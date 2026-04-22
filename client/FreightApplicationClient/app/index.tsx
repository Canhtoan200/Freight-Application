import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function App() {
  const router = useRouter();
  const [email, setEmail] = useState("canhtoan.work000@gmail.com");
  const [password, setPassword] = useState("Canhtoan111");
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(false); // Trạng thái chờ API

  const handleLogin = async () => {
    setErrorMessage("");
    // 1. Kiểm tra đầu vào cơ bản
    if (!email || !password) {
      const msg = "Vui lòng nhập đầy đủ Gmail và Mật khẩu";
      setErrorMessage(msg);
      Alert.alert("Thông báo", msg);
      return;
    }

    setLoading(true); // Bắt đầu load

    try {
      // 2. Gửi request đến API
      const response = await fetch(
        "https://freight-application-server.onrender.com/api/v1/users/login",
        {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: email,
            password: password,
          }),
        },
      );

      const data = await response.json();

      if (response.ok && data.data != null) {
        // 3. Đăng nhập thành công
        console.log("Token nhận được:", data.data);
        setErrorMessage("");
        // Luôn lưu object user (có position, token...)
        await AsyncStorage.setItem("userToken", JSON.stringify(data.data));
        router.replace("/(tabs)");
      } else {
        // 4. Lỗi từ server (sai mật khẩu, user không tồn tại...)
        const msg = data.message || "Thông tin không chính xác";
        setErrorMessage(msg);
        console.log("Lỗi đăng nhập", msg);
      }
    } catch (error) {
      // 5. Lỗi kết nối (mất mạng, server sập...)
      const msg = "Không thể kết nối đến máy chủ";
      setErrorMessage(msg);
      console.log("Lỗi kết nối", msg);
      console.error(error);
    } finally {
      setLoading(false); // Tắt hiệu ứng load
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.loginBox}>
        {/* Logo công ty */}
        <View style={styles.logoBox}>
          <Text style={styles.logoText}>Logo công ty</Text>
        </View>
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}
        {/* Ô nhập Gmail */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Gmail:</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        {/* Ô nhập Mật khẩu */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Mật khẩu:</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry={true}
          />
        </View>

        {/* Nút Đăng nhập */}
        <TouchableOpacity
          style={[
            styles.btnLogin,
            { backgroundColor: loading ? "#ccc" : "#fff" },
          ]}
          onPress={handleLogin}
          disabled={loading} // Khóa nút khi đang gửi request
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.btnText}>Đăng nhập</Text>
          )}
        </TouchableOpacity>

        {/* Nút Đăng nhập cho khách */}
        <TouchableOpacity style={styles.btnGuest}>
          <Text style={styles.btnText}>Đăng nhập cho khách</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  loginBox: {
    width: "85%",
    padding: 20,
    alignItems: "center",
    // Nếu muốn có viền bao quanh toàn bộ như bản vẽ:
    borderWidth: 1,
    borderColor: "#000",
  },
  logoBox: {
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginBottom: 40,
  },
  logoText: {
    fontSize: 16,
    fontWeight: "bold",
  },
  inputGroup: {
    width: "100%",
    marginBottom: 20,
  },
  label: {
    textAlign: "center",
    marginBottom: 8,
    fontSize: 16,
  },
  input: {
    width: "100%",
    height: 40,
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 10,
  },
  btnLogin: {
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 8,
    paddingHorizontal: 30,
    marginBottom: 30,
    marginTop: 10,
  },
  btnGuest: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#000",
    paddingVertical: 12,
    alignItems: "center",
  },
  errorText: {
    width: "100%",
    color: "#c62828",
    textAlign: "center",
    marginBottom: 12,
    fontWeight: "600",
  },
  btnText: {
    fontSize: 16,
  },
});
