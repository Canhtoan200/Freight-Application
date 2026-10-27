import React, { useCallback, useState } from "react";
import { useFocusEffect, useSegments } from "expo-router";
import { Alert, ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from 'expo-router';

type Order = {
  OrderID: number;
  order_name?: string;
  goods_quantity?: number;
  receiver_name?: string;
  sender_name?: string;
  driver_name?: string;
  wagon_number?: string;
  wagon_arrival_date?: Date;
  shipping_status?: string;
};
type Wagon = {
  WagonID: number;
  wagon_number?: string;
  wagon_route?: string;
  wagon_type?: string;
  wagon_departure_date?: string | Date;
  wagon_arrival_date?: string | Date;
};

const formatWagonDate = (value?: string | Date) => {
  if (!value) return "Chưa có";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("vi-VN");
};

export default function AdminHome() {
  const router = useRouter();
  const segments = useSegments();
  const isBusinessPartner = segments.some((segment) => String(segment) === "(businessPartners)");
  const routePrefix = isBusinessPartner
    ? "/(tabs)/(businessPartners)"
    : "/(tabs)/(admins)";
  const [orders, setOrders] = useState<Order[]>([]);
  const [wagons, setWagons] = useState<Wagon[]>([]);
  const [wagonOrderMap, setWagonOrderMap] = useState<Record<number, Order[]>>({});
  const [loading, setLoading] = useState(true);
  const [wagonLoading, setWagonLoading] = useState(true);
  const [transitioningWagonID, setTransitioningWagonID] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
      fetchWagons();
    }, [])
  );

  const fetchOrders = async () => {
    try {
      const response = await fetch('https://freight-application-server.onrender.com/api/v1/orders/getAllOrders');
      const data = await response.json();
      if (response.ok) {
        setOrders(data.data || []);
      } else {
        console.log("Lỗi", "Không thể tải danh sách đơn hàng");
      }
    } catch (error) {
      console.error("Lỗi kết nối", "Không thể kết nối đến máy chủ");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  const fetchWagons = async () => {
    try {
      const response = await fetch('https://freight-application-server.onrender.com/api/v1/wagons/getAllWagons');
      const data = await response.json();
      if (response.ok) {
        const wagonList: Wagon[] = data.data || [];
        setWagons(wagonList);
        // Fetch order IDs for each wagon in parallel, build a map
        const entries = await Promise.all(
          wagonList.map(async (wagon) => {
            const orderIds = await fetchWagonOrderIds(wagon.WagonID);
            return [wagon.WagonID, orderIds] as [number, Order[]];
          })
        );
        setWagonOrderMap(Object.fromEntries(entries));
      } else {
        console.log("Lỗi", "Không thể tải danh sách toa tàu");
      }
    } catch (error) {
      console.error("Lỗi kết nối", "Không thể kết nối đến máy chủ");
      console.error(error);
    } finally {
      setWagonLoading(false);
    }
  };
  // Returns the full order list linked to a wagon
  const fetchWagonOrderIds = async (WagonID: number): Promise<Order[]> => {
    try {
      const response = await fetch(
        `https://freight-application-server.onrender.com/api/v1/wagons/getWagonDetailID`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ WagonIDs: WagonID }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        return data.data || [];
      }
      return [];
    } catch {
      return [];
    }
  };
  const goToCreateOrder = () => {
    router.push(`${routePrefix}/createOrderManagement` as any);
  };
  const goToCreateWagonOrder = (wagonId: number, wagonNumber: string) => {
    router.push({
      pathname: `${routePrefix}/createWagonOrderManagement` as any,
      params: { wagonId, wagonNumber },
    });
  };
  const goToOrderDetail = (orderId: number) => {
    router.push({
      pathname: `${routePrefix}/orderManagement` as any,
      params: { orderId }
    });
  };

  const goToCreateWagon = (wagonType: "LOADING" | "UNLOADING") => {
    router.push({
      pathname: `${routePrefix}/createWagonManagement` as any,
      params: { wagonType },
    });
  };

  const moveWagonToUnloading = async (wagon: Wagon) => {
    if (transitioningWagonID !== null) return;
    setTransitioningWagonID(wagon.WagonID);
    try {
      const response = await fetch(
        "https://freight-application-server.onrender.com/api/v1/wagons/convertToUnloading",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ WagonID: wagon.WagonID }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "Không thể chuyển toa sang toa dỡ.");
      }
      setWagons((current) => current.map((item) =>
        item.WagonID === wagon.WagonID ? { ...item, wagon_type: "UNLOADING" } : item
      ));
      Alert.alert("Thành công", `Toa ${wagon.wagon_number || ""} đã được chuyển sang danh sách toa dỡ.`);
    } catch (error) {
      console.error("Không thể chuyển toa xếp sang toa dỡ:", error);
      Alert.alert("Lỗi", error instanceof Error ? error.message : "Không thể chuyển toa sang toa dỡ.");
    } finally {
      setTransitioningWagonID(null);
    }
  };

  const loadingWagons = wagons.filter(
    (wagon) => (wagon.wagon_type ?? "LOADING").toUpperCase() === "LOADING"
  );
  const unloadingWagons = wagons.filter((wagon) => wagon.wagon_type?.toUpperCase() === "UNLOADING");

  const renderOrderRow = (order: Order) => (
    <View key={order.OrderID} style={styles.tableRow}>
      <View style={[styles.commonCell, styles.cellLarge]}><Text style={styles.bodyText}>{order.order_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.goods_quantity || '0'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.receiver_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.sender_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.driver_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.wagon_number || 'null'}</Text></View>
      <View style={styles.commonCell}>
        <Text style={styles.bodyText}>
          {order.shipping_status === 'Đã lên toa'
            ? `Toa đến ngày: ${order.wagon_arrival_date ? new Date(order.wagon_arrival_date).toLocaleDateString('vi-VN') : 'chưa rõ'}`
            : order.shipping_status || 'null'}
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.commonCell, styles.lastCell]} 
        onPress={() => goToOrderDetail(order.OrderID)}
      >
        <Text style={styles.detailLink}>Xem</Text>
      </TouchableOpacity>
    </View>
  );
  const renderWagonRow = (wagon: Wagon) => {
    const wagonOrders: Order[] = wagonOrderMap[wagon.WagonID] || [];
    return (
    <View key={wagon.WagonID} style={styles.tableRow}>
      <View style={styles.wagonRowInner}>
        <View style={styles.wagonRowHeader}>
          <View style={styles.wagonRowSpacer} />
          <View style={styles.wagonTitleBlock}>
            <Text style={styles.sectionTitle}>Toa {wagon.wagon_number || 'null'}</Text>
            <Text style={styles.wagonDetails}>
              {wagon.wagon_route || "Chưa có tuyến"} · Khởi hành: {formatWagonDate(wagon.wagon_departure_date)} · Đến: {formatWagonDate(wagon.wagon_arrival_date)}
            </Text>
          </View>
          <View style={[styles.wagonRowSpacer, styles.wagonActions]}>
            <TouchableOpacity style={styles.addButton} onPress={() => goToCreateWagonOrder(wagon.WagonID, wagon.wagon_number || '')}>
              <Text style={styles.addButtonText}>Thêm đơn hàng</Text>
            </TouchableOpacity>
            {(wagon.wagon_type ?? "LOADING").toUpperCase() === "LOADING" && (
              <TouchableOpacity
                style={[styles.addButtonSmall, transitioningWagonID === wagon.WagonID && styles.disabledButton]}
                disabled={transitioningWagonID === wagon.WagonID}
                onPress={() => moveWagonToUnloading(wagon)}
              >
                <Text style={styles.addButtonText}>
                  {transitioningWagonID === wagon.WagonID
                    ? "Đang chuyển..."
                    : "Chuyển sang toa dỡ"}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={styles.tableHeaderWrapper}>
          <View style={styles.tableHeader}>
            <View style={[styles.commonCell, styles.cellLarge]}><Text style={styles.headerText}>Tên hàng</Text></View>
            <View style={styles.commonCell}><Text style={styles.headerText}>Số lượng</Text></View>
            <View style={styles.commonCell}><Text style={styles.headerText}>Chủ nhận</Text></View>
            <View style={styles.commonCell}><Text style={styles.headerText}>Chủ gửi</Text></View>
            <View style={styles.commonCell}><Text style={styles.headerText}>Phân công Tài xế</Text></View>
            <View style={styles.commonCell}><Text style={styles.headerText}>Phân công Toa</Text></View>
            <View style={styles.commonCell}><Text style={styles.headerText}>Trạng thái</Text></View>
            <View style={[styles.commonCell, styles.lastCell]}><Text style={styles.headerText}>Chi tiết</Text></View>
          </View>
        </View>
        <View style={styles.tableBody}>
          {wagonLoading ? (
            <Text style={styles.emptyText}>Đang tải...</Text>
          ) : wagonOrders.length > 0 ? (
            wagonOrders.map(renderWagonOrderRow)
          ) : (
            <Text style={styles.emptyText}>Chưa có đơn hàng trong toa này</Text>
          )}
        </View>
      </View>
    </View>
    );
  };
    const renderWagonOrderRow = (order: Order) => (
    <View key={order.OrderID} style={styles.tableRow}>
      <View style={[styles.commonCell, styles.cellLarge]}><Text style={styles.bodyText}>{order.order_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.goods_quantity || '0'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.receiver_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.sender_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.driver_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.wagon_number || 'null'}</Text></View>
      <View style={styles.commonCell}>
        <Text style={styles.bodyText}>
          {order.shipping_status === 'Đã lên toa'
            ? `Toa đến ngày: ${order.wagon_arrival_date ? new Date(order.wagon_arrival_date).toLocaleDateString('vi-VN') : 'chưa rõ'}`
            : order.shipping_status || 'null'}
        </Text>
      </View>
      <TouchableOpacity 
        style={[styles.commonCell, styles.lastCell]} 
        onPress={() => goToOrderDetail(order.OrderID)}
      >
        <Text style={styles.detailLink}>Xem</Text>
      </TouchableOpacity>
    </View>
  );
  return (
      <ScrollView contentContainerStyle={styles.container}>
        {isBusinessPartner && (
          <Text style={{ marginBottom: 12, fontWeight: '700', color: '#333' }}>
            Ga Giáp Bát · Tiếp nhận và dỡ toa
          </Text>
        )}
        <View style={styles.headerBox}>
          <View style={styles.logoBox}>
            <Text style={styles.logoText}>Logo công ty</Text>
          </View>

          <View style={styles.pageTitleBox}>
            <Text style={styles.pageTitle}>Các đơn hàng hôm nay</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.uploadButton}>
              <Text style={styles.uploadButtonText}>Thêm đơn hàng bằng file excel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={goToCreateOrder}>
              <Text style={styles.addButtonText}>Thêm đơn hàng</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Các đơn đang vận chuyển</Text>
          <View style={styles.tableHeaderWrapper}>
            <View style={styles.tableHeader}>
              <View style={[styles.commonCell, styles.cellLarge]}><Text style={styles.headerText}>Tên hàng</Text></View>
              <View style={styles.commonCell}><Text style={styles.headerText}>Số lượng</Text></View>
              <View style={styles.commonCell}><Text style={styles.headerText}>Chủ nhận</Text></View>
              <View style={styles.commonCell}><Text style={styles.headerText}>Chủ gửi</Text></View>
              <View style={styles.commonCell}><Text style={styles.headerText}>Phân công Tài xế</Text></View>
              <View style={styles.commonCell}><Text style={styles.headerText}>Phân công Toa</Text></View>
              <View style={styles.commonCell}><Text style={styles.headerText}>Trạng thái</Text></View>
              <View style={[styles.commonCell, styles.lastCell]}><Text style={styles.headerText}>Chi tiết</Text></View>
            </View>
          </View>
          <View style={styles.tableBody}>
            {loading ? (
              <Text style={styles.emptyText}>Đang tải...</Text>
            ) : orders.length > 0 ? (
              orders.map(renderOrderRow)
            ) : (
              <Text style={styles.emptyText}>Chưa có đơn hàng đang vận chuyển</Text>
            )}
          </View>
        </View>
        <View style={styles.headerBox}>
          <View style={styles.pageTitleBox}>
            <Text style={styles.pageTitle}>Danh sách toa tàu</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.addButton} onPress={() => goToCreateWagon("LOADING")}>
              <Text style={styles.addButtonText}>Thêm toa xếp</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addButton} onPress={() => goToCreateWagon("UNLOADING")}>
              <Text style={styles.addButtonText}>Thêm toa dỡ</Text>
            </TouchableOpacity>
          </View>
        </View>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Danh sách toa tàu xếp</Text>
            <View style={styles.tableBody}>
              {wagonLoading ? (
                <Text style={styles.emptyText}>Đang tải...</Text>
              ) : loadingWagons.length > 0 ? (
                loadingWagons.map(renderWagonRow)
              ) : (
                <Text style={styles.emptyText}>Chưa có toa tàu xếp</Text>
              )}
            </View>
          </View>
          <View style={styles.sectionBox}>
            <Text style={styles.sectionTitle}>Danh sách toa tàu dỡ</Text>
            <View style={styles.tableBody}>
              {wagonLoading ? (
                <Text style={styles.emptyText}>Đang tải...</Text>
              ) : unloadingWagons.length > 0 ? (
                unloadingWagons.map(renderWagonRow)
              ) : (
                <Text style={styles.emptyText}>Chưa có toa tàu dỡ</Text>
              )}
            </View>
          </View>
      </ScrollView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: '#fff',
  },
  headerBox: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoBox: {
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 120,
    marginBottom: 8,
  },
  logoText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  pageTitleBox: {
    flex: 1,
    marginHorizontal: 12,
    minWidth: 160,
    marginBottom: 8,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerActions: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
  },
  uploadButton: {
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    marginBottom: 8,
    marginRight: 8,
  },
  uploadButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  addButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  addButtonSmall: {
    borderWidth: 1,
    borderColor: '#000',
    backgroundColor: '#000',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 6,
    alignSelf: 'flex-end',
  },
  addButtonSmallText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 11,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#b02a37',
    backgroundColor: '#dc3545',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  sectionBox: {
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 16,
    padding: 12,
  },
  sectionTitle: {
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 5,
    flex: 1,
  },
  tableHeaderWrapper: {
    overflow: 'hidden',
    marginBottom: 0,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#000',
    // Đảm bảo header không bị tràn
    width: '100%',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderColor: '#000',
    width: '100%',
  },
  // Style chung cho tất cả các cell (cả Header và Body)
  commonCell: {
    flex: 1,
    minWidth: 100,
    borderRightWidth: 1,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 4,
    justifyContent: 'center', // Căn giữa theo chiều dọc
    alignItems: 'center',     // Căn giữa theo chiều ngang
  },
  cellLarge: {
    flex: 1.5,
  },
  // Cell cuối cùng của mỗi dòng (không có border phải)
  lastCell: {
    borderRightWidth: 0,
  },
  // Text style
  headerText: {
    fontWeight: '700',
    textAlign: 'center',
  },
  bodyText: {
    fontSize: 13,
    color: '#111',
    textAlign: 'center',
  },
  detailButton: {
    flex: 1,
    minWidth: 100,
    // Không để borderRight ở đây nếu là cột cuối
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCell: {
    fontWeight: '700',
  },
  tableBody: {
    minHeight: 100,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  
  cellMultiline: {
    flex: 1.2,
  },
  multilineText: {
    lineHeight: 18,
  },
  detailButtonText: {
    fontWeight: '600',
    fontSize: 12,
  },
  detailLink: {
    color: '#1976d2',
    fontWeight: '700',
  },
  bottomBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 16,
    gap: 8,
  },
  bottomCard: {
    borderWidth: 1,
    borderColor: '#000',
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 12,
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    marginBottom: 8,
  },
  bottomCardText: {
    fontWeight: '700',
    textAlign: 'center',
    fontSize: 12,
    marginTop: 8,
  },
  emptyText: {
    color: '#777',
    textAlign: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  wagonRowInner: {
    flex: 1,
  },
  wagonRowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    marginTop: 8,
  },
  wagonTitleBlock: {
    flex: 2,
    alignItems: 'center',
  },
  wagonDetails: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  wagonRowSpacer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  wagonActions: {
    gap: 6,
  },
});