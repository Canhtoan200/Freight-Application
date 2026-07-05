import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from "expo-constants";
import * as Location from "expo-location";
import React, { useEffect, useState, useRef } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View, Platform } from "react-native";
// Load MapLibre dynamically at runtime to avoid compile-time errors when
// the native MapLibre package is not installed in the environment.
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

const GOONG_MAPTILES_KEY = process.env.EXPO_PUBLIC_GOONG_MAPTILES_KEY ?? "";
const GOONG_STYLE_URL = "https://tiles.goong.io/assets/goong_map_web.json";
const GOONG_API_KEY = process.env.EXPO_PUBLIC_GOONG_API_KEY ?? "";
const ANDROID_GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const IS_EXPO_GO =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";

export default function DriverMapManagement() {
  const [MapLibreGL, setMapLibreGL] = useState<any | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import('@maplibre/maplibre-react-native');
        const impl = ((mod as any).default ?? mod) as any;
        if (mounted) setMapLibreGL(impl);
      } catch (e) {
        console.warn('MapLibre native module not available:', e);
      }
    })();
    return () => { mounted = false; };
  }, []);
  const insets = useSafeAreaInsets();
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
  const canUseGoong = Boolean(GOONG_MAPTILES_KEY && GOONG_API_KEY && !IS_EXPO_GO);
  const [errorMessage, setErrorMessage] = useState(
    IS_EXPO_GO
      ? "Goong map cần Development Build và không chạy trực tiếp trong Expo Go."
      : GOONG_MAPTILES_KEY && GOONG_API_KEY
        ? ""
        : !GOONG_MAPTILES_KEY
          ? "Thiếu EXPO_PUBLIC_GOONG_MAPTILES_KEY để hiển thị bản đồ Goong."
          : "Thiếu EXPO_PUBLIC_GOONG_API_KEY để gọi API Goong.",
  );

  useEffect(() => {
    fetchDriverDetails();
    fetchOrderStatus();
    let isMounted = true;

    const getCurrentLocation = async () => {
      if (!canUseGoong) {
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
        // Fallback: try to get last known position (works if Google Play services connection dropped)
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last && isMounted) {
            setCurrentLocation({
              latitude: last.coords.latitude,
              longitude: last.coords.longitude,
              zoomLevel: 15,
            });
            if (isMounted) setErrorMessage("Sử dụng vị trí lưu trữ tạm thời do sự cố dịch vụ vị trí.");
            return;
          }
        } catch (e) {
          console.warn("getLastKnownPositionAsync fallback failed:", e);
        }

        if (isMounted) {
          setErrorMessage("Không thể lấy vị trí hiện tại. Hãy kiểm tra Google Play services hoặc thử thiết bị thật.");
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
  }, [canUseGoong]);

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
  const fetchDriverDetails = async () => {
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
  };
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
    }

    // Geocode driver_link address for the assigned driver
    const matchedDriver = drivers.find(d => d.driver_name === selectedOrder.driver_name);
    if (matchedDriver?.driver_link) {
      const driverFeatures = await searchAddress(matchedDriver.driver_link);
      if (driverFeatures && driverFeatures.length > 0) {
        const [longitude, latitude] = driverFeatures[0].geometry.coordinates;
        setSelectedDriverCoordinate([longitude, latitude]);
      }
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
  const SelectedDriver = async (driver: Driver) => {
    setSelectedDriverID(driver.DriverIDs);
    setSelectedDriverCoordinate(null);
    if (!driver.driver_link) return;
    const features = await searchAddress(driver.driver_link);
    if (features && features.length > 0) {
      const [longitude, latitude] = features[0].geometry.coordinates;
      const coord: [number, number] = [longitude, latitude];
      setSelectedDriverCoordinate(coord);
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
  const decodePolyline = (encoded: string): [number, number][] => {
    const coordinates: [number, number][] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let byte = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += deltaLat;

      result = 0;
      shift = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += deltaLng;

      coordinates.push([lng * 1e-5, lat * 1e-5]);
    }

    return coordinates;
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
        } else if (route.overview_polyline?.points) {
          setRouteCoordinates(decodePolyline(route.overview_polyline.points));
        } else {
          setRouteCoordinates(null);
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
    if (!address) {
      console.warn("address is undefined");
      return [];
    }

    const url = `https://rsapi.goong.io/Geocode?address=${encodeURIComponent(address)}&api_key=${GOONG_API_KEY}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.results && data.results.length > 0) {
        const topResult = data.results[0];
        const { lat, lng } = topResult.geometry.location;
        return [{
          geometry: {
            type: "Point",
            coordinates: [lng, lat]
          },
          place_name: topResult.formatted_address
        }];
      } else {
        console.log("Không tìm thấy địa chỉ phù hợp từ Goong");
        return [];
      }
    } catch (error) {
      console.error("Lỗi gọi API Goong:", error);
      return [];
    }
  };


  // Native map implementation using MapLibre and Goong raster tiles.
  // Note: `@maplibre/react-native-maplibre-gl` must be installed and the app rebuilt (dev build) for native map to work.
  const mapRef = useRef<any | null>(null);

  const centerMapOnUser = () => {
    if (!mapRef.current || !currentLocation) return;
    mapRef.current.animateToRegion({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    }, 700);
  };

  const readyToRenderMap = canUseGoong && !!MapLibreGL;

  return (
    <View style={styles.container}>
      {readyToRenderMap ? (
        centerCoordinate ? (
          <>
            <MapLibreGL.MapView
              ref={(r: any) => { mapRef.current = r; }}
              style={styles.map}
              logoEnabled={false}
            >
              <MapLibreGL.Camera
                centerCoordinate={[centerCoordinate[0], centerCoordinate[1]]}
                zoomLevel={15}
              />

              {/* Goong raster tiles via RasterSource + RasterLayer */}
              {GOONG_MAPTILES_KEY ? (
                <MapLibreGL.RasterSource
                  id="goongTiles"
                  tileSize={256}
                  tileUrlTemplates={[`https://tile.goong.io/1.0.0/{z}/{x}/{y}.png?api_key=${GOONG_MAPTILES_KEY}`]}
                >
                  <MapLibreGL.RasterLayer id="goongLayer" sourceID="goongTiles" />
                </MapLibreGL.RasterSource>
              ) : null}

              {/* Markers */}
              {selectedOrderCoordinate && (
                <MapLibreGL.PointAnnotation id={`order-${selectedOrderID ?? 'o'}`} coordinate={[selectedOrderCoordinate[0], selectedOrderCoordinate[1]]}>
                  <View style={styles.orderMarker}><View style={styles.marker}><View style={styles.markerDot} /></View></View>
                </MapLibreGL.PointAnnotation>
              )}
              {selectedDriverCoordinate && (
                <MapLibreGL.PointAnnotation id={`driver-${selectedDriverID ?? 'd'}`} coordinate={[selectedDriverCoordinate[0], selectedDriverCoordinate[1]]}>
                  <View style={styles.driverMarker}><View style={[styles.marker, { backgroundColor: '#000', width: 28, height: 28 }]} /></View>
                </MapLibreGL.PointAnnotation>
              )}

              {/* Route polyline via ShapeSource + LineLayer */}
              {routeCoordinates && (
                <MapLibreGL.ShapeSource id="routeSource" shape={{ type: 'Feature', geometry: { type: 'LineString', coordinates: routeCoordinates } }}>
                  <MapLibreGL.LineLayer id="routeLine" style={{ lineColor: '#2563eb', lineWidth: 4 }} />
                </MapLibreGL.ShapeSource>
              )}
            </MapLibreGL.MapView>
          {/* Floating Action Button */}
          <TouchableOpacity 
            style={styles.locationButton} 
            activeOpacity={0.7}
            onPress={centerMapOnUser}
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
            {Platform.OS === 'android' && !ANDROID_GOOGLE_MAPS_KEY
              ? 'Google Maps API key not found'
              : IS_EXPO_GO
                ? 'Goong map cần Development Build'
                : 'Goong map chưa được cấu hình'}
          </Text>
          <Text style={styles.missingTokenText}>
            {Platform.OS === 'android' && !ANDROID_GOOGLE_MAPS_KEY
              ? 'Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY and rebuild a development client (or use an emulator image with Google Play services).'
              : IS_EXPO_GO
                ? 'Bạn đang mở ứng dụng bằng Expo Go. Hãy dùng development build để hiển thị Goong map.'
                : 'Thêm EXPO_PUBLIC_GOONG_MAPTILES_KEY vào môi trường để hiển thị bản đồ.'}
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
  },  
  fullscreenLoader: {
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
