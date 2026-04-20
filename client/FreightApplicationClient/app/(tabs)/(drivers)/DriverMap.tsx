import React from 'react';
import { Platform } from 'react-native';
import DriverMapWeb from './DriverMap.web';
import DriverMapNative from './DriverMap.native';

export default function DriverMap() {
  return Platform.OS === 'web' ? <DriverMapWeb /> : <DriverMapNative />;
}
