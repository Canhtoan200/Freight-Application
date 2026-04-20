import React from "react";
import { View, StyleSheet } from 'react-native';
import DriverMap from './DriverMapManagement';

export default function DriverManagement() {
  return (
    <View style={styles.container}>
      {/* 1. Phần Map (Giả lập) */}
      <View style={styles.mapMockup}>
        <DriverMap />
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
