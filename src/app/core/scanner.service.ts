import { inject, Injectable, signal } from '@angular/core';
import { Capacitor, PluginListenerHandle } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { DeviceHints, isLikelyIot } from './device-filter';
import { MOCK_DEVICES, MOCK_HINTS } from './mock';
import { DeviceInfo } from './models';
import { NativeClassicDevice, NativeWifiDevice, UnwiredSerial } from './native-serial';
import { SettingsStore } from './settings.store';
import { DISCOVERY_MESSAGES, mergeWifiResponses } from './wifi-protocol';

export type ScanProblem = 'bluetooth-off' | 'permission-denied' | null;

const SCAN_MS = 12000;

@Injectable({ providedIn: 'root' })
export class ScannerService {
  private readonly store = inject(SettingsStore);
  readonly devices = signal<DeviceInfo[]>([]);
  /** Ids dos aparelhos que não parecem IoT (TVs, fones, celulares). Ficam ocultos por padrão. */
  readonly others = signal<ReadonlySet<string>>(new Set());
  readonly scanning = signal(false);
  readonly problem = signal<ScanProblem>(null);

  private listeners: PluginListenerHandle[] = [];
  private bleScanning = false;
  private timers: ReturnType<typeof setTimeout>[] = [];

  async start(): Promise<void> {
    await this.stop();
    this.devices.set([]);
    this.others.set(new Set());
    this.problem.set(null);
    this.scanning.set(true);
    if (!Capacitor.isNativePlatform()) {
      this.startMock();
      return;
    }
    // Wi-Fi não depende de Bluetooth: segue mesmo se ele estiver desligado.
    void this.scanWifi();
    if (await this.prepareBluetooth()) {
      await Promise.allSettled([this.scanClassic(), this.scanBle()]);
    }
    this.timers.push(setTimeout(() => void this.stop(), SCAN_MS));
  }

  async stop(): Promise<void> {
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.scanning.set(false);
    if (!Capacitor.isNativePlatform()) return;
    const listeners = this.listeners;
    this.listeners = [];
    const stopping = Promise.allSettled([
      UnwiredSerial.stopDiscovery(),
      ...(this.bleScanning ? [BleClient.stopLEScan()] : []),
      ...listeners.map((listener) => listener.remove()),
    ]);
    this.bleScanning = false;
    await stopping;
  }

  async enableBluetooth(): Promise<void> {
    await UnwiredSerial.enable();
    await this.start();
  }

  private async prepareBluetooth(): Promise<boolean> {
    const { granted } = await UnwiredSerial.requestBluetooth();
    if (!granted) {
      this.problem.set('permission-denied');
      return false;
    }
    const { enabled } = await UnwiredSerial.isEnabled();
    if (!enabled) {
      this.problem.set('bluetooth-off');
      return false;
    }
    return true;
  }

  private async scanClassic(): Promise<void> {
    const { devices } = await UnwiredSerial.bondedDevices();
    devices.forEach((device) => this.addClassic(device));
    this.listeners.push(await UnwiredSerial.addListener('classicDevice', (device) => this.addClassic(device)));
    await UnwiredSerial.startDiscovery();
  }

  private addClassic(device: NativeClassicDevice): void {
    const name = device.name || device.address;
    this.add(
      { id: device.address, name, address: device.address, kind: 'spp', paired: device.paired, rssi: device.rssi },
      { name, kind: 'spp', major: device.major },
    );
  }

  private async scanBle(): Promise<void> {
    await BleClient.initialize({ androidNeverForLocation: true });
    this.bleScanning = true;
    await BleClient.requestLEScan({ allowDuplicates: false }, (result) => {
      // Só nomeados: sem nome, a lista enche de aparelhos que não dá para reconhecer.
      const name = result.localName ?? result.device.name;
      if (!name) return;
      this.add(
        { id: result.device.deviceId, name, address: result.device.deviceId, kind: 'ble', rssi: result.rssi },
        { name, kind: 'ble', uuids: result.uuids, companies: Object.keys(result.manufacturerData ?? {}).map(Number) },
      );
    });
  }

  /** Respostas cruas da descoberta Wi-Fi. Fora do Android não há rede para perguntar. */
  async discoverWifi(timeoutMs = 3000): Promise<NativeWifiDevice[]> {
    if (!Capacitor.isNativePlatform()) return [];
    const { devices } = await UnwiredSerial.udpDiscover({ messages: DISCOVERY_MESSAGES, port: this.store.settings().discoveryPort, timeoutMs });
    return devices;
  }

  private async scanWifi(): Promise<void> {
    try {
      for (const device of mergeWifiResponses(await this.discoverWifi())) this.add(device);
    } catch {
      // Sem rede ou broadcast bloqueado: o cadastro por IP continua disponível.
    }
  }

  private add(device: DeviceInfo, hints: DeviceHints = { name: device.name, kind: device.kind }): void {
    // Um anúncio BLE pode chegar sem serviços e o seguinte com eles: a decisão vale a cada atualização.
    const iot = isLikelyIot(hints);
    if (iot === this.others().has(device.id)) {
      this.others.update((current) => {
        const next = new Set(current);
        if (iot) next.delete(device.id);
        else next.add(device.id);
        return next;
      });
    }
    this.devices.update((current) => {
      const index = current.findIndex((item) => item.id === device.id);
      if (index === -1) return [...current, device];
      const copy = [...current];
      copy[index] = { ...copy[index], ...device };
      return copy;
    });
  }

  private startMock(): void {
    MOCK_DEVICES.forEach((device, index) => {
      this.timers.push(setTimeout(() => this.add(device, MOCK_HINTS[device.id]), 900 * (index + 1)));
    });
    this.timers.push(setTimeout(() => this.scanning.set(false), 900 * (MOCK_DEVICES.length + 1)));
  }
}
