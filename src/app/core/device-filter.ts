import { TransportKind } from './models';

/** O que a busca sabe de um aparelho além do nome. */
export interface DeviceHints {
  name: string;
  kind: TransportKind;
  /** Classe principal do Bluetooth clássico (BluetoothClass.Device.Major). */
  major?: number;
  /** Serviços anunciados por BLE, em minúsculas. */
  uuids?: string[];
  /** Fabricantes nos dados de anúncio BLE (identificadores do Bluetooth SIG). */
  companies?: number[];
}

// Celular, áudio e vídeo, teclado e mouse, impressora e câmera, relógio.
// Computador fica de fora: o ESP32 no modo serial clássico se anuncia como computador.
const CONSUMER_MAJOR = new Set([0x0200, 0x0400, 0x0500, 0x0600, 0x0700]);

const UART_SERVICES = [
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART
  '0000ffe0-0000-1000-8000-00805f9b34fb', // HM-10 e afins
  '0000ffe1-0000-1000-8000-00805f9b34fb',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Microchip transparente
];

// Espressif, Nordic, Texas Instruments.
const MAKER_COMPANIES = new Set([0x02e5, 0x0059, 0x000d]);
// Apple, Microsoft, Samsung, LG, Google, Sony, Bose, Harman, Xiaomi, Amazon, Garmin, Huawei.
const CONSUMER_COMPANIES = new Set([0x004c, 0x0006, 0x0075, 0x00c4, 0x00e0, 0x012d, 0x009e, 0x0057, 0x038f, 0x0171, 0x0087, 0x027d]);

const MAKER_NAME =
  /^(hc-?\d{2}|jdy|hm-?\d{2}|bt-?0\d|at-09|mlt-bt|zs-04|dsd ?tech|linvor|bluno|nodemcu|wemos|lolin|xiao|seeed|feather|adafruit|micro:?bit|pico|nano|uno|mega)|esp ?32|esp ?8266|esp-|arduino|raspberry|\buart\b|\bserial\b/i;

/** Firmwares próprios, que rodam em placas como o ESP: o nome anuncia o projeto, não a placa. */
const OWN_FIRMWARE = /^(unwired|iluminus)/i;

const CONSUMER_NAME =
  /^\[[a-z ]+\]|\b(tv|smart ?tv|bravia|soundbar|speaker|caixa de som|jbl|bose|sony|airpods|buds|galaxy|iphone|ipad|macbook|imac|apple watch|watch|mi band|fitbit|echo|alexa|fire ?tv|chromecast|roku|headset|headphones?|fone|carkit|car kit|kindle|printer|impressora|edifier|soundcore|anker|qcy|ar[- ]condicionado|air ?con)\b|^(desktop|laptop)-|^wh-|^wf-/i;

/**
 * Diz se vale mostrar o aparelho por padrão na busca. Na dúvida, mostra:
 * esconder um módulo de verdade é pior do que mostrar uma TV a mais.
 */
export function isLikelyIot(hints: DeviceHints): boolean {
  if (hints.kind === 'wifi') return true;
  if (MAKER_NAME.test(hints.name) || OWN_FIRMWARE.test(hints.name)) return true;
  if (hints.uuids?.some((uuid) => UART_SERVICES.includes(uuid.toLowerCase()))) return true;
  if (hints.companies?.some((id) => MAKER_COMPANIES.has(id))) return true;
  if (CONSUMER_NAME.test(hints.name)) return false;
  if (hints.major !== undefined && CONSUMER_MAJOR.has(hints.major)) return false;
  if (hints.companies?.some((id) => CONSUMER_COMPANIES.has(id))) return false;
  return true;
}
