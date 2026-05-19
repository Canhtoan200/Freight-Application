import React, { useEffect, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

type Order = {
  OrderID: number;
  order_name?: string;
  goods_quantity?: number;
  receiver_name?: string;
  sender_name?: string;
  wagon_arrival_date?: string;
  shipping_status?: string;
  wagon_number?: string;
};

export default function CreateWagonOrderManagement() {
  const router = useRouter();
  const { wagonId, wagonNumber } = useLocalSearchParams<{
    wagonId: string;
    wagonNumber: string;
  }>();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [statusModal, setStatusModal] = useState<{ orderId: number; current?: string } | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await fetch(
        "https://freight-application-server.onrender.com/api/v1/orders/getAllOrders"
      );
      const data = await response.json();
      if (response.ok) {
        setOrders(data.data || []);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (orderId: number) => {
    if (!wagonId) {
      Alert.alert("Lỗi", "Không tìm thấy thông tin toa tàu.");
      return;
    }
    setAddingId(orderId);
    try {
      const response = await fetch(
        "https://freight-application-server.onrender.com/api/v1/wagons/createWagonDetail",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ WagonIDs: Number(wagonId), OrderIDs: [orderId] }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        Alert.alert("Thành công", `Đã thêm đơn hàng vào toa ${wagonNumber || wagonId}.`);
        router.back();
      } else {
        Alert.alert("Lỗi", data.message || "Không thể thêm đơn hàng vào toa.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể kết nối đến máy chủ.");
    } finally {
      setAddingId(null);
    }
  };

  const STATUS_OPTIONS = [
    "Đã tiếp nhận",
    "Đang vận chuyển",
    "Đã lên toa",
    "Đã giao hàng",
  ];

  const handleUpdateStatus = (orderId: number, currentStatus?: string) => {
    setStatusModal({ orderId, current: currentStatus });
  };

  const submitStatusUpdate = async (orderId: number, status: string) => {
    setStatusModal(null);
    setUpdatingId(orderId);
    try {
      const response = await fetch(
        "https://freight-application-server.onrender.com/api/v1/orders/updateShippingStatus",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ OrderID: orderId, shipping_status: status }),
        }
      );
      const data = await response.json();
      if (response.ok) {
        setOrders((prev) =>
          prev.map((o) =>
            o.OrderID === orderId ? { ...o, shipping_status: status } : o
          )
        );
      } else {
        Alert.alert("Lỗi", data.message || "Không thể cập nhật trạng thái.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert("Lỗi", "Không thể kết nối đến máy chủ.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Status picker modal */}
      <Modal
        visible={statusModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setStatusModal(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setStatusModal(null)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Chọn trạng thái mới</Text>
            {statusModal && (
              <Text style={styles.modalCurrent}>
                Hiện tại: {statusModal.current || "—"}
              </Text>
            )}
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status}
                style={styles.modalOption}
                onPress={() => statusModal && submitStatusUpdate(statusModal.orderId, status)}
              >
                <Text style={styles.modalOptionText}>{status}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setStatusModal(null)}
            >
              <Text style={styles.modalCancelText}>Hủy</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <View style={styles.headerRow}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>← Quay lại</Text>
        </TouchableOpacity>
        <Text style={styles.pageTitle}>
          Thêm đơn hàng vào toa {wagonNumber || wagonId}
        </Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.loadingText}>Đang tải danh sách đơn hàng...</Text>
        </View>
      ) : orders.length === 0 ? (
        <Text style={styles.emptyText}>Không có đơn hàng nào.</Text>
      ) : (
        <View style={styles.tableWrapper}>
          <View style={styles.tableHeader}>
            <View style={[styles.cell, styles.cellLarge]}>
              <Text style={styles.headerText}>Tên hàng</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.headerText}>Số lượng</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.headerText}>Chủ nhận</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.headerText}>Chủ gửi</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.headerText}>Trạng thái</Text>
            </View>
            <View style={styles.cell}>
              <Text style={styles.headerText}>Cập nhật</Text>
            </View>
            <View style={[styles.cell, styles.lastCell]}>
              <Text style={styles.headerText}>Thêm</Text>
            </View>
          </View>
          {orders.map((order) => (
            <View key={order.OrderID} style={styles.tableRow}>
              <View style={[styles.cell, styles.cellLarge]}>
                <Text style={styles.bodyText}>{order.order_name || "—"}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.bodyText}>{order.goods_quantity ?? "—"}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.bodyText}>{order.receiver_name || "—"}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.bodyText}>{order.sender_name || "—"}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={styles.bodyText}>{order.shipping_status || "—"}</Text>
              </View>
              <View style={styles.cell}>
                {updatingId === order.OrderID ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <TouchableOpacity
                    style={styles.updateButton}
                    onPress={() => handleUpdateStatus(order.OrderID, order.shipping_status)}
                  >
                    <Text style={styles.updateButtonText}>Cập nhật</Text>
                  </TouchableOpacity>
                )}
              </View>
              <View style={[styles.cell, styles.lastCell]}>
                {addingId === order.OrderID ? (
                  <ActivityIndicator size="small" color="#000" />
                ) : (
                  <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => handleAdd(order.OrderID)}
                  >
                    <Text style={styles.addButtonText}>Thêm</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 24,
    backgroundColor: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    gap: 12,
  },
  backButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#000",
  },
  backButtonText: {
    fontWeight: "600",
    fontSize: 13,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  centered: {
    alignItems: "center",
    marginTop: 40,
  },
  loadingText: {
    marginTop: 8,
    color: "#555",
  },
  emptyText: {
    textAlign: "center",
    color: "#777",
    marginTop: 40,
  },
  tableWrapper: {
    borderWidth: 1,
    borderColor: "#000",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderBottomWidth: 1,
    borderColor: "#000",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  cell: {
    flex: 1,
    minWidth: 80,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  cellLarge: {
    flex: 1.5,
  },
  lastCell: {
    borderRightWidth: 0,
  },
  headerText: {
    fontWeight: "700",
    textAlign: "center",
    fontSize: 13,
  },
  bodyText: {
    fontSize: 12,
    textAlign: "center",
    color: "#111",
  },
  addButton: {
    backgroundColor: "#000",
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  updateButton: {
    backgroundColor: "#1976d2",
    paddingVertical: 5,
    paddingHorizontal: 8,
  },
  updateButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 20,
    minWidth: 260,
    maxWidth: 340,
  },
  modalTitle: {
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 6,
    textAlign: "center",
  },
  modalCurrent: {
    fontSize: 13,
    color: "#555",
    marginBottom: 12,
    textAlign: "center",
  },
  modalOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  modalOptionText: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  modalCancel: {
    paddingVertical: 12,
    marginTop: 4,
  },
  modalCancelText: {
    fontSize: 14,
    color: "#d32f2f",
    textAlign: "center",
    fontWeight: "600",
  },
});
