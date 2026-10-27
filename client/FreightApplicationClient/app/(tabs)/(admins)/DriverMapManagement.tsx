import React from 'react';
import { Platform } from 'react-native';

type DriverMapManagementProps = {
  readOnly?: boolean;
  partnerMode?: boolean;
};

export default function DriverMapManagement({ readOnly = false, partnerMode = false }: DriverMapManagementProps) {
  if (Platform.OS === 'web') {
    const Web = require('./DriverMapManagement.web').default;
    return <Web readOnly={readOnly} partnerMode={partnerMode} />;
  }
  const Native = require('./DriverMapManagement.native').default;
  return <Native readOnly={readOnly} partnerMode={partnerMode} />;
}
