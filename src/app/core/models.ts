export type TransportKind = 'spp' | 'ble' | 'wifi';
export type WifiMode = 'stream' | 'http';
export type ParseMode = 'auto' | 'chaves' | 'csv' | 'json' | 'xml' | 'numero' | 'legado';
export type LineEnding = 'none' | 'lf' | 'cr' | 'crlf';

export interface DeviceInfo {
  /** Identificador estável: MAC, id de BLE ou id de Wi-Fi. Chave do perfil salvo. */
  id: string;
  name: string;
  address: string;
  kind: TransportKind;
  paired?: boolean;
  rssi?: number;
  wifiMode?: WifiMode;
  port?: number;
}

export interface ChannelEdit {
  name?: string;
  unit?: string;
  color?: string;
  hidden?: boolean;
  /** Faixa do eixo Y no gráfico próprio do canal. Ausente ou nula: automática. */
  yMin?: number | null;
  yMax?: number | null;
}

export interface SavedCommand {
  label: string;
  command: string;
}

export interface DeviceProfile {
  device: DeviceInfo;
  format: ParseMode;
  channels: Record<string, ChannelEdit>;
  knownKeys: string[];
  commands: SavedCommand[];
  separateCharts?: boolean;
  /** Faixa do eixo Y do gráfico com todos os canais. Ausente: usa a dos ajustes antigos. */
  yMin?: number | null;
  yMax?: number | null;
  lastUsedAt: number;
}

export interface LogLine {
  id: number;
  time: string;
  dir: 'tx' | 'rx';
  text: string;
}

export const CHANNEL_COLORS = ['#ffc90e', '#9db2ec', '#6fd3b0', '#ff9c8e'];
