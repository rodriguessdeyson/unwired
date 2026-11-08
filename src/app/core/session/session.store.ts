import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ChannelTracker } from '../data/channel-tracker';
import { MockTransport } from '../connection/mock';
import { CHANNEL_COLORS, ChannelEdit, DeviceInfo, DeviceProfile, LineEnding, LogLine, ParseMode } from '../models';
import { LineFramer, parseLine } from '../data/parser';
import { keepScreenOn } from '../platform/screen-awake';
import { SettingsStore } from '../settings/settings.store';
import { createNativeTransport, SerialTransport, TransportError, TransportErrorCode } from '../connection/transports';

export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'lost' | 'failed';

export interface ChannelView {
  key: string;
  name: string;
  unit: string;
  color: string;
  hidden: boolean;
  value: number | null;
  staleSeconds: number;
  history: number[];
}

const FLUSH_MS = 100;
const IDLE_FLUSH_MS = 250;
const STALE_MS = 5000;
const SPARK_POINTS = 40;
const ENDINGS: Record<LineEnding, string> = { none: '', lf: '\n', cr: '\r', crlf: '\r\n' };

@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly store = inject(SettingsStore);

  readonly status = signal<SessionStatus>('idle');
  readonly errorCode = signal<TransportErrorCode | null>(null);
  readonly device = signal<DeviceInfo | null>(null);
  readonly profile = signal<DeviceProfile | null>(null);
  readonly canReceive = signal(true);
  readonly receiving = signal(true);
  readonly running = signal(false);
  readonly log = signal<LogLine[]>([]);
  readonly linesReceived = signal(0);
  /** Avança a cada lote de dados. Gráfico e blocos se atualizam por ele. */
  readonly tick = signal(0);

  readonly tracker = signal(new ChannelTracker());

  /** Com o dispositivo conectado a tela não apaga, para acompanhar o gráfico sem tocar nela. */
  private readonly screenAwake = effect(() => void keepScreenOn(this.status() === 'connected'));

  readonly channels = computed<ChannelView[]>(() => {
    this.tick();
    const profile = this.profile();
    const now = Date.now();
    return this.tracker()
      .channels()
      .map((channel, index) => {
        const edit: ChannelEdit = profile?.channels[channel.key] ?? {};
        const age = channel.lastAt ? now - channel.lastAt : 0;
        return {
          key: channel.key,
          name: edit.name || channel.key,
          unit: edit.unit ?? '',
          color: edit.color ?? CHANNEL_COLORS[index % CHANNEL_COLORS.length],
          hidden: !!edit.hidden,
          value: channel.last,
          staleSeconds: age > STALE_MS ? Math.round(age / 1000) : 0,
          history: channel.values
            .slice(-SPARK_POINTS)
            .filter((value): value is number => value !== null),
        };
      });
  });
  readonly visibleChannels = computed(() => this.channels().filter((channel) => !channel.hidden));
  readonly hiddenCount = computed(() => this.channels().length - this.visibleChannels().length);

  private transport: SerialTransport | null = null;
  private framer = new LineFramer();
  private pending: LogLine[] = [];
  private nextLogId = 1;
  private flushTimer?: ReturnType<typeof setInterval>;
  private idleTimer?: ReturnType<typeof setTimeout>;
  private connectAttempt = 0;
  private stoppedAt = 0;
  private dirty = false;

  async connect(device: DeviceInfo): Promise<void> {
    await this.closeTransport();
    const attempt = ++this.connectAttempt;
    const profile = this.store.profileFor(device);
    this.device.set(device);
    this.profile.set(profile);
    this.errorCode.set(null);
    this.status.set('connecting');
    this.resetData(profile);

    const transport: SerialTransport = Capacitor.isNativePlatform()
      ? createNativeTransport(device)
      : new MockTransport(device);
    try {
      await transport.connect({
        onData: (text) => this.onData(text),
        onClosed: (unexpected) => {
          if (this.transport === transport) this.onClosed(unexpected);
        },
      });
    } catch (error) {
      if (attempt !== this.connectAttempt) return;
      this.errorCode.set(error instanceof TransportError ? error.code : 'connect-failed');
      this.status.set('failed');
      return;
    }
    if (attempt !== this.connectAttempt) {
      await transport.disconnect();
      return;
    }
    this.transport = transport;
    this.canReceive.set(transport.canReceive);
    this.status.set('connected');
    this.startFlushing();
    this.saveProfile({ ...this.profile()!, device, lastUsedAt: Date.now() });
  }

  /** Abre e fecha uma conexão, sem mexer na sessão atual. */
  async test(device: DeviceInfo): Promise<boolean> {
    const transport: SerialTransport = Capacitor.isNativePlatform()
      ? createNativeTransport(device)
      : new MockTransport(device);
    try {
      await transport.connect({ onData: () => undefined, onClosed: () => undefined });
      await transport.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  async reconnect(): Promise<void> {
    const device = this.device();
    if (device) await this.connect(device);
  }

  async disconnect(): Promise<void> {
    this.connectAttempt += 1;
    await this.closeTransport();
    this.stopFlushing();
    this.status.set('idle');
    this.device.set(null);
    this.profile.set(null);
    this.running.set(false);
  }

  /** Envia com o fim de linha escolhido. Retorna falso se não conseguiu. */
  async send(command: string): Promise<boolean> {
    const text = command.trim();
    if (!text || !this.transport) return false;
    this.appendLog('tx', text);
    this.flush();
    const ending = this.device()?.wifiMode === 'http' ? '' : ENDINGS[this.store.settings().lineEnding];
    try {
      await this.transport.write(text + ending);
      return true;
    } catch {
      this.errorCode.set('send-failed');
      return false;
    }
  }

  async toggleStream(): Promise<void> {
    const settings = this.store.settings();
    const next = !this.running();
    if (await this.send(next ? settings.startCommand : settings.stopCommand)) {
      this.running.set(next);
      if (!next) this.stoppedAt = Date.now();
    }
  }

  clear(): void {
    this.tracker().clear();
    this.log.set([]);
    this.pending = [];
    this.linesReceived.set(0);
    this.tick.update((value) => value + 1);
  }

  setFormat(format: ParseMode): void {
    const profile = this.profile();
    if (!profile) return;
    this.saveProfile({ ...profile, format, knownKeys: [], channels: {} });
    this.framer.setLegacy(format === 'legado');
    this.tracker.set(new ChannelTracker());
    this.tick.update((value) => value + 1);
  }

  editChannel(key: string, patch: ChannelEdit): void {
    const profile = this.profile();
    if (!profile) return;
    const channels = { ...profile.channels, [key]: { ...profile.channels[key], ...patch } };
    this.saveProfile({ ...profile, channels });
  }

  showHiddenChannels(): void {
    const profile = this.profile();
    if (!profile) return;
    const channels = Object.fromEntries(
      Object.entries(profile.channels).map(([key, edit]) => [key, { ...edit, hidden: false }]),
    );
    this.saveProfile({ ...profile, channels });
  }

  setSeparateCharts(separateCharts: boolean): void {
    const profile = this.profile();
    if (profile) this.saveProfile({ ...profile, separateCharts });
  }

  /** Grava de uma vez a faixa do gráfico geral e a de cada canal. */
  saveChartRanges(all: { yMin: number | null; yMax: number | null }, channels: Record<string, { yMin: number | null; yMax: number | null }>): void {
    const profile = this.profile();
    if (!profile) return;
    const merged = { ...profile.channels };
    for (const [key, range] of Object.entries(channels)) merged[key] = { ...merged[key], ...range };
    this.saveProfile({ ...profile, ...all, channels: merged });
  }

  saveCommands(commands: DeviceProfile['commands']): void {
    const profile = this.profile();
    if (profile) this.saveProfile({ ...profile, commands });
  }

  private saveProfile(profile: DeviceProfile): void {
    this.profile.set(profile);
    this.store.saveProfile(profile);
  }

  private resetData(profile: DeviceProfile): void {
    this.stopFlushing();
    const tracker = new ChannelTracker();
    tracker.seed(profile.knownKeys);
    this.tracker.set(tracker);
    this.framer = new LineFramer(profile.format === 'legado');
    this.pending = [];
    this.log.set([]);
    this.linesReceived.set(0);
    this.running.set(false);
    this.receiving.set(true);
    this.canReceive.set(true);
  }

  private onData(text: string): void {
    this.handleLines(this.framer.push(text));
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => this.handleLines(this.framer.flush()), IDLE_FLUSH_MS);
  }

  private handleLines(lines: string[]): void {
    const format = this.profile()?.format ?? 'auto';
    const now = Date.now();
    for (const line of lines) {
      this.tracker().add(parseLine(format, line).values, now);
      if (this.receiving()) this.appendLog('rx', line);
      this.dirty = true;
      this.linesReceived.update((value) => value + 1);
    }
    // Dados chegando sem pedir: o dispositivo transmite sozinho.
    if (lines.length && !this.running() && now - this.stoppedAt > 1000) this.running.set(true);
  }

  private appendLog(dir: LogLine['dir'], text: string): void {
    this.pending.push({ id: this.nextLogId++, time: new Date().toTimeString().slice(0, 8), dir, text });
    this.dirty = true;
  }

  private startFlushing(): void {
    this.stopFlushing();
    let elapsed = 0;
    this.flushTimer = setInterval(() => {
      elapsed += FLUSH_MS;
      // Mesmo sem dados, o estado "sem dados há X s" precisa avançar.
      if (this.dirty || elapsed >= 1000) {
        elapsed = 0;
        this.flush();
      }
    }, FLUSH_MS);
  }

  private stopFlushing(): void {
    clearInterval(this.flushTimer);
    clearTimeout(this.idleTimer);
  }

  private flush(): void {
    this.dirty = false;
    if (this.pending.length) {
      const merged = [...this.log(), ...this.pending];
      this.pending = [];
      this.log.set(this.trimLog(merged));
    }
    this.rememberChannels();
    this.tick.update((value) => value + 1);
  }

  private trimLog(lines: LogLine[]): LogLine[] {
    const limit = this.store.settings().historyChars;
    let chars = 0;
    let start = lines.length;
    while (start > 0 && chars + lines[start - 1].text.length <= limit) {
      chars += lines[start - 1].text.length;
      start -= 1;
    }
    return start === 0 ? lines : lines.slice(start);
  }

  private rememberChannels(): void {
    const profile = this.profile();
    if (!profile) return;
    const keys = this.tracker()
      .channels()
      .map((channel) => channel.key);
    if (keys.length !== profile.knownKeys.length) this.saveProfile({ ...profile, knownKeys: keys });
  }

  private onClosed(unexpected: boolean): void {
    this.transport = null;
    this.stopFlushing();
    this.flush();
    this.running.set(false);
    if (unexpected) this.status.set('lost');
  }

  private async closeTransport(): Promise<void> {
    const transport = this.transport;
    this.transport = null;
    if (transport) {
      try {
        await transport.disconnect();
      } catch {
        // A conexão já caiu; não há o que fechar.
      }
    }
  }
}
