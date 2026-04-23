import Constants from "expo-constants";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";
const MAPBOX_STYLE_URL = "mapbox://styles/mapbox/streets-v12";
const IS_EXPO_GO =
  Constants.appOwnership === "expo" ||
  Constants.executionEnvironment === "storeClient";
const Mapbox = (() => {
  try {
    const module = require("@rnmapbox/maps");
    return module.default ?? module;
  } catch {
    return null;
  }
})() as any | null;

if (Mapbox && MAPBOX_ACCESS_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
}

export default function DriverMapManagement() {
  const cameraRef = useRef<any>(null);
  const [currentLocation, setCurrentLocation] = useState<{
    latitude: number;
    longitude: number;
    zoomLevel: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const canUseMapbox = Boolean(Mapbox && MAPBOX_ACCESS_TOKEN && !IS_EXPO_GO);
  const [errorMessage, setErrorMessage] = useState(
    IS_EXPO_GO
      ? "Mapbox cần Development Build và không chạy trực tiếp trong Expo Go."
      : MAPBOX_ACCESS_TOKEN
        ? ""
        : "Thiếu EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN để hiển thị bản đồ Mapbox.",
  );

  useEffect(() => {
    let isMounted = true;

    const getCurrentLocation = async () => {
      if (!canUseMapbox) {
        setLoading(false);
        return;
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();

        if (status !== "granted") {
          if (isMounted) {
            setErrorMessage("Bạn chưa cấp quyền vị trí cho ứng dụng.");
          }
          return;
        }

        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        const nextLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          zoomLevel: 15,
        };

        if (isMounted) {
          setCurrentLocation(nextLocation);
        }
      } catch (error) {
        console.error("Lỗi lấy vị trí hiện tại:", error);
        if (isMounted) {
          setErrorMessage("Không thể lấy vị trí hiện tại.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    getCurrentLocation();

    return () => {
      isMounted = false;
    };
  }, [canUseMapbox]);

  const centerCoordinate = currentLocation
    ? ([currentLocation.longitude, currentLocation.latitude] as [number, number])
    : null;

  return (
    <View style={styles.container}>
      {canUseMapbox ? (
        centerCoordinate ? (
          <Mapbox.MapView
            style={styles.map}
            styleURL={MAPBOX_STYLE_URL}
            compassEnabled={true}
            logoEnabled={true}
            scaleBarEnabled={true}
            onMapLoadingError={() =>
              setErrorMessage("Mapbox không thể tải dữ liệu bản đồ.")
            }
          >
            <Mapbox.Camera
              ref={cameraRef}
              centerCoordinate={centerCoordinate}
              zoomLevel={currentLocation!.zoomLevel}
              animationMode="none"
            />

            <Mapbox.PointAnnotation
              id="current-location-admin"
              coordinate={centerCoordinate}
              title="Vị trí hiện tại"
              snippet="Bản đồ đang định vị thiết bị"
            >
              <View style={styles.marker} />
            </Mapbox.PointAnnotation>
          </Mapbox.MapView>
        ) : null
      ) : (
        <View style={styles.missingTokenContainer}>
          <Text style={styles.missingTokenTitle}>
            {IS_EXPO_GO
              ? "Mapbox cần Development Build"
              : "Mapbox chưa được cấu hình"}
          </Text>
          <Text style={styles.missingTokenText}>
            {IS_EXPO_GO
              ? "Bạn đang mở ứng dụng bằng Expo Go. Hãy dùng development build để hiển thị Mapbox."
              : "Thêm EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN vào môi trường để hiển thị bản đồ."}
          </Text>
        </View>
      )}

      {loading && (
        <View style={styles.fullscreenLoader}>
          <ActivityIndicator size="large" color="#000" />
          <Text style={styles.overlayText}>Đang lấy vị trí hiện tại...</Text>
        </View>
      )}

      {!!errorMessage && (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  missingTokenContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#eef6ff",
  },
  missingTokenTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 8,
  },
  missingTokenText: {
    textAlign: "center",
    color: "#334155",
    lineHeight: 20,
  },
  marker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#2563eb",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  markerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  fullscreenLoader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
  },
  overlayText: {
    marginTop: 8,
    color: "#111",
    fontWeight: "600",
  },
  banner: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: "rgba(220,53,69,0.95)",
    padding: 10,
    borderRadius: 10,
  },
  bannerText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
});
