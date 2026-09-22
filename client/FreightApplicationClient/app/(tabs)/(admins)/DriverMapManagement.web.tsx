import Ionicons from '@expo/vector-icons/Ionicons';
import React, { useEffect, useRef, useState } from 'react';
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

const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';
const GOONG_API_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY ?? GOONG_MAPTILES_KEY;
const GOONG_STYLE_URL = GOONG_MAPTILES_KEY
  ? `https://tiles.goong.io/assets/goong_map_web.json?api_key=${GOONG_MAPTILES_KEY}`
  : '';
const GOONG_DIRECTION_URL = 'https://rsapi.goong.io/direction';
const ROUTE_START_COORDINATE: Coordinate = [106.7009, 10.7769];
const ROUTE_END_COORDINATE: Coordinate = [106.6945, 10.7866];
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css';

const MOCK_ORDERS: Order[] = [
  {
    OrderID: 9001,
    order_name: 'Giao linh kiện điện tử',
    sender_name: 'Kho trung tâm Quận 1',
    receiver_name: 'Cửa hàng Thủ Đức',
    sender_address: '72 Lê Thánh Tôn, Bến Nghé, Quận 1, Thành phố Hồ Chí Minh',
    receiver_address: '1 Võ Văn Ngân, Linh Chiểu, Thủ Đức, Thành phố Hồ Chí Minh',
    shipping_status: 'Đã tiếp nhận',
    shipping_position: 'Kho Quận 1',
    organization: 'Freight Demo Quận 1',
  },
  {
    OrderID: 9002,
    order_name: 'Giao hàng tiêu dùng',
    sender_name: 'Kho Thủ Đức',
    receiver_name: 'Điểm nhận Dĩ An',
    sender_address: '1 Võ Văn Ngân, Linh Chiểu, Thủ Đức, Thành phố Hồ Chí Minh',
    receiver_address: 'An Bình, Dĩ An, Bình Dương',
    shipping_status: 'Đã tiếp nhận',
    shipping_position: 'Kho Thủ Đức',
    organization: 'Freight Demo Thủ Đức',
  },
];

const MOCK_DRIVERS: Driver[] = [
  {
    DriverIDs: 1,
    driver_name: 'Trần Văn Sơn',
    driver_link: 'KDC Nam Thịnh, An Bình, Dĩ An, Bình Dương',
    driver_license_plate_number: '50H 19249',
    driver_phone_number: '0981391557',
  },
  {
    DriverIDs: 2,
    driver_name: 'Nguyễn Minh Hải',
    driver_link: '268 Lý Thường Kiệt, Phường 14, Quận 10, Thành phố Hồ Chí Minh',
    driver_license_plate_number: '51D 67890',
    driver_phone_number: '0909000002',
  },
];

const MOCK_ROUTE: RouteResult = {
  coordinates: [
    [106.7009, 10.7769],
    [106.7005, 10.7789],
    [106.6992, 10.7811],
    [106.6945, 10.7866],
  ],
  distanceText: '4.2 km',
  durationText: '12 phút',
};

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

  const url = `${GOONG_DIRECTION_URL}?origin=${originStr}&destination=${destinationStr}&vehicle=car&api_key=${apiKey}`;

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

  return {
    coordinates: decodedCoordinates.length > 0 ? decodedCoordinates : [origin, destination],
    distanceText: distanceMeters > 0 ? `${(distanceMeters / 1000).toFixed(1)} km` : undefined,
    durationText: durationSeconds > 0 ? `${Math.max(1, Math.round(durationSeconds / 60))} phút` : undefined,
  };
};

const getHeading = (from: Coordinate, to: Coordinate) => {
  const deltaLng = to[0] - from[0];
  const deltaLat = to[1] - from[1];
  return (Math.atan2(deltaLng, deltaLat) * 180) / Math.PI;
};

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

