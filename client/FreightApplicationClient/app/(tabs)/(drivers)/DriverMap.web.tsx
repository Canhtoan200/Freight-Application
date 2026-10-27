import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Coordinate = [longitude: number, latitude: number];
type Order = {
  OrderID: number;
  order_name?: string;
  sender_address?: string;
  sender_name?: string;
  shipping_status?: string;
  organization?: string;
};
type Route = { coordinates: Coordinate[]; distanceText?: string; durationText?: string };

const API = 'https://freight-application-server.onrender.com/api/v1';
const MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';
const GOONG_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY ?? MAPTILES_KEY;
const STYLE_URL = `https://tiles.goong.io/assets/goong_map_web.json?api_key=${encodeURIComponent(MAPTILES_KEY)}`;
const DRIVER_START = 'KDC Nam Thịnh, An Bình, Dĩ An, Bình Dương';
const HEADING_TO_PICKUP = 'Tài xế đang đi!';
const PICKED_UP = 'Đã nhận hàng';
const ARRIVED_AT_STATION = 'Đã tới ga';
const LOADED_ON_WAGON = 'Đã lên toa';
const SIMULATION_DURATION_MS = 45_000;
const SIMULATION_TICK_MS = 500;
const MAPLIBRE_JS = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://unpkg.com/maplibre-gl@2.4.0/dist/maplibre-gl.css';

