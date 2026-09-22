import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useRouter } from 'expo-router';
import AntDesign from '@expo/vector-icons/AntDesign';
import { Dropdown } from 'react-native-element-dropdown';

type Order = {
  OrderID: number;
  order_name?: string;
  goods_quantity?: number;
  receiver_name?: string;
  sender_name?: string;
  driver_name?: string;
  wagon_number?: string;
  wagon_arrival_date?: string | Date;
  shipping_status?: string;
};
const dropdownOptions = [
    { label: 'Tất cả', value: 'all' },
  { label: '1 tuần trước', value: '1 week ago' },
  { label: '1 tháng trước', value: '1 month ago' },
  { label: '2 tháng trước', value: '2 month ago' },
  { label: '1 quý trước', value: '1 quarter ago' },
  { label: '2 quý trước', value: '2 quarter ago' },
  { label: '1 năm trước', value: '1 year ago' },
  { label: '2 năm trước', value: '2 year ago' },
];

export default function AccountantsHome() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState('1 week ago');
  const [wagonNumber, setWagonNumber] = useState('');
  const [senderName, setSenderName] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [isFocus, setIsFocus] = useState(false);

  useEffect(() => {
    fetchOrders();
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
  const searchOrders = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://freight-application-server.onrender.com/api/v1/orders/searchOrders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wagon_departure_date: value,
          wagon_number: wagonNumber.trim() || null,
          sender_name: senderName.trim() || null,
          receiver_name: receiverName.trim() || null,
        }),
      });
      const data = await response.json();
      if (response.ok) {
        setOrders(data.data || []);
      } else {
        console.error('Lỗi tìm kiếm', data.message || 'Không thể tìm kiếm đơn hàng');
      }
    } catch (error) {
      console.error('Lỗi kết nối', 'Không thể kết nối đến máy chủ');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
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
                <Text style={styles.pageTitle}>Tổng hợp nhật kí</Text>
              </View>
    
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.uploadButton}>
                  <Text style={styles.uploadButtonText}>Thêm đơn hàng bằng file excel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.addButton}>
                  <Text style={styles.addButtonText}>Thêm đơn hàng</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.exportButton}>
                  <Text style={styles.exportButtonText}>Xuất file excel</Text>
                </TouchableOpacity>
              </View>
            </View>
    
            <View style={styles.sectionBox}>
              <View style={styles.searchBox}>
                <View style={styles.searchRow}>
                  <View style={styles.searchField}>
                    <Text style={styles.searchLabel}>Ngày tàu chạy:</Text>
                    <Dropdown
                      style={[styles.dropdown, isFocus && { borderColor: 'blue' }]}
                      placeholderStyle={styles.placeholderStyle}
                      selectedTextStyle={styles.selectedTextStyle}
                      containerStyle={styles.dropdownContainer}
                      data={dropdownOptions}
                      maxHeight={300}
                      labelField="label"
                      valueField="value"
                      placeholder={!isFocus ? 'Chọn thời gian' : '...'}
                      value={value}
                      onFocus={() => setIsFocus(true)}
                      onBlur={() => setIsFocus(false)}
                      onChange={item => {
                        setValue(item.value);
                        setIsFocus(false);
                        console.log('Selected:', item.value);
                      }}
                      renderRightIcon={() => (
                        <AntDesign
                          name={isFocus ? 'caret-up' : 'caret-down'}
                          size={12}
                          color="gray"
                        />
                      )}
                    />
                  </View>
                  <View style={styles.searchField}>
                    <Text style={styles.searchLabel}>Số toa:</Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Nhập số toa"
                      placeholderTextColor="#999"
                      value={wagonNumber}
                      onChangeText={setWagonNumber}
                    />
                  </View>
                  <View style={styles.searchField}>
                    <Text style={styles.searchLabel}>Chủ gửi:</Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Nhập tên chủ gửi"
                      placeholderTextColor="#999"
                      value={senderName}
                      onChangeText={setSenderName}
                    />
                  </View>
                  <View style={styles.searchField}>
                    <Text style={styles.searchLabel}>Chủ nhận:</Text>
                    <TextInput
                      style={styles.searchInput}
                      placeholder="Nhập tên chủ nhận"
                      placeholderTextColor="#999"
                      value={receiverName}
                      onChangeText={setReceiverName}
                    />
                  </View>
                  <TouchableOpacity style={styles.searchButton} onPress={searchOrders}>
                    <Text style={styles.searchButtonText}>Tìm kiếm</Text>
                  </TouchableOpacity>
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
                {loading ? (
                  <Text style={styles.emptyText}>Đang tải...</Text>
                ) : orders.length > 0 ? (
                  orders.map(renderOrderRow)
                ) : (
                  <Text style={styles.emptyText}>Chưa có đơn hàng đang vận chuyển</Text>
                )}
              </View>
            </View>
      </ScrollView>
  );
}
const styles = StyleSheet.create({
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
  exportButton: {
    borderWidth: 1,
    borderColor: '#1976d2',
    backgroundColor: '#1976d2',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
    marginLeft: 8,
    borderRadius: 6,
  },
  exportButtonText: {
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
    marginBottom: 10,
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
  tableBody: {
    minHeight: 100,
    justifyContent: 'flex-start',
    alignItems: 'stretch',
  },
  emptyText: {
    color: '#777',
    textAlign: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  detailLink: {
    color: '#1976d2',
    fontWeight: '700',
  },
  dropdown: {
    width: '100%',
    height: 40,
    borderColor: '#000',
    borderWidth: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 8,
  },
  dropdownContainer: {
    borderWidth: 1,
    borderColor: '#000',
    marginTop: 2, // Slight separation from input field
  },
  placeholderStyle: {
    fontSize: 14,
  },
  selectedTextStyle: {
    fontSize: 14,
    color: '#000',
  },
  searchBox: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e2e2e2',
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#fafafa',
  },
  searchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-end',
    gap: 12,
  },
  searchField: {
    flex: 1,
    minWidth: 160,
  },
  searchLabel: {
    marginBottom: 6,
    fontWeight: '600',
    color: '#333',
  },
  searchInput: {
    height: 42,
    borderWidth: 1,
    borderColor: '#d1d1d1',
    borderRadius: 8,
    paddingHorizontal: 12,
    backgroundColor: '#fff',
  },
  searchButton: {
    alignSelf: 'flex-end',
    backgroundColor: '#1976d2',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    marginTop: 8,
  },
  searchButtonText: {
    color: '#fff',
    fontWeight: '700',
  },
});