export default function DriverMapManagement() {
  const insets = useSafeAreaInsets();
  const mapContainerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const truckMarkerRef = useRef<any>(null);
  const trackingTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);
  const [drivers, setDrivers] = useState<Driver[]>(MOCK_DRIVERS);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(MOCK_ORDERS[0]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(MOCK_DRIVERS[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [route, setRoute] = useState<RouteResult | null>(MOCK_ROUTE);
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

        new maplibregl.Marker({ color: '#2563eb' })
          .setLngLat([106.7009, 10.7769])
          .addTo(map);

        const loadTimeout = window.setTimeout(() => {
          if (mounted) setLoading(false);
        }, 5000);

        map.on('load', () => {
          if (mounted) {
            setErrorMessage('');
            setLoading(false);
          }
          syncMapMarkers();
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

  const handleSelectOrder = (order: Order) => {
    setSelectedOrder(order);
    setSelectedDriver(null);
    setRoute(null);
    setDropdownOpen(false);
    setTrackingSession(null);
  };

  const handleSelectDriver = async (driver: Driver) => {
    setSelectedDriver(driver);
    setDropdownOpen(false);
    setTrackingSession(null);
    setErrorMessage('');

    try {
      setRoute(null);
      const nextRoute = await fetchGoongDirections(ROUTE_START_COORDINATE, ROUTE_END_COORDINATE);
      setRoute(nextRoute);
    } catch (error: any) {
      console.error(error);
      setRoute(MOCK_ROUTE);
      setErrorMessage(error.message || 'Không thể tải tuyến đường Goong.');
    }
  };

  const syncMapMarkers = () => {
  const map = mapRef.current;
  if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

  const activeRoute = trackingSession?.route ?? route;
  const routeCoordinates =
    activeRoute?.coordinates && activeRoute.coordinates.length > 0
      ? activeRoute.coordinates
      : MOCK_ROUTE.coordinates;

  // Lấy tọa độ an toàn
  const destination = routeCoordinates[routeCoordinates.length - 1] ?? ROUTE_END_COORDINATE;
  const driverPoint = trackingSession?.currentCoordinate ?? routeCoordinates[0] ?? ROUTE_START_COORDINATE;

  // Khởi tạo Marker chiếc xe an toàn
  if (!truckMarkerRef.current && typeof document !== 'undefined') {
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
      .setLngLat(driverPoint) // Gán vị trí trước khi add vào Map
      .addTo(map);
  }

  const routeGeoJson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: routeCoordinates },
      properties: {},
    }],
  };

  const destinationGeoJson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: destination },
      properties: { color: '#dc2626' },
    }],
  };

  const driverGeoJson = {
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: { type: 'Point', coordinates: driverPoint },
      properties: { color: '#2563eb' },
    }],
  };

  const ensureSourceAndLayer = (sourceId: string, layerId: string, data: any, color: string) => {
    if (!map.getSource(sourceId)) {
      map.addSource(sourceId, { type: 'geojson', data });
    }
    if (!map.getLayer(layerId)) {
      map.addLayer({
        id: layerId,
        type: 'line',
        source: sourceId,
        paint: {
          'line-color': '#2563eb',
          'line-width': 5,
          'line-opacity': 0.9,
        },
      });
    }
    const source = map.getSource(sourceId);
    if (source && typeof source.setData === 'function') {
      source.setData(data);
    }

    if (sourceId === 'destination-marker' || sourceId === 'driver-marker') {
      if (!map.getLayer(`${layerId}-circle`)) {
        map.addLayer({
          id: `${layerId}-circle`,
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
    }
  };

  ensureSourceAndLayer('route-line', 'route-line-layer', routeGeoJson, '#2563eb');
  ensureSourceAndLayer('destination-marker', 'destination-marker-layer', destinationGeoJson, '#dc2626');
  ensureSourceAndLayer('driver-marker', 'driver-marker-layer', driverGeoJson, '#2563eb');

  if (truckMarkerRef.current) {
    const marker = truckMarkerRef.current;
    marker.setLngLat(driverPoint);
    if (trackingSession && trackingSession.heading !== undefined) {
      marker.setRotation(trackingSession.heading);
    }
  }

  if (trackingSession && driverPoint) {
    map.easeTo({
      center: driverPoint,
      zoom: Math.max(map.getZoom(), 15),
      duration: 500,
    });
  }
};

  const startMockTracking = (order: Order, driver: Driver, assignedRoute: RouteResult) => {
    stopTrackingTimer();

    const metrics = buildRouteMetrics(assignedRoute.coordinates);
    if (metrics.totalDistanceMeters <= 0) {
      return;
    }

    const startedAt = Date.now();
    const simulationDurationMs = 45_000;
    const tickMs = 500;

    setTrackingSession({
      order: { ...order, shipping_status: 'Đã phân công' },
      driver,
      route: assignedRoute,
      currentCoordinate: metrics.coordinates[0],
      heading: 0,
      status: 'Đã phân công',
      progress: 0,
      remainingDistanceMeters: metrics.totalDistanceMeters,
      etaSeconds: Math.ceil(simulationDurationMs / 1000),
    });

    trackingTimerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.min(elapsed / simulationDurationMs, 1);
      const currentCoordinate = interpolateRouteCoordinate(metrics, progress);

      setTrackingSession((currentSession) => {
        if (!currentSession) return null;
        const previousCoordinate = currentSession.currentCoordinate ?? metrics.coordinates[0];
        const heading = getHeading(previousCoordinate, currentCoordinate);

        return {
          ...currentSession,
          currentCoordinate,
          heading,
          status: progress >= 1 ? 'Đã đến điểm lấy' : 'Tài xế đang đến điểm lấy',
          progress,
          remainingDistanceMeters: metrics.totalDistanceMeters * (1 - progress),
          etaSeconds: Math.max(0, Math.ceil((simulationDurationMs - elapsed) / 1000)),
        };
      });

      if (progress >= 1) stopTrackingTimer();
    }, tickMs);
  };

  useEffect(() => {
    syncMapMarkers();
  }, [route, trackingSession]);

  const handleAssign = () => {
    if (!selectedOrder || !selectedDriver || !route) return;

    stopTrackingTimer();
    startMockTracking(selectedOrder, selectedDriver, route);
    setSelectedOrder(null);
    setSelectedDriver(null);
    setRoute(null);
  };

  const handleCloseTracking = () => {
    stopTrackingTimer();
    setTrackingSession(null);
    setSelectedOrder(null);
    setSelectedDriver(null);
    setRoute(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapCard}>
        <View ref={mapContainerRef} style={styles.map} />

        {!trackingSession && (
          <OrdersPanel
            loading={false}
            orders={orders}
            selectedOrderID={selectedOrder?.OrderID ?? null}
            top={Math.max(insets.top + 8, 16)}
            onSelect={handleSelectOrder}
          />
        )}

        {selectedOrder && !trackingSession && (
          <DriverSelectPanel
            order={selectedOrder}
            drivers={drivers}
            selectedDriver={selectedDriver}
            dropdownOpen={dropdownOpen}
            geocoding={false}
            routing={false}
            assigning={false}
            route={route}
            onToggleDropdown={() => setDropdownOpen((open) => !open)}
            onSelectDriver={handleSelectDriver}
            onAssign={handleAssign}
            onClose={() => {
              setSelectedOrder(null);
              setSelectedDriver(null);
              setRoute(null);
              setDropdownOpen(false);
            }}
          />
        )}

        {trackingSession && <TrackingPanel session={trackingSession} onClose={handleCloseTracking} />}

        {loading && (
          <View style={styles.overlayPanel}>
            <Text style={styles.title}>Đang tải bản đồ...</Text>
            <Text style={styles.text}>Vui lòng đợi trong giây lát.</Text>
          </View>
        )}

        {errorMessage ? (
          <View style={styles.overlayPanel}>
            <Text style={styles.title}>Lỗi bản đồ web</Text>
            <Text style={styles.text}>{errorMessage}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function OrdersPanel({ loading, orders, selectedOrderID, top, onSelect }: OrdersPanelProps) {
  return (
    <View style={[styles.ordersPanel, { top }]}>
      <View style={styles.panelTitleRow}>
        <Text style={styles.panelTitle}>Đơn hàng chờ phân công</Text>
        <Text style={styles.mockBadge}>MOCK</Text>
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
                onPress={() => onSelect(order)}
              >
                <Text style={[styles.orderTitle, selected && styles.selectedRowText]}>
                  #{order.OrderID} · {order.organization || order.sender_name || 'Khách hàng'}
                </Text>
                <Text style={styles.orderAddress} numberOfLines={1}>
                  {order.sender_address || 'Chưa có địa chỉ'}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
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
          <Text style={styles.assignButtonText}>Kết thúc mô phỏng</Text>
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

type RouteMetrics = {
  coordinates: Coordinate[];
  cumulativeDistances: number[];
  totalDistanceMeters: number;
};

function buildRouteMetrics(coordinates: Coordinate[]): RouteMetrics {
  const cumulativeDistances = [0];
  let totalDistanceMeters = 0;

  for (let index = 1; index < coordinates.length; index += 1) {
    totalDistanceMeters += distanceBetweenCoordinates(coordinates[index - 1], coordinates[index]);
    cumulativeDistances.push(totalDistanceMeters);
  }

  return { coordinates, cumulativeDistances, totalDistanceMeters };
}

function interpolateRouteCoordinate(metrics: RouteMetrics, progress: number): Coordinate {
  const safeProgress = Math.max(0, Math.min(progress, 1));

  if (safeProgress === 0) return metrics.coordinates[0];
  if (safeProgress === 1) return metrics.coordinates[metrics.coordinates.length - 1];

  const targetDistance = metrics.totalDistanceMeters * safeProgress;
  let low = 1;
  let high = metrics.cumulativeDistances.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (metrics.cumulativeDistances[middle] < targetDistance) low = middle + 1;
    else high = middle;
  }

  const endIndex = low;
  const startIndex = endIndex - 1;
  const segmentStart = metrics.cumulativeDistances[startIndex];
  const segmentLength = metrics.cumulativeDistances[endIndex] - segmentStart;
  const segmentProgress = segmentLength > 0 ? (targetDistance - segmentStart) / segmentLength : 0;
  const start = metrics.coordinates[startIndex];
  const end = metrics.coordinates[endIndex];

  return [
    start[0] + (end[0] - start[0]) * segmentProgress,
    start[1] + (end[1] - start[1]) * segmentProgress,
  ];
}

function distanceBetweenCoordinates(from: Coordinate, to: Coordinate) {
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = degreesToRadians(to[1] - from[1]);
  const longitudeDelta = degreesToRadians(to[0] - from[0]);
  const fromLatitude = degreesToRadians(from[1]);
  const toLatitude = degreesToRadians(to[1]);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function degreesToRadians(value: number) {
  return value * Math.PI / 180;
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
  mockBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#fef3c7',
    color: '#92400e',
    fontSize: 9,
    fontWeight: '800',
  },
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
