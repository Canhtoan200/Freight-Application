import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Coordinate = [longitude: number, latitude: number];

type Order = {
  OrderID: number;
  order_name?: string;
  sender_name?: string;
  receiver_name?: string;
  sender_address?: string;
  receiver_address?: string;
  shipping_status?: string;
  shipping_position?: string;
  organization?: string;
  driver_name?: string;
  driver_license_plate?: string;
};

type Driver = {
  DriverIDs: number;
  driver_name?: string;
  driver_link?: string;
  driver_license_plate_number?: string;
  driver_phone_number?: string;
};

type RouteResult = {
  coordinates: Coordinate[];
  distanceText?: string;
  durationText?: string;
};

type TrackingStatus = 'Đã phân công' | 'Tài xế đang đến điểm lấy' | 'Đã đến điểm lấy';

type TrackingSession = {
  order: Order;
  driver: Driver;
  route: RouteResult;
  currentCoordinate: Coordinate;
  heading: number;
  status: TrackingStatus;
  progress: number;
  remainingDistanceMeters: number;
  etaSeconds: number;
};

type OrdersPanelProps = {
  loading: boolean;
  orders: Order[];
  drivers: Driver[];
  readOnly: boolean;
  selectedOrderID: number | null;
  top: number;
  onSelect: (order: Order) => void;
};

type DriverSelectPanelProps = {
  order: Order;
  drivers: Driver[];
  selectedDriver: Driver | null;
  dropdownOpen: boolean;
  geocoding: boolean;
  routing: boolean;
  assigning: boolean;
  route: RouteResult | null;
  onToggleDropdown: () => void;
  onSelectDriver: (driver: Driver) => void;
  onAssign: () => void;
  onClose: () => void;
};

type TrackingPanelProps = {
  session: TrackingSession;
  onClose: () => void;
};

type DriverMapManagementProps = {
  readOnly?: boolean;
};

const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';
const GOONG_API_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY ?? GOONG_MAPTILES_KEY;
const GOONG_STYLE_URL = GOONG_MAPTILES_KEY
  ? `https://tiles.goong.io/assets/goong_map_web.json?api_key=${GOONG_MAPTILES_KEY}`
  : '';
const GOONG_DIRECTION_URL = 'https://rsapi.goong.io/direction';
const ORDERS_BY_STATUS_URL =
  'https://freight-application-server.onrender.com/api/v1/orders/getAllOrderByStatus';
const DRIVERS_URL = 'https://freight-application-server.onrender.com/api/v1/drivers/getAllDrivers';
const ASSIGN_DRIVER_URL =
  'https://freight-application-server.onrender.com/api/v1/drivers/createDriverOrderDetail';
const ORDERS_STATUS = 'Đã tiếp nhận';
const ACTIVE_FLEET_STATUSES = new Set([
  ORDERS_STATUS,
  'Tài xế đang đi!',
  'Đã nhận hàng',
  'Đã tới ga',
]);
const DRIVER_START_ADDRESS = 'KDC Nam Thịnh, An Bình, Dĩ An, Bình Dương';
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css';

const decodePolyline = (encoded: string): Coordinate[] => {
  if (!encoded) return [];

  let index = 0;
  const coordinates: Coordinate[] = [];
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let byte = 0;
    let result = 0;
    let shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    latitude += deltaLat;

    result = 0;
    shift = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    longitude += deltaLng;

    coordinates.push([longitude / 1e5, latitude / 1e5]);
  }

  return coordinates;
};

const fetchGoongDirections = async (origin: Coordinate, destination: Coordinate): Promise<RouteResult> => {
  const apiKey = GOONG_API_KEY;
  if (!apiKey) {
    throw new Error('Thiếu API key Goong.');
  }

  // Goong nhận định dạng: latitude,longitude (vĩ độ, kinh độ)
  const originStr = `${origin[1]},${origin[0]}`;
  const destinationStr = `${destination[1]},${destination[0]}`;

  const params = new URLSearchParams({
    origin: originStr,
    destination: destinationStr,
    vehicle: 'car',
    api_key: apiKey,
  });
  const url = `${GOONG_DIRECTION_URL}?${params.toString()}`;

  const response = await fetch(url);
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Goong direction failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const route = data?.routes?.[0];
  if (!route) {
    throw new Error('Goong không trả về tuyến đường hợp lệ.');
  }

  // Lấy chuỗi polyline từ overview_polyline hoặc geometry
  const overviewPolyline = route.overview_polyline?.points || route.geometry;
  const decodedCoordinates = overviewPolyline ? decodePolyline(overviewPolyline) : [];

  const distanceMeters = typeof route.legs?.[0]?.distance?.value === 'number' 
    ? route.legs[0].distance.value 
    : route.distance || 0;
    
  const durationSeconds = typeof route.legs?.[0]?.duration?.value === 'number' 
    ? route.legs[0].duration.value 
    : route.duration || 0;

  if (decodedCoordinates.length < 2) {
    throw new Error('Goong không trả về hình học tuyến đường hợp lệ.');
  }

  return {
    coordinates: decodedCoordinates,
    distanceText: distanceMeters > 0 ? `${(distanceMeters / 1000).toFixed(1)} km` : undefined,
    durationText: durationSeconds > 0 ? `${Math.max(1, Math.round(durationSeconds / 60))} phút` : undefined,
  };
};

