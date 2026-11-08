import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { DeviceInfo, WifiMode } from '../../core/models';
import { ScannerService } from '../../core/connection/scanner.service';
import { SessionStore } from '../../core/session/session.store';
import { SettingsStore } from '../../core/settings/settings.store';
import { identifyWifi } from '../../core/connection/wifi-protocol';

type Mode = 'auto' | WifiMode;

export function isValidIpv4(text: string): boolean {
  const parts = text.trim().split('.');
  return parts.length === 4 && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}

@Component({
  selector: 'app-wifi',
  host: { class: 'ion-page' },
  imports: [IonIcon, TranslocoPipe],
  template: `
    <div class="h-full flex flex-col overflow-hidden bg-ink-900 text-paper" style="padding-top: var(--ion-safe-area-top, 0)">
      <header class="shrink-0 flex items-center gap-1 px-3 pt-3 pb-3">
        <button (click)="back()" [attr.aria-label]="'common.back' | transloco" class="size-11 flex items-center justify-center">
          <ion-icon name="chevron-back-outline" class="text-[22px]" aria-hidden="true" />
        </button>
        <h1 class="text-xl font-semibold">{{ 'wifi.title' | transloco }}</h1>
      </header>

      <main class="grow min-h-0 overflow-y-auto px-5 flex flex-col gap-[22px] *:shrink-0" style="padding-bottom: max(24px, var(--ion-safe-area-bottom, 0))">
        <div class="flex flex-col gap-2">
          <label for="ip" class="text-sm font-semibold">{{ 'wifi.ip' | transloco }}</label>
          <input id="ip" [value]="ip()" (input)="onIp($event)" inputmode="decimal" autocomplete="off" placeholder="192.168.0.42" class="h-[52px] box-border px-3.5 rounded-xl border border-ink-600 bg-ink-800 font-mono text-base" />
        </div>

        <div class="flex flex-col gap-2">
          <h2 id="mode" class="text-sm font-semibold">{{ 'wifi.mode' | transloco }}</h2>
          <div role="group" aria-labelledby="mode" class="grid grid-cols-3 gap-2">
            @for (option of modes; track option.id) {
              <button (click)="setMode(option.id)" [attr.aria-pressed]="mode() === option.id" class="min-h-12 rounded-xl text-sm font-semibold border transition-colors" [class]="mode() === option.id ? 'bg-paper text-ink-900 border-paper' : 'border-ink-600'">{{ option.label | transloco }}</button>
            }
          </div>
        </div>

        @if (mode() !== 'http') {
          <div class="flex flex-col gap-2">
            <label for="port" class="text-sm font-semibold">{{ 'wifi.port' | transloco }}</label>
            <input id="port" [value]="port()" (input)="onPort($event)" inputmode="numeric" autocomplete="off" class="h-[52px] box-border px-3.5 rounded-xl border border-ink-600 bg-ink-800 font-mono text-base" />
          </div>
        }

        @if (effectiveMode(); as effective) {
          <section class="p-3.5 rounded-2xl bg-ink-800 border border-ink-700 flex flex-col gap-3">
            @if (mode() === 'auto') {
              <div class="flex items-center justify-between text-[15px]"><span>{{ 'wifi.detected' | transloco }}</span><span class="text-sm font-semibold">{{ (effective === 'stream' ? 'wifi.stream' : 'wifi.http') | transloco }}</span></div>
            }
            <div class="flex items-center justify-between text-[15px]"><span>{{ 'wifi.capSend' | transloco }}</span><span class="text-sm font-semibold text-ok">{{ 'wifi.yes' | transloco }}</span></div>
            @for (key of ['wifi.capReceive', 'wifi.capChart']; track key) {
              <div class="flex items-center justify-between text-[15px]">
                <span>{{ key | transloco }}</span>
                <span class="text-sm font-semibold" [class]="effective === 'stream' ? 'text-ok' : 'text-mute'">{{ (effective === 'stream' ? 'wifi.yes' : 'wifi.no') | transloco }}</span>
              </div>
            }
          </section>
        } @else {
          <p class="text-sm leading-snug text-mute">{{ 'wifi.autoHint' | transloco: { port: port() } }}</p>
        }

        <p role="status" class="text-sm leading-snug" [class]="messageClass()">{{ message() | transloco }}</p>

        <div class="mt-auto flex flex-col gap-1.5">
          <button (click)="test()" [disabled]="testing()" class="min-h-[52px] rounded-[14px] border border-link-400 text-link-300 text-base font-semibold">{{ (testing() ? 'wifi.testing' : 'wifi.test') | transloco }}</button>
          <button (click)="saveAndConnect()" [disabled]="testing()" class="min-h-[52px] rounded-[14px] bg-link-400 text-ink-900 text-base font-semibold">{{ 'wifi.saveConnect' | transloco }}</button>
        </div>
      </main>

    </div>
  `,
})
export class WifiPage {
  private readonly session = inject(SessionStore);
  private readonly store = inject(SettingsStore);
  private readonly router = inject(Router);
  private readonly scanner = inject(ScannerService);

