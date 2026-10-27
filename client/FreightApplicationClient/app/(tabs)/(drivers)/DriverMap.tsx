import React from 'react';
import { Platform } from 'react-native';
import { useSegments } from 'expo-router';

export default function DriverMap() {
  const segments = useSegments();
  const partnerMode = segments.some((segment) => String(segment) === '(driverPartners)');
  if (Platform.OS === 'web') {
    const Web = require('./DriverMap.web').default;
    return <Web partnerMode={partnerMode} />;
  }
  const Native = require('./DriverMap.native').default;
  return <Native partnerMode={partnerMode} />;
}
