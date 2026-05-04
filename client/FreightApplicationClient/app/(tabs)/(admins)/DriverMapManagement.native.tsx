import Ionicons from "@expo/vector-icons/build/Ionicons";
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
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    zoomLevel: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrderID, setSelectedOrderID] = useState<number | null>(null);
  const [selectedOrderCoordinate, setSelectedOrderCoordinate] = useState<[number, number] | null>(null);
  const canUseMapbox = Boolean(Mapbox && MAPBOX_ACCESS_TOKEN && !IS_EXPO_GO);
  const [errorMessage, setErrorMessage] = useState(
    IS_EXPO_GO
      ? "Mapbox cần Development Build và không chạy trực tiếp trong Expo Go."
      : MAPBOX_ACCESS_TOKEN
        ? ""
        : "Thiếu EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN để hiển thị bản đồ Mapbox.",
  );

  useEffect(() => {
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
  const SelectedOrder = async (selectedOrder: Order) => {
    setSelectedOrderID(selectedOrder.OrderID);
    setSelectedOrderCoordinate(null);
    const features = await searchAddress(selectedOrder);
    if (features && features.length > 0) {
      const [longitude, latitude] = features[0].center;
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
  };
  const renderOrderRow = (order: Order) => (
    <View key={order.OrderID}>
      <TouchableOpacity onPress={() => SelectedOrder(order)}>
      <Text style={styles.panelContent} numberOfLines={1}>
        #{order.OrderID} – {order.organization || order.sender_name || "Khách hàng"} {"\n"}
      </Text>
      <View style={styles.divider} />
      </TouchableOpacity>
    </View>
  );
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
          <TouchableOpacity onPress={() => setSelectedOrderID(null)} style={styles.closeButton}>
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
          <TouchableOpacity style={styles.submitButton}>
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
  const searchAddress = async (order: Order) => {
    const token = "pk.eyJ1IjoiY2FuaHRvYW4wMDAiLCJhIjoiY21vNm84OXo1MjN4ZzJ5b2VjcjdwNzlheCJ9.ZUs6kySzEPQxOJ995AG5iw";
    
    if (!order.sender_address) {
      console.warn("sender_address is undefined");
      return [];
    }

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(order.sender_address)}.json?access_token=${token}&limit=1&country=vn&language=vi`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.features && data.features.length > 0) {
        return data.features;
      } else {
        console.log("Không tìm thấy địa chỉ phù hợp");
        return [];
      }
    } catch (error) {
      console.error("Lỗi gọi API Mapbox:", error);
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
                <Mapbox.Callout title="Địa chỉ đơn hàng" />
              </Mapbox.PointAnnotation>
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
            <Text style={styles.panelTitle}>Danh sách khách hàng đã lên đơn hàng:</Text>
            {loading ? (
              <Text style={styles.emptyText}>Đang tải...</Text>
            ) : orders.length > 0 ? (
              orders.map(renderOrderRow)
            ) : (
              <Text style={styles.emptyText}>Chưa có đơn hàng đang vận chuyển</Text>
            )}
          </View>
          {selectedOrderID !== null && renderOrderDriver(selectedOrderID)}
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
});
