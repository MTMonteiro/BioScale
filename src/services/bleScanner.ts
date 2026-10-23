import { Platform, PermissionsAndroid } from 'react-native';
import { RawScaleReading } from '../types/health';
import { parseOkokManufacturerData, base64ToBytes, bytesToHex } from './okokBleParser';

let bleManagerInstance: any = null;

function getBleManager() {
  if (Platform.OS === 'web') return null;
  if (!bleManagerInstance) {
    try {
      const { BleManager } = require('react-native-ble-plx');
      bleManagerInstance = new BleManager();
    } catch (e) {
      console.warn('BLE Nativo indisponível neste ambiente (use Dev Build ou Simulador):', e);
      return null;
    }
  }
  return bleManagerInstance;
}

export async function requestBlePermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  try {
    if (Platform.Version >= 31) {
      const result = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
        PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      ]);
      return (
        result['android.permission.BLUETOOTH_SCAN'] === PermissionsAndroid.RESULTS.GRANTED &&
        result['android.permission.BLUETOOTH_CONNECT'] === PermissionsAndroid.RESULTS.GRANTED
      );
    } else {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    }
  } catch (e) {
    console.warn('Erro ao solicitar permissões Bluetooth:', e);
    return false;
  }
}

export interface BleScanCallbacks {
  onReading: (reading: RawScaleReading) => void;
  onRawPacket?: (deviceName: string, mac: string, hex: string) => void;
  onError: (err: string) => void;
}

export function startScaleBleScan(callbacks: BleScanCallbacks): () => void {
  const manager = getBleManager();
  if (!manager) {
    callbacks.onError(
      'Módulo Bluetooth nativo requer compilação Android (npx expo run:android). Você pode usar o Simulador da Balança Wellmix para testar agora!'
    );
    return () => {};
  }

  manager.startDeviceScan(
    null,
    { allowDuplicates: true },
    (error: any, device: any) => {
      if (error) {
        callbacks.onError(error.message || 'Erro no scanner Bluetooth');
        return;
      }

      if (device?.manufacturerData) {
        try {
          const bytes = base64ToBytes(device.manufacturerData);
          const hex = bytesToHex(bytes);
          callbacks.onRawPacket?.(
            device.name || device.localName || 'Dispositivo BLE',
            device.id || '',
            hex
          );
        } catch {}

        const parsed = parseOkokManufacturerData(
          device.manufacturerData,
          device.name || device.localName || undefined,
          device.id
        );

        if (parsed) {
          callbacks.onReading(parsed);
        }
      }
    }
  );

  return () => {
    try {
      manager.stopDeviceScan();
    } catch {}
  };
}
