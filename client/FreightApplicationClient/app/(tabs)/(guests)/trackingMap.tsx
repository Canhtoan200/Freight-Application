import React from 'react';
import { Platform } from 'react-native';

export default function GuestTrackingMap() {
  if (Platform.OS === 'web') {
    const WebMap = require('./trackingMap.web').default;
    return <WebMap />;
  }

  const NativeMap = require('./trackingMap.native').default;
  return <NativeMap />;
}
