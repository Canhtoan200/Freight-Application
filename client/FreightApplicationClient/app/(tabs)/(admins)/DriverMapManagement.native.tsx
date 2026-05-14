import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from "expo-constants";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const MAPBOX_STYLE_URL = "mapbox://styles/mapbox/streets-v12";
const IS_EXPO_GO =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";
const Mapbox = (() => {
  try {
    const module = require("@rnmapbox/maps");
    return module.default ?? module;
  } catch {
    return null;
  }
})() as any | null;

if (Mapbox && MAPBOX_ACCESS_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

export default function DriverMapManagement() {
  const insets = useSafeAreaInsets();
  const cameraRef = useRef<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [viewMode, setViewMode] = useState<'order' | 'driver'>('order');
  const [selectedDriverID, setSelectedDriverID] = useState<number | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    zoomLevel: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrderID, setSelectedOrderID] = useState<number | null>(null);
  const [selectedOrderCoordinate, setSelectedOrderCoordinate] = useState<[number, number] | null>(null);
  const [selectedDriverCoordinate, setSelectedDriverCoordinate] = useState<[number, number] | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][] | null>(null);
  const canUseMapbox = Boolean(Mapbox && MAPBOX_ACCESS_TOKEN && !IS_EXPO_GO);
  const [errorMessage, setErrorMessage] = useState(
    IS_EXPO_GO
      ? "Mapbox cần Development Build và không chạy trực tiếp trong Expo Go."
      : MAPBOX_ACCESS_TOKEN
        ? ""
        : "Thiếu EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN để hiển thị bản đồ Mapbox.",
  );

  useEffect(() => {
    fetchDriverDetauls();
    fetchOrderStatus();
    let isMounted = true;

    const getCurrentLocation = async () => {
      if (!canUseMapbox) {
        setLoading(false);
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          if (isMounted) {
            setErrorMessage("Bạn chưa cấp quyền vị trí cho ứng dụng.");
          }
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const nextLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          zoomLevel: 15,
        };

        if (isMounted) {
          setCurrentLocation(nextLocation);
        }
      } catch (error) {
        console.error("Lỗi lấy vị trí hiện tại:", error);
        if (isMounted) {
          setErrorMessage("Không thể lấy vị trí hiện tại.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    getCurrentLocation();
    return () => {
      isMounted = false;
    };
  }, [canUseMapbox]);

  useEffect(() => {
    if (selectedDriverCoordinate && selectedOrderCoordinate) {
      fetchRoute(selectedDriverCoordinate, selectedOrderCoordinate);
    } else {
      setRouteCoordinates(null);
    }
  }, [selectedDriverCoordinate, selectedOrderCoordinate]);

  const fetchOrderStatus = async () => {
    try {
      const response = await fetch('https://freight-application-server.onrender.com/api/v1/orders/getAllOrderByStatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipping_status: "Đã tiếp nhận"
        })
      });

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error("Server trả về không phải JSON:", text.slice(0, 200));
        console.log("Lỗi server: Máy chủ chưa sẵn sàng hoặc đang khởi động lại.");
        return;
      }

      const data = await response.json();
      if (response.ok) {
        setOrders(data.data || data || []);
      } else {
        console.log("Lỗi server:", data.message || "Không thể tải danh sách");
      }
    } catch (error) {
      console.error("Lỗi kết nối", "Không thể kết nối đến máy chủ");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  const fetchDriverDetauls = async () => {
    try {
      const response = await fetch('https://freight-application-server.onrender.com/api/v1/drivers/getAllDrivers');
      const data = await response.json();
      if (response.ok) {
        setDrivers(data.data || []);
      } else {
        console.log("Lỗi", "Không thể tải danh sách tài xế");
      }
    } catch (error) {
      console.error("Lỗi kết nối", "Không thể kết nối đến máy chủ");
      console.error(error);
    }
  }
  const SelectedOrder = async (selectedOrder: Order) => {
    setSelectedOrderID(selectedOrder.OrderID);
    setSelectedOrderCoordinate(null);
    setSelectedDriverCoordinate(null);

    // Geocode sender address
    const orderFeatures = await searchAddress(selectedOrder.sender_address);
    if (orderFeatures && orderFeatures.length > 0) {
      const [longitude, latitude] = orderFeatures[0].geometry.coordinates;
      const coord: [number, number] = [longitude, latitude];
      setSelectedOrderCoordinate(coord);
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: coord,
          zoomLevel: 15,
          animationDuration: 1000,
        });
      }
    }

    // Geocode driver_link address for the assigned driver
    const matchedDriver = drivers.find(d => d.driver_name === selectedOrder.driver_name);
    if (matchedDriver?.driver_link) {
      const driverFeatures = await searchAddress(matchedDriver.driver_link);
      if (driverFeatures && driverFeatures.length > 0) {
        const [longitude, latitude] = driverFeatures[0].geometry.coordinates;
        setSelectedDriverCoordinate([longitude, latitude]);
        if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: [longitude, latitude],
          zoomLevel: 15,
          animationDuration: 1000,
        });
      }
      }
    }
  };
  const renderOrderRow = (order: Order, index: number) => (
    <View key={order.OrderID ?? index}>
      <TouchableOpacity onPress={() => SelectedOrder(order)}>
      <Text style={styles.panelContent} numberOfLines={1}>
        #{order.OrderID} – {order.organization || order.sender_name || "Khách hàng"} {"\n"}
      </Text>
      <View style={styles.divider} />
      </TouchableOpacity>
    </View>
  );
  const SelectedDriver = async (driver: Driver) => {
    setSelectedDriverID(driver.DriverIDs);
    setSelectedDriverCoordinate(null);
    if (!driver.driver_link) return;
    const features = await searchAddress(driver.driver_link);
    if (features && features.length > 0) {
      const [longitude, latitude] = features[0].geometry.coordinates;
      const coord: [number, number] = [longitude, latitude];
      setSelectedDriverCoordinate(coord);
      if (cameraRef.current) {
        cameraRef.current.setCamera({
          centerCoordinate: coord,
          zoomLevel: 15,
          animationDuration: 1000,
        });
      }
    }
  };
  const submitDriverOrder = async () => {
    if (!selectedDriverID || !selectedOrderID) return;
    try {
      const response = await fetch('https://freight-application-server.onrender.com/api/v1/drivers/createDriverOrderDetail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          DriverIDs: selectedDriverID,
          OrderIDs: [selectedOrderID],
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        console.error("Lỗi xác nhận tài xế:", data.message);
      }
    } catch (error) {
      console.error("Lỗi kết nối:", error);
    }
    setSelectedOrderID(null);
    setSelectedDriverID(null);
    setViewMode('order');
    fetchOrderStatus();
  };
  const renderDriverRow = (driver: Driver, index: number) => (
    <View key={driver.DriverIDs ?? index}>
      <TouchableOpacity onPress={() => SelectedDriver(driver)}>
        <Text style={styles.panelContent} numberOfLines={1}>
          {driver.driver_name || 'Tài xế'} – {driver.driver_license_plate_number || '—'}{"\n"}
        </Text>
        <View style={styles.divider} />
      </TouchableOpacity>
    </View>
  );

  const renderDriverDetail = (driverID: number) => {
    const driver = drivers.find(d => d.DriverIDs === driverID);
    if (!driver) return null;

    return (
      <View key={driverID} style={styles.bottomPanel}>
        <View style={styles.dragHandle} />
        <View style={styles.panelHeader}>
          <TouchableOpacity onPress={() => setSelectedDriverID(null)} style={styles.closeButton}>
            <Ionicons name="arrow-back" size={20} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.panelHeaderTitle}>Chi tiết tài xế</Text>
          <TouchableOpacity onPress={() => { setSelectedDriverID(null); setViewMode('order'); }} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
          <Text style={styles.orderName}>{driver.driver_name || '—'}</Text>
          <View style={styles.infoRow}>
            <Ionicons name="call-outline" size={16} color="#64748b" />
            <Text style={styles.infoText}>{driver.driver_phone_number || '—'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="car-outline" size={16} color="#64748b" />
            <Text style={styles.infoText}>{driver.driver_license_plate_number || '—'}</Text>
          </View>
          <View style={styles.infoDivider} />
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Tải trọng còn</Text>
              <Text style={styles.statValue}>{driver.the_remaining_weight_of_the_car ?? '—'}kg</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Thể tích còn</Text>
              <Text style={styles.statValue}>{driver.the_remaining_volume_of_the_car ?? '—'} lít</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Khoảng cách</Text>
              {/* Distance from driver to sender_address location */}
              <Text style={styles.statValue}>
                {selectedDriverCoordinate && selectedOrderCoordinate
                  ? `${calculateDistance(selectedDriverCoordinate, selectedOrderCoordinate)}km`
                  : driver.drop_off_distance != null
                    ? `${driver.drop_off_distance}km`
                    : '—'}
              </Text>
            </View>
          </View>
        </ScrollView>
        <View style={styles.panelFooter}>
          <TouchableOpacity style={styles.submitButton} onPress={submitDriverOrder}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.submitText}>Xác nhận tài xế</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderOrderDriver = (orderID: number) => {
    const order = orders.find(o => o.OrderID === orderID);
    if (!order) return null;

    return (
      <View key={orderID} style={styles.bottomPanel}>
        {/* Drag handle */}
        <View style={styles.dragHandle} />

        {/* Header */}
        <View style={styles.panelHeader}>
          <Text style={styles.panelHeaderTitle}>Chi tiết đơn hàng</Text>
          <TouchableOpacity onPress={() => { setSelectedOrderID(null); setSelectedDriverCoordinate(null); }} style={styles.closeButton}>
            <Ionicons name="close" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.panelBody} showsVerticalScrollIndicator={false}>
          {/* Order name */}
          <Text style={styles.orderName}>{order.order_name || '—'}</Text>

          {/* Address row */}
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color="#64748b" />
            <Text style={styles.infoText}>{order.sender_address || '—'}</Text>
          </View>

          <View style={styles.infoDivider} />

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Số lượng</Text>
              <Text style={styles.statValue}>{order.goods_quantity ?? '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Khối lượng</Text>
              <Text style={styles.statValue}>{order.goods_weight ? `${order.goods_weight} kg` : '—'}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Thể tích</Text>
              <Text style={styles.statValue}>{order.goods_volumn || '—'}</Text>
            </View>
          </View>
        </ScrollView>

        {/* Action Button */}
        <View style={styles.panelFooter}>
          <TouchableOpacity style={styles.submitButton} onPress={() => { setViewMode('driver'); }}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
            <Text style={styles.submitText}>Đi đến chọn tài xế</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  const centerCoordinate = currentLocation
    ? ([currentLocation!.longitude, currentLocation!.latitude] as [number, number])
    : null;
  const centerMapOnUser = () => {
  if (cameraRef.current && centerCoordinate) {
    cameraRef.current.setCamera({
      centerCoordinate: centerCoordinate,
      zoomLevel: 15,
      animationDuration: 1000, // Smooth transition
    });
  }
  };
  const fetchRoute = async (from: [number, number], to: [number, number]) => {
    const token = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?geometries=geojson&overview=full&access_token=${token}`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.routes && data.routes.length > 0) {
        setRouteCoordinates(data.routes[0].geometry.coordinates);
        if (cameraRef.current) {
          const lngs = [from[0], to[0]];
          const lats = [from[1], to[1]];
          cameraRef.current.fitBounds(
            [Math.max(...lngs), Math.max(...lats)],
            [Math.min(...lngs), Math.min(...lats)],
            [80, 80, 80, 80],
            1000,
          );
        }
      } else {
        setRouteCoordinates(null);
      }
    } catch (error) {
      console.error("Lỗi lấy tuyến đường:", error);
      setRouteCoordinates(null);
    }
  };

  const calculateDistance = (coord1: [number, number], coord2: [number, number]): number => {
    const [lon1, lat1] = coord1;
    const [lon2, lat2] = coord2;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
  };

  const searchAddress = async (address: string | undefined) => {
    // 1. Get your API Key from account.goong.io (Do NOT use Mapbox token here)
    const GOONG_API_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY;
    
    if (!address) {
      console.warn("address is undefined");
      return [];
    }

    // 2. Goong forward geocoding endpoint structure
    const url = `https://rsapi.goong.io/Geocode?address=${encodeURIComponent(address)}&api_key=${GOONG_API_KEY}`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      // 3. Goong returns data inside a 'results' array instead of Mapbox's 'features'
      if (data.results && data.results.length > 0) {
        const topResult = data.results[0];
        const { lat, lng } = topResult.geometry.location;

        // 4. Transform the format so your Mapbox Map Camera can ingest it [lng, lat]
        const simulatedFeatures = [{
          geometry: {
            type: "Point",
            coordinates: [lng, lat] // Keep it [lng, lat] for Mapbox Map compatibility
          },
          place_name: topResult.formatted_address
        }];

        return simulatedFeatures;
      } else {
        console.log("Không tìm thấy địa chỉ phù hợp từ Goong");
        return [];
      }
    } catch (error) {
      console.error("Lỗi gọi API Goong:", error);
      return [];
    }
  };


  return (
    <View style={styles.container}>
      {canUseMapbox ? (
        centerCoordinate ? (
          <>
          <Mapbox.MapView
            style={styles.map}
            styleURL={MAPBOX_STYLE_URL}
            onMapLoadingError={() =>
              setErrorMessage("Mapbox không thể tải dữ liệu bản đồ.")
            }
          >
            <Mapbox.Camera
              ref={cameraRef}
              centerCoordinate={centerCoordinate}
              zoomLevel={currentLocation!.zoomLevel}
              animationMode="none"
            />

            <Mapbox.PointAnnotation
              id="current-location-admin"
              coordinate={centerCoordinate}
              title="Vị trí hiện tại"
              snippet="Bản đồ đang định vị thiết bị"
            >
              <View style={styles.marker} />
            </Mapbox.PointAnnotation>

            {selectedOrderCoordinate && (
              <Mapbox.PointAnnotation
                id="selected-order-location"
                coordinate={selectedOrderCoordinate}
              >
                <View style={styles.orderMarker}>
                  <Ionicons name="location" size={28} color="#dc2626" />
                </View>
                <Mapbox.Callout title="Địa chỉ gửi hàng" />
              </Mapbox.PointAnnotation>
            )}
            {selectedDriverCoordinate && (
              <Mapbox.PointAnnotation
                id="selected-driver-location"
                coordinate={selectedDriverCoordinate}
              >
                <View style={styles.driverMarker}>
                  <Ionicons name="car-sport" size={24} color="black" />
                </View>
                <Mapbox.Callout title="Vị trí tài xế" />
              </Mapbox.PointAnnotation>
            )}
            {routeCoordinates && (
              <Mapbox.ShapeSource
                id="route-source"
                shape={{
                  type: 'Feature',
                  properties: {},
                  geometry: { type: 'LineString', coordinates: routeCoordinates },
                }}
              >
                <Mapbox.LineLayer
                  id="route-layer"
                  style={{
                    lineColor: '#2563eb',
                    lineWidth: 4,
                    lineOpacity: 0.85,
                    lineCap: 'round',
                    lineJoin: 'round',
                  }}
                />
              </Mapbox.ShapeSource>
            )}
          </Mapbox.MapView>
          {/* Floating Action Button */}
          <TouchableOpacity 
            style={styles.locationButton} 
            onPress={centerMapOnUser}
            activeOpacity={0.7}
          >
            <Ionicons name="locate" size={24} color="#2563eb" />
          </TouchableOpacity>
          <View style={[styles.topRightPanel, { top: insets.top - 30 }]}>
            {viewMode === 'order' ? (
              <>
                <Text style={styles.panelTitle}>Danh sách khách hàng đã lên đơn hàng:</Text>
                {loading ? (
                  <Text style={styles.emptyText}>Đang tải...</Text>
                ) : orders.length > 0 ? (
                  orders.map(renderOrderRow)
                ) : (
                  <Text style={styles.emptyText}>Chưa có đơn hàng đang vận chuyển</Text>
                )}
              </>
            ) : (
              <>
                <View style={styles.driverPanelHeader}>
                  <TouchableOpacity onPress={() => { setViewMode('order'); setSelectedDriverID(null); }} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={16} color="#2563eb" />
                  </TouchableOpacity>
                  <Text style={styles.panelTitle}>Danh sách tài xế:</Text>
                </View>
                {loading ? (
                  <Text style={styles.emptyText}>Đang tải...</Text>
                ) : drivers.length > 0 ? (
                  drivers.map(renderDriverRow)
                ) : (
                  <Text style={styles.emptyText}>Chưa có tài xế</Text>
                )}
              </>
            )}
          </View>
          {viewMode === 'order' && selectedOrderID !== null && renderOrderDriver(selectedOrderID)}
          {viewMode === 'driver' && selectedDriverID !== null && renderDriverDetail(selectedDriverID)}
          </> 
        ) : null
      ) : (
        <View style={styles.missingTokenContainer}>
          <Text style={styles.missingTokenTitle}>
            {IS_EXPO_GO
              ? "Mapbox cần Development Build"
              : "Mapbox chưa được cấu hình"}
          </Text>
          <Text style={styles.missingTokenText}>
            {IS_EXPO_GO
              ? "Bạn đang mở ứng dụng bằng Expo Go. Hãy dùng development build để hiển thị Mapbox."
              : "Thêm EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN vào môi trường để hiển thị bản đồ."}
          </Text>
        </View>
      )}

      {loading && (
        <View style={styles.fullscreenLoader}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.overlayText}>Đang lấy vị trí hiện tại...</Text>
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
    width: "100%",
    height: "100%",
  },
  missingTokenContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#eef6ff",
  },
  missingTokenTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  missingTokenText: {
    textAlign: "center",
    color: "#334155",
    lineHeight: 20,
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563eb",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  markerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },  orderMarker: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  driverMarker: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },  fullscreenLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayText: {
    marginTop: 8,
    color: "#111",
    fontWeight: "600",
  },
  banner: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(220,53,69,0.95)",
    padding: 10,
    borderRadius: 10,
  },
  bannerText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
  // ... your existing styles
  locationButton: {
    position: 'absolute',
    bottom: 360, // Adjusted so it doesn't cover your error banner
    right: 20,
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5, // Android shadow
    shadowColor: '#000', // iOS shadow
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
  divider: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 6,
  },
  panelContent: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'System',
  },
  emptyText: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },
  bottomPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  panelHeaderTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0f172a',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  panelBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    maxHeight: 240,
  },
  orderName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  infoDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
    marginVertical: 14,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e2e8f0',
  },
  statLabel: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  panelFooter: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  submitButton: {
    backgroundColor: '#16a34a',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
  },
  submitText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  driverPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  backButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
