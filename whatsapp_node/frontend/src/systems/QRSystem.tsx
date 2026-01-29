import React, { useState, useEffect } from 'react';
import { QRCodeModal } from '../components/Modals/QRCodeModal';
import { Instance } from '../types';

interface QRSystemProps {
  selectedInstance: Instance | null;
}

export const QRSystem: React.FC<QRSystemProps> = ({ selectedInstance }) => {
  const [isDismissed, setIsDismissed] = useState(false);

  // Reset dismissal when instance changes
  useEffect(() => {
    setIsDismissed(false);
  }, [selectedInstance?.id]);

  const shouldShow = selectedInstance 
    && selectedInstance.status !== 'connected' 
    && selectedInstance.qr 
    && !isDismissed;

  if (!shouldShow || !selectedInstance?.qr) return null;

  return (
    <QRCodeModal 
      qrCode={selectedInstance.qr} 
      instanceName={selectedInstance.name} 
      onClose={() => setIsDismissed(true)} 
    />
  );
};
