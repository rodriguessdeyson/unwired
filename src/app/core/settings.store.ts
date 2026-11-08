import { inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { TranslocoService } from '@jsverse/transloco';
import { DeviceInfo, DeviceProfile, LineEnding, ParseMode, SavedCommand } from './models';
import { UnwiredSerial } from './native-serial';

export interface AppSettings {
  onboarded: boolean;
  legacyImported: boolean;
  startCommand: string;
  stopCommand: string;
  historyChars: number;
  lineEnding: LineEnding;
  defaultFormat: ParseMode;
  windowSize: number;
  yMin: number | null;
  yMax: number | null;
  discoveryPort: number;
  streamPort: number;
  lang: string;
}

const DEFAULTS: AppSettings = {
  onboarded: false,
  legacyImported: false,
  startCommand: 'LS',
  stopCommand: 'DS',
  historyChars: 20000,
  lineEnding: 'crlf',
  defaultFormat: 'auto',
  windowSize: 120,
  yMin: null,
  yMax: null,
  discoveryPort: 4210,
  streamPort: 8080,
  lang: '',
};

const SETTINGS_KEY = 'settings';
const PROFILES_KEY = 'profiles';

@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly i18n = inject(TranslocoService);

  readonly settings = signal<AppSettings>(DEFAULTS);
  readonly profiles = signal<Record<string, DeviceProfile>>({});

  async load(): Promise<void> {
    const [settings, profiles] = await Promise.all([
      Preferences.get({ key: SETTINGS_KEY }),
      Preferences.get({ key: PROFILES_KEY }),
    ]);
    if (settings.value) this.settings.set({ ...DEFAULTS, ...(JSON.parse(settings.value) as Partial<AppSettings>) });
    if (profiles.value) this.profiles.set(JSON.parse(profiles.value) as Record<string, DeviceProfile>);
    await this.importLegacy();
  }

  update(patch: Partial<AppSettings>): void {
    this.settings.update((current) => ({ ...current, ...patch }));
    void Preferences.set({ key: SETTINGS_KEY, value: JSON.stringify(this.settings()) });
  }

  profileFor(device: DeviceInfo): DeviceProfile {
    return (
      this.profiles()[device.id] ?? {
        device,
        format: this.settings().defaultFormat,
        channels: {},
        knownKeys: [],
        commands: this.defaultCommands(device),
        lastUsedAt: 0,
      }
    );
  }

  saveProfile(profile: DeviceProfile): void {
    this.profiles.update((current) => ({ ...current, [profile.device.id]: profile }));
    void Preferences.set({ key: PROFILES_KEY, value: JSON.stringify(this.profiles()) });
  }

  private defaultCommands(device: DeviceInfo): SavedCommand[] {
    if (device.wifiMode !== 'http') {
      const { startCommand, stopCommand } = this.settings();
      return [startCommand, stopCommand].map((command) => ({ label: command, command }));
    }
    // Comandos que o firmware do Iluminus aceita por HTTP.
    const t = (key: string) => this.i18n.translate(`devices.${key}`);
    return [
      { label: t('cmdOn'), command: 'L' },
      { label: t('cmdOff'), command: 'D' },
      { label: t('cmdRed'), command: 'L&r=255&g=0&b=0' },
      { label: t('cmdBlue'), command: 'L&r=0&g=0&b=255' },
    ];
  }

  /** Ajustes do app antigo ficam em SharedPreferences, que a WebView não enxerga. */
  private async importLegacy(): Promise<void> {
    if (this.settings().legacyImported) return;
    if (!Capacitor.isNativePlatform()) return;
    try {
      const { values } = await UnwiredSerial.legacyPreferences();
      this.update({ ...mapLegacyPreferences(values), legacyImported: true });
    } catch {
      // Sem ajustes antigos legíveis, ficam os padrões. Nova tentativa no próximo início.
    }
  }
}

export function mapLegacyPreferences(values: Record<string, string>): Partial<AppSettings> {
  const patch: Partial<AppSettings> = {};
  const number = (key: string): number | undefined => {
    const parsed = Number(values[key]);
    return values[key] !== undefined && values[key] !== '' && Number.isFinite(parsed) ? parsed : undefined;
  };
  if (values['prefComL']) patch.startCommand = values['prefComL'];
  if (values['prefComD']) patch.stopCommand = values['prefComD'];
  const history = number('prefBuffer');
  if (history !== undefined && history > 0) patch.historyChars = history;
  const windowSize = number('prefX');
  if (windowSize !== undefined && windowSize >= 20) patch.windowSize = Math.min(1000, Math.round(windowSize));
  const yMin = number('prefYmin');
  const yMax = number('prefYmax');
  if (yMin !== undefined && yMax !== undefined && yMax > yMin) {
    patch.yMin = yMin;
    patch.yMax = yMax;
  }
  return patch;
}
