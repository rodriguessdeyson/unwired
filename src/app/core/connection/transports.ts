import { CapacitorHttp, PluginListenerHandle } from '@capacitor/core';
import { BleClient, dataViewToText, textToDataView } from '@capacitor-community/bluetooth-le';
import { DeviceInfo } from '../models';
import { createBase64Decoder, toBase64, UnwiredSerial } from './native-serial';
import { CHECK_COMMAND, HTTP_DEFAULT_PORT } from './wifi-protocol';

export type TransportErrorCode = 'connect-failed' | 'no-uart' | 'send-failed';

export class TransportError extends Error {
  constructor(readonly code: TransportErrorCode) {
    super(code);
  }
}

export interface TransportHandlers {
  onData(text: string): void;
  onClosed(unexpected: boolean): void;
}

export interface SerialTransport {
  /** Modo só de envio não tem dados de volta: sem canais e sem registro de RX. */
  readonly canReceive: boolean;
  connect(handlers: TransportHandlers): Promise<void>;
  write(text: string): Promise<void>;
  disconnect(): Promise<void>;
}

/** SPP e TCP compartilham o mesmo caminho nativo: um fluxo de bytes em duas direções. */
class NativeStreamTransport implements SerialTransport {
  readonly canReceive = true;
  private id: string | null = null;
  private listeners: PluginListenerHandle[] = [];
  private closing = false;

  constructor(private readonly open: () => Promise<{ id: string }>) {}

  async connect(handlers: TransportHandlers): Promise<void> {
    const decode = createBase64Decoder();
    this.listeners = [
      await UnwiredSerial.addListener('data', (event) => {
        if (event.id === this.id) handlers.onData(decode(event.data));
      }),
      await UnwiredSerial.addListener('closed', (event) => {
        if (event.id !== this.id) return;
        this.id = null;
        void this.removeListeners();
        handlers.onClosed(!this.closing);
      }),
    ];
    try {
      this.id = (await this.open()).id;
    } catch {
      await this.removeListeners();
      throw new TransportError('connect-failed');
    }
  }

  async write(text: string): Promise<void> {
    if (!this.id) throw new TransportError('send-failed');
    try {
      await UnwiredSerial.write({ id: this.id, data: toBase64(text) });
    } catch {
      throw new TransportError('send-failed');
    }
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    const id = this.id;
    if (id) await UnwiredSerial.close({ id });
    else await this.removeListeners();
  }

  private async removeListeners(): Promise<void> {
    const listeners = this.listeners;
    this.listeners = [];
    await Promise.all(listeners.map((listener) => listener.remove()));
  }
}

const UART_PROFILES = [
  // Nordic UART: comum em ESP32 e placas nRF.
  {
    service: '6e400001-b5a3-f393-e0a9-e50e24dcca9e',
    write: '6e400002-b5a3-f393-e0a9-e50e24dcca9e',
    notify: '6e400003-b5a3-f393-e0a9-e50e24dcca9e',
  },
  // HM-10 e clones.
  {
    service: '0000ffe0-0000-1000-8000-00805f9b34fb',
    write: '0000ffe1-0000-1000-8000-00805f9b34fb',
    notify: '0000ffe1-0000-1000-8000-00805f9b34fb',
  },
];

class BleUartTransport implements SerialTransport {
  readonly canReceive = true;
  private uart: (typeof UART_PROFILES)[number] | null = null;
  private closing = false;

  constructor(private readonly deviceId: string) {}

  async connect(handlers: TransportHandlers): Promise<void> {
    await BleClient.initialize({ androidNeverForLocation: true });
    try {
      await BleClient.connect(this.deviceId, () => handlers.onClosed(!this.closing));
    } catch {
      throw new TransportError('connect-failed');
    }
    const services = await BleClient.getServices(this.deviceId);
    const available = new Set(services.map((service) => service.uuid.toLowerCase()));
    this.uart = UART_PROFILES.find((profile) => available.has(profile.service)) ?? null;
    if (!this.uart) {
      this.closing = true;
      await BleClient.disconnect(this.deviceId);
      throw new TransportError('no-uart');
    }
    await BleClient.startNotifications(this.deviceId, this.uart.service, this.uart.notify, (value) =>
      handlers.onData(dataViewToText(value)),
    );
  }

  async write(text: string): Promise<void> {
    if (!this.uart) throw new TransportError('send-failed');
    try {
      // MTU padrão do BLE: 20 bytes por pacote.
      for (let start = 0; start < text.length; start += 20) {
        await BleClient.writeWithoutResponse(
          this.deviceId,
          this.uart.service,
          this.uart.write,
          textToDataView(text.slice(start, start + 20)),
        );
      }
    } catch {
      throw new TransportError('send-failed');
    }
  }

  async disconnect(): Promise<void> {
    this.closing = true;
    await BleClient.disconnect(this.deviceId);
  }
}

/** Modo só de comandos do protocolo Wi-Fi: `GET /set?c=<comando>`, sem dados de volta. */
class WifiHttpTransport implements SerialTransport {
  readonly canReceive = false;
  private readonly base: string;

  constructor(host: string, port?: number) {
    this.base = port && port !== HTTP_DEFAULT_PORT ? `http://${host}:${port}` : `http://${host}`;
  }

  async connect(): Promise<void> {
    await this.request(CHECK_COMMAND, 'connect-failed');
  }

  async write(text: string): Promise<void> {
    await this.request(text.trim(), 'send-failed');
  }

  async disconnect(): Promise<void> {}

  private async request(command: string, code: TransportErrorCode): Promise<void> {
    try {
      // O comando já traz os próprios parâmetros, como `L&r=255&g=0&b=0`.
      const response = await CapacitorHttp.get({
        url: `${this.base}/set?c=${command}`,
        connectTimeout: 2000,
        readTimeout: 2000,
      });
      if (response.status !== 200) throw new Error(String(response.status));
    } catch {
      throw new TransportError(code);
    }
  }
}

export function createNativeTransport(device: DeviceInfo): SerialTransport {
  switch (device.kind) {
    case 'spp':
      return new NativeStreamTransport(() => UnwiredSerial.connectSpp({ address: device.address }));
    case 'ble':
      return new BleUartTransport(device.id);
    case 'wifi':
      return device.wifiMode === 'http'
        ? new WifiHttpTransport(device.address, device.port)
        : new NativeStreamTransport(() =>
            UnwiredSerial.connectTcp({ host: device.address, port: device.port ?? 8080 }),
          );
  }
}
