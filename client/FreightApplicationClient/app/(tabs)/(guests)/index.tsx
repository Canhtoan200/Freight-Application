import React, { useState, useEffect } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View, TouchableOpacity, Alert } from "react-native";
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Order = {
  OrderID: number;
  order_name?: string;
  goods_quantity?: number;
  receiver_name?: string;
  sender_name?: string;
  shipping_status?: string;
  organization?: string;
};

export default function GuestHome() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userOrganization, setUserOrganization] = useState('');

  useEffect(() => {
    const fetchUserOrganization = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          const user = JSON.parse(token);
          setUserOrganization(user.organization || '');
        }
      } catch (error) {
        console.error('Lỗi lấy tổ chức:', error);
      }
    };
    fetchUserOrganization();
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch('https://freight-application-server.onrender.com/api/v1/orders/getAllOrders');
      const data = await response.json();
      if (response.ok) {
        // Lọc chỉ lấy các đơn organization là tổ chức của mình
        const filteredOrganization = (data.data || []).filter((order: Order) => order.organization === userOrganization);
        setOrders(filteredOrganization);
      } else {
        Alert.alert("Lỗi", "Không thể tải danh sách đơn hàng");
      }
    } catch (error) {
      Alert.alert("Lỗi kết nối", "Không thể kết nối đến máy chủ");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

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
      <Text style={styles.cell}>{order.shipping_status || 'null'}</Text>
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