import React, { useState, useEffect } from "react";
import { ScrollView, StyleSheet, Text, View, TouchableOpacity, TextInput, Alert } from "react-native";
import { RadioButton } from 'react-native-paper';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CreateOrder() {
  const router = useRouter();
  const [checked, setChecked] = useState('ngang');
  const [otherText, setOtherText] = useState('');
  const [userOrganization, setUserOrganization] = useState('');
  const [formData, setFormData] = useState({
    tenHang: '',
    chuNhan: '',
    chuGui: '',
    diaChiNhan: '',
    diaChiGui: '',
    soDienthoaiNhan: '',
    soDienthoaiGui: '',
    soLuongHang: '',
    canNangHangHoa: '',
    theTichHangHoa: '',
    ghiChu: '',
    yeuCauXepDo: '',
  });

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
  }, []);

  const goBack = () => {
    router.back();
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async () => {
    // Kiểm tra dữ liệu bắt buộc
    if (!formData.tenHang || !formData.chuNhan || !formData.chuGui || !formData.diaChiNhan || !formData.diaChiGui || !formData.soDienthoaiNhan || !formData.soDienthoaiGui || !formData.soLuongHang) {
      Alert.alert("Thông báo", "Vui lòng điền đầy đủ thông tin bắt buộc");
      return;
    }

    // Chuẩn bị dữ liệu gửi lên server
    const orderData = {
      order_name: formData.tenHang,
      sender_name: formData.chuGui,
      receiver_name: formData.chuNhan,
      sender_address: formData.diaChiGui,
      receiver_address: formData.diaChiNhan,
      sender_phone_number: formData.soDienthoaiGui,
      receiver_phone_number: formData.soDienthoaiNhan,
      goods_quantity: parseInt(formData.soLuongHang) || 0,
      goods_weight: parseInt(formData.canNangHangHoa) || 0,
      goods_volume: parseInt(formData.theTichHangHoa) || 0,
      note: formData.ghiChu || "",
      handling_instruction: checked === 'other' ? otherText : checked,
      shipping_status: 'Đã tiếp nhận',
      organization: userOrganization 
    };

    try {
      const response = await fetch('https://freight-application-server.onrender.com/api/v1/orders/createGuestOrder', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData),
      });
      const data = await response.json();

      if (response.ok) {
        console.log("Đơn hàng đã được tạo:", data);
        goBack();
      } else {
        console.log("Lỗi từ server:", data);
      }
    } catch (error) {
      Alert.alert("Lỗi kết nối", "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối Internet.");
      console.error(error);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Tạo đơn hàng mới</Text>
      </View>

      <View style={styles.formBox}>
        <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Tên hàng <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.tenHang}
            onChangeText={(value) => handleInputChange('tenHang', value)}
            placeholder="Nhập tên hàng"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Chủ gửi <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.chuGui}
            onChangeText={(value) => handleInputChange('chuGui', value)}
            placeholder="Nhập tên chủ gửi"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Chủ nhận <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.chuNhan}
            onChangeText={(value) => handleInputChange('chuNhan', value)}
            placeholder="Nhập tên chủ nhận"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Địa chỉ người gửi <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.diaChiGui}
            onChangeText={(value) => handleInputChange('diaChiGui', value)}
            placeholder="Nhập địa chỉ người gửi"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Địa chỉ người nhận <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.diaChiNhan}
            onChangeText={(value) => handleInputChange('diaChiNhan', value)}
            placeholder="Nhập địa chỉ người nhận"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Số điện thoại người gửi <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.soDienthoaiGui}
            onChangeText={(value) => handleInputChange('soDienthoaiGui', value)}
            placeholder="Nhập số điện thoại người gửi"
            keyboardType="phone-pad"
          />
        </View>
        
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Số điện thoại người nhận <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.soDienthoaiNhan}
            onChangeText={(value) => handleInputChange('soDienthoaiNhan', value)}
            placeholder="Nhập số điện thoại người nhận"
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Số lượng hàng <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={styles.input}
            value={formData.soLuongHang}
            onChangeText={(value) => handleInputChange('soLuongHang', value)}
            placeholder="Ví dụ: 100 kiện"
            keyboardType="default"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Cân nặng hàng hóa(kg)</Text>
          <TextInput
            style={styles.input}
            value={formData.canNangHangHoa}
            onChangeText={(value) => handleInputChange('canNangHangHoa', value)}
            placeholder="Ví dụ: 100 kg"
            keyboardType="default"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Thể tích hàng hóa(m³)</Text>
          <TextInput
            style={styles.input}
            value={formData.theTichHangHoa}
            onChangeText={(value) => handleInputChange('theTichHangHoa', value)}
            placeholder="Ví dụ: 10 m³"
            keyboardType="default"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ghi chú</Text>
          <TextInput
            style={styles.input}
            value={formData.ghiChu}
            onChangeText={(value) => handleInputChange('ghiChu', value)}
            placeholder="Thông tin bổ sung (không bắt buộc)"
            multiline
            numberOfLines={3}
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Yêu cầu xếp dỡ:</Text>
    
          <View style={styles.row}>
            {/* Cột 1 */}
            <View style={styles.column}>
              <View style={styles.radioItem}>
                <RadioButton
                  value="ngang"
                  status={checked === 'ngang' ? 'checked' : 'unchecked'}
                  onPress={() => setChecked('Xếp dọc ngang')}
                />
                <Text>Xếp dọc ngang</Text>
              </View>
              
              <View style={styles.radioItem}>
                <RadioButton
                  value="fragile"
                  status={checked === 'fragile' ? 'checked' : 'unchecked'}
                  onPress={() => setChecked('Hang dễ vỡ')}
                />
                <Text>Hàng dễ vỡ</Text>
              </View>
            </View>

            {/* Cột 2 */}
            <View style={styles.column}>
              <View style={styles.radioItem}>
                <RadioButton
                  value="3layers"
                  status={checked === '3layers' ? 'checked' : 'unchecked'}
                  onPress={() => setChecked('Xếp 3 lớp')}
                />
                <Text>Xếp 3 lớp</Text>
              </View>
              
              <View style={styles.radioItem}>
                <RadioButton
                  value="5layers"
                  status={checked === '5layers' ? 'checked' : 'unchecked'}
                  onPress={() => setChecked('Xếp 5 lớp')}
                />
                <Text>Xếp 5 lớp</Text>
              </View>
            </View>
          </View>

          {/* Lựa chọn Khác */}
          <View style={styles.otherContainer}>
            <RadioButton
              value="other"
              status={checked === 'other' ? 'checked' : 'unchecked'}
              onPress={() => setChecked('other')}
            />
            <Text style={{ marginRight: 10 }}>Khác:</Text>
            <TextInput
              style={styles.input}
              value={otherText}
              onChangeText={setOtherText}
              placeholder="Nhập yêu cầu khác..."
              editable={checked === 'other'} // Chỉ cho nhập khi chọn "Khác"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
          <Text style={styles.submitButtonText}>Tạo đơn hàng</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Lưu ý:</Text>
        <Text style={styles.infoText}>• Đơn hàng sẽ được xử lý trong vòng 24h</Text>
        <Text style={styles.infoText}>• Phí vận chuyển sẽ được tính theo bảng giá</Text>
        <Text style={styles.infoText}>• Bạn sẽ nhận được thông báo khi đơn hàng được xác nhận</Text>
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
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 16,
    flex: 1,
  },
  formBox: {
    borderWidth: 1,
    borderColor: '#000',
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontWeight: '600',
    marginBottom: 8,
    fontSize: 14,
  },
  required: {
    color: '#ff4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: '#fff',
  },
  submitButton: {
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 10,
  },
  submitButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  infoBox: {
    borderWidth: 1,
    borderColor: '#007AFF',
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 6,
  },
  infoTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#007AFF',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between' 
  },
  column: { 
    flex: 1 
  },
  radioItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 5 
  },
  otherContainer: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 10 
  },
});