async function fetchOrdersByStatus(): Promise<Order[]> {
  const url = `${ORDERS_BY_STATUS_URL}?shipping_status=${encodeURIComponent(ORDERS_STATUS)}`;
  const response = await fetch(url);
  const payload = (await response.json()) as { data?: Order[]; message?: string };

  if (!response.ok) {
    throw new Error(payload.message || 'Không thể tải đơn hàng.');
  }
  if (!Array.isArray(payload.data)) {
    throw new Error('Máy chủ trả về danh sách đơn hàng không hợp lệ.');
  }

  return payload.data;
}

async function fetchFleetOrders(): Promise<Order[]> {
  const response = await fetch('https://freight-application-server.onrender.com/api/v1/orders/getAllOrders');
  const payload = (await response.json()) as { data?: Order[]; message?: string };
  if (!response.ok) throw new Error(payload.message || 'Không thể tải tổng quan đơn hàng.');
  if (!Array.isArray(payload.data)) throw new Error('Máy chủ trả về danh sách đơn hàng không hợp lệ.');
  return payload.data.filter((order) => ACTIVE_FLEET_STATUSES.has(order.shipping_status ?? ''));
}

async function fetchDrivers(): Promise<Driver[]> {
  const response = await fetch(DRIVERS_URL);
  const payload = (await response.json()) as { data?: Driver[]; message?: string };

  if (!response.ok) {
    throw new Error(payload.message || 'Không thể tải danh sách tài xế.');
  }
  if (!Array.isArray(payload.data)) {
    throw new Error('Máy chủ trả về danh sách tài xế không hợp lệ.');
  }

  return payload.data;
}

async function geocodeAddress(address: string): Promise<Coordinate> {
  if (!GOONG_API_KEY) {
    throw new Error('Thiếu API key Goong để xác định vị trí địa chỉ.');
  }

  const params = new URLSearchParams({
    address: `${address}, Việt Nam`,
    api_key: GOONG_API_KEY,
  });
  const response = await fetch(`https://rsapi.goong.io/Geocode?${params.toString()}`);
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.error_message || 'Không thể xác định tọa độ địa chỉ.');
  }

  const location = payload?.results?.[0]?.geometry?.location;
  if (typeof location?.lng !== 'number' || typeof location?.lat !== 'number') {
    throw new Error(`Không tìm thấy tọa độ cho địa chỉ: ${address}`);
  }

  return [location.lng, location.lat];
}

const loadMapLibre = async () => {
  if (typeof window === 'undefined') return null;
  const existing = (window as any).maplibregl;
  if (existing) return existing;

  const css = document.querySelector(`link[href="${MAPLIBRE_CSS}"]`) as HTMLLinkElement | null;
  if (!css) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = MAPLIBRE_CSS;
    document.head.appendChild(link);
  }

  return new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${MAPLIBRE_JS}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => {
        resolve((window as any).maplibregl);
      });
      existingScript.addEventListener('error', () => {
        reject(new Error('Không tải được thư viện MapLibre.'));
      });
      return;
    }

    const script = document.createElement('script');
    script.src = MAPLIBRE_JS;
    script.async = true;
    script.onload = () => {
      if ((window as any).maplibregl) {
        resolve((window as any).maplibregl);
      } else {
        reject(new Error('MapLibre không được định nghĩa sau khi nạp script.'));
      }
    };
    script.onerror = () => reject(new Error('Không tải được thư viện MapLibre.'));
    document.body.appendChild(script);
  });
};

