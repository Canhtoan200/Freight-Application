import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, Platform } from 'react-native';
import MapView, { Marker, Polyline, UrlTile, PROVIDER_GOOGLE } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Order = {
  OrderID: number;
  order_name?: string;
  goods_quantity?: number;
  receiver_name?: string;
  sender_name?: string;
  sender_address?: string;
  driver_name?: string;
  wagon_number?: string;
  shipping_status?: string;
  goods_weight?: string;
  goods_volumn?: string;
  organization?: string;
};
type Driver = {
  DriverIDs: number;
  driver_name?: string;
  driver_link?: string;
  driver_license_plate_number?: string;
  driver_phone_number?: string;
  amount_of_gas?: number;
  money_amount_of_gas?: number;
  the_remaining_volume_of_the_car?: number;
  the_remaining_weight_of_the_car?: number;
  drop_off_distance?: number;
};

const IS_EXPO_GO =
  Constants.appOwnership === 'expo' ||
  Constants.executionEnvironment === 'storeClient';

const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? '';
const GOONG_API_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY ?? '';

const INITIAL_LOCATION = {
  latitude: 10.7769,
  longitude: 106.7009,
  zoomLevel: 14,
};

type Props = {
  destinationAddress?: string;
};

export default function DriverMap({ destinationAddress }: Props) {
  const mapRef = useRef<MapView | null>(null);
  const [currentLocation, setCurrentLocation] = useState(INITIAL_LOCATION);
  const [loading, setLoading] = useState(true);
  const [destinationCoordinate, setDestinationCoordinate] = useState<[number, number] | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null);
  const canUseGoong = Boolean(GOONG_MAPTILES_KEY && GOONG_API_KEY && !IS_EXPO_GO);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver>();
  const insets = useSafeAreaInsets();
  const [selectedOrderID, setSelectedOrderID] = useState<number | null>(null);
  const [selectedOrderCoordinate, setSelectedOrderCoordinate] = useState<[number, number] | null>(null);
  const [selectedDriverCoordinate, setSelectedDriverCoordinate] = useState<[number, number] | null>(null);
  const [errorMessage, setErrorMessage] = useState(
    IS_EXPO_GO
      ? 'Goong map cần Development Build và không chạy trực tiếp trong Expo Go.'
      : GOONG_MAPTILES_KEY && GOONG_API_KEY
        ? ''
        : !GOONG_MAPTILES_KEY
          ? 'Thiếu EXPO_PUBLIC_GOONG_MAPTILES_KEY để hiển thị bản đồ Goong.'
          : 'Thiếu EXPO_PUBLIC_GOONG_API_KEY để gọi API Goong.',
  );

  useEffect(() => {
    fetchOrdersByUserID(); 
    let isMounted = true;

    const getCurrentLocation = async () => {
      if (!canUseGoong) {
        setLoading(false);
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== 'granted') {
          if (isMounted) setErrorMessage('Bạn chưa cấp quyền vị trí cho ứng dụng.');
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (isMounted) {
          const nextLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            zoomLevel: 15,
          };
          setCurrentLocation(nextLocation);
          mapRef.current?.animateToRegion({
            latitude: nextLocation.latitude,
            longitude: nextLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      } catch (error) {
        console.error('Lỗi lấy vị trí hiện tại:', error);
        if (isMounted) setErrorMessage('Không thể lấy vị trí hiện tại.');
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    getCurrentLocation();
    return () => { isMounted = false; };
  }, [canUseGoong]);

  useEffect(() => {
    if (!destinationAddress || !currentLocation) return;
    (async () => {
      const features = await searchAddress(destinationAddress);
      if (features && features.length > 0) {
        const [lng, lat] = features[0].geometry.coordinates;
        setDestinationCoordinate([lng, lat]);
      }
    })();
  }, [destinationAddress, currentLocation]);

  useEffect(() => {
    if (currentLocation && destinationCoordinate) {
      const from: [number, number] = [currentLocation.longitude, currentLocation.latitude];
      fetchRoute(from, destinationCoordinate);
    } else {
      setRouteCoordinates(null);
    }
  }, [currentLocation, destinationCoordinate]);

  const fetchOrdersByUserID = async () => {
    try {
      const raw = await AsyncStorage.getItem('userToken');
      if (raw) {
        const parsed = JSON.parse(raw);
        const getDriverID = await fetchDriverID(parsed.userID);
        const getDriver = await fetchDriverByDriverID(getDriverID);
        const getDriverOrderID = await fetchDriverOrderID(getDriverID);
        const fetchedOrders: Order[] = [];
        for(let i = 0; i < getDriverOrderID.length; i++) {
          const getOrderID = await fetchOrderID(getDriverOrderID[i]);
          fetchedOrders.push(getOrderID);
        }
        setOrders(fetchedOrders);
      }
    } catch (error) {
      console.error('Lỗi đọc userID:', error);
    }
  };

  const fetchDriverID = async (userID: number) => {
    try {
      const getDriverID = await fetch('https://freight-application-server.onrender.com/api/v1/drivers/getDriverIDBasedOnUserID?userID=' + userID);
      const data = await getDriverID.json();
      if (getDriverID.ok) {
        return data.data;
      } else {
        console.log("Lỗi", "Không thể tải danh sách tài xế");
      }
    } catch (error) {
      console.error("Lỗi kết nối", "Không thể kết nối đến máy chủ");
      console.error(error);
    }
  };
  const fetchDriverByDriverID = async (driverID: number) => {
    try {
      const getDriver = await fetch('https://freight-application-server.onrender.com/api/v1/drivers/getDriverByDriverID?driverID=' + driverID);
      const data = await getDriver.json();
      if (getDriver.ok) {
        setDrivers(data.data);
        return data.data;
      } else {
        console.log("Lỗi", "Không thể tải thông tin tài xế");
      }
    } catch (error) {
      console.error("Lỗi kết nối", "Không thể kết nối đến máy chủ");
      console.error(error);
    }
  };
  const fetchDriverOrderID = async (driverID: number) => {
    try {
      const getDriverOrderID = await fetch('https://freight-application-server.onrender.com/api/v1/drivers/getDriverOrderBasedOnDriverID?driverID=' + driverID);
      const data = await getDriverOrderID.json();
      if (getDriverOrderID.ok) {
        return data.data.map((item: any) => item.OrderIDs);
      } else {
        console.log("Lỗi", "Không thể tải danh sách tài xế");
      }
    } catch (error) {
      console.error("Lỗi kết nối", "Không thể kết nối đến máy chủ");
      console.error(error);
    }
  };
  const fetchOrderID = async (orderID: number) => {
    try {
      const getOrderID = await fetch('https://freight-application-server.onrender.com/api/v1/orders/getOrderByID?OrderID=' + orderID);
      const data = await getOrderID.json();
      if (getOrderID.ok) {
        return data.data;
      } else {
        console.log("Lỗi", "Không thể tải danh sách đơn hàng");
      }
    } catch (error) {
      console.error("Lỗi kết nối", "Không thể kết nối đến máy chủ");
      console.error(error);
    }
  };
  const renderOrderRow = (order: Order, index: number) => {
    if (order.shipping_status === "Đã lên toa") {
      return null; 
    }
  
    return (
      <View key={order.OrderID ?? index}>
        <TouchableOpacity onPress={() => SelectedOrder(order)}>
          <Text style={styles.panelContent} numberOfLines={1}>
            #{order.OrderID} – {order.organization || order.sender_name || "Khách hàng"} {"\n"}
          </Text>
          <View style={styles.divider} />
        </TouchableOpacity>
      </View>
    );
  };
  const SelectedOrder = async (selectedOrder: Order) => {
    setSelectedOrderID(selectedOrder.OrderID);
    setSelectedOrderCoordinate(null);
    setSelectedDriverCoordinate(null);

    // Geocode sender address
    const orderFeatures = await searchAddress(selectedOrder.sender_address ?? '');
    if (orderFeatures && orderFeatures.length > 0) {
      const [longitude, latitude] = orderFeatures[0].geometry.coordinates;
      const coord: [number, number] = [longitude, latitude];
      setSelectedOrderCoordinate(coord);
      const driverFeatures = await searchAddress(drivers?.driver_link ?? '');
      if (driverFeatures && driverFeatures.length > 0) {
        const [driverLng, driverLat] = driverFeatures[0].geometry.coordinates;
        const driverCoord: [number, number] = [driverLng, driverLat];
        setSelectedDriverCoordinate(driverCoord);
        fetchRoute(driverCoord, coord);
      }
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: coord[1],
          longitude: coord[0],
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    }
  };

  const searchAddress = async (address: string) => {
    if (!address) return [];
    const url = `https://rsapi.goong.io/Geocode?address=${encodeURIComponent(address)}&api_key=${GOONG_API_KEY}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.results && data.results.length > 0) {
        const { lat, lng } = data.results[0].geometry.location;
        return [{ geometry: { type: 'Point', coordinates: [lng, lat] } }];
      }
      return [];
    } catch (e) {
      console.error('Geocode error', e);
      return [];
    }
  };

  const fetchRoute = async (from: [number, number], to: [number, number]) => {
    const url = `https://rsapi.goong.io/direction?origin=${from[1]},${from[0]}&destination=${to[1]},${to[0]}&vehicle=car&api_key=${GOONG_API_KEY}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        if (route.geometry && route.geometry.coordinates) {
          setRouteCoordinates(route.geometry.coordinates);
          // Fit map to route
          if (mapRef.current) {
            const coords = route.geometry.coordinates.map((c: any) => ({ latitude: c[1], longitude: c[0] }));
            mapRef.current.fitToCoordinates(coords, { edgePadding: { top: 80, right: 80, bottom: 80, left: 80 }, animated: true });
          }
        } else {
          setRouteCoordinates(null);
        }
      } else {
        setRouteCoordinates(null);
      }
    } catch (error) {
      console.error('Lỗi lấy tuyến đường:', error);
      setRouteCoordinates(null);
    }
  };

  const centerCoordinate = [currentLocation.longitude, currentLocation.latitude] as [number, number];

  const centerMapOnUser = () => {
    if (cameraRef.current && centerCoordinate) {
      cameraRef.current.setCamera({
        centerCoordinate,
        zoomLevel: 15,
        animationDuration: 1000,
      });
    }
  };

  return (
    <View style={styles.container}>
      {canUseGoong ? (
        <>
          <MapView
            ref={(r) => (mapRef.current = r)}
            style={styles.map}
            provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation={true}
            showsMyLocationButton={false}
          >
            {GOONG_MAPTILES_KEY ? (
              <UrlTile urlTemplate={`https://tile.goong.io/1.0.0/{z}/{x}/{y}.png?api_key=${GOONG_MAPTILES_KEY}`} maximumZ={20} flipY={false} />
            ) : null}

            <Marker coordinate={{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }}>
              <View style={styles.marker} />
            </Marker>

            {selectedOrderCoordinate && (
              <Marker coordinate={{ latitude: selectedOrderCoordinate[1], longitude: selectedOrderCoordinate[0] }}>
                <View style={styles.orderMarker}>
                  <Ionicons name="location" size={28} color="#dc2626" />
                </View>
              </Marker>
            )}

            {selectedDriverCoordinate && (
              <Marker coordinate={{ latitude: selectedDriverCoordinate[1], longitude: selectedDriverCoordinate[0] }}>
                <View style={styles.driverMarker}>
                  <Ionicons name="car-sport" size={24} color="black" />
                </View>
              </Marker>
            )}

            {routeCoordinates && (
              <Polyline coordinates={routeCoordinates.map((c) => ({ latitude: c[1], longitude: c[0] }))} strokeColor="#2563eb" strokeWidth={4} />
            )}

            {destinationCoordinate && (
              <Marker coordinate={{ latitude: destinationCoordinate[1], longitude: destinationCoordinate[0] }}>
                <View style={styles.destinationMarker}>
                  <Ionicons name="location" size={28} color="#dc2626" />
                </View>
              </Marker>
            )}

          </MapView>

          <View style={[styles.topRightPanel, { top: insets.top - 30 }]}>
            <Text style={styles.panelTitle}>Danh sách các đơn hàng cần đi hôm nay:</Text>
            {loading ? (
              <Text style={styles.emptyText}>Đang tải...</Text>
            ) : orders.length > 0 ? (
              orders.map(renderOrderRow)
            ) : (
              <Text style={styles.emptyText}>Chưa có đơn hàng đang vận chuyển</Text>
            )}
          </View>
          <TouchableOpacity style={styles.locationButton} onPress={centerMapOnUser} activeOpacity={0.7}>
            <Ionicons name="locate" size={24} color="#2563eb" />
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.missingTokenContainer}>
          <Text style={styles.missingTokenTitle}>
            {IS_EXPO_GO ? 'Goong map cần Development Build' : 'Goong map chưa được cấu hình'}
          </Text>
          <Text style={styles.missingTokenText}>
            {IS_EXPO_GO
              ? 'Bạn đang mở ứng dụng bằng Expo Go. Hãy dùng development build để hiển thị Goong map.'
              : 'Thêm EXPO_PUBLIC_GOONG_MAPTILES_KEY vào môi trường để hiển thị bản đồ.'}
          </Text>
        </View>
      )}

      {loading && (
        <View style={styles.loadingBadge}>
          <ActivityIndicator size="small" color="#2563eb" />
          <Text style={styles.loadingText}>Đang định vị...</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: '100%',
    height: '100%',
  },
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
  missingTokenText: {
    textAlign: 'center',
    color: '#334155',
    lineHeight: 20,
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#2563eb',
    borderWidth: 3,
    borderColor: '#fff',
  },
  destinationMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  loadingBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  loadingText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  banner: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(220,53,69,0.95)',
    padding: 10,
    borderRadius: 10,
  },
  bannerText: {
    color: '#fff',
    textAlign: 'center',
    fontWeight: '600',
  },
  panelContent: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'System',
  },
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 6,
  },
  topRightPanel: {
    position: 'absolute',
    right: 15,
    backgroundColor: 'rgba(255, 255, 255, 0.9)', // Slightly transparent
    padding: 12,
    borderRadius: 12,
    width: 200,
    // Shadow/Elevation
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    zIndex: 10,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  driverMarker: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },  
  orderMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
