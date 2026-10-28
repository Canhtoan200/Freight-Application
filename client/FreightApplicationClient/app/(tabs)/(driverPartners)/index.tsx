import React from 'react';
import { View, StyleSheet } from 'react-native';
import DriverMap from '../(drivers)/DriverMap';

export default function DriverPartnerHome() {
  return (
    <View style={styles.container}>
      <View style={styles.mapMockup}>
        <DriverMap partnerMode />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  mapMockup: { flex: 1, backgroundColor: '#e0e0e0' },
});