export default function DriverMapManagement({ readOnly = false }: DriverMapManagementProps) {
  const insets = useSafeAreaInsets();
  const mapContainerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const truckMarkerRef = useRef<any>(null);
  const allDriverMarkersRef = useRef<any[]>([]);
  const trackingTimerRef = useRef<number | null>(null);
  const orderRequestRef = useRef(0);
  const driverRequestRef = useRef(0);
  const [loading, setLoading] = useState(true);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [routing, setRouting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [orderCoordinate, setOrderCoordinate] = useState<Coordinate | null>(null);
  const [driverCoordinate, setDriverCoordinate] = useState<Coordinate | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [trackingSession, setTrackingSession] = useState<TrackingSession | null>(null);

  const stopTrackingTimer = () => {
    if (trackingTimerRef.current !== null) {
      window.clearInterval(trackingTimerRef.current);
      trackingTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTrackingTimer();
  }, []);

  useEffect(() => {
    return () => {
      if (truckMarkerRef.current) {
        truckMarkerRef.current.remove();
        truckMarkerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let active = true;

    (readOnly ? fetchFleetOrders() : fetchOrdersByStatus())
      .then((orderList) => {
        if (!active) return;
        setOrders(orderList);
        if (!readOnly && orderList[0]) void handleSelectOrder(orderList[0]);
      })
      .catch((error: unknown) => {
        console.error('Không thể tải đơn hàng:', error);
        if (active) setErrorMessage('Không thể tải danh sách đơn hàng.');
      })
      .finally(() => {
        if (active) setOrdersLoading(false);
      });

    fetchDrivers()
      .then((driverList) => {
        if (active) setDrivers(driverList);
      })
      .catch((error: unknown) => {
        console.error('Không thể tải danh sách tài xế:', error);
        if (active) setErrorMessage('Không thể tải danh sách tài xế.');
      });

    return () => {
      active = false;
      orderRequestRef.current += 1;
      driverRequestRef.current += 1;
    };
  }, [readOnly]);

  useEffect(() => {
    if (!readOnly) return;
    let active = true;

    geocodeAddress(DRIVER_START_ADDRESS)
      .then((coordinate) => {
        if (!active) return;
        setDriverCoordinate(coordinate);
        mapRef.current?.easeTo({ center: coordinate, zoom: 12, duration: 700 });
      })
      .catch((error: unknown) => {
        console.error('Không thể xác định vị trí đội xe:', error);
        if (active) setErrorMessage('Không thể xác định vị trí đội xe.');
      });

    return () => {
      active = false;
    };
  }, [readOnly]);

  useEffect(() => {
    let map: any;
    let mounted = true;

    if (!GOONG_STYLE_URL) {
      setLoading(false);
      return;
    }

    const init = async () => {
      if (!mapContainerRef.current) return;

      try {
        const maplibregl = await loadMapLibre();
        if (!mounted || !mapContainerRef.current) return;
        if (!maplibregl || !maplibregl.Map) {
          throw new Error('MapLibre không hợp lệ.');
        }

        map = new maplibregl.Map({
          container: mapContainerRef.current,
          style: GOONG_STYLE_URL,
          center: [106.7009, 10.7769],
          zoom: 12,
        });

        mapRef.current = map;

        map.on('error', (event: any) => {
          console.error('MapLibre error:', event);
          if (mounted) setErrorMessage('Lỗi khi tải dữ liệu bản đồ.');
        });

        map.addControl(new maplibregl.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

        const loadTimeout = window.setTimeout(() => {
          if (mounted) setLoading(false);
        }, 5000);

        map.on('load', () => {
          if (mounted) {
            setLoading(false);
            setMapReady(true);
          }
          window.clearTimeout(loadTimeout);
        });
      } catch (error: any) {
        console.error(error);
        if (mounted) {
          setErrorMessage(error.message || 'Không thể khởi tạo bản đồ web.');
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (map) map.remove();
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map || drivers.length === 0) {
      allDriverMarkersRef.current.forEach((marker) => marker.remove());
      allDriverMarkersRef.current = [];
      return;
    }

    let active = true;
    allDriverMarkersRef.current.forEach((marker) => marker.remove());
    allDriverMarkersRef.current = [];

    const loadDriverMarkers = async () => {
      const coordinatesByAddress = new Map<string, Coordinate>();
      const fallbackCoordinate = await geocodeAddress(DRIVER_START_ADDRESS);
      coordinatesByAddress.set(DRIVER_START_ADDRESS, fallbackCoordinate);

      const locatedDrivers = await Promise.all(drivers.map(async (driver) => {
        const address = driver.driver_link?.trim() || DRIVER_START_ADDRESS;
        try {
          let coordinate = coordinatesByAddress.get(address);
          if (!coordinate) {
            coordinate = await geocodeAddress(address);
            coordinatesByAddress.set(address, coordinate);
          }
          return { driver, coordinate, isFallback: !driver.driver_link?.trim() };
        } catch (error) {
          console.warn(`Không thể xác định vị trí tài xế #${driver.DriverIDs}; dùng vị trí mô phỏng mặc định.`, error);
          return { driver, coordinate: fallbackCoordinate, isFallback: true };
        }
      }));

      if (!active) return;

      const groups = new Map<string, typeof locatedDrivers>();
      const unselectedDrivers = locatedDrivers.filter(
        ({ driver }) => driver.DriverIDs !== selectedDriver?.DriverIDs,
      );
      for (const locatedDriver of unselectedDrivers) {
        const key = locatedDriver.coordinate.map((value) => value.toFixed(5)).join(',');
        const group = groups.get(key) ?? [];
        group.push(locatedDriver);
        groups.set(key, group);
      }

      const maplibregl = (window as any).maplibregl;
      for (const group of groups.values()) {
        const markerElement = document.createElement('div');
        markerElement.style.display = 'flex';
        markerElement.style.alignItems = 'center';
        markerElement.style.justifyContent = 'center';
        markerElement.style.width = '34px';
        markerElement.style.height = '34px';
        markerElement.style.borderRadius = '50%';
        markerElement.style.background = '#16a34a';
        markerElement.style.border = '2px solid #ffffff';
        markerElement.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.3)';

        const icon = document.createElement('span');
        icon.textContent = '🚚';
        icon.style.fontSize = '19px';
        markerElement.appendChild(icon);

        const popupContent = document.createElement('div');
        popupContent.style.minWidth = '190px';
        popupContent.style.maxWidth = '260px';
        for (const { driver, isFallback } of group) {
          const card = document.createElement('div');
          card.style.padding = '6px 0';
          card.style.borderBottom = '1px solid #e2e8f0';

          const name = document.createElement('strong');
          name.textContent = driver.driver_name || `Tài xế #${driver.DriverIDs}`;
          card.appendChild(name);

          const details = [
            ['Biển số', driver.driver_license_plate_number || 'Chưa có'],
            ['Điện thoại', driver.driver_phone_number || 'Chưa có'],
            ['Địa chỉ', driver.driver_link || 'Chưa có'],
            ...(isFallback ? [['Vị trí', 'Vị trí mô phỏng mặc định']] : []),
          ];
          for (const [label, value] of details) {
            const detail = document.createElement('div');
            detail.textContent = `${label}: ${value}`;
            detail.style.marginTop = '3px';
            detail.style.fontSize = '12px';
            card.appendChild(detail);
          }
          popupContent.appendChild(card);
        }

        const marker = new maplibregl.Marker({ element: markerElement, anchor: 'bottom' })
          .setLngLat(group[0].coordinate)
          .setPopup(new maplibregl.Popup({ offset: 18 }).setDOMContent(popupContent))
          .addTo(map);
        allDriverMarkersRef.current.push(marker);
      }
      const coordinates = locatedDrivers.map(({ coordinate }) => coordinate);
      if (coordinates.length === 1) {
        map.easeTo({ center: coordinates[0], zoom: 12, duration: 700 });
      } else if (coordinates.length > 1) {
        const longitudes = coordinates.map(([longitude]) => longitude);
        const latitudes = coordinates.map(([, latitude]) => latitude);
        map.fitBounds(
          [
            [Math.min(...longitudes), Math.min(...latitudes)],
            [Math.max(...longitudes), Math.max(...latitudes)],
          ],
          { padding: 80, maxZoom: 12, duration: 700 },
        );
      }
    };

    void loadDriverMarkers().catch((error) => {
      console.error('Không thể hiển thị vị trí tài xế trên bản đồ:', error);
      if (active) setErrorMessage('Không thể tải vị trí tài xế trên bản đồ.');
    });

    return () => {
      active = false;
      allDriverMarkersRef.current.forEach((marker) => marker.remove());
      allDriverMarkersRef.current = [];
    };
  }, [drivers, mapReady, selectedDriver]);

  const handleSelectOrder = async (order: Order) => {
    const requestID = ++orderRequestRef.current;
    driverRequestRef.current += 1;
    setSelectedOrder(order);
    setSelectedDriver(null);
    setOrderCoordinate(null);
    setDriverCoordinate(null);
    setRoute(null);
    setDropdownOpen(false);
    setTrackingSession(null);
    setErrorMessage('');

    if (!order.sender_address?.trim()) {
      setErrorMessage(`Đơn hàng #${order.OrderID} chưa có địa chỉ người gửi.`);
      return;
    }

    setGeocoding(true);
    try {
      const coordinate = await geocodeAddress(order.sender_address);
      if (requestID !== orderRequestRef.current) return;

      setOrderCoordinate(coordinate);
      mapRef.current?.easeTo({ center: coordinate, zoom: 15, duration: 700 });
    } catch (error: unknown) {
      console.error('Không thể xác định vị trí người gửi:', error);
      if (requestID === orderRequestRef.current) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Không thể xác định vị trí người gửi.',
        );
      }
    } finally {
      if (requestID === orderRequestRef.current) setGeocoding(false);
    }
  };

  const handleSelectDriver = async (driver: Driver) => {
    const requestID = ++driverRequestRef.current;
    setSelectedDriver(driver);
    setDriverCoordinate(null);
    setRoute(null);
    setDropdownOpen(false);
    setTrackingSession(null);
    setErrorMessage('');

    if (!selectedOrder?.sender_address?.trim()) {
      setErrorMessage('Đơn hàng chưa có địa chỉ người gửi để tạo tuyến đường.');
      return;
    }

    try {
      setGeocoding(true);
      setRouting(false);
      const [driverLocation, destination] = await Promise.all([
        geocodeAddress(DRIVER_START_ADDRESS),
        orderCoordinate
          ? Promise.resolve(orderCoordinate)
          : geocodeAddress(selectedOrder.sender_address),
      ]);
      if (requestID !== driverRequestRef.current) return;
      setDriverCoordinate(driverLocation);
      setOrderCoordinate(destination);

      setGeocoding(false);
      setRouting(true);
      const nextRoute = await fetchGoongDirections(driverLocation, destination);
      if (requestID !== driverRequestRef.current) return;
      setRoute(nextRoute);
      const longitudes = nextRoute.coordinates.map(([longitude]) => longitude);
      const latitudes = nextRoute.coordinates.map(([, latitude]) => latitude);
      mapRef.current?.fitBounds(
        [
          [Math.min(...longitudes), Math.min(...latitudes)],
          [Math.max(...longitudes), Math.max(...latitudes)],
        ],
        { padding: 80, duration: 700 },
      );
    } catch (error: unknown) {
      console.error('Không thể tạo tuyến đường đến người gửi:', error);
      if (requestID === driverRequestRef.current) {
        setErrorMessage(
          error instanceof Error ? error.message : 'Không thể tải tuyến đường Goong.',
        );
      }
    } finally {
      if (requestID === driverRequestRef.current) {
        setGeocoding(false);
        setRouting(false);
      }
    }
  };

  const syncMapMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

    const activeRoute = trackingSession?.route ?? route;
    const routeCoordinates = activeRoute?.coordinates ?? [];
    const destination =
      orderCoordinate ?? routeCoordinates[routeCoordinates.length - 1] ?? null;
    const driverPoint =
      trackingSession?.currentCoordinate ??
      driverCoordinate ??
      routeCoordinates[0] ??
      null;

    if (driverPoint && !truckMarkerRef.current && typeof document !== 'undefined') {
      const truckElement = document.createElement('div');
      truckElement.style.width = '26px';
      truckElement.style.height = '26px';
      truckElement.style.display = 'flex';
      truckElement.style.alignItems = 'center';
      truckElement.style.justifyContent = 'center';
      truckElement.style.borderRadius = '50%';
      truckElement.style.background = '#1d4ed8';
      truckElement.style.border = '2px solid #ffffff';
      truckElement.style.boxShadow = '0 6px 18px rgba(29,78,216,0.3)';
      truckElement.style.fontSize = '16px';
      truckElement.style.transform = 'scale(1.1)';
      truckElement.textContent = '🚚';

      truckMarkerRef.current = new (window as any).maplibregl.Marker({
        element: truckElement,
        anchor: 'center',
      })
        .setLngLat(driverPoint)
        .addTo(map);
    } else if (!driverPoint && truckMarkerRef.current) {
      truckMarkerRef.current.remove();
      truckMarkerRef.current = null;
    }

    const routeGeoJson = {
      type: 'FeatureCollection',
      features: routeCoordinates.length > 1
        ? [{
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: routeCoordinates },
            properties: {},
          }]
        : [],
    };
    const destinationGeoJson = {
      type: 'FeatureCollection',
      features: destination
        ? [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: destination },
            properties: {},
          }]
        : [],
    };
    const driverGeoJson = {
      type: 'FeatureCollection',
      features: driverPoint
        ? [{
            type: 'Feature',
            geometry: { type: 'Point', coordinates: driverPoint },
            properties: {},
          }]
        : [],
    };

    const ensureSourceAndLayer = (sourceId: string, layerId: string, data: any, color: string) => {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, { type: 'geojson', data });
      }
      if (!map.getLayer(layerId)) {
        map.addLayer(sourceId === 'route-line'
          ? {
              id: layerId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': '#2563eb',
                'line-width': 5,
                'line-opacity': 0.9,
              },
            }
          : {
              id: layerId,
              type: 'circle',
              source: sourceId,
              paint: {
                'circle-radius': sourceId === 'driver-marker' ? 9 : 10,
                'circle-color': color,
                'circle-stroke-color': '#ffffff',
                'circle-stroke-width': 2,
              },
            });
      }
      const source = map.getSource(sourceId);
      if (source && typeof source.setData === 'function') source.setData(data);
    };

    ensureSourceAndLayer('route-line', 'route-line-layer', routeGeoJson, '#2563eb');
    ensureSourceAndLayer('destination-marker', 'destination-marker-layer', destinationGeoJson, '#dc2626');
    ensureSourceAndLayer('driver-marker', 'driver-marker-layer', driverGeoJson, '#2563eb');

    if (truckMarkerRef.current && driverPoint) {
      truckMarkerRef.current.setLngLat(driverPoint);
      if (trackingSession?.heading !== undefined) {
        truckMarkerRef.current.setRotation(trackingSession.heading);
      }
    }

    if (trackingSession && driverPoint) {
      map.easeTo({
        center: driverPoint,
        zoom: Math.max(map.getZoom(), 15),
        duration: 500,
      });
    }
  }, [driverCoordinate, orderCoordinate, route, trackingSession]);

  useEffect(() => {
    syncMapMarkers();
  }, [mapReady, syncMapMarkers]);

  const handleAssign = async () => {
    if (readOnly || !selectedOrder || !selectedDriver || !route || assigning) return;
    setAssigning(true);
    setErrorMessage('');

    try {
      const response = await fetch(ASSIGN_DRIVER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          DriverIDs: selectedDriver.DriverIDs,
          OrderIDs: [selectedOrder.OrderID],
        }),
      });
      const payload = (await response.json()) as { message?: string; affectedRows?: number };
      if (!response.ok || payload.message === 'Lỗi server' || payload.affectedRows !== 1) {
        throw new Error(payload.message || 'Không thể phân công tài xế.');
      }

      setOrders((currentOrders) =>
        currentOrders.filter((item) => item.OrderID !== selectedOrder.OrderID),
      );
      stopTrackingTimer();
      setTrackingSession(null);
      closeSelection();
    } catch (error: unknown) {
      console.error('Không thể phân công tài xế:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Không thể phân công tài xế.');
    } finally {
      setAssigning(false);
    }
  };

  const closeSelection = () => {
    orderRequestRef.current += 1;
    driverRequestRef.current += 1;
    setSelectedOrder(null);
    setSelectedDriver(null);
    setOrderCoordinate(null);
    setDriverCoordinate(null);
    setRoute(null);
    setGeocoding(false);
    setRouting(false);
    setDropdownOpen(false);
  };

  const handleFinishTracking = () => {
    stopTrackingTimer();
    setTrackingSession(null);
    closeSelection();
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapCard}>
        <View ref={mapContainerRef} style={styles.map} />

        {!trackingSession && (
          <OrdersPanel
            loading={ordersLoading}
            orders={orders}
            drivers={drivers}
            readOnly={readOnly}
            selectedOrderID={selectedOrder?.OrderID ?? null}
            top={Math.max(insets.top + 8, 16)}
            onSelect={handleSelectOrder}
          />
        )}

        {selectedOrder && !trackingSession && !readOnly && (
          <DriverSelectPanel
            order={selectedOrder}
            drivers={drivers}
            selectedDriver={selectedDriver}
            dropdownOpen={dropdownOpen}
            geocoding={geocoding}
            routing={routing}
            assigning={assigning}
            route={route}
            onToggleDropdown={() => setDropdownOpen((open) => !open)}
            onSelectDriver={handleSelectDriver}
            onAssign={handleAssign}
            onClose={closeSelection}
          />
        )}

        {trackingSession && (
          <TrackingPanel
            session={trackingSession}
            onClose={handleFinishTracking}
          />
        )}

        {loading && (
          <View style={styles.overlayPanel}>
            <Text style={styles.title}>Đang tải bản đồ...</Text>
            <Text style={styles.text}>Vui lòng đợi trong giây lát.</Text>
          </View>
        )}

        {errorMessage ? (
          <View style={styles.overlayPanel}>
            <Text style={styles.title}>Không thể tải dữ liệu</Text>
            <Text style={styles.text}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function OrdersPanel({
  loading,
  orders,
  drivers,
  readOnly,
  selectedOrderID,
  top,
  onSelect,
}: OrdersPanelProps) {
  return (
    <View style={[styles.ordersPanel, { top }]}>
      <View style={styles.panelTitleRow}>
        <Text style={styles.panelTitle}>
          {readOnly ? 'Tổng quan đơn hàng & đội xe' : 'Đơn hàng chờ phân công'}
        </Text>
      </View>
      {loading ? (
        <View style={styles.inlineLoading}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.mutedText}>Đang tải...</Text>
        </View>
      ) : orders.length === 0 ? (
        <Text style={styles.emptyText}>Chưa có đơn hàng</Text>
      ) : (
        <ScrollView style={styles.ordersScroll} nestedScrollEnabled>
          {orders.map((order) => {
            const selected = order.OrderID === selectedOrderID;
            return (
              <TouchableOpacity
                key={order.OrderID}
                style={[styles.orderRow, selected && styles.selectedRow]}
                onPress={() => { if (!readOnly) onSelect(order); }}
                disabled={readOnly}
              >
                <Text style={[styles.orderTitle, selected && styles.selectedRowText]}>
                  #{order.OrderID} · {order.organization || order.sender_name || 'Khách hàng'}
                </Text>
                <Text style={styles.orderAddress} numberOfLines={1}>
                  {order.sender_address || 'Chưa có địa chỉ'}
                </Text>
                {readOnly && (
                  <Text style={styles.orderAddress}>
                    {order.shipping_status || 'Chưa có trạng thái'}
                    {order.driver_name ? ` · ${order.driver_name}` : ''}
                  </Text>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
      {readOnly && (
        <>
          <Text style={styles.panelTitle}>Tài xế · vị trí mô phỏng KDC Nam Thịnh</Text>
          <ScrollView style={styles.ordersScroll} nestedScrollEnabled>
            {drivers.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có tài xế</Text>
            ) : (
              drivers.map((driver) => (
                <Text key={driver.DriverIDs} style={styles.orderAddress}>
                  {driver.driver_name || `Tài xế #${driver.DriverIDs}`} ·{' '}
                  {driver.driver_license_plate_number || 'Chưa có biển số'}
                </Text>
              ))
            )}
          </ScrollView>
        </>
      )}
    </View>
  );
}

function DriverSelectPanel({
  order,
  drivers,
  selectedDriver,
  dropdownOpen,
  geocoding,
  routing,
  assigning,
  route,
  onToggleDropdown,
  onSelectDriver,
  onAssign,
  onClose,
}: DriverSelectPanelProps) {
  return (
    <View style={styles.selectionPanel}>
      <View style={styles.selectionHeader}>
        <View style={styles.flexOne}>
          <Text style={styles.selectionEyebrow}>ĐƠN HÀNG #{order.OrderID}</Text>
          <Text style={styles.selectionTitle} numberOfLines={1}>
            {order.organization || order.sender_name || 'Khách hàng'}
          </Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      <Text style={styles.fieldLabel}>Chọn tài xế</Text>
      <TouchableOpacity style={styles.selectControl} onPress={onToggleDropdown}>
        <View style={styles.flexOne}>
          <Text style={selectedDriver ? styles.selectValue : styles.selectPlaceholder}>
            {selectedDriver?.driver_name || 'Chọn tài xế phù hợp'}
          </Text>
          {!!selectedDriver && <Text style={styles.selectMeta}>{selectedDriver.driver_license_plate_number || 'Chưa có biển số'}</Text>}
        </View>
        <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={20} color="#64748b" />
      </TouchableOpacity>

      {dropdownOpen && (
        <View style={styles.dropdown}>
          <ScrollView style={styles.dropdownScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {drivers.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có tài xế</Text>
            ) : (
              drivers.map((driver) => (
                <TouchableOpacity
                  key={driver.DriverIDs}
                  style={styles.driverOption}
                  onPress={() => onSelectDriver(driver)}
                >
                  <View style={styles.driverOptionIcon}>
                    <Ionicons name="car-sport" size={17} color="#2563eb" />
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.driverOptionName}>{driver.driver_name || 'Tài xế'}</Text>
                    <Text style={styles.driverOptionMeta} numberOfLines={1}>
                      {driver.driver_license_plate_number || 'Chưa có biển số'} · {driver.driver_link || 'Chưa có địa chỉ'}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}

      <View style={styles.routeStatus}>
        {geocoding || routing ? (
          <>
            <ActivityIndicator size="small" color="#2563eb" />
            <Text style={styles.routeStatusText}>
              {geocoding ? 'Đang xác định tọa độ...' : 'Đang tạo tuyến đường...'}
            </Text>
          </>
        ) : route ? (
          <>
            <Ionicons name="navigate" size={18} color="#16a34a" />
            <Text style={styles.routeStatusText}>
              Tuyến đường sẵn sàng{route.distanceText ? ` · ${route.distanceText}` : ''}
              {route.durationText ? ` · ${route.durationText}` : ''}
            </Text>
          </>
        ) : (
          <>
            <Ionicons name="information-circle-outline" size={18} color="#64748b" />
            <Text style={styles.routeStatusText}>Chọn tài xế để hiển thị marker và tuyến đường</Text>
          </>
        )}
      </View>

      <TouchableOpacity
        style={[styles.assignButton, (!selectedDriver || !route || assigning) && styles.disabledButton]}
        onPress={onAssign}
        disabled={!selectedDriver || !route || assigning}
      >
        {assigning ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#ffffff" />
            <Text style={styles.assignButtonText}>Xác nhận phân công</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

function TrackingPanel({ session, onClose }: TrackingPanelProps) {
  const completed = session.status === 'Đã đến điểm lấy';
  const progressPercent = Math.round(session.progress * 100);
  const progressWidth = `${progressPercent}%` as `${number}%`;

  return (
    <View style={styles.selectionPanel}>
      <View style={styles.selectionHeader}>
        <View style={styles.flexOne}>
          <Text style={styles.selectionEyebrow}>THEO DÕI ĐƠN HÀNG #{session.order.OrderID}</Text>
          <Text style={styles.selectionTitle} numberOfLines={1}>
            {session.driver.driver_name || 'Tài xế'}
          </Text>
          <Text style={styles.trackingPlate}>{session.driver.driver_license_plate_number || 'Chưa có biển số'}</Text>
        </View>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Ionicons name="close" size={22} color="#64748b" />
        </TouchableOpacity>
      </View>

      <View style={[styles.trackingStatusBadge, completed && styles.trackingCompleteBadge]}>
        <Ionicons name={completed ? 'checkmark-circle' : 'navigate'} size={18} color={completed ? '#15803d' : '#1d4ed8'} />
        <Text style={[styles.trackingStatusText, completed && styles.trackingCompleteText]}>{session.status}</Text>
      </View>

      <View style={styles.trackingRouteRow}>
        <View style={styles.trackingPoint}>
          <Ionicons name="car-sport" size={16} color="#ffffff" />
        </View>
        <View style={styles.trackingRouteLine} />
        <Ionicons name="location" size={25} color="#dc2626" />
        <View style={styles.flexOne}>
          <Text style={styles.trackingDestinationLabel}>Điểm lấy hàng</Text>
          <Text style={styles.trackingDestination} numberOfLines={1}>
            {session.order.sender_address || 'Chưa có địa chỉ'}
          </Text>
        </View>
      </View>

      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>Tiến độ mô phỏng</Text>
        <Text style={styles.progressValue}>{progressPercent}%</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: progressWidth }]} />
      </View>

      <View style={styles.trackingMetrics}>
        <TrackingMetric label="Còn lại" value={formatDistance(session.remainingDistanceMeters)} />
        <View style={styles.metricDivider} />
        <TrackingMetric label="ETA mô phỏng" value={formatEta(session.etaSeconds)} />
        <View style={styles.metricDivider} />
        <TrackingMetric label="Tiến độ" value={`${progressPercent}%`} />
      </View>

      {completed ? (
        <TouchableOpacity style={styles.finishButton} onPress={onClose}>
          <Ionicons name="flag" size={19} color="#ffffff" />
          <Text style={styles.assignButtonText}>Kết thúc xem trước</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.autoTrackingHint}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.autoTrackingText}>Marker tài xế đang tự động di chuyển theo tuyến</Text>
        </View>
      )}
    </View>
  );
}

function TrackingMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricItem}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters >= 1000) return `${(distanceMeters / 1000).toFixed(1)} km`;
  return `${Math.max(0, Math.round(distanceMeters))} m`;
}

function formatEta(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  if (safeSeconds < 60) return `${safeSeconds}s`;
  return `${Math.floor(safeSeconds / 60)}m ${safeSeconds % 60}s`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef6ff',
    padding: 16,
  },
  mapCard: {
    position: 'relative',
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  map: {
    flex: 1,
    minHeight: 320,
    width: '100%',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 2,
  },
  text: {
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
  },
  overlayPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  flexOne: { flex: 1 },
  ordersPanel: {
    position: 'absolute',
    right: 14,
    width: 230,
    maxHeight: 230,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.96)',
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
  },
  panelTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 },
  panelTitle: { flex: 1, fontSize: 14, fontWeight: '700', color: '#0f172a' },
  ordersScroll: { maxHeight: 180 },
  orderRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  selectedRow: { backgroundColor: '#eff6ff', marginHorizontal: -6, paddingHorizontal: 6 },
  orderTitle: { fontSize: 12, fontWeight: '600', color: '#334155' },
  selectedRowText: { color: '#1d4ed8' },
  orderAddress: { marginTop: 2, fontSize: 10, color: '#94a3b8' },
  mutedText: { fontSize: 12, color: '#64748b' },
  emptyText: { paddingVertical: 10, textAlign: 'center', fontSize: 12, color: '#94a3b8' },
  inlineLoading: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8 },
  selectionPanel: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 26,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#ffffff',
    elevation: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
  },
  selectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  selectionEyebrow: { fontSize: 10, fontWeight: '700', color: '#2563eb', letterSpacing: 0.7 },
  selectionTitle: { marginTop: 2, fontSize: 17, fontWeight: '700', color: '#0f172a' },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
  },
  fieldLabel: { marginBottom: 6, fontSize: 12, fontWeight: '700', color: '#334155' },
  selectControl: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  selectPlaceholder: { fontSize: 14, color: '#94a3b8' },
  selectValue: { fontSize: 14, fontWeight: '700', color: '#0f172a' },
  selectMeta: { marginTop: 2, fontSize: 11, color: '#64748b' },
  dropdown: {
    marginTop: 6,
    maxHeight: 170,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  dropdownScroll: { maxHeight: 170 },
  driverOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  driverOptionIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#eff6ff',
  },
  driverOptionName: { fontSize: 13, fontWeight: '700', color: '#1e293b' },
  driverOptionMeta: { marginTop: 2, fontSize: 10, color: '#64748b' },
  routeStatus: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingHorizontal: 10,
    borderRadius: 9,
    backgroundColor: '#f8fafc',
  },
  routeStatusText: { flex: 1, fontSize: 11, color: '#475569' },
  trackingPlate: { marginTop: 2, fontSize: 11, color: '#64748b' },
  trackingStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 7,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#dbeafe',
  },
  trackingCompleteBadge: { backgroundColor: '#dcfce7' },
  trackingStatusText: { fontSize: 12, fontWeight: '700', color: '#1d4ed8' },
  trackingCompleteText: { color: '#15803d' },
  trackingRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 13,
    paddingVertical: 9,
  },
  trackingPoint: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
  },
  trackingRouteLine: { width: 28, height: 3, marginHorizontal: 5, backgroundColor: '#93c5fd' },
  trackingDestinationLabel: { fontSize: 10, fontWeight: '700', color: '#64748b' },
  trackingDestination: { marginTop: 2, fontSize: 11, color: '#1e293b' },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  progressLabel: { fontSize: 11, fontWeight: '600', color: '#475569' },
  progressValue: { fontSize: 12, fontWeight: '800', color: '#2563eb' },
  progressTrack: {
    height: 8,
    marginTop: 6,
    overflow: 'hidden',
    borderRadius: 4,
    backgroundColor: '#e2e8f0',
  },
  progressFill: { height: '100%', borderRadius: 4, backgroundColor: '#2563eb' },
  trackingMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 13,
    paddingVertical: 10,
    borderRadius: 11,
    backgroundColor: '#f8fafc',
  },
  metricItem: { flex: 1, alignItems: 'center' },
  metricValue: { fontSize: 13, fontWeight: '800', color: '#0f172a' },
  metricLabel: { marginTop: 2, fontSize: 9, color: '#64748b' },
  metricDivider: { width: 1, height: 28, backgroundColor: '#e2e8f0' },
  autoTrackingHint: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 11,
    borderRadius: 11,
    backgroundColor: '#eff6ff',
  },
  autoTrackingText: { fontSize: 11, fontWeight: '600', color: '#1d4ed8' },
  finishButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 11,
    borderRadius: 12,
    backgroundColor: '#16a34a',
  },
  assignButton: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: '#2563eb',
  },
  disabledButton: { backgroundColor: '#94a3b8' },
  assignButtonText: { fontSize: 14, fontWeight: '700', color: '#ffffff' },
});
