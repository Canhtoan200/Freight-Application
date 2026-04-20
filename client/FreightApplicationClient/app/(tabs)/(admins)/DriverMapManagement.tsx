import React from 'react';
import { Platform } from 'react-native';
import DriverMapManagementWeb from './DriverMapManagement.web';
import DriverMapManagementNative from './DriverMapManagement.native';

export default function DriverMapManagement() {
  return Platform.OS === 'web' ? <DriverMapManagementWeb /> : <DriverMapManagementNative />;
}
