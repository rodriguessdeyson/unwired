import { PluginListenerHandle, registerPlugin } from '@capacitor/core';

export interface NativeClassicDevice {
  name: string;
  address: string;
  paired: boolean;
  rssi?: number;
  /** Classe principal do Bluetooth clássico, quando o aparelho a anuncia. */
  major?: number;
}

export interface NativeWifiDevice {
  address: string;
  response: string;
}

export interface UnwiredSerialPlugin {
  requestBluetooth(): Promise<{ granted: boolean }>;
  isEnabled(): Promise<{ enabled: boolean }>;
  enable(): Promise<{ enabled: boolean }>;
  bondedDevices(): Promise<{ devices: NativeClassicDevice[] }>;
  startDiscovery(): Promise<void>;
  stopDiscovery(): Promise<void>;
  connectSpp(options: { address: string }): Promise<{ id: string }>;
  connectTcp(options: { host: string; port: number }): Promise<{ id: string }>;
  write(options: { id: string; data: string }): Promise<void>;
  close(options: { id: string }): Promise<void>;
  udpDiscover(options: { messages: string[]; port: number; timeoutMs: number }): Promise<{ devices: NativeWifiDevice[] }>;
  legacyPreferences(): Promise<{ values: Record<string, string> }>;
  /** Grava no cache do app, de onde o compartilhamento do Android lê. */
  writeCacheFile(options: { name: string; data: string }): Promise<{ uri: string }>;
  /** Abre o teclado para o campo que já está em foco. */
  showKeyboard(): Promise<void>;
  /** Impede que a tela apague ou bloqueie sozinha. */
  keepScreenOn(options: { enabled: boolean }): Promise<void>;
  addListener(event: 'classicDevice', handler: (device: NativeClassicDevice) => void): Promise<PluginListenerHandle>;
  addListener(event: 'discoveryFinished', handler: () => void): Promise<PluginListenerHandle>;
  addListener(event: 'data', handler: (event: { id: string; data: string }) => void): Promise<PluginListenerHandle>;
  addListener(event: 'closed', handler: (event: { id: string; error?: string }) => void): Promise<PluginListenerHandle>;
}

export const UnwiredSerial = registerPlugin<UnwiredSerialPlugin>('UnwiredSerial');

export function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** Decodificador contínuo: um caractere pode chegar dividido entre dois pacotes. */
export function createBase64Decoder(): (data: string) => string {
  const decoder = new TextDecoder();
  return (data) => {
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return decoder.decode(bytes, { stream: true });
  };
}
