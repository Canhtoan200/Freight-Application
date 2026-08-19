import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Camera,
  type CameraRef,
  Map,
  Marker,
} from '@maplibre/maplibre-react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Coordinate = [longitude: number, latitude: number];

type Order = {
  OrderID: number;
  organization?: string;
  sender_address?: string;
  sender_name?: string;
  shipping_status?: string;
};

const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';
const GOONG_API_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY ?? '';
const GOONG_STYLE_URL = `https://tiles.goong.io/assets/goong_map_web.json?api_key=${encodeURIComponent(GOONG_MAPTILES_KEY)}`;
const INITIAL_COORDINATE: Coordinate = [106.7009, 10.7769];

export default function DriverMap() {
  const cameraRef = useRef<CameraRef | null>(null);
  const locationSubscriptionRef = useRef<Location.LocationSubscription | null>(null);
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [driverCoordinate, setDriverCoordinate] = useState<Coordinate | null>(null);
  const [selectedOrderID, setSelectedOrderID] = useState<number | null>(null);
  const [selectedOrderCoordinate, setSelectedOrderCoordinate] = useState<Coordinate | null>(null);
  const [errorMessage, setErrorMessage] = useState(
    IS_EXPO_GO
      ? 'MapLibre cần Development Build và không chạy trong Expo Go.'
      : GOONG_MAPTILES_KEY
        ? ''
        : 'Thiếu EXPO_PUBLIC_GOONG_MAPTILES_KEY để hiển thị Goong Map.',
  );

  const canRenderMap = Boolean(GOONG_MAPTILES_KEY && !IS_EXPO_GO);

  useEffect(() => {
    if (!canRenderMap) {
      setLoading(false);
      return;
    }

    let mounted = true;

    void loadDriverOrders().then((fetchedOrders) => {
      if (mounted) setOrders(fetchedOrders);
    });

    const startLocationUpdates = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (mounted) setErrorMessage('Bạn chưa cấp quyền vị trí cho ứng dụng.');
          return;
        }

        const current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!mounted) return;

        const firstCoordinate: Coordinate = [
          current.coords.longitude,
          current.coords.latitude,
        ];
        setDriverCoordinate(firstCoordinate);
        cameraRef.current?.easeTo({
          center: firstCoordinate,
          zoom: 15,
          duration: 800,
        });

        locationSubscriptionRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            distanceInterval: 10,
            timeInterval: 5000,
          },
          (location) => {
            if (!mounted) return;
            setDriverCoordinate([
              location.coords.longitude,
              location.coords.latitude,
            ]);
          },
        );
      } catch (error) {
        console.error('Lỗi lấy vị trí tài xế:', error);
        if (mounted) setErrorMessage('Không thể lấy vị trí hiện tại của tài xế.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void startLocationUpdates();

    return () => {
      mounted = false;
      locationSubscriptionRef.current?.remove();
      locationSubscriptionRef.current = null;
    };
  }, [canRenderMap]);

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
    setSelectedOrderID(order.OrderID);
    setSelectedOrderCoordinate(null);

    if (!GOONG_API_KEY) {
      setErrorMessage('Thiếu EXPO_PUBLIC_GOONG_API_KEY để tìm vị trí đơn hàng.');
      return;
    }

    if (!order.sender_address) {
      setErrorMessage(`Đơn hàng #${order.OrderID} chưa có địa chỉ người gửi.`);
      return;
    }

    const coordinate = await geocodeAddress(order.sender_address);
    if (!coordinate) {
      setErrorMessage(`Không tìm thấy tọa độ của đơn hàng #${order.OrderID}.`);
      return;
    }

    setErrorMessage('');
    setSelectedOrderCoordinate(coordinate);
  };

  const geocodeAddress = async (address: string): Promise<Coordinate | null> => {
    try {
      const response = await fetch(
        `https://rsapi.goong.io/Geocode?address=${encodeURIComponent(address)}&api_key=${encodeURIComponent(GOONG_API_KEY)}`,
      );
      const data = await response.json();
      const location = data.results?.[0]?.geometry?.location;
      return location ? [location.lng, location.lat] : null;
    } catch (error) {
      console.error('Lỗi Goong Geocode:', error);
      return null;
    }
  };

  const centerOnDriver = () => {
    if (!driverCoordinate) return;
    cameraRef.current?.easeTo({
      center: driverCoordinate,
      zoom: 15,
      duration: 700,
    });
  };

  const renderOrderRow = (order: Order, index: number) => {
    if (order.shipping_status === 'Đã lên toa') return null;

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

        {driverCoordinate && (
          <Marker id="driver-location" lngLat={driverCoordinate} anchor="bottom">
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
        <Text style={styles.coordinateTitle}>Tọa độ đang hiển thị</Text>
        <Text style={styles.coordinateText}>
          Tài xế: {formatCoordinate(driverCoordinate)}
        </Text>
        <Text style={styles.coordinateText}>
          Đơn hàng: {formatCoordinate(selectedOrderCoordinate)}
        </Text>
      </View>

      <TouchableOpacity style={styles.locationButton} onPress={centerOnDriver} activeOpacity={0.7}>
        <Ionicons name="locate" size={24} color="#2563eb" />
      </TouchableOpacity>

      {loading && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Đang lấy vị trí tài xế...</Text>
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

function formatCoordinate(coordinate: Coordinate | null) {
  if (!coordinate) return 'chưa có';
  return `${coordinate[1].toFixed(6)}, ${coordinate[0].toFixed(6)}`;
}

async function loadDriverOrders(): Promise<Order[]> {
  try {
    const raw = await AsyncStorage.getItem('userToken');
    if (!raw) return [];

    const { userID } = JSON.parse(raw);
    const driverID = await fetchDriverID(userID);
    if (driverID == null) return [];

    const orderIDs = await fetchDriverOrderIDs(driverID);
    const orders = await Promise.all(orderIDs.map(fetchOrderByID));
    return orders.filter((order): order is Order => Boolean(order));
  } catch (error) {
    console.error('Lỗi tải đơn hàng của tài xế:', error);
    return [];
  }
}

async function fetchDriverID(userID: number): Promise<number | null> {
  try {
    const response = await fetch(
      `https://freight-application-server.onrender.com/api/v1/drivers/getDriverIDBasedOnUserID?userID=${userID}`,
    );
    const data = await response.json();
    return response.ok ? data.data : null;
  } catch (error) {
    console.error('Không thể tải mã tài xế:', error);
    return null;
  }
}

async function fetchDriverOrderIDs(driverID: number): Promise<number[]> {
  try {
    const response = await fetch(
      `https://freight-application-server.onrender.com/api/v1/drivers/getDriverOrderBasedOnDriverID?driverID=${driverID}`,
    );
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.data)) return [];
    return data.data.map((item: { OrderIDs: number }) => item.OrderIDs);
  } catch (error) {
    console.error('Không thể tải danh sách đơn hàng:', error);
    return [];
  }
}

async function fetchOrderByID(orderID: number): Promise<Order | null> {
  try {
    const response = await fetch(
      `https://freight-application-server.onrender.com/api/v1/orders/getOrderByID?OrderID=${orderID}`,
    );
    const data = await response.json();
    return response.ok ? data.data : null;
  } catch (error) {
    console.error(`Không thể tải đơn hàng #${orderID}:`, error);
    return null;
  }
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
