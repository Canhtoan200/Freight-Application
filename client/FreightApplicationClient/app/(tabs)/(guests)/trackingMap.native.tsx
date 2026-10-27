import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Camera, type CameraRef, GeoJSONSource, Layer, Map, Marker } from '@maplibre/maplibre-react-native';
import Constants from 'expo-constants';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Coordinate = [longitude: number, latitude: number];
type Order = {
  OrderID: number;
  order_name?: string;
  organization?: string;
  sender_address?: string;
  receiver_address?: string;
  sender_name?: string;
  driver_name?: string;
  shipping_status?: string;
};
type Route = { coordinates: Coordinate[]; durationText?: string; distanceText?: string };

const API_URL = 'https://freight-application-server.onrender.com/api/v1';
const GOONG_API_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY ?? '';
const MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';
const MAP_STYLE = `https://tiles.goong.io/assets/goong_map_web.json?api_key=${encodeURIComponent(MAPTILES_KEY)}`;
const DRIVER_START = 'KDC Nam Thịnh, An Bình, Dĩ An, Bình Dương';
const STATION = 'Ga Sóng Thần, Dĩ An, Bình Dương';
const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

export default function GuestTrackingMap() {
  const cameraRef = useRef<CameraRef | null>(null);
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadOrders = async () => {
      try {
        const raw = await AsyncStorage.getItem('userToken');
        const user = raw ? JSON.parse(raw) as { token?: string } : null;
        if (!user?.token) throw new Error('Vui lòng đăng nhập lại để theo dõi đơn hàng.');
        const response = await fetch(`${API_URL}/orders/getOrdersForTracking`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const payload = await parseTrackingResponse(response);
        if (!response.ok) throw new Error(payload.message || 'Không thể tải đơn hàng.');
        if (!Array.isArray(payload.data)) throw new Error('Danh sách đơn hàng không hợp lệ.');
        if (active) {
          setOrders(payload.data);
          setSelectedOrder((current) => {
            const latest = current
              ? payload.data?.find((order) => order.OrderID === current.OrderID)
              : payload.data?.[0];
            if (!latest) return null;
            if (
              current
              && latest.shipping_status === current.shipping_status
              && latest.sender_address === current.sender_address
              && latest.driver_name === current.driver_name
            ) return current;
            return latest;
          });
        }
      } catch (loadError) {
        console.error('Không thể tải đơn theo dõi:', loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : 'Không thể tải đơn hàng.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadOrders();
    const refreshTimer = setInterval(() => { void loadOrders(); }, 30_000);
    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, []);

  useEffect(() => {
    let active = true;
    if (!selectedOrder) {
      setRoute(null);
      return () => { active = false; };
    }
    if (['Đã tới ga', 'Đã lên toa'].includes(selectedOrder.shipping_status ?? '')) {
      setRoute(null);
      return () => { active = false; };
    }
    const toStation = selectedOrder.shipping_status === 'Đã nhận hàng';
    const from = toStation ? selectedOrder.sender_address : DRIVER_START;
    const to = toStation ? STATION : selectedOrder.sender_address;
    if (!from || !to) {
      setError('Đơn hàng thiếu địa chỉ để tính lộ trình.');
      return () => { active = false; };
    }
    setRouteLoading(true);
    setError('');
    void fetchRoadRoute(from, to)
      .then((result) => {
        if (!active) return;
        setRoute(result);
        const longitudes = result.coordinates.map(([longitude]) => longitude);
        const latitudes = result.coordinates.map(([, latitude]) => latitude);
        cameraRef.current?.fitBounds(
          [
            Math.min(...longitudes),
            Math.min(...latitudes),
            Math.max(...longitudes),
            Math.max(...latitudes),
          ],
          { padding: { top: 80, right: 40, bottom: 80, left: 40 }, duration: 600 },
        );
      })
      .catch((routeError) => {
        console.error('Không thể tính tuyến đường:', routeError);
        if (active) setError(routeError instanceof Error ? routeError.message : 'Không thể tính tuyến đường.');
      })
      .finally(() => {
        if (active) setRouteLoading(false);
      });
    return () => { active = false; };
  }, [selectedOrder]);

  if (IS_EXPO_GO || !MAPTILES_KEY) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>
          {IS_EXPO_GO ? 'Goong Map cần Development Build' : 'Thiếu cấu hình bản đồ'}
        </Text>
        <Text style={styles.muted}>
          {IS_EXPO_GO ? 'MapLibre không chạy trong Expo Go.' : 'Cần EXPO_PUBLIC_GOONG_MAPTILES_KEY.'}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Map style={styles.map} mapStyle={MAP_STYLE}>
        <Camera ref={cameraRef} initialViewState={{ center: [106.7, 10.78], zoom: 11 }} />
        {route && route.coordinates.length > 1 && (
          <>
            <Marker id="guest-driver-origin" lngLat={route.coordinates[0]} anchor="bottom">
              <View style={styles.driverMarker}><Ionicons name="car" size={20} color="#fff" /></View>
            </Marker>
            <Marker id="guest-order-destination" lngLat={route.coordinates[route.coordinates.length - 1]} anchor="bottom">
              <View style={styles.destinationMarker}><Ionicons name="location" size={22} color="#fff" /></View>
            </Marker>
            <GeoJSONSource
              id="guest-order-route"
              data={{
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates: route.coordinates },
              }}
            >
              <Layer
                id="guest-order-route-line"
                type="line"
                paint={{ 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.9 }}
              />
            </GeoJSONSource>
          </>
        )}
      </Map>
      <View style={[styles.panel, { top: Math.max(insets.top + 12, 16) }]}>
        <Text style={styles.title}>Theo dõi đơn hàng</Text>
        {loading ? <ActivityIndicator color="#2563eb" /> : orders.length === 0 ? (
          <Text style={styles.muted}>Chưa có đơn hàng của tổ chức bạn.</Text>
        ) : (
          <ScrollView style={styles.orderList}>
            {orders.map((order) => (
              <TouchableOpacity
                key={order.OrderID}
                style={[styles.orderRow, selectedOrder?.OrderID === order.OrderID && styles.selected]}
                onPress={() => setSelectedOrder(order)}
              >
                <Text style={styles.orderTitle}>#{order.OrderID} · {order.order_name || order.sender_name || 'Đơn hàng'}</Text>
                <Text style={styles.muted}>{order.shipping_status || 'Chưa có trạng thái'}</Text>
                {!['Đã lên toa', 'Đã dỡ toa'].includes(order.shipping_status ?? '') && (
                  <Text style={styles.muted}>{order.driver_name || 'Chưa phân công tài xế'}</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {routeLoading && <Text style={styles.muted}>Đang tính ETA...</Text>}
        {route && (
          <Text style={styles.eta}>
            ETA mô phỏng: {route.durationText || 'Không có dữ liệu'} · {route.distanceText || ''}
          </Text>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.muted}>Cập nhật mỗi 30 giây · Vị trí mô phỏng: KDC Nam Thịnh.</Text>
      </View>
    </View>
  );
}

async function geocodeAddress(address: string): Promise<Coordinate> {
  const query = new URLSearchParams({
    address: `${address}, Việt Nam`,
    api_key: GOONG_API_KEY,
  });
  const response = await fetch(`https://rsapi.goong.io/Geocode?${query}`);
  const payload = await response.json();
  const location = payload.results?.[0]?.geometry?.location;
  if (!response.ok || typeof location?.lng !== 'number' || typeof location?.lat !== 'number') {
    throw new Error(payload.error_message || `Không tìm thấy tọa độ: ${address}`);
  }
  return [location.lng, location.lat];
}

async function parseTrackingResponse(
  response: Response,
): Promise<{ data?: Order[]; message?: string }> {
  const body = await response.text();
  let payload: { data?: Order[]; message?: string } | null = null;
  try {
    payload = JSON.parse(body) as { data?: Order[]; message?: string };
  } catch {}
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('API theo dõi chưa có trên máy chủ. Hãy triển khai bản cập nhật backend rồi tải lại ứng dụng.');
    }
    throw new Error(
      payload?.message || `Máy chủ gặp lỗi HTTP ${response.status}. Kiểm tra log backend để biết nguyên nhân.`,
    );
  }
  if (!payload) throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
  return payload;
}

async function fetchRoadRoute(originAddress: string, destinationAddress: string): Promise<Route> {
  if (!GOONG_API_KEY) throw new Error('Thiếu EXPO_PUBLIC_GOONG_API_KEY.');
  const [origin, destination] = await Promise.all([
    geocodeAddress(originAddress),
    geocodeAddress(destinationAddress),
  ]);
  const query = new URLSearchParams({
    origin: `${origin[1]},${origin[0]}`,
    destination: `${destination[1]},${destination[0]}`,
    vehicle: 'car',
    api_key: GOONG_API_KEY,
  });
  const response = await fetch(`https://rsapi.goong.io/direction?${query}`);
  const payload = await response.json();
  const firstRoute = payload.routes?.[0];
  if (!response.ok || !firstRoute) throw new Error(payload.error_message || 'Không tìm thấy tuyến đường.');
  const coordinates = firstRoute.overview_polyline?.points
    ? decodePolyline(firstRoute.overview_polyline.points)
    : firstRoute.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error('Tuyến đường không hợp lệ.');
  const seconds = firstRoute.legs?.[0]?.duration?.value || firstRoute.duration;
  const meters = firstRoute.legs?.[0]?.distance?.value || firstRoute.distance;
  return {
    coordinates,
    durationText: seconds ? `${Math.ceil(seconds / 60)} phút` : undefined,
    distanceText: meters ? `${(meters / 1000).toFixed(1)} km` : undefined,
  };
}

function decodePolyline(encoded: string): Coordinate[] {
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const points: Coordinate[] = [];
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
    points.push([longitude / 1e5, latitude / 1e5]);
  }
  return points;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  panel: { position: 'absolute', left: 14, right: 14, maxHeight: '70%', padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.97)' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#eef6ff' },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  orderList: { maxHeight: 290 },
  orderRow: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  selected: { backgroundColor: '#eff6ff' },
  orderTitle: { fontWeight: '600', color: '#1e293b' },
  muted: { color: '#64748b', fontSize: 12, marginTop: 3 },
  eta: { color: '#1d4ed8', fontWeight: '700', marginTop: 8 },
  error: { color: '#b91c1c', marginTop: 6 },
  driverMarker: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2563eb' },
  destinationMarker: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#dc2626' },
});
