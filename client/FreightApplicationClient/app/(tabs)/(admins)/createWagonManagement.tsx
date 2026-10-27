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
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSegments } from "expo-router";
import DateTimePicker, {
  DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";

type WagonPayload = {
  wagon_number: string;
  wagon_route: string;
  wagon_departure_date: string;
  wagon_arrival_date: string;
  wagon_type: "LOADING" | "UNLOADING";
};

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min}`;
}

function toDateTimeLocalValue(date: Date | null) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d}T${h}:${min}`;
}

function parseDateTimeLocalValue(value: string) {
  if (!value) return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return null;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);
  return Number.isNaN(date.getTime()) ? null : date;
}

type WebDateTimeInputProps = {
  value: Date | null;
  onChange: (date: Date | null) => void;
  minimum?: Date;
  maximum?: Date;
};

function WebDateTimeInput({ value, onChange, minimum, maximum }: WebDateTimeInputProps) {
  return React.createElement("input", {
    type: "datetime-local",
    value: toDateTimeLocalValue(value),
    min: toDateTimeLocalValue(minimum ?? null),
    max: toDateTimeLocalValue(maximum ?? null),
    onChange: (event) => onChange(parseDateTimeLocalValue(event.currentTarget.value)),
    style: {
      boxSizing: "border-box",
      width: "100%",
      minHeight: 42,
      padding: "10px 12px",
      border: "1px solid #ccc",
      borderRadius: 6,
      backgroundColor: "#fff",
      color: "#333",
      fontSize: 14,
    },
  });
}

export default function CreateWagonManagement() {
  const router = useRouter();
  const { wagonType: requestedWagonType } = useLocalSearchParams<{ wagonType?: string }>();
  const wagonType: WagonPayload["wagon_type"] =
    requestedWagonType?.toUpperCase() === "UNLOADING" ? "UNLOADING" : "LOADING";
  const segments = useSegments();
  const homeRoute = segments.some((segment) => String(segment) === "(businessPartners)")
    ? "/(tabs)/(businessPartners)"
    : "/(tabs)/(admins)";

  const [wagonNumber, setWagonNumber] = useState("");
  const [wagonRoute, setWagonRoute] = useState("");
  const [departureDate, setDepartureDate] = useState<Date | null>(null);
  const [showIOSPicker, setShowIOSPicker] = useState(false);
  const [arrivalDate, setArrivalDate] = useState<Date | null>(null);
  const [showIOSArrivalPicker, setShowIOSArrivalPicker] = useState(false);
  const [loading, setLoading] = useState(false);

  const openDatePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: departureDate ?? new Date(),
        onChange: (event: any, selectedDate?: Date) => {
          if (event.type === "set" && selectedDate) {
            DateTimePickerAndroid.open({
              value: selectedDate,
              mode: "time",
              onChange: (timeEvent: any, selectedTime?: Date) => {
                if (timeEvent.type === "set" && selectedTime) {
                  const dateTime = new Date(selectedDate);
                  dateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes());
                  setDepartureDate(dateTime);
                }
              },
            });
          }
        },
        mode: "date",
      });
    } else if (Platform.OS === "ios") {
      setShowIOSPicker(true);
    }
  };

  const openArrivalDatePicker = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        value: arrivalDate ?? new Date(),
        onChange: (event: any, selectedDate?: Date) => {
          if (event.type === "set" && selectedDate) {
            DateTimePickerAndroid.open({
              value: selectedDate,
              mode: "time",
              onChange: (timeEvent: any, selectedTime?: Date) => {
                if (timeEvent.type === "set" && selectedTime) {
                  const dateTime = new Date(selectedDate);
                  dateTime.setHours(selectedTime.getHours(), selectedTime.getMinutes());
                  setArrivalDate(dateTime);
                }
              },
            });
          }
        },
        mode: "date",
      });
    } else if (Platform.OS === "ios") {
      setShowIOSArrivalPicker(true);
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
    if (!departureDate || !arrivalDate) {
      Alert.alert("Thông báo", "Vui lòng chọn ngày khởi hành và ngày đến.");
      return;
    }
    if (arrivalDate < departureDate) {
      Alert.alert("Thông báo", "Ngày đến phải sau ngày khởi hành.");
      return;
    }

    const payload: WagonPayload = {
      wagon_number: wagonNumber.trim(),
      wagon_route: wagonRoute.trim(),
      wagon_departure_date: formatDate(departureDate),
      wagon_arrival_date: formatDate(arrivalDate),
      wagon_type: wagonType,
    };

    setLoading(true);
    try {
      const response = await fetch(
        "https://freight-application-server.onrender.com/api/v1/wagons/createWagonOrder",
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
        router.replace(homeRoute as any);
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
        <Text style={styles.sectionTitle}>
          Tạo toa tàu {wagonType === "LOADING" ? "xếp" : "dỡ"}
        </Text>

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
          <Text style={styles.label}>Ngày khởi hành<Text style={styles.required}>*</Text></Text>
          {Platform.OS === "web" ? (
            <WebDateTimeInput
              value={departureDate}
              onChange={setDepartureDate}
              maximum={arrivalDate ?? undefined}
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
                  : "Chọn ngày và giờ khởi hành"}
              </Text>
            </TouchableOpacity>
          )}
          {/* iOS date picker modal - Departure */}
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
                    maximumDate={arrivalDate ?? undefined}
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

        {/* Arrival Date */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Ngày đến<Text style={styles.required}>*</Text></Text>
          {Platform.OS === "web" ? (
            <WebDateTimeInput
              value={arrivalDate}
              onChange={setArrivalDate}
              minimum={departureDate ?? undefined}
            />
          ) : (
            <TouchableOpacity
              style={[styles.input, styles.dateButton]}
              onPress={openArrivalDatePicker}
            >
              <Text
                style={arrivalDate ? styles.dateText : styles.datePlaceholder}
              >
                {arrivalDate ? formatDate(arrivalDate) : "Chọn ngày đến"}
              </Text>
            </TouchableOpacity>
          )}
          {/* iOS date picker modal - Arrival */}
          {Platform.OS === "ios" && (
            <Modal
              transparent
              visible={showIOSArrivalPicker}
              animationType="slide"
            >
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <DateTimePicker
                    value={arrivalDate ?? new Date()}
                    mode="datetime"
                    display="spinner"
                    minimumDate={departureDate ?? undefined}
                    onChange={(_event: any, selectedDate?: Date) => {
                      if (selectedDate) setArrivalDate(selectedDate);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.modalDone}
                    onPress={() => setShowIOSArrivalPicker(false)}
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
        <Text style={styles.infoText}>• Ngày khởi hành là bắt buộc</Text>
        <Text style={styles.infoText}>• Ngày đến là bắt buộc</Text>
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
