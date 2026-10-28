import React from "react";
import { StyleSheet, View } from "react-native";
import DriverMap from "./DriverMapManagement";

type DriverManagementProps = {
  partnerMode?: boolean;
};

export default function DriverManagement({ partnerMode = false }: DriverManagementProps) {
  return (
    <View style={styles.container}>
      <DriverMap partnerMode={partnerMode} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
});
