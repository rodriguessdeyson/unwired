import { DeviceHints } from './device-filter';
import { DeviceInfo } from './models';
import { SerialTransport, TransportHandlers } from './transports';

/**
 * Dispositivos simulados, usados só fora do Android: permitem desenvolver e
 * testar cada caso do painel sem hardware.
 */
export const MOCK_DEVICES: DeviceInfo[] = [
  { id: 'mock-chaves', name: 'HC-05 Bancada', address: '98:D3:31:F5:2A:10', kind: 'spp', paired: true, rssi: -48 },
  { id: 'mock-csv', name: 'ESP32 Sensor', address: '3C:71:BF:9A:44:E2', kind: 'ble', rssi: -62 },
  { id: 'mock-stream', name: 'ESP32 Bancada', address: '192.168.0.57', kind: 'wifi', wifiMode: 'stream', port: 8080 },
  { id: 'mock-texto', name: 'HM-10 Estufa', address: '50:65:83:12:7B:C0', kind: 'ble', rssi: -74 },
  { id: 'mock-http', name: 'Iluminus Sala', address: '192.168.0.42', kind: 'wifi', wifiMode: 'http' },
  { id: 'mock-numero', name: 'Arduino Nano', address: '00:21:13:04:9D:6F', kind: 'spp', paired: true, rssi: -80 },
  { id: 'mock-comando', name: 'HC-06 Silencioso', address: '00:21:13:0A:BC:11', kind: 'spp', paired: true, rssi: -70 },
  { id: 'mock-parado', name: 'HC-05 Oficina', address: '98:D3:31:00:7C:42', kind: 'spp', paired: true, rssi: -58 },
  // Aparelhos comuns da casa, que a busca deve esconder por padrão.
  { id: 'mock-tv', name: '[TV] Samsung 7 Series', address: 'A0:D0:5B:11:22:33', kind: 'spp', rssi: -66 },
  { id: 'mock-caixa', name: 'JBL Flip 5', address: '00:42:79:AB:CD:EF', kind: 'spp', rssi: -71 },
  { id: 'mock-ar', name: '[AC] Sala', address: 'F4:7B:09:44:55:66', kind: 'ble', rssi: -77 },
];

/** O que cada aparelho simulado anunciaria além do nome. */
export const MOCK_HINTS: Record<string, DeviceHints> = {
  'mock-tv': { name: '[TV] Samsung 7 Series', kind: 'spp', major: 0x0400 },
  'mock-caixa': { name: 'JBL Flip 5', kind: 'spp', major: 0x0400 },
  'mock-ar': { name: '[AC] Sala', kind: 'ble', companies: [0x0075] },
};

export class MockTransport implements SerialTransport {
  readonly canReceive: boolean;
  private timer?: ReturnType<typeof setInterval>;
  private handlers?: TransportHandlers;
  private tick = 0;
  private streaming: boolean;

  constructor(private readonly device: DeviceInfo) {
    this.canReceive = device.id !== 'mock-http';
    this.streaming = device.id !== 'mock-comando';
  }

  async connect(handlers: TransportHandlers): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    this.handlers = handlers;
    if (this.canReceive) this.timer = setInterval(() => this.emit(), 200);
  }

  async write(text: string): Promise<void> {
    const command = text.trim().toUpperCase();
    if (command === 'LS') this.streaming = true;
    if (command === 'DS') this.streaming = false;
    if (this.canReceive) this.handlers?.onData('OK\r\n');
  }

  async disconnect(): Promise<void> {
    clearInterval(this.timer);
  }

  private emit(): void {
    if (!this.streaming) return;
    const i = this.tick++;
    const wave = (base: number, amp: number, period: number) =>
      (base + amp * Math.sin(i / period) + amp * 0.2 * Math.sin(i / 2.3)).toFixed(2);
    const line = this.lineFor(i, wave);
    if (line) this.handlers?.onData(`${line}\r\n`);
  }

  private lineFor(i: number, wave: (base: number, amp: number, period: number) => string): string | null {
    switch (this.device.id) {
      case 'mock-csv':
        return `${wave(12, 3, 9)},${wave(3.3, 0.4, 17)},${wave(512, 80, 13)}`;
      case 'mock-numero':
        return wave(50, 30, 8);
      case 'mock-texto':
        return i % 15 === 0 ? ['Sistema pronto', 'Porta aberta', 'Estufa ligada'][(i / 15) % 3] : null;
      case 'mock-parado':
        // H para de chegar depois de alguns segundos.
        return i < 40 ? `T=${wave(44, 18, 11)} H=${wave(61, 6, 23)}` : `T=${wave(44, 18, 11)}`;
      default:
        return `T=${wave(44, 18, 11)} H=${wave(61, 6, 23)}`;
    }
  }
}
