import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

type EditableOrder = {
  order_name: string;
  sender_name: string;
  sender_address: string;
  sender_phone_number: string;
  receiver_name: string;
  receiver_address: string;
  receiver_phone_number: string;
  goods_quantity: string;
  goods_weight: string;
  goods_volume: string;
  note: string;
  handling_instruction: string;
};

type Endpoint = "sender" | "receiver";
type DeliveryEvidence = {
  endpoint: Endpoint;
  imageData: string;
  mimeType: string;
  fileName?: string | null;
};
type ApiOrder = Partial<Record<keyof EditableOrder, string | number | null>> & {
  OrderID: number;
};

const API_URL = "https://freight-application-server.onrender.com/api/v1/orders";
const BACKEND_UPDATE_MESSAGE =
  "API chỉnh sửa của kế toán chưa được cập nhật trên máy chủ. Hãy deploy phiên bản backend mới rồi thử lại.";
const emptyOrder: EditableOrder = {
  order_name: "",
  sender_name: "",
  sender_address: "",
  sender_phone_number: "",
  receiver_name: "",
  receiver_address: "",
  receiver_phone_number: "",
  goods_quantity: "",
  goods_weight: "",
  goods_volume: "",
  note: "",
  handling_instruction: "",
};

const fields: { key: keyof EditableOrder; label: string; multiline?: boolean; keyboardType?: "default" | "numeric" | "decimal-pad" }[] = [
  { key: "order_name", label: "Tên hàng hóa" },
  { key: "goods_quantity", label: "Số lượng", keyboardType: "numeric" },
  { key: "goods_weight", label: "Khối lượng (kg)", keyboardType: "decimal-pad" },
  { key: "goods_volume", label: "Thể tích (m³)", keyboardType: "decimal-pad" },
  { key: "sender_name", label: "Tên người gửi" },
  { key: "sender_address", label: "Địa chỉ gửi", multiline: true },
  { key: "sender_phone_number", label: "Điện thoại người gửi" },
  { key: "receiver_name", label: "Tên người nhận" },
  { key: "receiver_address", label: "Địa chỉ nhận", multiline: true },
  { key: "receiver_phone_number", label: "Điện thoại người nhận" },
  { key: "handling_instruction", label: "Hướng xử lý" },
  { key: "note", label: "Ghi chú", multiline: true },
];

async function readApiResponse(response: Response) {
  const body = await response.text();
  let data: { message?: string; data?: ApiOrder; evidence?: DeliveryEvidence[] };
  try {
    data = JSON.parse(body);
  } catch {
    if (response.status === 404) {
      throw new Error(BACKEND_UPDATE_MESSAGE);
    }
    throw new Error(`Máy chủ trả dữ liệu không hợp lệ (HTTP ${response.status}).`);
  }
  if (!response.ok) {
    throw new Error(data.message || `Máy chủ gặp lỗi HTTP ${response.status}.`);
  }
  return data;
}

