import { RawScaleReading } from '../types/health';

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

/**
 * Converte string Base64 (formato retornado pelo react-native-ble-plx para manufacturerData)
 * em um array de bytes (Uint8Array), sem dependências externas.
 */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  const out: number[] = [];
  let i = 0;
  while (i < clean.length) {
    const enc1 = BASE64_CHARS.indexOf(clean.charAt(i++));
    const enc2 = BASE64_CHARS.indexOf(clean.charAt(i++));
    const enc3 = BASE64_CHARS.indexOf(clean.charAt(i++));
    const enc4 = BASE64_CHARS.indexOf(clean.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    out.push(chr1 & 0xff);
    if (enc3 !== 64 && enc3 !== -1) out.push(chr2 & 0xff);
    if (enc4 !== 64 && enc4 !== -1) out.push(chr3 & 0xff);
  }
  return new Uint8Array(out);
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

/**
 * Decodifica o pacote Manufacturer Specific Data das balanças OKOK International / Chipsea / Wellmix.
 * Suporta as variantes V1 (0xCA 0x10), V2 (0xCA 0x11), V20 (0xC0) e Chipsea Broadcast padrão.
 */
export function parseOkokManufacturerData(
  manufacturerDataB64: string,
  deviceName?: string,
  deviceId?: string
): RawScaleReading | null {
  try {
    const bytes = base64ToBytes(manufacturerDataB64);
    if (bytes.length < 8) return null;

    const rawHex = bytesToHex(bytes);

    // No BLE, os 2 primeiros bytes do Manufacturer Specific Data são o Company ID (little-endian).
    // Nas balanças OKOK/Chipsea, os bytes costumam começar com 0xCA (ou ter 0xCA no índice 0 ou 2).
    let offset = 0;
    if (bytes[0] !== 0xca && bytes[2] === 0xca) {
      offset = 2;
    }

    const header0 = bytes[offset];
    const header1 = bytes[offset + 1];

    // Variante 1: OKOK V20 (Header 0xC0 ou Company ID 0xFFF0 / 0x0100 com pacote criptografado XOR ou aberto)
    if (header0 === 0xca && (header1 === 0x10 || header1 === 0x11)) {
      const version = header1 === 0x10 ? 'OKOK-V10' : 'OKOK-V11';
      const flags = bytes[offset + 3] ?? 0;
      const isStabilized = (flags & 0x01) !== 0 || (flags & 0x80) !== 0 || true;

      // Peso em bytes [offset+4, offset+5] Big Endian
      const rawWeight = (bytes[offset + 4] << 8) | bytes[offset + 5];
      // Impedância em bytes [offset+6, offset+7] Big Endian
      const rawImpedance =
        bytes.length >= offset + 8
          ? (bytes[offset + 6] << 8) | bytes[offset + 7]
          : 0;

      // Divisor depende dos bits de unidade/escala na flag, padrão OKOK é / 100 ou / 10
      let weightKg = rawWeight / 100;
      if (weightKg < 10 && rawWeight > 200) {
        weightKg = rawWeight / 10;
      }

      const impedanceOhm = rawImpedance > 1000 ? rawImpedance / 10 : rawImpedance;

      if (weightKg >= 5 && weightKg <= 250) {
        return {
          weightKg: Math.round(weightKg * 100) / 100,
          impedanceOhm: Math.round(impedanceOhm),
          isStabilized,
          hasImpedance: impedanceOhm > 50,
          protocolVersion: version,
          rawHex,
          deviceName,
          deviceId,
        };
      }
    }

    // Variante 2: Chipsea / Wellmix Genérica (Bytes 2 e 3 ou 4 e 5 = Peso)
    // Procura um par de bytes que represente peso plausível (30.00 kg a 200.00 kg -> 3000 a 20000 ou 300 a 2000)
    const candidates: Array<{ wIdx: number; iIdx: number; div: number; label: string }> = [
      { wIdx: 2, iIdx: 4, div: 100, label: 'Chipsea-A (div100)' },
      { wIdx: 4, iIdx: 6, div: 100, label: 'Chipsea-B (div100)' },
      { wIdx: 2, iIdx: 4, div: 10, label: 'Chipsea-C (div10)' },
      { wIdx: 4, iIdx: 6, div: 10, label: 'Chipsea-D (div10)' },
    ];

    const nameMatch =
      deviceName &&
      /okok|chipsea|wellmix|scale|qn-scale|body|health/i.test(deviceName);

    if (nameMatch || bytes[0] === 0xca || bytes[0] === 0xc0 || bytes[0] === 0xf0) {
      for (const c of candidates) {
        if (bytes.length >= c.iIdx + 2) {
          const wRaw = (bytes[c.wIdx] << 8) | bytes[c.wIdx + 1];
          const iRaw = (bytes[c.iIdx] << 8) | bytes[c.iIdx + 1];
          const weightKg = wRaw / c.div;
          if (weightKg >= 15 && weightKg <= 220) {
            const impedanceOhm = iRaw > 1500 ? iRaw / 10 : iRaw;
            return {
              weightKg: Math.round(weightKg * 100) / 100,
              impedanceOhm: impedanceOhm >= 100 && impedanceOhm <= 1200 ? Math.round(impedanceOhm) : 495,
              isStabilized: true,
              hasImpedance: impedanceOhm >= 100 && impedanceOhm <= 1200,
              protocolVersion: c.label,
              rawHex,
              deviceName,
              deviceId,
            };
          }
        }
      }
    }

    return null;
  } catch {
    return null;
  }
}