  protected readonly modes: { id: Mode; label: string }[] = [
    { id: 'auto', label: 'wifi.auto' },
    { id: 'stream', label: 'wifi.stream' },
    { id: 'http', label: 'wifi.http' },
  ];
  protected readonly ip = signal('');
  protected readonly port = signal(String(this.store.settings().streamPort));
  protected readonly mode = signal<Mode>('auto');
  /** O que o modo automático descobriu no último teste. */
  protected readonly detected = signal<DeviceInfo | null>(null);
  protected readonly effectiveMode = computed<WifiMode | null>(() => (this.mode() === 'auto' ? (this.detected()?.wifiMode ?? null) : (this.mode() as WifiMode)));
  protected readonly testing = signal(false);
  protected readonly result = signal<'ok' | 'fail' | 'invalid' | null>(null);

  protected readonly message = computed(() => {
    const result = this.result();
    if (result === 'ok' && this.mode() === 'auto') return this.detected()?.wifiMode === 'stream' ? 'wifi.foundStream' : 'wifi.foundHttp';
    const labels = { ok: 'wifi.testOk', fail: 'wifi.testFail', invalid: 'wifi.invalid' };
    return result ? labels[result] : 'wifi.hint';
  });
  protected readonly messageClass = computed(() => {
    const result = this.result();
    return result === 'ok' ? 'text-ok' : result ? 'text-err' : 'text-mute';
  });

  protected onIp(event: Event): void {
    this.ip.set((event.target as HTMLInputElement).value);
    this.reset();
  }

  protected onPort(event: Event): void {
    this.port.set((event.target as HTMLInputElement).value);
    this.reset();
  }

  protected setMode(mode: Mode): void {
    this.mode.set(mode);
    this.reset();
  }

  protected async test(): Promise<void> {
    await this.resolveDevice();
  }

  protected async saveAndConnect(): Promise<void> {
    // No automático, conectar sem testar antes também descobre o modo.
    const device = this.mode() === 'auto' ? (this.detected() ?? (await this.resolveDevice())) : this.buildDevice();
    if (!device) return;
    void this.session.connect(device);
    void this.router.navigateByUrl('/tabs/dispositivos', { replaceUrl: true });
  }

  private reset(): void {
    this.result.set(null);
    this.detected.set(null);
  }

  /** Testa o modo escolhido, ou descobre qual é no automático. */
  private async resolveDevice(): Promise<DeviceInfo | null> {
    const device = this.buildDevice();
    if (!device) return null;
    this.testing.set(true);
    let found: DeviceInfo | null = null;
    if (this.mode() === 'auto') {
      found = await identifyWifi(device.address, device.port ?? this.store.settings().streamPort, {
        discover: () => this.scanner.discoverWifi(1500),
        test: (candidate) => this.session.test(candidate),
      });
      this.detected.set(found);
    } else if (await this.session.test(device)) {
      found = device;
    }
    this.testing.set(false);
    this.result.set(found ? 'ok' : 'fail');
    return found;
  }

  protected back(): void {
    void this.router.navigateByUrl('/busca', { replaceUrl: true });
  }

  private buildDevice(): DeviceInfo | null {
    const ip = this.ip().trim();
    const port = Number(this.port());
    const stream = this.mode() !== 'http';
    if (!isValidIpv4(ip) || (stream && !(Number.isInteger(port) && port > 0 && port < 65536))) {
      this.result.set('invalid');
      return null;
    }
    return {
      id: `wifi:manual:${ip}`,
      name: ip,
      address: ip,
      kind: 'wifi',
      wifiMode: stream ? 'stream' : 'http',
      port: stream ? port : undefined,
    };
  }
}