export default function AccountantOrderManagement() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [form, setForm] = useState<EditableOrder>(emptyOrder);
  const [evidence, setEvidence] = useState<Partial<Record<Endpoint, DeliveryEvidence>>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<keyof EditableOrder | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [savingField, setSavingField] = useState<keyof EditableOrder | null>(null);
  const [uploading, setUploading] = useState<Endpoint | null>(null);
  const [downloading, setDownloading] = useState<Endpoint | null>(null);

  useEffect(() => {
    let active = true;
    const loadOrder = async () => {
      try {
        const rawUser = await AsyncStorage.getItem("userToken");
        const user = rawUser ? JSON.parse(rawUser) as { token?: string } : null;
        if (!user?.token) throw new Error("Vui lòng đăng nhập lại.");

        const response = await fetch(`${API_URL}/accountant/${orderId}`, {
          headers: { Authorization: `Bearer ${user.token}` },
        });
        const data = await readApiResponse(response);
        if (!active) return;

        const order = data.data;
        if (!order) throw new Error("Máy chủ không trả về thông tin đơn hàng.");
        const nextForm = { ...emptyOrder };
        for (const field of Object.keys(nextForm) as (keyof EditableOrder)[]) {
          const value = order[field];
          nextForm[field] = value == null ? "" : String(value);
        }
        setForm(nextForm);
        setEvidence(Object.fromEntries(
          (data.evidence || []).map((item: DeliveryEvidence) => [item.endpoint, item])
        ));
      } catch (error) {
        console.error("Không thể tải đơn hàng kế toán:", error);
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Không thể tải đơn hàng.");
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    if (orderId) loadOrder();
    else setLoading(false);
    return () => { active = false; };
  }, [orderId]);

  const getToken = async () => {
    const rawUser = await AsyncStorage.getItem("userToken");
    const user = rawUser ? JSON.parse(rawUser) as { token?: string } : null;
    if (!user?.token) throw new Error("Vui lòng đăng nhập lại.");
    return user.token;
  };

  const saveField = async (key: keyof EditableOrder) => {
    const field = fields.find((item) => item.key === key);
    if (!field) return;
    let value: string | number | null = draftValue.trim();
    if (field.keyboardType === "numeric" || field.keyboardType === "decimal-pad") {
      if (!draftValue.trim()) {
        value = null;
      } else {
        value = Number(draftValue);
        if (
          !Number.isFinite(value) ||
          value < 0 ||
          (field.keyboardType === "numeric" && !Number.isInteger(value))
        ) {
          Alert.alert("Dữ liệu không hợp lệ", `${field.label} phải là số hợp lệ và không âm.`);
          return;
        }
      }
    }
    setSavingField(key);
    try {
      const token = await getToken();
      const response = await fetch(`${API_URL}/accountant/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: value }),
      });
      await readApiResponse(response);
      setForm((current) => ({ ...current, [key]: value == null ? "" : String(value) }));
      setEditingField(null);
      Alert.alert("Thành công", `Đã cập nhật ${field.label.toLowerCase()}.`);
    } catch (error) {
      console.error("Không thể cập nhật đơn hàng:", error);
      Alert.alert("Lỗi", error instanceof Error ? error.message : "Không thể cập nhật đơn hàng.");
    } finally {
      setSavingField(null);
    }
  };

  const downloadEvidence = async (endpoint: Endpoint) => {
    const image = evidence[endpoint];
    if (!image) return;
    setDownloading(endpoint);
    try {
      const extensionByMimeType: Record<string, string> = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
      };
      const extension = extensionByMimeType[image.mimeType];
      if (!extension) throw new Error("Định dạng ảnh không được hỗ trợ để tải xuống.");
      const fileName = `bien-ban-don-${orderId}-${endpoint}.${extension}`;

      if (Platform.OS === "web") {
        const binary = window.atob(image.imageData);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        const blob = new Blob([bytes], { type: image.mimeType });
        const objectUrl = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = objectUrl;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(objectUrl);
        return;
      }

      if (!FileSystem.cacheDirectory) {
        throw new Error("Không tìm thấy thư mục lưu ảnh trên thiết bị.");
      }
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(fileUri, image.imageData, {
        encoding: FileSystem.EncodingType.Base64,
      });
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error(`Ảnh đã lưu tạm tại ${fileUri}, nhưng thiết bị không hỗ trợ chia sẻ để lưu ra ngoài.`);
      }
      await Sharing.shareAsync(fileUri, {
        mimeType: image.mimeType,
        dialogTitle: "Lưu ảnh biên bản",
        UTI: `public.${extension}`,
      });
    } catch (error) {
      console.error("Không thể tải ảnh biên bản:", error);
      Alert.alert("Lỗi", error instanceof Error ? error.message : "Không thể tải ảnh biên bản.");
    } finally {
      setDownloading(null);
    }
  };

  const uploadEvidence = async (endpoint: Endpoint) => {
    setUploading(endpoint);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Cần quyền truy cập", "Vui lòng cho phép truy cập thư viện ảnh để chọn biên bản.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error("Không đọc được dữ liệu ảnh đã chọn.");
      const imageData = asset.base64;
      const mimeType = asset.mimeType?.toLowerCase();
      if (!mimeType || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
        throw new Error("Ảnh phải có định dạng JPEG, PNG hoặc WebP.");
      }
      if (asset.base64.length * 0.75 > 6 * 1024 * 1024) {
        throw new Error("Ảnh không được vượt quá 6 MB.");
      }

      const token = await getToken();
      const response = await fetch(`${API_URL}/accountant/${orderId}/evidence/${endpoint}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageData,
          mimeType,
          fileName: asset.fileName || null,
        }),
      });
      await readApiResponse(response);

      setEvidence((current) => ({
        ...current,
        [endpoint]: {
          endpoint,
          imageData,
          mimeType,
          fileName: asset.fileName,
        },
      }));
      Alert.alert("Thành công", "Đã lưu ảnh biên bản giao nhận.");
    } catch (error) {
      console.error("Không thể lưu ảnh biên bản:", error);
      Alert.alert("Lỗi", error instanceof Error ? error.message : "Không thể lưu ảnh biên bản.");
    } finally {
      setUploading(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.statusText}>Đang tải đơn hàng...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>{loadError}</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Quay lại</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Chỉnh sửa đơn hàng #{orderId}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Thông tin đơn hàng</Text>
        <Text style={styles.helperText}>
          Chọn Sửa ở đúng thông tin cần điều chỉnh. Các trường khác sẽ được giữ nguyên.
        </Text>
        {fields.map((field) => (
          <View key={field.key} style={styles.inputGroup}>
            <Text style={styles.label}>{field.label}</Text>
            {editingField === field.key ? (
              <>
                <TextInput
                  style={[styles.input, field.multiline && styles.multilineInput]}
                  value={draftValue}
                  onChangeText={setDraftValue}
                  keyboardType={field.keyboardType || "default"}
                  multiline={field.multiline}
                  textAlignVertical={field.multiline ? "top" : "center"}
                  autoFocus
                />
                <View style={styles.editActions}>
                  <TouchableOpacity
                    style={[styles.primaryButton, styles.inlineButton, savingField === field.key && styles.disabledButton]}
                    onPress={() => saveField(field.key)}
                    disabled={savingField !== null}
                  >
                    {savingField === field.key ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Lưu trường này</Text>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cancelButton, styles.inlineButton]}
                    onPress={() => setEditingField(null)}
                    disabled={savingField !== null}
                  >
                    <Text style={styles.cancelButtonText}>Hủy</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={styles.valueRow}>
                <Text style={styles.value}>{form[field.key] || "Chưa có thông tin"}</Text>
                <TouchableOpacity
                  style={styles.editButton}
                  onPress={() => {
                    setDraftValue(form[field.key]);
                    setEditingField(field.key);
                  }}
                  disabled={savingField !== null}
                >
                  <Text style={styles.editButtonText}>Sửa</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ))}
        <Text style={styles.helperText}>
          Trạng thái, tài xế và toa tàu được quản lý riêng nên không chỉnh sửa tại đây.
        </Text>
      </View>

      {(["sender", "receiver"] as Endpoint[]).map((endpoint) => {
        const isSender = endpoint === "sender";
        const image = evidence[endpoint];
        return (
          <View key={endpoint} style={styles.section}>
            <Text style={styles.sectionTitle}>
              Biên bản giao nhận - đầu {isSender ? "gửi" : "nhận"}
            </Text>
            <Text style={styles.helperText}>
              {isSender ? "Ảnh biên bản tại nơi nhận hàng từ người gửi." : "Ảnh biên bản tại nơi giao hàng cho người nhận."}
            </Text>
            {image && (
              <>
                <Image
                  source={{ uri: `data:${image.mimeType};base64,${image.imageData}` }}
                  style={styles.evidenceImage}
                  resizeMode="contain"
                />
                <TouchableOpacity
                  style={[styles.downloadButton, downloading === endpoint && styles.disabledButton]}
                  onPress={() => downloadEvidence(endpoint)}
                  disabled={downloading !== null}
                >
                  {downloading === endpoint ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Tải ảnh về thiết bị</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[styles.secondaryButton, uploading === endpoint && styles.disabledButton]}
              onPress={() => uploadEvidence(endpoint)}
              disabled={uploading !== null}
            >
              {uploading === endpoint ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{image ? "Thay ảnh biên bản" : "Chọn và tải ảnh lên"}</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    backgroundColor: "#f5f5f5",
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  statusText: {
    marginTop: 12,
    color: "#555",
  },
  errorText: {
    color: "#b00020",
    textAlign: "center",
    marginBottom: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
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
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  section: {
    padding: 16,
    marginBottom: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  inputGroup: {
    marginBottom: 12,
  },
  valueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    minHeight: 40,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#e0e0e0",
    borderRadius: 6,
    backgroundColor: "#fafafa",
  },
  value: {
    flex: 1,
    color: "#333",
    paddingVertical: 10,
  },
  editButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: "#e8f1ff",
    borderRadius: 5,
  },
  editButtonText: {
    color: "#0056b3",
    fontWeight: "600",
  },
  editActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  inlineButton: {
    flex: 1,
    marginTop: 0,
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: "#eee",
  },
  cancelButtonText: {
    color: "#333",
    fontWeight: "600",
  },
  label: {
    fontWeight: "600",
    marginBottom: 6,
    color: "#333",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    minHeight: 42,
  },
  multilineInput: {
    minHeight: 76,
  },
  helperText: {
    color: "#666",
    fontSize: 13,
    marginBottom: 12,
  },
  primaryButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#007AFF",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  secondaryButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#25292e",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 12,
  },
  downloadButton: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1976d2",
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.6,
  },
  evidenceImage: {
    width: "100%",
    height: 320,
    backgroundColor: "#eee",
    borderRadius: 6,
  },
});
