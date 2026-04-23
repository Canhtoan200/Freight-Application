import React from 'react';
import { Platform } from 'react-native';

export default function DriverMapManagement() {
  if (Platform.OS === 'web') {
    const Web = require('./DriverMapManagement.web').default;
    return <Web />;
  }
  const Native = require('./DriverMapManagement.native').default;
  return <Native />;
}
