import React from 'react';
import { Platform } from 'react-native';

export default function DriverMap() {
  if (Platform.OS === 'web') {
    const Web = require('./DriverMap.web').default;
    return <Web />;
  }
  const Native = require('./DriverMap.native').default;
  return <Native />;
}
