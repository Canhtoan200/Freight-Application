import AsyncStorage from '@react-native-async-storage/async-storage';
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
  receiver_name?: string;
  driver_name?: string;
  shipping_status?: string;
};

type Route = { coordinates: Coordinate[]; durationText?: string; distanceText?: string };

const API_URL = 'https://freight-application-server.onrender.com/api/v1';
const GOONG_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY ?? '';
const MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';
const STYLE_URL = `https://tiles.goong.io/assets/goong_map_web.json?api_key=${encodeURIComponent(MAPTILES_KEY)}`;
const DRIVER_START = 'KDC Nam Thịnh, An Bình, Dĩ An, Bình Dương';
const STATION = 'Ga Sóng Thần, Dĩ An, Bình Dương';
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css';

export default function GuestTrackingMap() {
  const insets = useSafeAreaInsets();
  const mapContainerRef = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const syncMapRef = useRef<() => void>(() => {});
  const markerRefs = useRef<any[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const rawUser = await AsyncStorage.getItem('userToken');
        const user = rawUser ? JSON.parse(rawUser) as { token?: string } : null;
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
        console.error('Không thể tải đơn để theo dõi:', loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : 'Không thể tải đơn hàng.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const refreshTimer = setInterval(() => { void load(); }, 30_000);
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

    const destinationAddress =
      selectedOrder.shipping_status === 'Đã nhận hàng' ? STATION : selectedOrder.sender_address;
    const originAddress =
      selectedOrder.shipping_status === 'Đã nhận hàng'
        ? selectedOrder.sender_address
        : DRIVER_START;
    if (!destinationAddress || !originAddress) {
      setError('Đơn hàng thiếu địa chỉ để xác định lộ trình.');
      return () => { active = false; };
    }

    setRouteLoading(true);
    setError('');
    void fetchRoute(originAddress, destinationAddress)
      .then((result) => {
        if (active) setRoute(result);
      })
      .catch((routeError) => {
        console.error('Không thể tải lộ trình đơn hàng:', routeError);
        if (active) setError(routeError instanceof Error ? routeError.message : 'Không thể tải lộ trình.');
      })
      .finally(() => {
        if (active) setRouteLoading(false);
      });

    return () => { active = false; };
  }, [selectedOrder]);

  useEffect(() => {
    let mounted = true;
    let map: any;
    let resizeObserver: ResizeObserver | null = null;
    void loadMapLibre().then((maplibregl) => {
      if (!mounted || !mapContainerRef.current || !maplibregl) return;
      map = new maplibregl.Map({
        container: mapContainerRef.current,
        style: STYLE_URL,
        center: [106.7, 10.78],
        zoom: 11,
      });
      mapRef.current = map;
      if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current.parentElement) {
        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(mapContainerRef.current.parentElement);
      }
      map.on('error', (event: any) => {
        console.error('MapLibre guest map error:', event?.error ?? event);
        if (mounted) setError('Không tải được nền bản đồ Goong. Kiểm tra MAPTILES key và quyền truy cập tên miền.');
      });
      map.on('load', () => {
        map.resize();
        syncMapRef.current();
      });
    }).catch((mapError) => {
      console.error('Không thể khởi tạo bản đồ theo dõi:', mapError);
      if (mounted) setError('Không thể khởi tạo bản đồ. Kiểm tra cấu hình Goong.');
    });
    return () => {
      mounted = false;
      resizeObserver?.disconnect();
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  const syncMap = () => {
    const map = mapRef.current;
    const maplibregl = (window as any).maplibregl;
    if (!map || !maplibregl || !map.isStyleLoaded()) return;
    markerRefs.current.forEach((marker) => marker.remove());
    markerRefs.current = [];

    const sourceId = 'guest-tracking-route';
    const routeData = {
      type: 'FeatureCollection',
      features: route?.coordinates.length
        ? [{
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: route.coordinates },
          }]
        : [],
    };
    if (map.getSource(sourceId)) {
      map.getSource(sourceId).setData(routeData);
    } else {
      map.addSource(sourceId, { type: 'geojson', data: routeData });
      map.addLayer({
        id: 'guest-tracking-route-line',
        type: 'line',
        source: sourceId,
        paint: { 'line-color': '#2563eb', 'line-width': 5 },
      });
    }

    if (route?.coordinates.length) {
      markerRefs.current.push(
        new maplibregl.Marker({ color: '#2563eb' }).setLngLat(route.coordinates[0]).addTo(map),
        new maplibregl.Marker({ color: '#dc2626' })
          .setLngLat(route.coordinates[route.coordinates.length - 1]).addTo(map),
      );
      const initialBounds: [[number, number], [number, number]] = [
        [route.coordinates[0][0], route.coordinates[0][1]],
        [route.coordinates[0][0], route.coordinates[0][1]],
      ];
      const bounds = route.coordinates.reduce<[[number, number], [number, number]]>(
        (acc: [[number, number], [number, number]], coordinate) => [
          [Math.min(acc[0][0], coordinate[0]), Math.min(acc[0][1], coordinate[1])],
          [Math.max(acc[1][0], coordinate[0]), Math.max(acc[1][1], coordinate[1])],
        ],
        initialBounds,
      );
      map.fitBounds(bounds, { padding: 70, duration: 500 });
    }
  };

  syncMapRef.current = syncMap;
  useEffect(() => { syncMapRef.current(); }, [route]);

  return (
    <View style={styles.container}>
      <View ref={mapContainerRef} style={styles.map} />
      <View style={[styles.panel, { top: Math.max(insets.top + 12, 16) }]}>
        <Text style={styles.title}>Theo dõi đơn hàng</Text>
        {loading ? <ActivityIndicator color="#2563eb" /> : orders.length === 0 ? (
          <Text style={styles.muted}>Chưa có đơn hàng thuộc tổ chức của bạn.</Text>
        ) : (
          <ScrollView style={styles.orderList}>
            {orders.map((order) => (
              <TouchableOpacity
                key={order.OrderID}
                style={[styles.order, selectedOrder?.OrderID === order.OrderID && styles.selected]}
                onPress={() => setSelectedOrder(order)}
              >
                <Text style={styles.orderTitle}>#{order.OrderID} · {order.order_name || order.sender_name}</Text>
                <Text style={styles.muted}>{order.shipping_status || 'Chưa có trạng thái'}</Text>
                <Text style={styles.muted}>{order.driver_name || 'Chưa phân công tài xế'}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {routeLoading && <Text style={styles.muted}>Đang tính lộ trình và ETA...</Text>}
        {!!route && (
          <Text style={styles.eta}>
            ETA mô phỏng: {route.durationText || 'Không có dữ liệu'} · {route.distanceText || ''}
          </Text>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Text style={styles.note}>Dữ liệu làm mới mỗi 30 giây. Vị trí tài xế dùng điểm mô phỏng tại KDC Nam Thịnh.</Text>
      </View>
    </View>
  );
}

async function fetchRoute(originAddress: string, destinationAddress: string): Promise<Route> {
  if (!GOONG_KEY) throw new Error('Thiếu EXPO_PUBLIC_GOONG_API_KEY.');
  const [origin, destination] = await Promise.all([
    geocode(originAddress),
    geocode(destinationAddress),
  ]);
  const query = new URLSearchParams({
    origin: `${origin[1]},${origin[0]}`,
    destination: `${destination[1]},${destination[0]}`,
    vehicle: 'car',
    api_key: GOONG_KEY,
  });
  const response = await fetch(`https://rsapi.goong.io/direction?${query}`);
  const payload = await response.json();
  if (!response.ok || !payload.routes?.[0]) throw new Error(payload.error_message || 'Không tìm thấy tuyến đường.');
  const first = payload.routes[0];
  const coordinates = first.overview_polyline?.points
    ? decodePolyline(first.overview_polyline.points)
    : first.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error('Tuyến đường không có dữ liệu hợp lệ.');
  const duration = first.legs?.[0]?.duration?.value || first.duration;
  const distance = first.legs?.[0]?.distance?.value || first.distance;
  return {
    coordinates,
    durationText: duration ? `${Math.ceil(duration / 60)} phút` : undefined,
    distanceText: distance ? `${(distance / 1000).toFixed(1)} km` : undefined,
  };
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
      throw new Error('API theo dõi chưa có trên máy chủ. Hãy triển khai bản cập nhật backend rồi tải lại trang.');
    }
    throw new Error(
      payload?.message || `Máy chủ gặp lỗi HTTP ${response.status}. Kiểm tra log backend để biết nguyên nhân.`,
    );
  }
  if (!payload) throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
  return payload;
}

async function geocode(address: string): Promise<Coordinate> {
  const query = new URLSearchParams({ address: `${address}, Việt Nam`, api_key: GOONG_KEY });
  const response = await fetch(`https://rsapi.goong.io/Geocode?${query}`);
  const payload = await response.json();
  const location = payload.results?.[0]?.geometry?.location;
  if (!response.ok || typeof location?.lng !== 'number' || typeof location?.lat !== 'number') {
    throw new Error(payload.error_message || `Không tìm thấy tọa độ: ${address}`);
  }
  return [location.lng, location.lat];
}

function decodePolyline(encoded: string): Coordinate[] {
  let index = 0;
  let latitude = 0;
  let longitude = 0;
  const points: Coordinate[] = [];
  while (index < encoded.length) {
    const next = () => {
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
    latitude += next();
    longitude += next();
    points.push([longitude / 1e5, latitude / 1e5]);
  }
  return points;
}

function loadMapLibre(): Promise<any> {
  if (!MAPTILES_KEY) return Promise.reject(new Error('Thiếu EXPO_PUBLIC_GOONG_MAPTILES_KEY.'));
  if ((window as any).maplibregl) return Promise.resolve((window as any).maplibregl);
  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${MAPLIBRE_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = MAPLIBRE_CSS;
      document.head.appendChild(link);
    }
    const script = document.createElement('script');
    script.src = MAPLIBRE_JS;
    script.onload = () => resolve((window as any).maplibregl);
    script.onerror = () => reject(new Error('Không tải được MapLibre.'));
    document.body.appendChild(script);
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 500, position: 'relative' },
  map: {
    flex: 1,
    minHeight: 500,
    width: '100%',
    height: '100%',
  },
  panel: { position: 'absolute', left: 16, width: 330, maxHeight: '80%', padding: 14, borderRadius: 14, backgroundColor: 'white' },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  orderList: { maxHeight: 300 },
  order: { paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  selected: { backgroundColor: '#eff6ff' },
  orderTitle: { fontWeight: '600', color: '#1e293b' },
  muted: { color: '#64748b', fontSize: 12, marginTop: 3 },
  eta: { color: '#1d4ed8', fontWeight: '700', marginTop: 8 },
  error: { color: '#b91c1c', marginTop: 6 },
  note: { color: '#64748b', fontSize: 11, marginTop: 8 },
});