export default function DriverMap() {
  const insets = useSafeAreaInsets();
  const mapContainer = useRef<any>(null);
  const mapRef = useRef<any>(null);
  const syncMapRef = useRef<() => void>(() => {});
  const driverMarkerRef = useRef<any>(null);
  const destinationMarkerRef = useRef<any>(null);
  const simulationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selected, setSelected] = useState<Order | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [simulatedCoordinate, setSimulatedCoordinate] = useState<Coordinate | null>(null);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [simulationStarted, setSimulationStarted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [routeLoading, setRouteLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const stopSimulation = () => {
    if (simulationTimerRef.current !== null) {
      clearInterval(simulationTimerRef.current);
      simulationTimerRef.current = null;
    }
    setSimulating(false);
  };

  useEffect(() => () => {
    if (simulationTimerRef.current !== null) clearInterval(simulationTimerRef.current);
    driverMarkerRef.current?.remove();
    destinationMarkerRef.current?.remove();
    mapRef.current?.remove();
  }, []);

  useEffect(() => {
    let active = true;
    void loadAssignedOrders()
      .then((items) => {
        if (!active) return;
        setOrders(items.filter((order) => order.shipping_status !== LOADED_ON_WAGON));
        setSelected(items.find((order) => order.shipping_status !== LOADED_ON_WAGON) ?? null);
      })
      .catch((loadError) => {
        console.error('Không thể tải đơn được phân công:', loadError);
        if (active) setError(loadError instanceof Error ? loadError.message : 'Không thể tải đơn hàng.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    stopSimulation();
    setRoute(null);
    setSimulatedCoordinate(null);
    setSimulationProgress(0);
    setSimulationStarted(false);
    if (
      !selected
      || selected.shipping_status === PICKED_UP
      || selected.shipping_status === ARRIVED_AT_STATION
    ) {
      setRouteLoading(false);
      return () => { active = false; };
    }
    const destination = getDriverDestination(selected);
    const origin = DRIVER_START;
    if (!origin || !destination) {
      setError('Đơn hàng thiếu địa chỉ để tính tuyến đường.');
      return () => { active = false; };
    }
    setError('');
    setRouteLoading(true);
    void fetchRoadRoute(origin, destination)
      .then((result) => {
        if (!active) return;
        setRoute(result);
        setSimulatedCoordinate(result.coordinates[0]);
      })
      .catch((routeError) => {
        console.error('Không thể tính tuyến đường:', routeError);
        if (active) setError(routeError instanceof Error ? routeError.message : 'Không thể tính tuyến đường.');
      })
      .finally(() => { if (active) setRouteLoading(false); });
    return () => { active = false; };
  }, [selected]);

  useEffect(() => {
    let active = true;
    let map: any;
    let resizeObserver: ResizeObserver | null = null;
    void loadMapLibre().then((maplibregl) => {
      if (!active || !mapContainer.current) return;
      map = new maplibregl.Map({
        container: mapContainer.current,
        style: STYLE_URL,
        center: [106.7, 10.78],
        zoom: 11,
      });
      mapRef.current = map;
      if (typeof ResizeObserver !== 'undefined' && mapContainer.current.parentElement) {
        resizeObserver = new ResizeObserver(() => map.resize());
        resizeObserver.observe(mapContainer.current.parentElement);
      }
      map.on('error', (event: any) => {
        console.error('MapLibre driver map error:', event?.error ?? event);
        if (active) {
          setError('Không tải được nền bản đồ Goong. Hãy kiểm tra MAPTILES key và tên miền được phép.');
        }
      });
      map.on('load', () => {
        map.resize();
        syncMapRef.current();
      });
    }).catch((mapError) => {
      console.error('Không thể khởi tạo bản đồ tài xế:', mapError);
      if (active) setError('Không thể mở bản đồ. Kiểm tra cấu hình Goong.');
    });
    return () => {
      active = false;
      resizeObserver?.disconnect();
      if (simulationTimerRef.current !== null) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
      }
      driverMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  const syncMap = () => {
    const map = mapRef.current;
    const maplibregl = (window as any).maplibregl;
    if (!map || !maplibregl || !map.isStyleLoaded()) return;
    const sourceID = 'driver-route';
    const data = {
      type: 'FeatureCollection',
      features: route && route.coordinates.length > 1
        ? [{
            type: 'Feature',
            properties: {},
            geometry: { type: 'LineString', coordinates: route.coordinates },
          }]
        : [],
    };
    if (map.getSource(sourceID)) map.getSource(sourceID).setData(data);
    else {
      map.addSource(sourceID, { type: 'geojson', data });
      map.addLayer({
        id: 'driver-route-line',
        type: 'line',
        source: sourceID,
        paint: { 'line-color': '#2563eb', 'line-width': 5 },
      });
    }
    if (!route || route.coordinates.length < 2) {
      driverMarkerRef.current?.remove();
      destinationMarkerRef.current?.remove();
      driverMarkerRef.current = null;
      destinationMarkerRef.current = null;
      return;
    }

    const driverPosition = simulatedCoordinate ?? route.coordinates[0];
    if (!driverMarkerRef.current) {
      const truck = document.createElement('div');
      truck.textContent = '🚚';
      truck.style.fontSize = '24px';
      truck.style.filter = 'drop-shadow(0 1px 2px rgba(0,0,0,0.45))';
      driverMarkerRef.current = new maplibregl.Marker({ element: truck, anchor: 'center' })
        .setLngLat(driverPosition)
        .addTo(map);
    } else {
      driverMarkerRef.current.setLngLat(driverPosition);
    }
    if (!destinationMarkerRef.current) {
      destinationMarkerRef.current = new maplibregl.Marker({ color: '#dc2626' })
        .setLngLat(route.coordinates[route.coordinates.length - 1])
        .addTo(map);
    } else {
      destinationMarkerRef.current.setLngLat(route.coordinates[route.coordinates.length - 1]);
    }
    const first = route.coordinates[0];
    const initialBounds: [[number, number], [number, number]] = [
      [first[0], first[1]],
      [first[0], first[1]],
    ];
    const bounds = route.coordinates.reduce<[[number, number], [number, number]]>(
      (box: [[number, number], [number, number]], point) => [
        [Math.min(box[0][0], point[0]), Math.min(box[0][1], point[1])],
        [Math.max(box[1][0], point[0]), Math.max(box[1][1], point[1])],
      ],
      initialBounds,
    );
    if (simulationProgress === 0) map.fitBounds(bounds, { padding: 70, duration: 500 });
  };

  syncMapRef.current = syncMap;
  useEffect(() => { syncMapRef.current(); }, [route, simulatedCoordinate, simulationProgress]);

  const updateOrder = async () => {
    if (!selected || saving || !simulationStarted || simulating || simulationProgress < 1) return;
    const next = selected.shipping_status === HEADING_TO_PICKUP ? PICKED_UP : null;
    if (!next) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`${API}/orders/updateShippingStatus`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ OrderID: selected.OrderID, shipping_status: next }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Không thể cập nhật trạng thái.');
      const updated = { ...selected, shipping_status: next };
      stopSimulation();
      setOrders((current) => current.map((order) => order.OrderID === updated.OrderID ? updated : order));
      setSelected(updated);
    } catch (updateError) {
      console.error('Không thể cập nhật trạng thái đơn:', updateError);
      setError(updateError instanceof Error ? updateError.message : 'Không thể cập nhật trạng thái.');
    } finally {
      setSaving(false);
    }
  };

  const startSimulation = () => {
    if (!route || routeLoading || simulationStarted || simulating) return;
    setSimulationStarted(true);
    setSimulating(true);
    setSimulationProgress(0);
    setSimulatedCoordinate(route.coordinates[0]);
    const startedAt = Date.now();
    simulationTimerRef.current = setInterval(() => {
      const progress = Math.min((Date.now() - startedAt) / SIMULATION_DURATION_MS, 1);
      setSimulationProgress(progress);
      setSimulatedCoordinate(interpolateRoute(route.coordinates, progress));
      if (progress >= 1 && simulationTimerRef.current !== null) {
        clearInterval(simulationTimerRef.current);
        simulationTimerRef.current = null;
        setSimulating(false);
      }
    }, SIMULATION_TICK_MS);
  };

  return (
    <View style={styles.container}>
      <View ref={mapContainer} style={styles.map} />
      <View style={[styles.panel, { top: Math.max(insets.top + 10, 16) }]}>
        <Text style={styles.title}>Đơn hàng được phân công</Text>
        {loading ? <ActivityIndicator color="#2563eb" /> : orders.length === 0 ? (
          <Text style={styles.muted}>Chưa có đơn được phân công.</Text>
        ) : (
          <ScrollView style={styles.list}>
            {orders.map((order) => (
              <TouchableOpacity
                key={order.OrderID}
                style={[styles.order, selected?.OrderID === order.OrderID && styles.selected]}
                onPress={() => setSelected(order)}
              >
                <Text style={styles.orderTitle}>#{order.OrderID} · {order.order_name || order.sender_name}</Text>
                <Text style={styles.muted}>{order.shipping_status}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        {selected && (
          <>
            <Text style={styles.muted}>
              {selected.shipping_status === PICKED_UP
                ? 'Đã nhận hàng · có thể tiếp tục nhận đơn khác trước khi tới ga.'
                : selected.shipping_status === ARRIVED_AT_STATION
                  ? 'Đã tới ga · chờ admin xếp toa tàu.'
                  : `Điểm nhận hàng: ${getDriverDestination(selected)}`}
            </Text>
            {selected.shipping_status === HEADING_TO_PICKUP && (
              <Text style={styles.eta}>
              {routeLoading
                ? 'Đang tạo tuyến đường...'
                : simulating
                  ? `Đang mô phỏng tuyến đường · ${Math.floor(simulationProgress * 100)}%`
                  : simulationStarted && simulationProgress >= 1
                    ? 'Đã đến điểm tiếp theo · xác nhận để cập nhật trạng thái'
                    : simulationStarted
                      ? 'Đang ở điểm xuất phát mô phỏng'
                      : 'Đã có tuyến đường · xác nhận đơn để bắt đầu mô phỏng'}
                {' · ETA '}{route?.durationText || '—'} · {route?.distanceText || ''}
              </Text>
            )}
            {selected.shipping_status === HEADING_TO_PICKUP && (
              <TouchableOpacity
                style={[styles.action, (saving || routeLoading || simulating || !route) && styles.disabledAction]}
                onPress={() => {
                  if (!simulationStarted) startSimulation();
                  else void updateOrder();
                }}
                disabled={saving || routeLoading || simulating || !route}
              >
                {saving ? <ActivityIndicator color="#fff" /> : (
                  <Text style={styles.actionText}>
                    {routeLoading
                      ? 'Đang tạo tuyến đường...'
                      : simulating
                        ? 'Đang mô phỏng...'
                        : !simulationStarted
                          ? 'Xác nhận đơn hàng'
                          : simulationProgress < 1
                            ? 'Đang mô phỏng...'
                            : 'Xác nhận đã nhận hàng'}
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </>
        )}
        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

async function loadAssignedOrders(): Promise<Order[]> {
  const raw = await AsyncStorage.getItem('userToken');
  if (!raw) throw new Error('Vui lòng đăng nhập lại.');
  const user = JSON.parse(raw) as { userID?: number };
  if (!user.userID) throw new Error('Không tìm thấy mã tài khoản tài xế.');

  const driverResponse = await fetch(`${API}/drivers/getDriverIDBasedOnUserID?userID=${user.userID}`);
  const driverPayload = await driverResponse.json();
  if (!driverResponse.ok || !driverPayload.data) throw new Error('Không tìm thấy hồ sơ tài xế.');
  const assignmentResponse = await fetch(
    `${API}/drivers/getDriverOrderBasedOnDriverID?driverID=${driverPayload.data}`,
  );
  const assignmentPayload = await assignmentResponse.json();
  if (!assignmentResponse.ok || !Array.isArray(assignmentPayload.data)) {
    throw new Error('Không thể tải đơn được phân công.');
  }
  const details = await Promise.all(
    assignmentPayload.data.map(async (assignment: { OrderIDs: number }) => {
      const response = await fetch(`${API}/orders/getOrderByID?OrderID=${assignment.OrderIDs}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(`Không thể tải đơn #${assignment.OrderIDs}.`);
      return payload.data as Order | undefined;
    }),
  );
  return details.filter((order): order is Order => Boolean(order));
}

function getDriverDestination(order: Order): string | undefined {
  return order.sender_address;
}

async function geocode(address: string): Promise<Coordinate> {
  if (!GOONG_KEY) throw new Error('Thiếu EXPO_PUBLIC_GOONG_API_KEY.');
  const query = new URLSearchParams({ address: `${address}, Việt Nam`, api_key: GOONG_KEY });
  const response = await fetch(`https://rsapi.goong.io/Geocode?${query}`);
  const payload = await response.json();
  const location = payload.results?.[0]?.geometry?.location;
  if (!response.ok || typeof location?.lng !== 'number' || typeof location?.lat !== 'number') {
    throw new Error(payload.error_message || `Không tìm thấy tọa độ: ${address}`);
  }
  return [location.lng, location.lat];
}

async function fetchRoadRoute(from: string, to: string): Promise<Route> {
  const [origin, destination] = await Promise.all([geocode(from), geocode(to)]);
  const query = new URLSearchParams({
    origin: `${origin[1]},${origin[0]}`,
    destination: `${destination[1]},${destination[0]}`,
    vehicle: 'car',
    api_key: GOONG_KEY,
  });
  const response = await fetch(`https://rsapi.goong.io/direction?${query}`);
  const payload = await response.json();
  const first = payload.routes?.[0];
  if (!response.ok || !first) throw new Error(payload.error_message || 'Không tìm thấy tuyến đường.');
  const coordinates = first.overview_polyline?.points
    ? decodePolyline(first.overview_polyline.points)
    : first.geometry?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error('Tuyến đường không hợp lệ.');
  const seconds = first.legs?.[0]?.duration?.value || first.duration;
  const meters = first.legs?.[0]?.distance?.value || first.distance;
  return {
    coordinates,
    durationText: seconds ? `${Math.ceil(seconds / 60)} phút` : undefined,
    distanceText: meters ? `${(meters / 1000).toFixed(1)} km` : undefined,
  };
}

function interpolateRoute(coordinates: Coordinate[], progress: number): Coordinate {
  if (coordinates.length === 1) return coordinates[0];
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
  const result: Coordinate[] = [];
  while (index < encoded.length) {
    const read = () => {
      let value = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        value |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      return (value & 1) ? ~(value >> 1) : value >> 1;
    };
    latitude += read();
    longitude += read();
    result.push([longitude / 1e5, latitude / 1e5]);
  }
  return result;
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
  panel: { position: 'absolute', right: 14, width: 330, maxHeight: '75%', padding: 14, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.97)' },
  title: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 8 },
  list: { maxHeight: 270 },
  order: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
  selected: { backgroundColor: '#eff6ff' },
  orderTitle: { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  muted: { fontSize: 12, color: '#64748b', marginTop: 4 },
  eta: { fontSize: 12, fontWeight: '700', color: '#1d4ed8', marginTop: 8 },
  action: { marginTop: 10, padding: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#2563eb' },
  disabledAction: { opacity: 0.55 },
  actionText: { color: '#fff', fontWeight: '700' },
  error: { color: '#b91c1c', marginTop: 8 },
});
