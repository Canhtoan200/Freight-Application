import React from "react";
import { View, StyleSheet, Text, TouchableOpacity, ScrollView, Linking } from 'react-native';
import { Avatar, Button, Divider } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DriverMap from './DriverMap';

export default function DriverHome() {
  // Hàm xử lý gọi điện
  const handleCall = () => {
    Linking.openURL('tel:0908473406');
  };
  return (
    <View style={styles.container}>
      {/* 1. Phần Map (Giả lập) */}
      <View style={styles.mapMockup}>
        <DriverMap />
      </View>

      {/* 2. Phần Thông tin đơn hàng (Bottom Area) */}
      <View style={styles.orderCard}>
        
        {/* Header: Số điểm và Trạng thái */}
        <View style={styles.headerRow}>
           <Text style={styles.pointsText}>2 Địa điểm</Text>
           <View style={styles.statusBadge}>
              <Text style={styles.statusText}>3 • Giao đơn</Text>
              <Text style={styles.timeText}>12:15 PM  {'>'}</Text>
           </View>
           <MaterialCommunityIcons name="view-list" size={24} color="black" />
        </View>

        <ScrollView style={styles.content}>
          {/* Tên khách hàng & Địa chỉ */}
          <Text style={styles.customerName}>Ngọc Anh Ho</Text>
          <Text style={styles.addressText}>
            42 Lý Thường Kiệt, KP.Thắng Lợi 1, P.Dĩ An, TP.Hồ Chí Minh, Vietnam
          </Text>

          {/* Giá tiền & Hình thức thanh toán */}
          <View style={styles.priceRow}>
            <Text style={styles.priceText}>22.762 đ • 40</Text>
            <View style={styles.paymentMethod}>
                <Text style={styles.paymentText}>Thẻ / Ví</Text>
            </View>
          </View>

          {/* Ghi chú của khách */}
          <View style={styles.noteBox}>
            <Text style={styles.noteText}>cuối hẻm quẹo trái, nhà có ghế đá, cửa gỗ</Text>
          </View>
        </ScrollView>

        {/* 3. Thanh công cụ (Chat, Gọi, Xem thêm) */}
        <Divider />
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtn}>
            <MaterialCommunityIcons name="silverware-fork-knife" size={24} color="black" />
            <Text style={styles.actionLabel}>Chi tiết</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionBtn}>
            <MaterialCommunityIcons name="chat-processing" size={24} color="black" />
            <Text style={styles.actionLabel}>Chat</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn} onPress={handleCall}>
            <MaterialCommunityIcons name="phone" size={24} color="black" />
            <Text style={styles.actionLabel}>Gọi</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtn}>
            <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={24} color="#f57c00" />
            <Text style={styles.actionLabel}>Xem thêm</Text>
          </TouchableOpacity>
        </View>

        {/* 4. Nút bấm chính "Đã đến" */}
        <View style={styles.footer}>
           <Button 
            mode="contained" 
            style={styles.arrivedBtn}
            labelStyle={styles.btnLabel}
            onPress={() => console.log('Đã đến điểm giao')}>
            Đã đến
          </Button>
          <TouchableOpacity style={styles.powerBtn}>
             <MaterialCommunityIcons name="power" size={24} color="white" />
          </TouchableOpacity>
        </View>

      </View>
    </View>
  );
  
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  mapMockup: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' },
  orderCard: { 
    backgroundColor: 'white', 
    borderTopLeftRadius: 20, 
    borderTopRightRadius: 20, 
    padding: 16,
    paddingBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    elevation: 10,
    maxHeight: '60%'
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  pointsText: { fontWeight: 'bold', fontSize: 16 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  statusText: { color: '#ff5252', fontWeight: 'bold' },
  timeText: { color: '#666', fontSize: 12, marginLeft: 5 },
  content: { maxHeight: 250, paddingVertical: 10 },
  customerName: { fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  addressText: { fontSize: 15, color: '#333', lineHeight: 22 },
  priceRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, justifyContent: 'flex-start' },
  priceText: { fontSize: 16, fontWeight: 'bold' },
  paymentMethod: { backgroundColor: '#1976d2', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 10 },
  paymentText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  noteBox: { backgroundColor: '#f9f9f9', padding: 12, borderRadius: 8, marginTop: 12, borderLeftWidth: 4, borderLeftColor: '#ddd' },
  noteText: { color: '#666', fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 12, paddingHorizontal: 5 },
  actionBtn: { alignItems: 'center', flex: 1 },
  actionLabel: { fontSize: 12, marginTop: 5 },
  footer: { flexDirection: 'row', alignItems: 'center', marginTop: 15, paddingTop: 10 },
  arrivedBtn: { flex: 1, backgroundColor: 'white', borderColor: '#4CAF50', borderWidth: 1, borderRadius: 25, marginRight: 10 },
  btnLabel: { color: '#4CAF50', fontWeight: 'bold', fontSize: 16 },
  powerBtn: { backgroundColor: '#4CAF50', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  map: {
    width: '100%',
    height: '100%',
  },
});
