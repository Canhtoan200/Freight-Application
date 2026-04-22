import React from "react";
import { StyleSheet, View } from "react-native";
import DriverMap from "./DriverMapManagement";

export default function DriverManagement() {
  return (
    <View style={styles.container}>
      <DriverMap />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
});
