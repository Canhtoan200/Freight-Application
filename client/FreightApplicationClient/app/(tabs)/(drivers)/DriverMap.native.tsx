import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Camera,
  type CameraRef,
  GeoJSONSource,
  Layer,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';
import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Coordinate = [longitude: number, latitude: number];

type Order = {
  OrderID: number;
  order_name?: string;
  organization?: string;
  sender_address?: string;
  receiver_address?: string;
  sender_name?: string;
  shipping_status?: string;
  driver_name?: string;
};

type RouteResult = {
  coordinates: Coordinate[];
  distanceText?: string;
  durationText?: string;
};

const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';
const GOONG_API_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY ?? '';
const GOONG_STYLE_URL = `https://tiles.goong.io/assets/goong_map_web.json?api_key=${encodeURIComponent(GOONG_MAPTILES_KEY)}`;
const INITIAL_COORDINATE: Coordinate = [106.7009, 10.7769];
const DRIVER_START_ADDRESS = 'KDC Nam Thịnh, An Bình, Dĩ An, Bình Dương';
const STATUS_HEADING_TO_PICKUP = 'Tài xế đang đi!';
const STATUS_DELIVERING = 'Đang giao hàng';
const STATUS_DELIVERED = 'Đã giao hàng';
const isHeadingToDestination = (status: string | undefined, partnerMode: boolean) =>
  status === (partnerMode ? STATUS_DELIVERING : STATUS_HEADING_TO_PICKUP);
const STATUS_PICKED_UP = 'Đã nhận hàng';
const STATUS_ARRIVED_AT_STATION = 'Đã tới ga';
const STATUS_LOADED_ON_WAGON = 'Đã lên toa';
const SIMULATION_DURATION_MS = 45_000;
const SIMULATION_TICK_MS = 500;
const SERVER_URL = 'https://freight-application-server.onrender.com/api/v1';

type DriverMapProps = { partnerMode?: boolean };

