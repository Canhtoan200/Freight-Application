import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";

export default function CreateWagonManagement() {
  const router = useRouter();

  const [wagonNumber, setWagonNumber] = useState("");
  const [wagonRoute, setWagonRoute] = useState("");
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const h = String(date.getHours()).padStart(2, "0");
    const min = String(date.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${h}:${min}`;
  };

  const openDatePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: departureDate ?? new Date(),
        onChange: (event: any, selectedDate?: Date) => {
          if (event.type === "set" && selectedDate) {
            setDepartureDate(selectedDate);
          }
        },
        mode: "date",
      });
    } else if (Platform.OS === "ios") {
      setShowIOSPicker(true);
    }
  };

  const goBack = () => {
    router.back();
  };

  const handleSubmit = async () => {
    if (!wagonNumber.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập số toa tàu");
      return;
    }
    if (!wagonRoute.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập tuyến đường toa");
      return;
    }

    const payload: {
      wagon_number: string;
      wagon_route: string;
      wagon_departure_date?: string;
    } = {
      wagon_number: wagonNumber.trim(),
      wagon_route: wagonRoute.trim(),
    };
    if (departureDate) {
      payload.wagon_departure_date = formatDate(departureDate);
    }

    setLoading(true);
    try {
      const response = await fetch(
        "https://freight-application-server.onrender.com/api/v1/orders/createWagonOrder",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );
      const data = await response.json();

      if (response.ok) {
        Alert.alert("Thành công", data.message || "Tạo toa tàu thành công", [
          { text: "OK", onPress: goBack },
        ]);
      } else {
        Alert.alert("Lỗi", data.message || "Tạo toa tàu thất bại");
      }
    } catch (error) {
      Alert.alert(
        "Lỗi kết nối",
        "Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối Internet."
      );
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={goBack}>
          <Text style={styles.backButtonText}>← Quay lại</Text>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={styles.formBox}>
        <Text style={styles.sectionTitle}>Tạo toa tàu mới</Text>

        {/* Wagon Number */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Số toa tàu <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={wagonNumber}
            onChangeText={setWagonNumber}
            placeholder="Nhập số toa tàu (VD: 232252)"
          />
        </View>

        {/* Wagon Route */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>
            Tuyến đường toa <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            value={wagonRoute}
            onChangeText={setWagonRoute}
            placeholder="Nhập tuyến đường toa (VD: Hà Nội - TP.HCM)"
          />
        </View>

        {/* Departure Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ngày khởi hành</Text>
          {Platform.OS === "web" ? (
            <TextInput
              style={styles.input}
              value={departureDate ? formatDate(departureDate) : ""}
              onChangeText={(text) => {
                const parsed = new Date(text);
                if (!isNaN(parsed.getTime())) setDepartureDate(parsed);
              }}
              placeholder="YYYY-MM-DD HH:MM (không bắt buộc)"
            />
          ) : (
            <TouchableOpacity
              style={[styles.input, styles.dateButton]}
              onPress={openDatePicker}
            >
              <Text
                style={
                  departureDate ? styles.dateText : styles.datePlaceholder
                }
              >
                {departureDate
                  ? formatDate(departureDate)
                  : "Chọn ngày khởi hành (không bắt buộc)"}
              </Text>
            </TouchableOpacity>
          )}

          {/* iOS date picker modal */}
          {Platform.OS === "ios" && (
            <Modal
              transparent
              visible={showIOSPicker}
              animationType="slide"
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <DateTimePicker
                    value={departureDate ?? new Date()}
                    mode="datetime"
                    display="spinner"
                    onChange={(_event: any, selectedDate?: Date) => {
                      if (selectedDate) setDepartureDate(selectedDate);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.modalDone}
                    onPress={() => setShowIOSPicker(false)}
                  >
                    <Text style={styles.modalDoneText}>Xong</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          )}
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.submitButtonText}>
            {loading ? "Đang tạo..." : "Tạo toa tàu"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Info box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Lưu ý:</Text>
        <Text style={styles.infoText}>• Số toa tàu là bắt buộc và phải duy nhất</Text>
        <Text style={styles.infoText}>• Tuyến đường toa là bắt buộc</Text>
        <Text style={styles.infoText}>• Ngày khởi hành có thể bổ sung sau</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#007AFF",
    borderRadius: 6,
  },
  backButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  formBox: {
    borderWidth: 1,
    borderColor: "#000",
    marginBottom: 16,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    color: "#333",
  },
  required: {
    color: "red",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    backgroundColor: "#fff",
  },
  dateButton: {
    justifyContent: "center",
  },
  dateText: {
    fontSize: 14,
    color: "#333",
  },
  datePlaceholder: {
    fontSize: 14,
    color: "#aaa",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  modalDone: {
    alignItems: "flex-end",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  modalDoneText: {
    color: "#007AFF",
    fontSize: 16,
    fontWeight: "600",
  },
  submitButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  submitButtonDisabled: {
    backgroundColor: "#99c4ff",
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  infoBox: {
    backgroundColor: "#f0f8ff",
    borderWidth: 1,
    borderColor: "#b0d4f1",
    borderRadius: 8,
    padding: 14,
  },
  infoTitle: {
    fontWeight: "bold",
    marginBottom: 6,
    fontSize: 14,
  },
  infoText: {
    fontSize: 13,
    color: "#444",
    marginBottom: 4,
  },
});
