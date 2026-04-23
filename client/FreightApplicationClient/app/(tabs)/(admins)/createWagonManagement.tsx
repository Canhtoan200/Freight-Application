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
} from "react-native";
import { useRouter } from "expo-router";

export default function CreateWagonManagement() {
  const router = useRouter();

  const [wagonNumber, setWagonNumber] = useState("");
  const [departureDateText, setDepartureDateText] = useState("");
  const [loading, setLoading] = useState(false);

  const goBack = () => {
    router.back();
  };

  // Validate datetime string: accepts "YYYY-MM-DD" or "YYYY-MM-DD HH:MM"
  const isValidDatetime = (value: string) => {
    if (!value) return true; // nullable field
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/;
    const dateTime = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
    return dateOnly.test(value) || dateTime.test(value);
  };

  const handleSubmit = async () => {
    if (!wagonNumber.trim()) {
      Alert.alert("Thông báo", "Vui lòng nhập số toa tàu");
      return;
    }

    if (departureDateText && !isValidDatetime(departureDateText)) {
      Alert.alert(
        "Thông báo",
        "Định dạng ngày khởi hành không hợp lệ.\nVui lòng nhập theo dạng: YYYY-MM-DD hoặc YYYY-MM-DD HH:MM"
      );
      return;
    }

    const payload: { wagon_number: string; wagon_departure_date?: string } = {
      wagon_number: wagonNumber.trim(),
    };
    if (departureDateText.trim()) {
      payload.wagon_departure_date = departureDateText.trim();
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
        console.log("Thành công", data.message || "Tạo toa tàu thành công", [
          { text: "OK", onPress: goBack },
        ]);
      } else {
        console.log("Lỗi", data.message || "Tạo toa tàu thất bại");
      }
    } catch (error) {
      console.log(
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

        {/* Departure Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ngày khởi hành</Text>
          <TextInput
            style={styles.input}
            value={departureDateText}
            onChangeText={setDepartureDateText}
            placeholder="YYYY-MM-DD HH:MM (không bắt buộc)"
            keyboardType={Platform.OS === "ios" ? "default" : "default"}
          />
          <Text style={styles.hintText}>
            Ví dụ: 2026-04-25 08:30
          </Text>
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
        <Text style={styles.infoText}>• Ngày khởi hành có thể bổ sung sau</Text>
        <Text style={styles.infoText}>• Định dạng ngày: YYYY-MM-DD hoặc YYYY-MM-DD HH:MM</Text>
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
  hintText: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
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
