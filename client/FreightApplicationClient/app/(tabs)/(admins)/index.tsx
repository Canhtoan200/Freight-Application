import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from "react-native";
import { useRouter } from 'expo-router';

type Order = {
  OrderID: number;
  order_name?: string;
  goods_quantity?: number;
  receiver_name?: string;
  sender_name?: string;
  driver_name?: string;
  wagon_number?: string;
  shipping_status?: string;
};
type Wagon = {
  WagonID: number;
  wagon_number?: string;
  wagon_departure_date?: Date;
};

export default function AdminHome() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [wagons, setWagons] = useState<Wagon[]>([]);
  const [wagonOrderMap, setWagonOrderMap] = useState<Record<number, Order[]>>({});
  const [loading, setLoading] = useState(true);
  const [wagonLoading, setWagonLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
    fetchWagons();
  }, []);

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
    router.push('/(tabs)/(admins)/createOrderManagement');
  };

  const goToOrderDetail = (orderId: number) => {
    router.push({
      pathname: '/(tabs)/(admins)/orderManagement' as any,
      params: { orderId }
    });
  };

  const goToCreateWagon = () => {
    router.push('/(tabs)/(admins)/createWagonManagement');
  };

  const renderOrderRow = (order: Order) => (
    <View key={order.OrderID} style={styles.tableRow}>
      <View style={[styles.commonCell, styles.cellLarge]}><Text style={styles.bodyText}>{order.order_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.goods_quantity || '0'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.receiver_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.sender_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.driver_name || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.wagon_number || 'null'}</Text></View>
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.shipping_status || 'null'}</Text></View>
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
        <Text style={styles.sectionTitle}>Toa {wagon.wagon_number || 'null'}</Text>
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
      <View style={styles.commonCell}><Text style={styles.bodyText}>{order.shipping_status || 'null'}</Text></View>
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
            <TouchableOpacity style={styles.addButton} onPress={goToCreateWagon}>
              <Text style={styles.addButtonText}>Thêm toa tàu</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={styles.sectionBox}>
          <View style={styles.tableBody}>
            {loading ? (
              <Text style={styles.emptyText}>Đang tải...</Text>
            ) : wagons.length > 0 ? (
              wagons.map(renderWagonRow)
            ) : (
              <Text style={styles.emptyText}>Chưa có toa tàu</Text>
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
    marginBottom: 12,
    marginTop: 5,
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
});