export default function DriverMap({ partnerMode = false }: DriverMapProps) {
  const cameraRef = useRef<CameraRef | null>(null);
  const simulationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverCoordinate, setDriverCoordinate] = useState<Coordinate | null>(null);
  const [selectedOrderID, setSelectedOrderID] = useState<number | null>(null);
  const [selectedOrderCoordinate, setSelectedOrderCoordinate] = useState<Coordinate | null>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [simulatedDriverCoordinate, setSimulatedDriverCoordinate] = useState<Coordinate | null>(null);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [updatingOrderID, setUpdatingOrderID] = useState<number | null>(null);
  const [driverStartAddress, setDriverStartAddress] = useState(DRIVER_START_ADDRESS);
  const [errorMessage, setErrorMessage] = useState(
    IS_EXPO_GO
      ? 'MapLibre cần Development Build và không chạy trong Expo Go.'
      : GOONG_MAPTILES_KEY
        ? ''
        : 'Thiếu EXPO_PUBLIC_GOONG_MAPTILES_KEY để hiển thị Goong Map.',
  );

  const canRenderMap = Boolean(GOONG_MAPTILES_KEY && !IS_EXPO_GO);

  const stopSimulation = () => {
    if (simulationTimerRef.current !== null) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    setSimulating(false);
  };

  useEffect(() => {
    if (!canRenderMap) {
      setLoading(false);
      return;
    }

    let mounted = true;

    const loadMapData = async () => {
      try {
        const context = await loadDriverContext(partnerMode);
        const coordinate = await geocodeAddress(context.startAddress);
        if (!mounted) return;
        setDriverStartAddress(context.startAddress);
        setOrders(context.orders.filter((order) => order.shipping_status !== STATUS_LOADED_ON_WAGON));
        setDriverCoordinate(coordinate);
        cameraRef.current?.easeTo({
          center: coordinate,
          zoom: 13,
          duration: 800,
        });
      } catch (error) {
        console.error('Không thể tải dữ liệu bản đồ tài xế:', error);
        if (mounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Không thể tải dữ liệu tài xế.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadMapData();

    return () => {
      mounted = false;
    };
  }, [canRenderMap, partnerMode]);

  useEffect(() => () => {
    if (simulationTimerRef.current !== null) clearInterval(simulationTimerRef.current);
  }, []);

  useEffect(() => {
    if (!driverCoordinate || !selectedOrderCoordinate) return;

    const west = Math.min(driverCoordinate[0], selectedOrderCoordinate[0]);
    const south = Math.min(driverCoordinate[1], selectedOrderCoordinate[1]);
    const east = Math.max(driverCoordinate[0], selectedOrderCoordinate[0]);
    const north = Math.max(driverCoordinate[1], selectedOrderCoordinate[1]);

    cameraRef.current?.fitBounds([west, south, east, north], {
      padding: { top: 110, right: 60, bottom: 180, left: 60 },
      duration: 900,
    });
  }, [driverCoordinate, selectedOrderCoordinate]);

  const selectOrder = async (order: Order) => {
    stopSimulation();
    setSelectedOrderID(order.OrderID);
    setSelectedOrderCoordinate(null);
    setRoute(null);
    setSimulatedDriverCoordinate(null);
    setSimulationProgress(0);
    setSimulationStarted(false);

    if (
      order.shipping_status === STATUS_PICKED_UP
      || order.shipping_status === STATUS_ARRIVED_AT_STATION
      || order.shipping_status === STATUS_LOADED_ON_WAGON
    ) {
      setErrorMessage(order.shipping_status === STATUS_ARRIVED_AT_STATION
          ? 'Đã tới ga. Đơn hàng đang chờ admin xếp toa.'
          : order.shipping_status === STATUS_LOADED_ON_WAGON
            ? 'Đơn hàng đã được xếp lên toa.'
            : '');
      return;
    }

    if (!GOONG_API_KEY) {
      setErrorMessage('Thiếu EXPO_PUBLIC_GOONG_API_KEY để tìm vị trí đơn hàng.');
      return;
    }

    if (!order.sender_address) {
      setErrorMessage(`Đơn hàng #${order.OrderID} chưa có địa chỉ người gửi.`);
      return;
    }

    const destinationAddress = getDestinationAddress(order, partnerMode);
    if (!destinationAddress) {
      setErrorMessage(`Đơn hàng #${order.OrderID} chưa có địa chỉ đến.`);
      return;
    }

    const originAddress = driverStartAddress;
    if (!originAddress) {
      setErrorMessage(`Đơn hàng #${order.OrderID} chưa có địa chỉ người gửi.`);
      return;
    }

    try {
      const [coordinate, origin] = await Promise.all([
        geocodeAddress(destinationAddress),
        geocodeAddress(originAddress),
      ]);
      const drivingRoute = await fetchDrivingRoute(origin, coordinate);
      setErrorMessage('');
      setDriverCoordinate(origin);
      setSelectedOrderCoordinate(coordinate);
      setRoute(drivingRoute);
    } catch (error) {
      console.error(`Không thể hiển thị tuyến đường đơn #${order.OrderID}:`, error);
      setErrorMessage(error instanceof Error ? error.message : 'Không thể tính tuyến đường.');
    }
  };

  const geocodeAddress = async (address: string): Promise<Coordinate> => {
    const response = await fetch(
      `https://rsapi.goong.io/Geocode?address=${encodeURIComponent(`${address}, Việt Nam`)}&api_key=${encodeURIComponent(GOONG_API_KEY)}`,
    );
    const data = await response.json();
    const location = data.results?.[0]?.geometry?.location;
    if (!response.ok || typeof location?.lng !== 'number' || typeof location?.lat !== 'number') {
      throw new Error(data.error_message || `Không tìm thấy tọa độ: ${address}`);
    }
    return [location.lng, location.lat];
  };

  const centerOnDriver = () => {
    if (!driverCoordinate) return;
    cameraRef.current?.easeTo({
      center: driverCoordinate,
      zoom: 15,
      duration: 700,
    });
  };

  const selectedOrder = orders.find((order) => order.OrderID === selectedOrderID) ?? null;
  const selectedDestination = selectedOrder ? getDestinationAddress(selectedOrder, partnerMode) : null;

  const startSimulation = () => {
    if (!route || simulationStarted || simulating) return;
    setSimulationStarted(true);
    setSimulating(true);
    setSimulationProgress(0);
    setSimulatedDriverCoordinate(route.coordinates[0]);
    const startedAt = Date.now();
    simulationTimerRef.current = setInterval(() => {
      const progress = Math.min((Date.now() - startedAt) / SIMULATION_DURATION_MS, 1);
      setSimulationProgress(progress);
      setSimulatedDriverCoordinate(interpolateRoute(route.coordinates, progress));
      if (progress >= 1 && simulationTimerRef.current !== null) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
        setSimulating(false);
      }
    }, SIMULATION_TICK_MS);
  };

  const advanceOrder = async () => {
    if (!selectedOrder || updatingOrderID !== null || !simulationStarted || simulating || simulationProgress < 1) return;
    const nextStatus = isHeadingToDestination(selectedOrder.shipping_status, partnerMode)
      ? (partnerMode ? STATUS_DELIVERED : STATUS_PICKED_UP)
      : null;
    if (!nextStatus) return;

    setUpdatingOrderID(selectedOrder.OrderID);
    setErrorMessage('');
    try {
      const response = await fetch(`${SERVER_URL}/orders/updateShippingStatus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ OrderID: selectedOrder.OrderID, shipping_status: nextStatus }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Không thể cập nhật trạng thái đơn hàng.');

      const updatedOrder = { ...selectedOrder, shipping_status: nextStatus };
      setOrders((current) => current.map((order) =>
        order.OrderID === updatedOrder.OrderID ? updatedOrder : order,
      ));
      setRoute(null);
      setSelectedOrderCoordinate(null);
      setSimulatedDriverCoordinate(null);
      setSimulationStarted(false);
      setSimulationProgress(0);
      setErrorMessage('Đã nhận hàng. Bạn có thể tiếp tục chọn đơn khác trước khi tới ga.');
    } catch (error) {
      console.error('Không thể cập nhật tiến độ giao hàng:', error);
      setErrorMessage(error instanceof Error ? error.message : 'Không thể cập nhật trạng thái.');
    } finally {
      setUpdatingOrderID(null);
    }
  };

  const renderOrderRow = (order: Order, index: number) => {
    if (![STATUS_HEADING_TO_PICKUP, STATUS_DELIVERING, STATUS_PICKED_UP, STATUS_ARRIVED_AT_STATION].includes(order.shipping_status ?? '')) {
      return null;
    }

    const isSelected = selectedOrderID === order.OrderID;
    return (
      <TouchableOpacity
        key={order.OrderID ?? index}
        onPress={() => void selectOrder(order)}
        style={[styles.orderRow, isSelected && styles.selectedOrderRow]}
      >
        <Text style={[styles.panelContent, isSelected && styles.selectedOrderText]} numberOfLines={1}>
          #{order.OrderID} – {order.organization || order.sender_name || 'Khách hàng'}
        </Text>
        <Text style={styles.orderStatus}>{order.shipping_status}</Text>
      </TouchableOpacity>
    );
  };

  if (!canRenderMap) {
    return (
      <View style={styles.missingTokenContainer}>
        <Text style={styles.missingTokenTitle}>
          {IS_EXPO_GO ? 'Goong Map cần Development Build' : 'Goong Map chưa được cấu hình'}
        </Text>
        <Text style={styles.missingTokenText}>
          {IS_EXPO_GO
            ? 'MapLibre là native module. Hãy chạy development build thay vì Expo Go.'
            : 'Thêm EXPO_PUBLIC_GOONG_MAPTILES_KEY vào file môi trường.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Map style={styles.map} mapStyle={GOONG_STYLE_URL}>
        <Camera
          ref={cameraRef}
          initialViewState={{ center: INITIAL_COORDINATE, zoom: 14 }}
        />

        {(simulatedDriverCoordinate || driverCoordinate) && (
          <Marker id="driver-location" lngLat={simulatedDriverCoordinate || driverCoordinate!} anchor="bottom">
            <View style={styles.driverMarker}>
              <Ionicons name="car-sport" size={22} color="#ffffff" />
            </View>
          </Marker>
        )}

        {selectedOrderCoordinate && (
          <Marker id="selected-order" lngLat={selectedOrderCoordinate} anchor="bottom">
            <View style={styles.orderMarker}>
              <Ionicons name="location" size={30} color="#dc2626" />
            </View>
          </Marker>
        )}
        {route && route.coordinates.length > 1 && (
          <GeoJSONSource
            id="driver-delivery-route"
            data={{
              type: 'Feature',
              properties: {},
              geometry: { type: 'LineString', coordinates: route.coordinates },
            }}
          >
            <Layer
              id="driver-delivery-route-line"
              type="line"
              paint={{ 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.9 }}
            />
          </GeoJSONSource>
        )}
      </Map>

      <View style={[styles.topRightPanel, { top: Math.max(insets.top + 8, 16) }]}>
        <Text style={styles.panelTitle}>Đơn hàng cần đi hôm nay</Text>
        {orders.length > 0 ? (
          orders.map(renderOrderRow)
        ) : (
          <Text style={styles.emptyText}>Chưa có đơn hàng đang vận chuyển</Text>
        )}
      </View>

      <View style={styles.coordinateCard}>
        <Text style={styles.coordinateTitle}>Vị trí mô phỏng · KDC Nam Thịnh</Text>
        {selectedOrder?.shipping_status === STATUS_PICKED_UP ? (
          <Text style={styles.coordinateText}>
            Đã nhận hàng · có thể tiếp tục nhận đơn khác trước khi tới ga.
          </Text>
        ) : !!selectedDestination && (
          <Text style={styles.coordinateText}>
            Điểm nhận hàng: {selectedDestination}
          </Text>
        )}
        {isHeadingToDestination(selectedOrder?.shipping_status, partnerMode) && (
          <Text style={styles.coordinateText}>
            {route
              ? simulating
                ? `Đang mô phỏng · ${Math.floor(simulationProgress * 100)}%`
                : simulationStarted && simulationProgress >= 1
                  ? 'Đã đến nơi · xác nhận để cập nhật trạng thái'
                  : 'Đã có tuyến đường · xác nhận đơn để bắt đầu mô phỏng'
              : 'Đang tải tuyến đường...'}
            {' · '}{route?.distanceText || '—'} · ETA {route?.durationText || '—'}
          </Text>
        )}
        {isHeadingToDestination(selectedOrder?.shipping_status, partnerMode) && (
          <TouchableOpacity
            style={[styles.advanceButton, (!route || simulating) && styles.disabledButton]}
            onPress={() => {
              if (!simulationStarted) startSimulation();
              else void advanceOrder();
            }}
            disabled={
              updatingOrderID === selectedOrder?.OrderID ||
              !route ||
              simulating ||
              (simulationStarted && simulationProgress < 1)
            }
          >
            {updatingOrderID === selectedOrder?.OrderID
              ? <ActivityIndicator color="#fff" />
              : simulating
                ? <Text style={styles.advanceButtonText}>Đang mô phỏng...</Text>
              : <Text style={styles.advanceButtonText}>
                  {!simulationStarted
                    ? 'Xác nhận đơn hàng'
                    : 'Xác nhận đã nhận hàng'}
                </Text>}
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.locationButton} onPress={centerOnDriver} activeOpacity={0.7}>
        <Ionicons name="locate" size={24} color="#2563eb" />
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Đang tải đơn và vị trí mô phỏng...</Text>
        </View>
      )}

      {!!errorMessage && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

async function loadDriverContext(partnerMode: boolean): Promise<{ orders: Order[]; startAddress: string }> {
  const raw = await AsyncStorage.getItem('userToken');
  const user = raw ? JSON.parse(raw) as { userID?: number | string; ID?: number | string } : null;
  const userID = Number(user?.userID ?? user?.ID);
  if (!Number.isInteger(userID) || userID <= 0) throw new Error('Vui lòng đăng nhập lại để tải đơn được phân công.');

  const driverID = await fetchDriverID(userID, partnerMode);
  const [orderIDs, profile] = await Promise.all([
    fetchDriverOrderIDs(driverID, partnerMode),
    fetchDriverProfile(driverID, partnerMode),
  ]);
  const orders = await Promise.all(orderIDs.map(fetchOrderByID));
  return {
    orders,
    startAddress: partnerMode ? profile?.driver_link || 'Ga Giáp Bát, Hà Nội' : DRIVER_START_ADDRESS,
  };
}

async function fetchDriverProfile(driverID: number, partnerMode: boolean): Promise<{ driver_link?: string } | null> {
  if (!partnerMode) return null;
  const response = await fetch(`${SERVER_URL}/drivers/getDriverPartnerByID?driverPartnerID=${driverID}`);
  const payload = await response.json();
  if (!response.ok || !payload.data) return null;
  return payload.data;
}

async function fetchDriverID(userID: number, partnerMode: boolean): Promise<number> {
  const response = await fetch(partnerMode
    ? `${SERVER_URL}/drivers/getDriverPartnerIDBasedOnUserID?userID=${userID}`
    : `${SERVER_URL}/drivers/getDriverIDBasedOnUserID?userID=${userID}`);
  const payload = await response.json();
  if (!response.ok || typeof payload.data !== 'number') {
    throw new Error(payload.message || 'Không tìm thấy hồ sơ tài xế.');
  }
  return payload.data;
}

async function fetchDriverOrderIDs(driverID: number, partnerMode: boolean): Promise<number[]> {
  const response = await fetch(partnerMode
    ? `${SERVER_URL}/drivers/getDriverPartnerOrdersByID?driverPartnerID=${driverID}`
    : `${SERVER_URL}/drivers/getDriverOrderBasedOnDriverID?driverID=${driverID}`);
  const payload = await response.json();
  if (!response.ok || !Array.isArray(payload.data)) {
    throw new Error(payload.message || 'Không thể tải danh sách đơn được phân công.');
  }
  return payload.data.map((item: { OrderIDs: number }) => item.OrderIDs);
}

async function fetchOrderByID(orderID: number): Promise<Order> {
  const response = await fetch(`${SERVER_URL}/orders/getOrderByID?OrderID=${orderID}`);
  const payload = await response.json();
  if (!response.ok || !payload.data) {
    throw new Error(payload.message || `Không thể tải đơn hàng #${orderID}.`);
  }
  return payload.data as Order;
}

function getDestinationAddress(order: Order, partnerMode = false): string | null {
  if (
    order.shipping_status === STATUS_PICKED_UP
    || order.shipping_status === STATUS_ARRIVED_AT_STATION
    || order.shipping_status === STATUS_LOADED_ON_WAGON
  ) return null;
  return (partnerMode ? order.receiver_address : order.sender_address) ?? null;
}

async function fetchDrivingRoute(from: Coordinate, to: Coordinate): Promise<RouteResult> {
  if (!GOONG_API_KEY) throw new Error('Thiếu EXPO_PUBLIC_GOONG_API_KEY để tính tuyến đường.');
  const query = new URLSearchParams({
    origin: `${from[1]},${from[0]}`,
    destination: `${to[1]},${to[0]}`,
    vehicle: 'car',
    api_key: GOONG_API_KEY,
  });
  const response = await fetch(`https://rsapi.goong.io/direction?${query}`);
  const payload = await response.json();
  const first = payload.routes?.[0];
  if (!response.ok || !first) throw new Error(payload.error_message || 'Không tìm thấy tuyến đường.');

  const coordinates: Coordinate[] = first.geometry?.coordinates ??
    (first.overview_polyline?.points ? decodePolyline(first.overview_polyline.points) : []);
  if (coordinates.length < 2) throw new Error('Tuyến đường không có geometry hợp lệ.');
  const leg = first.legs?.[0];
  const distance = leg?.distance?.value ?? first.distance;
  const duration = leg?.duration?.value ?? first.duration;
  return {
    coordinates,
    distanceText: distance ? `${(distance / 1000).toFixed(1)} km` : undefined,
    durationText: duration ? `${Math.ceil(duration / 60)} phút` : undefined,
  };
}

function interpolateRoute(coordinates: Coordinate[], progress: number): Coordinate {
  if (coordinates.length < 2) return coordinates[0];
  const segmentLengths = coordinates.slice(1).map((point, index) =>
    distanceBetweenCoordinates(coordinates[index], point),
  );
  const totalLength = segmentLengths.reduce((total, length) => total + length, 0);
  if (totalLength === 0) return coordinates[coordinates.length - 1];

  let distanceRemaining = totalLength * Math.max(0, Math.min(progress, 1));
  for (let index = 0; index < segmentLengths.length; index += 1) {
    const segmentLength = segmentLengths[index];
    if (distanceRemaining <= segmentLength || index === segmentLengths.length - 1) {
      const segmentProgress = segmentLength > 0
        ? Math.min(distanceRemaining / segmentLength, 1)
        : 0;
      const start = coordinates[index];
      const end = coordinates[index + 1];
      return [
        start[0] + (end[0] - start[0]) * segmentProgress,
        start[1] + (end[1] - start[1]) * segmentProgress,
      ];
    }
    distanceRemaining -= segmentLength;
  }
  return coordinates[coordinates.length - 1];
}

function distanceBetweenCoordinates(from: Coordinate, to: Coordinate): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (to[1] - from[1]) * radians;
  const longitudeDelta = (to[0] - from[0]) * radians;
  const fromLatitude = from[1] * radians;
  const toLatitude = to[1] * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function decodePolyline(encoded: string): Coordinate[] {
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const coordinates: Coordinate[] = [];
  while (index < encoded.length) {
    const readDelta = () => {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      return (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    };
    latitude += readDelta();
    longitude += readDelta();
    coordinates.push([longitude / 1e5, latitude / 1e5]);
  }
  return coordinates;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { width: '100%', height: '100%' },
  missingTokenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#eef6ff',
  },
  missingTokenTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  missingTokenText: { textAlign: 'center', color: '#334155', lineHeight: 20 },
  driverMarker: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  orderMarker: { alignItems: 'center', justifyContent: 'center' },
  topRightPanel: {
    position: 'absolute',
    right: 15,
    width: 210,
    maxHeight: 220,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.94)',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  panelTitle: { fontSize: 14, fontWeight: '700', color: '#1e293b', marginBottom: 6 },
  panelContent: { fontSize: 12, color: '#64748b' },
  orderStatus: { fontSize: 11, color: '#2563eb', marginTop: 2 },
  advanceButton: { marginTop: 8, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#2563eb' },
  disabledButton: { opacity: 0.55 },
  advanceButtonText: { color: '#ffffff', fontSize: 12, fontWeight: '700' },
  orderRow: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  selectedOrderRow: { backgroundColor: '#eff6ff', marginHorizontal: -6, paddingHorizontal: 6 },
  selectedOrderText: { color: '#1d4ed8', fontWeight: '700' },
  emptyText: { fontSize: 12, color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  coordinateCard: {
    position: 'absolute',
    left: 15,
    bottom: 20,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.94)',
    elevation: 4,
  },
  coordinateTitle: { fontSize: 12, fontWeight: '700', color: '#1e293b', marginBottom: 3 },
  coordinateText: { fontSize: 11, color: '#475569', lineHeight: 16 },
  locationButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  loadingBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    elevation: 4,
  },
  loadingText: { fontSize: 12, color: '#2563eb', fontWeight: '600' },
  banner: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 88,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(220,53,69,0.95)',
  },
  bannerText: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
