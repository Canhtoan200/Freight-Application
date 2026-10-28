import React from "react";
import { StyleSheet, View } from "react-native";
import DriverMap from "../(admins)/DriverMapManagement";

export default function BusinessPartnerDriverManagement() {
  return (
    <View style={styles.container}>
      <DriverMap partnerMode />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f5f5f5" },
});
