import Ionicons from '@expo/vector-icons/Ionicons';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
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
  order_dispatch_date?: string;
  receiver_name?: string;
  sender_name?: string;
  sender_address?: string;
  receiver_address?: string;
  sender_phone_number?: string;
  receiver_phone_number?: string;
  goods_quantity?: number;
  goods_weight?: string;
  goods_volume?: string;
  note?: string;
  handling_instruction?: string;
  shipping_route?: string;
  driver_name?: string;
  driver_license_plate?: string;
  driver_phone_number?: string;
  shipping_status?: string;
  shipping_position?: string;
  shipping_payment?: string;
  created_at?: string;
  organization?: string;
};

type Driver = {
  DriverIDs: number;
  accountID?: number;
  driver_name?: string;
  driver_link?: string;
  driver_license_plate_number?: string;
  driver_phone_number?: string;
  amount_of_gas?: string;
  money_amount_of_gas?: string;
  the_remaining_volume_of_the_car?: number;
  the_remaining_weight_of_the_car?: number;
  drop_off_distance?: number;
  create_at?: string;
};

type RouteResult = {
  coordinates: Coordinate[];
  distanceText?: string;
  durationText?: string;
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

const SERVER_URL = 'https://freight-application-server.onrender.com/api/v1';
const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';
const GOONG_API_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY ?? '';
const GOONG_STYLE_URL = `https://tiles.goong.io/assets/goong_map_web.json?api_key=${encodeURIComponent(GOONG_MAPTILES_KEY)}`;
const DEFAULT_COORDINATE: Coordinate = [106.7009, 10.7769];
const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';
const USE_MOCK_BUSINESS_APIS = true;
const API_ENDPOINTS = {
  ordersByStatus: `${SERVER_URL}/orders/getAllOrderByStatus`,
  drivers: `${SERVER_URL}/drivers/getAllDrivers`,
  assignDriver: `${SERVER_URL}/drivers/createDriverOrderDetail`,
};

const MOCK_ORDERS_RESPONSE: { data: Order[] } = {
  data: [
    {
      OrderID: 9001,
      order_name: 'Giao linh kiện điện tử',
      order_dispatch_date: '2026-08-16T08:00:00.000Z',
      sender_name: 'Kho trung tâm Quận 1',
      receiver_name: 'Cửa hàng Thủ Đức',
      sender_address: '72 Lê Thánh Tôn, Bến Nghé, Quận 1, Thành phố Hồ Chí Minh',
      receiver_address: '1 Võ Văn Ngân, Linh Chiểu, Thủ Đức, Thành phố Hồ Chí Minh',
      sender_phone_number: '0900000001',
      receiver_phone_number: '0900000002',
      goods_quantity: 12,
      goods_weight: '350.00',
      goods_volume: '8.50',
      shipping_status: 'Đã tiếp nhận',
      shipping_position: 'Kho Quận 1',
      shipping_payment: 'Đã thanh toán',
      organization: 'Freight Demo Quận 1',
      created_at: '2026-08-16T07:30:00.000Z',
    },
    {
      OrderID: 9002,
      order_name: 'Giao hàng tiêu dùng',
      order_dispatch_date: '2026-08-16T09:00:00.000Z',
      sender_name: 'Kho Thủ Đức',
      receiver_name: 'Điểm nhận Dĩ An',
      sender_address: '1 Võ Văn Ngân, Linh Chiểu, Thủ Đức, Thành phố Hồ Chí Minh',
      receiver_address: 'An Bình, Dĩ An, Bình Dương',
      sender_phone_number: '0900000003',
      receiver_phone_number: '0900000004',
      goods_quantity: 20,
      goods_weight: '500.00',
      goods_volume: '12.00',
      shipping_status: 'Đã tiếp nhận',
      shipping_position: 'Kho Thủ Đức',
      shipping_payment: 'Chưa thanh toán',
      organization: 'Freight Demo Thủ Đức',
      created_at: '2026-08-16T08:15:00.000Z',
    },
  ],
};

const MOCK_DRIVERS_RESPONSE: { data: Driver[] } = {
  data: [
    {
      DriverIDs: 1,
      driver_name: 'Trần Văn Sơn',
      accountID: 4,
      driver_link: 'KDC Nam Thịnh, An Bình, Dĩ An, Bình Dương',
      driver_license_plate_number: '50H 19249',
      driver_phone_number: '0981391557',
      amount_of_gas: '19.00',
      money_amount_of_gas: '2000000.00',
      the_remaining_volume_of_the_car: 15,
      the_remaining_weight_of_the_car: 16,
      drop_off_distance: 20,
      create_at: '2026-05-07T08:11:44.000Z',
    },
    {
      DriverIDs: 2,
      driver_name: 'Nguyễn Minh Hải',
      accountID: 8,
      driver_link: '268 Lý Thường Kiệt, Phường 14, Quận 10, Thành phố Hồ Chí Minh',
      driver_license_plate_number: '51D 67890',
      driver_phone_number: '0909000002',
      amount_of_gas: '25.00',
      money_amount_of_gas: '2500000.00',
      the_remaining_volume_of_the_car: 20,
      the_remaining_weight_of_the_car: 22,
      drop_off_distance: 18,
      create_at: '2026-06-12T03:30:00.000Z',
    },
  ],
};

export default function DriverMapManagement() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<CameraRef | null>(null);
  const geocodeCacheRef = useRef(new globalThis.Map<string, Coordinate>());
  const orderRequestRef = useRef(0);
  const driverRequestRef = useRef(0);

  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);
  const [orderCoordinate, setOrderCoordinate] = useState<Coordinate | null>(null);
  const [driverCoordinate, setDriverCoordinate] = useState<Coordinate | null>(null);
  const [currentCoordinate, setCurrentCoordinate] = useState<Coordinate>(DEFAULT_COORDINATE);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [geocoding, setGeocoding] = useState(false);
  const [routing, setRouting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [mapStyleLoaded, setMapStyleLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const canRenderMap = Boolean(GOONG_MAPTILES_KEY && !IS_EXPO_GO);

  useEffect(() => {
    let active = true;

    Promise.all([fetchOrders(), fetchDrivers()])
      .then(([orderList, driverList]) => {
        if (!active) return;
        setOrders(orderList);
        setDrivers(driverList);
      })
      .catch((error) => {
        console.error('Không thể tải dữ liệu bản đồ:', error);
        if (active) setErrorMessage('Không thể tải danh sách đơn hàng hoặc tài xế.');
      })
      .finally(() => {
        if (active) setLoadingData(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const loadCurrentLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (!active) return;

        const coordinate: Coordinate = [
          location.coords.longitude,
          location.coords.latitude,
        ];
        setCurrentCoordinate(coordinate);
        cameraRef.current?.easeTo({ center: coordinate, zoom: 14, duration: 600 });
      } catch (error) {
        console.warn('Không thể lấy vị trí thiết bị:', error);
      }
    };

    void loadCurrentLocation();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!driverCoordinate || !orderCoordinate) {
      setRoute(null);
      return;
    }

    const controller = new AbortController();
    setRouting(true);

    fetchDrivingRoute(driverCoordinate, orderCoordinate, controller.signal)
      .then((result) => setRoute(result))
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Không thể lấy tuyến đường:', error);
        setRoute(null);
        setErrorMessage('Không thể tạo tuyến đường giữa tài xế và đơn hàng.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setRouting(false);
      });

    return () => controller.abort();
  }, [driverCoordinate, orderCoordinate]);

  useEffect(() => {
    if (!driverCoordinate || !orderCoordinate) return;

    const west = Math.min(driverCoordinate[0], orderCoordinate[0]);
    const south = Math.min(driverCoordinate[1], orderCoordinate[1]);
    const east = Math.max(driverCoordinate[0], orderCoordinate[0]);
    const north = Math.max(driverCoordinate[1], orderCoordinate[1]);

    if (west === east && south === north) {
      cameraRef.current?.easeTo({ center: driverCoordinate, zoom: 16, duration: 700 });
      return;
    }

    cameraRef.current?.fitBounds([west, south, east, north], {
      padding: { top: 120, right: 70, bottom: 300, left: 70 },
      duration: 900,
    });
  }, [driverCoordinate, orderCoordinate]);

  const resolveAddress = async (address?: string): Promise<Coordinate | null> => {
    const normalizedAddress = address?.trim();
    if (!normalizedAddress) return null;

    const cached = geocodeCacheRef.current.get(normalizedAddress);
    if (cached) return cached;

    const coordinate = await geocodeAddress(normalizedAddress);
    if (coordinate) geocodeCacheRef.current.set(normalizedAddress, coordinate);
    return coordinate;
  };

  const handleSelectOrder = async (order: Order) => {
    const requestID = ++orderRequestRef.current;
    driverRequestRef.current += 1;
    setSelectedOrder(order);
    setSelectedDriver(null);
    setOrderCoordinate(null);
    setDriverCoordinate(null);
    setRoute(null);
    setDropdownOpen(false);
    setErrorMessage('');

    if (!GOONG_API_KEY) {
      setErrorMessage('Thiếu EXPO_PUBLIC_GOONG_API_KEY để tìm tọa độ đơn hàng.');
      return;
    }

    setGeocoding(true);
    try {
      const coordinate = await resolveAddress(order.sender_address);
      if (requestID !== orderRequestRef.current) return;

      if (!coordinate) {
        setErrorMessage(`Không tìm thấy tọa độ đơn hàng #${order.OrderID}.`);
        return;
      }
      setOrderCoordinate(coordinate);
      cameraRef.current?.easeTo({ center: coordinate, zoom: 15, duration: 600 });
    } catch (error) {
      console.error('Không thể geocode đơn hàng:', error);
      if (requestID === orderRequestRef.current) {
        setErrorMessage(`Không thể xác định tọa độ đơn hàng #${order.OrderID}.`);
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
    setErrorMessage('');

    setGeocoding(true);
    try {
      const coordinate = await resolveAddress(driver.driver_link);
      if (requestID !== driverRequestRef.current) return;

      if (!coordinate) {
        setErrorMessage(`Không tìm thấy tọa độ tài xế ${driver.driver_name ?? ''}.`);
        return;
      }
      setDriverCoordinate(coordinate);
    } catch (error) {
      console.error('Không thể geocode tài xế:', error);
      if (requestID === driverRequestRef.current) {
        setErrorMessage(`Không thể xác định tọa độ tài xế ${driver.driver_name ?? ''}.`);
      }
    } finally {
      if (requestID === driverRequestRef.current) setGeocoding(false);
    }
  };

  const handleAssignDriver = async () => {
    if (!selectedOrder || !selectedDriver) return;

    setAssigning(true);
    setErrorMessage('');
    try {
      await assignDriverToOrder(selectedDriver.DriverIDs, selectedOrder.OrderID);
      setOrders((currentOrders) =>
        currentOrders.filter((order) => order.OrderID !== selectedOrder.OrderID),
      );
      closeSelection();
    } catch (error) {
      console.error('Không thể phân công tài xế:', error);
      setErrorMessage('Không thể xác nhận phân công tài xế.');
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
    setDropdownOpen(false);
    setGeocoding(false);
  };

  const centerOnCurrentLocation = () => {
    cameraRef.current?.easeTo({
      center: currentCoordinate,
      zoom: 14,
      duration: 700,
    });
  };

  if (!canRenderMap) {
    return (
      <View style={styles.unavailableContainer}>
        <Text style={styles.unavailableTitle}>
          {IS_EXPO_GO ? 'Goong Map cần Development Build' : 'Goong Map chưa được cấu hình'}
        </Text>
        <Text style={styles.unavailableText}>
          {IS_EXPO_GO
            ? 'MapLibre là native module và không chạy trong Expo Go.'
            : 'Thêm EXPO_PUBLIC_GOONG_MAPTILES_KEY vào file môi trường.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={GOONG_STYLE_URL}
        onDidFinishLoadingStyle={() => setMapStyleLoaded(true)}
        onDidFailLoadingMap={() => {
          setMapStyleLoaded(false);
          setErrorMessage('Không thể tải Goong Map. Hãy kiểm tra MAPTILES key và kết nối mạng.');
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: currentCoordinate, zoom: 14 }}
        />

        {orderCoordinate && (
          <Marker id="selected-order" lngLat={orderCoordinate} anchor="bottom">
            <View style={styles.orderMarker}>
              <Ionicons name="location" size={32} color="#dc2626" />
            </View>
          </Marker>
        )}

        {driverCoordinate && (
          <Marker id="selected-driver" lngLat={driverCoordinate} anchor="bottom">
            <View style={styles.driverMarker}>
              <Ionicons name="car-sport" size={22} color="#ffffff" />
            </View>
          </Marker>
        )}

        {route && route.coordinates.length > 1 && (
          <GeoJSONSource
            id="selected-route"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: route.coordinates },
            }}
          >
            <Layer
              id="selected-route-line"
              type="line"
              paint={{
                'line-color': '#2563eb',
                'line-width': 5,
                'line-opacity': 0.9,
              }}
            />
          </GeoJSONSource>
        )}
      </Map>

      <OrdersPanel
        loading={loadingData}
        orders={orders}
        selectedOrderID={selectedOrder?.OrderID ?? null}
        top={Math.max(insets.top + 8, 16)}
        onSelect={(order) => void handleSelectOrder(order)}
      />

      {selectedOrder && (
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
          onSelectDriver={(driver) => void handleSelectDriver(driver)}
          onAssign={() => void handleAssignDriver()}
          onClose={closeSelection}
        />
      )}

      <TouchableOpacity
        style={[styles.locationButton, selectedOrder && styles.locationButtonRaised]}
        onPress={centerOnCurrentLocation}
        activeOpacity={0.75}
      >
        <Ionicons name="locate" size={24} color="#2563eb" />
      </TouchableOpacity>

      {!mapStyleLoaded && (
        <View style={styles.mapLoadingBadge}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.mapLoadingText}>Đang tải Goong Map...</Text>
        </View>
      )}

      {!!errorMessage && (
        <View style={[styles.errorBanner, selectedOrder && styles.errorBannerRaised]}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

function OrdersPanel({ loading, orders, selectedOrderID, top, onSelect }: OrdersPanelProps) {
  return (
    <View style={[styles.ordersPanel, { top }]}>
      <View style={styles.panelTitleRow}>
        <Text style={styles.panelTitle}>Đơn hàng chờ phân công</Text>
        {USE_MOCK_BUSINESS_APIS && <Text style={styles.mockBadge}>MOCK</Text>}
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
          {!!selectedDriver && (
            <Text style={styles.selectMeta}>
              {selectedDriver.driver_license_plate_number || 'Chưa có biển số'}
            </Text>
          )}
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
              Tuyến đường sẵn sàng
              {route.distanceText ? ` · ${route.distanceText}` : ''}
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

async function fetchOrders(): Promise<Order[]> {
  if (USE_MOCK_BUSINESS_APIS) {
    const payload = await mockApiResponse(MOCK_ORDERS_RESPONSE);
    return payload.data;
  }

  const response = await fetch(API_ENDPOINTS.ordersByStatus, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ shipping_status: 'Đã tiếp nhận' }),
  });
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(payload?.message || 'Không thể tải đơn hàng');
  return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
}

async function fetchDrivers(): Promise<Driver[]> {
  if (USE_MOCK_BUSINESS_APIS) {
    const payload = await mockApiResponse(MOCK_DRIVERS_RESPONSE);
    return payload.data;
  }

  const response = await fetch(API_ENDPOINTS.drivers);
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(payload?.message || 'Không thể tải tài xế');
  return Array.isArray(payload?.data) ? payload.data : [];
}

async function assignDriverToOrder(driverID: number, orderID: number) {
  if (USE_MOCK_BUSINESS_APIS) {
    await mockApiResponse({
      data: { DriverIDs: driverID, OrderIDs: [orderID] },
      message: 'Phân công tài xế thành công',
    });
    return;
  }

  const response = await fetch(API_ENDPOINTS.assignDriver, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ DriverIDs: driverID, OrderIDs: [orderID] }),
  });
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(payload?.message || 'Không thể phân công tài xế');
}

async function geocodeAddress(address: string): Promise<Coordinate | null> {
  const response = await fetch(
    `https://rsapi.goong.io/Geocode?address=${encodeURIComponent(address)}&api_key=${encodeURIComponent(GOONG_API_KEY)}`,
  );
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(payload?.message || 'Goong Geocode thất bại');

  const location = payload?.results?.[0]?.geometry?.location;
  return location ? [location.lng, location.lat] : null;
}

async function fetchDrivingRoute(
  from: Coordinate,
  to: Coordinate,
  signal: AbortSignal,
): Promise<RouteResult> {
  const response = await fetch(
    `https://rsapi.goong.io/direction?origin=${from[1]},${from[0]}&destination=${to[1]},${to[0]}&vehicle=car&api_key=${encodeURIComponent(GOONG_API_KEY)}`,
    { signal },
  );
  const payload = await parseResponse(response);
  if (!response.ok) throw new Error(payload?.message || 'Goong Directions thất bại');

  const firstRoute = payload?.routes?.[0];
  if (!firstRoute) throw new Error('Không tìm thấy tuyến đường');

  const coordinates: Coordinate[] = firstRoute.geometry?.coordinates
    ?? (firstRoute.overview_polyline?.points
      ? decodePolyline(firstRoute.overview_polyline.points)
      : []);
  if (coordinates.length < 2) throw new Error('Tuyến đường không có geometry hợp lệ');

  const firstLeg = firstRoute.legs?.[0];
  return {
    coordinates,
    distanceText: firstLeg?.distance?.text,
    durationText: firstLeg?.duration?.text,
  };
}

function decodePolyline(encoded: string): Coordinate[] {
  const coordinates: Coordinate[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeChunk = decodePolylineChunk(encoded, index);
    index = latitudeChunk.nextIndex;
    latitude += latitudeChunk.delta;

    const longitudeChunk = decodePolylineChunk(encoded, index);
    index = longitudeChunk.nextIndex;
    longitude += longitudeChunk.delta;

    coordinates.push([longitude * 1e-5, latitude * 1e-5]);
  }

  return coordinates;
}

function decodePolylineChunk(encoded: string, startIndex: number) {
  let index = startIndex;
  let result = 0;
  let shift = 0;
  let byte: number;

  do {
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    delta: (result & 1) !== 0 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}

async function parseResponse(response: Response): Promise<any> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    throw new Error('Máy chủ trả về dữ liệu không phải JSON');
  }
  return response.json();
}

function mockApiResponse<T>(payload: T, delay = 350): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(payload), delay);
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#e5e7eb' },
  map: { width: '100%', height: '100%', backgroundColor: '#e5e7eb' },
  flexOne: { flex: 1 },
  unavailableContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#eef6ff',
  },
  unavailableTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  unavailableText: { textAlign: 'center', color: '#475569', lineHeight: 20 },
  orderMarker: { alignItems: 'center', justifyContent: 'center' },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
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
  locationButton: {
    position: 'absolute',
    right: 18,
    bottom: 22,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    elevation: 6,
  },
  locationButtonRaised: { bottom: 286 },
  mapLoadingBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.96)',
    elevation: 4,
  },
  mapLoadingText: { fontSize: 12, fontWeight: '600', color: '#2563eb' },
  errorBanner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 82,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(220,38,38,0.95)',
  },
  errorBannerRaised: { bottom: 286 },
  errorText: { textAlign: 'center', fontSize: 12, fontWeight: '600', color: '#ffffff' },
});
