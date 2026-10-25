import React, { useState, useEffect } from "react";
import { ScrollView, StyleSheet, Text, View, ActivityIndicator, Alert, TouchableOpacity } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function OrderDetail() {
    const router = useRouter();
    const { orderId } = useLocalSearchParams();
    const [order, setOrder] = useState(null);
    const [loading, setLoading] = useState(true);

    const goBack = () => {
        if (router.canGoBack && router.canGoBack()) {
            router.back();
        } else {
            router.push('/');
        }
    };

    useEffect(() => {
        const fetchOrderDetail = async () => {
            if (!orderId) {
                setLoading(false);
                return;
            }

            try {
                const rawUser = await AsyncStorage.getItem("userToken");
                const user = rawUser ? JSON.parse(rawUser) : null;
                if (!user?.token) {
                    throw new Error("Vui lòng đăng nhập lại để xem chi tiết đơn hàng.");
                }
                const response = await fetch("https://freight-application-server.onrender.com/api/v1/orders/getOrdersForTracking", {
                    headers: { Authorization: `Bearer ${user.token}` },
                });
                const body = await response.text();
                let data = null;
                try {
                    data = JSON.parse(body);
                } catch {}
                if (!response.ok) {
                    if (response.status === 404) {
                        throw new Error("API theo dõi chưa được triển khai trên máy chủ.");
                    }
                    throw new Error(data?.message || `Máy chủ gặp lỗi HTTP ${response.status}.`);
                }
                if (!data) throw new Error("Máy chủ trả về dữ liệu không hợp lệ.");
                const foundOrder = (data.data || []).find((item) => String(item.OrderID) === String(orderId));

                if (foundOrder) {
                    setOrder(foundOrder);
                } else {
                    Alert.alert("Không tìm thấy", "Đơn hàng không tồn tại hoặc đã bị xóa.");
                }
            } catch (error) {
                console.error(error);
                Alert.alert(
                    "Không thể tải chi tiết đơn hàng",
                    error instanceof Error ? error.message : "Lỗi kết nối đến máy chủ.",
                );
            } finally {
                setLoading(false);
            }
        };

        fetchOrderDetail();
    }, [orderId]);

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#000" />
                <Text style={styles.loadingText}>Đang tải chi tiết đơn hàng...</Text>
            </View>
        );
    }

    if (!order) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>Không tìm thấy đơn hàng.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={goBack}>
                    <Text style={styles.backButtonText}>← Quay lại</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Chi tiết đơn hàng</Text>
            </View>
            <View style={styles.section}>
                <Text style={styles.label}>Mã đơn hàng:</Text>
                <Text style={styles.value}>{order.OrderID}</Text>
            </View>
            <View style={styles.section}>
                <Text style={styles.label}>Tên hàng hóa:</Text>
                <Text style={styles.value}>{order.order_name || "Không có"}</Text>
            </View>
            <View style={styles.section}>
                <Text style={styles.label}>Số lượng hàng hóa:</Text>
                <Text style={styles.value}>{order.goods_quantity ?? "Không có"}</Text>
            </View>
            <View style={styles.section}>
                <Text style={styles.label}>Cân nặng hàng hóa:</Text>
                <Text style={styles.value}>{order.goods_weight ? `${order.goods_weight} kg` : "Không có"}</Text>
            </View>
            <View style={styles.section}>
                <Text style={styles.label}>Thể tích hàng hóa:</Text>
                <Text style={styles.value}>{order.goods_volume ? `${order.goods_volume} m³` : "Không có"}</Text>
            </View>
            <View style={styles.section}>
                <Text style={styles.label}>Trạng thái đơn hàng:</Text>
                <Text style={styles.value}>{order.shipping_status || "Không có"}</Text>
            </View>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Thông tin người gửi</Text>
                <Text style={styles.label}>Người gửi:</Text>
                <Text style={styles.value}>{order.sender_name || "Không có"}</Text>
                <Text style={styles.label}>Địa chỉ:</Text>
                <Text style={styles.value}>{order.sender_address || "Không có"}</Text>
                <Text style={styles.label}>Số điện thoại:</Text>
                <Text style={styles.value}>{order.sender_phone_number || "Không có"}</Text>
            </View>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Thông tin người nhận</Text>
                <Text style={styles.label}>Người nhận:</Text>
                <Text style={styles.value}>{order.receiver_name || "Không có"}</Text>
                <Text style={styles.label}>Địa chỉ:</Text>
                <Text style={styles.value}>{order.receiver_address || "Không có"}</Text>
                <Text style={styles.label}>Số điện thoại:</Text>
                <Text style={styles.value}>{order.receiver_phone_number || "Không có"}</Text>
            </View>
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Thông tin giao hàng</Text>
                <Text style={styles.label}>Hướng xử lý:</Text>
                <Text style={styles.value}>{order.handling_instruction || "Không có"}</Text>
                <Text style={styles.label}>Tài xế:</Text>
                <Text style={styles.value}>{order.driver_name || "Chưa có"}</Text>
                <Text style={styles.label}>Biển số:</Text>
                <Text style={styles.value}>{order.driver_license_plate || "Chưa có"}</Text>
                <Text style={styles.label}>Số điện thoại tài xế:</Text>
                <Text style={styles.value}>{order.driver_phone_number || "Chưa có"}</Text>
                <Text style={styles.label}>Số toa:</Text>
                <Text style={styles.value}>{order.wagon_number || "Chưa có"}</Text>
                <Text style={styles.label}>Ngày chạy:</Text>
                <Text style={styles.value}>{order.wagon_departure_date || "Chưa có"}</Text>
            </View>
            <View style={styles.section}>
                <Text style={styles.label}>Ghi chú:</Text>
                <Text style={styles.value}>{order.note || "Không có"}</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#fff',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
    },
    loadingText: {
        marginTop: 12,
        color: '#333',
    },
    errorText: {
        color: '#d00',
        textAlign: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 16,
        textAlign: 'center',
    },
    section: {
        marginBottom: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        backgroundColor: '#fafafa',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 8,
    },
    label: {
        fontWeight: '600',
        marginTop: 8,
    },
    value: {
        marginTop: 4,
        color: '#333',
    },
    backButton: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: '#007AFF',
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    backButtonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 14,
    },
});
