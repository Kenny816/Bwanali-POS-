import { useState, useEffect } from 'react';

export function useHardware() {
  const [hardware, setHardware] = useState({
    scanner: 'camera', // 'camera', 'usb', 'none'
    printer: 'browser', // 'browser', 'thermal'
    cashDrawer: 'none'  // 'none', 'usb'
  });

  useEffect(() => {
    // Detect USB barcode scanner via WebUSB (if available)
    if ('usb' in navigator) {
      navigator.usb.getDevices().then(devices => {
        const scanner = devices.find(d => 
          d.productName?.toLowerCase().includes('scanner') || 
          d.productName?.toLowerCase().includes('barcode')
        );
        if (scanner) {
          setHardware(prev => ({ ...prev, scanner: 'usb' }));
        }
      }).catch(() => {});
    }

    // Detect thermal printer via WebSerial
    if ('serial' in navigator) {
      navigator.serial.getPorts().then(ports => {
        if (ports.length > 0) {
          setHardware(prev => ({ ...prev, printer: 'thermal' }));
        }
      }).catch(() => {});
    }

    // Cash drawer detection (typically via printer or serial)
    // For now, rely on settings.
  }, []);

  return hardware;
}
