import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DriverMapManagement() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Mapbox đã được bật cho mobile</Text>
      <Text style={styles.text}>
        Màn hình web đang dùng placeholder. Hãy chạy app native/dev build để xem bản đồ Mapbox.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eef6ff',
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 8,
  },
  text: {
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
  },
});
