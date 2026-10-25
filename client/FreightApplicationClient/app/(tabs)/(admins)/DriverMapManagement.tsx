import React from 'react';
import { Platform } from 'react-native';

type DriverMapManagementProps = {
  readOnly?: boolean;
};

export default function DriverMapManagement({ readOnly = false }: DriverMapManagementProps) {
  if (Platform.OS === 'web') {
    const Web = require('./DriverMapManagement.web').default;
    return <Web readOnly={readOnly} />;
  }
  const Native = require('./DriverMapManagement.native').default;
  return <Native readOnly={readOnly} />;
}
