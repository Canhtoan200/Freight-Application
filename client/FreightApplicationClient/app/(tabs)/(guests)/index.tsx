import React, { useState, useCallback } from "react";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { useFocusEffect, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Order = {
  OrderID: number;
  order_name?: string;
  goods_quantity?: number;
  receiver_name?: string;
  sender_name?: string;
  shipping_status?: string;
  organization?: string;
  driver_name?: string;
};

export default function GuestHome() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const rawUser = await AsyncStorage.getItem('userToken');
      const user = rawUser ? JSON.parse(rawUser) as { token?: string } : null;
      if (!user?.token) throw new Error('Vui lòng đăng nhập lại để xem đơn hàng.');

      const response = await fetch(
        'https://freight-application-server.onrender.com/api/v1/orders/getOrdersForTracking',
        { headers: { Authorization: `Bearer ${user.token}` } },
      );
      const body = await response.text();
      let data: { data?: Order[]; message?: string } | null = null;
      try {
        data = JSON.parse(body) as { data?: Order[]; message?: string };
      } catch {}
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('API theo dõi chưa được triển khai trên máy chủ.');
        }
        throw new Error(
          data?.message || `Máy chủ gặp lỗi HTTP ${response.status}. Kiểm tra log backend để biết nguyên nhân.`,
        );
      }
      if (!data) throw new Error('Máy chủ trả về dữ liệu không hợp lệ.');
      if (!Array.isArray(data.data)) throw new Error('Danh sách đơn hàng không hợp lệ.');
      setOrders(data.data.filter((order) => order.shipping_status !== 'Đã giao hàng'));
    } catch (error) {
      console.error(error);
      Alert.alert(
        "Không thể tải đơn hàng",
        error instanceof Error ? error.message : "Không thể kết nối đến máy chủ.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void fetchOrders();
    }, [fetchOrders]),
  );

  const goToCreateOrder = () => {
    router.push('/(tabs)/(guests)/createOrder');
  };

  const goToOrderDetail = (orderId: number) => {
    router.push({
      pathname: '/(tabs)/(guests)/orderDetail' as any,
      params: { orderId }
    });
  };

  const renderOrderRow = (order: Order) => (
    <View key={order.OrderID} style={styles.tableRow}>
      <Text style={styles.cell}>{order.order_name || 'null'}</Text>
      <Text style={styles.cell}>{order.goods_quantity || 'null'}</Text>
      <Text style={styles.cell}>{order.receiver_name || 'null'}</Text>
      <Text style={styles.cell}>{order.sender_name || 'null'}</Text>
      {!['Đã lên toa', 'Đã dỡ toa'].includes(order.shipping_status || '') &&
      (order.shipping_status === 'Tài xế đang đi!' || order.driver_name) ? (
        <TouchableOpacity
          style={styles.cell}
          onPress={() => goToOrderDetail(order.OrderID)}
          accessibilityRole="link"
          accessibilityLabel={`${order.shipping_status || 'Trạng thái đơn hàng'}, xem thông tin tài xế`}
        >
          <Text style={styles.detailLink}>{order.shipping_status || 'Xem thông tin tài xế'}</Text>
          <Text style={styles.driverInfoHint}>Xem thông tin tài xế</Text>
        </TouchableOpacity>
      ) : (
        <Text style={styles.cell}>{order.shipping_status || 'null'}</Text>
      )}
      <TouchableOpacity style={styles.cell} onPress={() => goToOrderDetail(order.OrderID)}>
        <Text style={styles.detailLink}>Xem</Text>
      </TouchableOpacity>
    </View>
  );

  return (
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <Text style={styles.pageTitle}>Các đơn đang vận chuyển</Text>
          <TouchableOpacity style={styles.addOrderButton} onPress={goToCreateOrder}>
            <Text style={styles.addOrderText}>Thêm đơn hàng</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Các đơn đang vận chuyển</Text>
          <View style={styles.tableHeaderWrapper}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headerCell]}>Tên hàng</Text>
              <Text style={[styles.cell, styles.headerCell]}>Số lượng</Text>
              <Text style={[styles.cell, styles.headerCell]}>Chủ nhận</Text>
              <Text style={[styles.cell, styles.headerCell]}>Chủ gửi</Text>
              <Text style={[styles.cell, styles.headerCell]}>Trạng thái</Text>
              <Text style={[styles.cell, styles.headerCell]}>Chi tiết</Text>
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

        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Các đơn đã đi trong tháng</Text>
          <View style={styles.tableHeaderWrapper}>
            <View style={styles.tableHeader}>
              <Text style={[styles.cell, styles.headerCell]}>Ngày tàu chạy</Text>
              <Text style={[styles.cell, styles.headerCell]}>Số toa</Text>
              <Text style={[styles.cell, styles.headerCell]}>Tên hàng</Text>
              <Text style={[styles.cell, styles.headerCell]}>Số lượng</Text>
              <Text style={[styles.cell, styles.headerCell]}>Chủ nhận</Text>
              <Text style={[styles.cell, styles.headerCell]}>Chủ gửi</Text>
              <Text style={[styles.cell, styles.headerCell]}>Trạng thái</Text>
              <Text style={[styles.cell, styles.headerCell]}>Chi tiết</Text>
            </View>
          </View>
          
        </View>

        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>Đơn giá</Text>
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Dưới 1 tấn:</Text>
            <Text style={styles.rateValue}>Thương lượng</Text>
          </View>
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Từ 1 - 3 tấn:</Text>
            <Text style={styles.rateValue}>1200/kg 400.000/m3</Text>
          </View>
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Từ 3 - 5 tấn:</Text>
            <Text style={styles.rateValue}>1500/kg 400.000/m3</Text>
          </View>
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Trên 5 tấn:</Text>
            <Text style={styles.rateValue}>Thương lượng</Text>
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
    paddingBottom: 32,
    backgroundColor: '#fff',
  },
  topBar: {
    borderWidth: 1,
    borderColor: '#000',
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
  },
  logoBox: {
    borderWidth: 1,
    borderColor: '#000',
    padding: 10,
    marginBottom: 8,
    minWidth: 120,
  },
  logoText: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  pageTitle: {
    fontWeight: '600',
    textAlign: 'center',
    flex: 1,
    minWidth: 180,
    marginHorizontal: 12,
    marginLeft: 150,
  },
  addOrderButton: {
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  addOrderText: {
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
  },
  tableHeaderWrapper: {
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    borderBottomWidth: 1,
    borderColor: '#000',
    paddingBottom: 8,
    marginBottom: 8,
  },
  headerCell: {
    fontWeight: '700',
  },
  cell: {
    flex: 1,
    minWidth: 100,
    borderRightWidth: 1,
    borderColor: '#000',
    paddingVertical: 6,
    paddingHorizontal: 4,
    textAlign: 'center',
  },
  tableBody: {
    minHeight: 100,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  emptyText: {
    color: '#666',
    fontStyle: 'italic',
  },
  tableRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    borderBottomWidth: 1,
    borderColor: '#eee',
    paddingVertical: 8,
  },
  detailLink: {
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  driverInfoHint: {
    color: '#007AFF',
    fontSize: 11,
    marginTop: 3,
  },
  rateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  rateLabel: {
    fontWeight: '600',
  },
  rateValue: {
    textAlign: 'right',
    flex: 1,
    marginLeft: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  bottomButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#000',
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  bottomButtonText: {
    fontWeight: '600',
  },
});