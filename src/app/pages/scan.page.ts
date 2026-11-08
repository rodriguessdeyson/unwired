import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonIcon, ViewWillEnter } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { DeviceInfo, TransportKind } from '../core/models';
import { ScannerService } from '../core/scanner.service';
import { SessionStore } from '../core/session.store';

type Filter = 'all' | TransportKind;

const KIND_COLOR: Record<TransportKind, string> = { spp: '#FFC90E', ble: '#9DB2EC', wifi: '#6FD3B0' };
// Clássico e BLE dividem o ícone do Bluetooth; a cor e a etiqueta separam um do outro.
const KIND_ICON: Record<TransportKind, string> = { spp: 'bluetooth', ble: 'bluetooth', wifi: 'wifi' };
const KIND_LABEL: Record<TransportKind, string> = { spp: 'SPP', ble: 'BLE', wifi: 'WIFI' };

/** Mesma posição a cada busca: ângulo vem do id; distância, da força do sinal. */
export function radarPosition(device: DeviceInfo): { x: number; y: number; near: boolean } {
  let hash = 0;
  for (const char of device.id) hash = (hash * 31 + char.charCodeAt(0)) | 0;
  const angle = ((Math.abs(hash) % 360) * Math.PI) / 180;
  const radius =
    device.rssi === undefined
      ? 70 + (Math.abs(hash) % 30)
      : 46 + (Math.min(Math.max(-device.rssi, 40), 95) - 40) * (72 / 55);
  return {
    x: Math.round(138 + radius * Math.cos(angle) - 22),
    y: Math.round(138 + radius * Math.sin(angle) - 22),
    near: radius < 70,
  };
}

@Component({
  selector: 'app-scan',
  host: { class: 'ion-page' },
  imports: [IonIcon, RouterLink, TranslocoPipe],
  template: `
    <div class="relative h-full flex flex-col overflow-hidden bg-ink-900 text-paper" style="padding-top: var(--ion-safe-area-top, 0)">
      <header class="shrink-0 flex items-center gap-1 px-3 pt-3">
        <button (click)="leave()" [attr.aria-label]="'common.back' | transloco" class="size-11 flex items-center justify-center">
          <ion-icon name="chevron-back-outline" class="text-[22px]" aria-hidden="true" />
        </button>
        <h1 class="grow text-xl font-semibold">{{ 'scan.title' | transloco }}</h1>
        <button (click)="toggleScan()" class="min-h-11 px-3 text-link-300 text-[15px] font-semibold">
          {{ (scanner.scanning() ? 'scan.stop' : 'scan.again') | transloco }}
        </button>
      </header>

      <section class="relative shrink-0 h-[276px] overflow-hidden" aria-hidden="false">
        <div class="absolute left-1/2 top-0 -ml-[138px] size-[276px]">
          @if (scanner.scanning()) {
            <div class="rd-sweep absolute inset-2 rounded-full"></div>
            <div class="rd-pulse absolute inset-2 rounded-full border border-signal"></div>
            <div class="rd-pulse absolute inset-2 rounded-full border border-signal" style="animation-delay: 1.4s"></div>
          }
          <svg class="absolute inset-0" width="276" height="276" viewBox="0 0 276 276" aria-hidden="true">
            <g fill="none" stroke="#38324A">
              <circle cx="138" cy="138" r="44" /><circle cx="138" cy="138" r="87" /><circle cx="138" cy="138" r="130" />
              <line x1="8" y1="138" x2="268" y2="138" /><line x1="138" y1="8" x2="138" y2="268" />
            </g>
          </svg>
          <div class="absolute left-[122px] top-[122px] size-8 rounded-[10px] bg-brand flex items-center justify-center" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 36 36"><rect x="8" y="17" width="5" height="12" rx="1" fill="#121018" /><rect x="16" y="7" width="5" height="22" rx="1" fill="#121018" /><rect x="24" y="20" width="5" height="9" rx="1" fill="#FFC90E" /></svg>
          </div>
          @for (item of visible(); track item.device.id) {
            <button
              (click)="pick(item.device)"
              [attr.aria-label]="item.device.name + ', ' + item.label"
              class="absolute size-11 flex items-center justify-center"
              [style.left.px]="item.position.x"
              [style.top.px]="item.position.y"
            >
              <span
                class="rd-dot relative flex items-center justify-center rounded-full border-[1.5px]"
                [style.width.px]="item.position.near ? 30 : 24"
                [style.height.px]="item.position.near ? 30 : 24"
                [style.border-color]="item.color"
                [style.background]="item.color + '26'"
                [style.color]="item.color"
              >
                <ion-icon [name]="item.icon" [style.font-size.px]="item.position.near ? 16 : 13" aria-hidden="true" />
                <span class="rd-ping absolute inset-0 rounded-full border" [style.border-color]="item.color"></span>
              </span>
            </button>
          }
        </div>
      </section>

      <div role="status" class="shrink-0 flex items-baseline gap-2 px-5 pb-2.5">
        <span class="font-mono text-2xl font-medium text-signal">{{ visible().length }}</span>
        <span class="text-sm text-mute">{{ (scanner.scanning() ? 'scan.searching' : 'scan.done') | transloco }}</span>
      </div>

      <div role="group" class="shrink-0 flex gap-2 px-5 pb-2.5 overflow-x-auto">
        @for (option of filters; track option.id) {
          <button
            (click)="filter.set(option.id)"
            [attr.aria-pressed]="filter() === option.id"
            class="shrink-0 min-h-10 px-3.5 rounded-[20px] text-sm font-semibold border transition-colors"
            [class]="filter() === option.id ? 'bg-paper text-ink-900 border-paper' : 'text-paper border-ink-600'"
          >
            {{ option.label | transloco }}
          </button>
        }
      </div>

      <main class="grow min-h-0 overflow-y-auto px-5 pb-3 flex flex-col gap-2">
        @if (scanner.problem() === 'bluetooth-off') {
          <div class="p-3.5 rounded-[14px] bg-ink-800 border border-ink-600 flex flex-col gap-2">
            <p class="text-[15px]">{{ 'scan.btOff' | transloco }}</p>
            <button (click)="scanner.enableBluetooth()" class="min-h-11 rounded-xl bg-link-400 text-ink-900 font-semibold text-[15px]">{{ 'scan.btOffAction' | transloco }}</button>
          </div>
        }
        @if (scanner.problem() === 'permission-denied') {
          <div class="p-3.5 rounded-[14px] bg-ink-800 border border-ink-600 flex flex-col gap-2">
            <p class="text-[15px]">{{ 'scan.denied' | transloco }}</p>
            <button (click)="scanner.start()" class="min-h-11 rounded-xl border border-link-400 text-link-300 font-semibold text-[15px]">{{ 'scan.deniedAction' | transloco }}</button>
          </div>
        }
        @if (!scanner.scanning() && !visible().length && !hiddenCount() && !scanner.problem()) {
          <p class="pt-3 text-[15px] text-mute">{{ 'scan.empty' | transloco }}</p>
          <a routerLink="/guia" class="min-h-11 flex items-center text-link-300 text-[15px] font-semibold no-underline">{{ 'devices.howTo' | transloco }}</a>
        }
        @for (item of visible(); track item.device.id) {
          <button
            (click)="pick(item.device)"
            class="fade-up shrink-0 w-full min-h-[70px] box-border flex items-center gap-3.5 px-3.5 py-2.5 rounded-[14px] bg-ink-800 border border-ink-700 text-left"
          >
            <span class="shrink-0 size-10 rounded-xl flex items-center justify-center" aria-hidden="true" [style.background]="item.color + '1f'" [style.color]="item.color">
              <ion-icon [name]="item.icon" class="text-xl" />
            </span>
            <span class="grow min-w-0 flex flex-col gap-0.5">
              <span class="text-base font-semibold truncate" [class.text-mute]="item.other">{{ item.device.name }}</span>
              <span class="font-mono text-xs text-mute truncate">{{ item.device.address }}</span>
              <span class="text-[13px] text-mute">{{ (item.other ? 'scan.otherTag' : item.note) | transloco }}</span>
            </span>
            <span class="shrink-0 font-mono text-xs px-2 py-1 rounded-md bg-ink-700">{{ item.label }}</span>
          </button>
        }
        @if (hiddenCount()) {
          <button (click)="showOthers.set(!showOthers())" [attr.aria-pressed]="showOthers()" class="shrink-0 w-full min-h-14 box-border flex items-center gap-3 px-3.5 py-2 rounded-[14px] border border-dashed border-ink-600 text-left">
            <span class="grow min-w-0 flex flex-col">
              <span class="text-sm font-semibold">{{ (showOthers() ? 'scan.shownCount' : 'scan.hiddenCount') | transloco: { count: hiddenCount() } }}</span>
              <span class="text-[13px] text-mute">{{ 'scan.hiddenHint' | transloco }}</span>
            </span>
            <span class="shrink-0 text-link-300 text-sm font-semibold">{{ (showOthers() ? 'scan.hideHidden' : 'scan.showHidden') | transloco }}</span>
          </button>
        }
      </main>

      <div class="shrink-0 px-5 pt-0.5 border-t border-ink-700" style="padding-bottom: max(12px, var(--ion-safe-area-bottom, 0))">
        <a routerLink="/wifi" class="min-h-11 flex items-center text-link-300 text-[15px] font-semibold no-underline">{{ 'scan.addIp' | transloco }}</a>
      </div>

      <div
        (click)="cancel()"
        aria-hidden="true"
        class="absolute inset-0 bg-ink-950/70 transition-opacity duration-300"
        [style.opacity]="selected() ? 1 : 0"
        [style.pointer-events]="selected() ? 'auto' : 'none'"
      ></div>
      <section
        class="absolute inset-x-0 bottom-0 box-border px-5 pt-5 rounded-t-3xl bg-ink-800 border-t border-ink-600 flex flex-col gap-3.5 transition-transform duration-500 ease-fluid"
        style="padding-bottom: max(24px, var(--ion-safe-area-bottom, 0))"
        [style.transform]="selected() ? 'translateY(0)' : 'translateY(105%)'"
        [style.visibility]="selected() ? 'visible' : 'hidden'"
      >
        <svg class="w-full" height="60" viewBox="0 0 350 60" aria-hidden="true">
          <rect x="4" y="12" width="36" height="36" rx="11" fill="#738DCA" />
          <path class="link-flow" d="M52 30 L298 30" fill="none" [attr.stroke]="statusColor()" stroke-width="2" stroke-linecap="round" />
          <circle cx="326" cy="30" r="18" fill="none" [attr.stroke]="statusColor()" stroke-width="2" />
          <circle cx="326" cy="30" r="6" [attr.fill]="statusColor()" />
        </svg>
        <div>
          <h2 class="text-[22px] font-semibold">{{ selected()?.name }}</h2>
          <p role="status" class="mt-1 text-[15px] font-semibold" [style.color]="statusColor()">{{ statusLabel() | transloco }}</p>
        </div>
        @switch (session.status()) {
          @case ('connected') {
            <button (click)="openSession()" class="min-h-[52px] rounded-[14px] bg-link-400 text-ink-900 text-base font-semibold">{{ 'scan.openSession' | transloco }}</button>
          }
          @case ('failed') {
            <button (click)="retry()" class="min-h-[52px] rounded-[14px] bg-link-400 text-ink-900 text-base font-semibold">{{ 'scan.retry' | transloco }}</button>
            <button (click)="cancel()" class="min-h-11 text-link-300 text-[15px] font-semibold">{{ 'scan.backToScan' | transloco }}</button>
          }
          @default {
            <button (click)="cancel()" class="min-h-[52px] rounded-[14px] border border-ink-600 text-base font-semibold">{{ 'common.cancel' | transloco }}</button>
          }
        }
      </section>
    </div>
  `,
})
export class ScanPage implements ViewWillEnter, OnDestroy {
  protected readonly scanner = inject(ScannerService);
  protected readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected readonly filter = signal<Filter>('all');
  /** TVs, fones e afins ficam ocultos até o usuário pedir. */
  protected readonly showOthers = signal(false);
  protected readonly selected = signal<DeviceInfo | null>(null);
  protected readonly filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'scan.all' },
    { id: 'spp', label: 'scan.classic' },
    { id: 'ble', label: 'scan.ble' },
    { id: 'wifi', label: 'scan.wifi' },
  ];

  private readonly ofKind = computed(() => this.scanner.devices().filter((device) => this.filter() === 'all' || device.kind === this.filter()));
  /** Quantos estão ocultos. Continua contando com eles à vista, para o botão poder escondê-los de novo. */
  protected readonly hiddenCount = computed(() => this.ofKind().filter((device) => this.scanner.others().has(device.id)).length);
  protected readonly visible = computed(() => {
    const others = this.scanner.others();
    const shown = this.ofKind().filter((device) => this.showOthers() || !others.has(device.id));
    // Os de outro tipo vão para o fim, para não se misturar aos módulos.
    return [...shown.filter((device) => !others.has(device.id)), ...shown.filter((device) => others.has(device.id))].map((device) => ({
        device,
        position: radarPosition(device),
        color: KIND_COLOR[device.kind],
        icon: KIND_ICON[device.kind],
        label: KIND_LABEL[device.kind],
        note: this.noteFor(device),
        other: others.has(device.id),
      }));
  });

  protected readonly statusColor = computed(() => {
    const status = this.session.status();
    return status === 'connected' ? '#6FD3B0' : status === 'failed' ? '#FF9C8E' : '#FFC90E';
  });
  protected readonly statusLabel = computed(() => {
    const status = this.session.status();
    if (status === 'connected') return 'scan.connected';
    if (status !== 'failed') return 'scan.connecting';
    return this.session.errorCode() === 'no-uart' ? 'scan.errUart' : 'scan.errConnect';
  });

  ionViewWillEnter(): void {
    this.selected.set(null);
    void this.scanner.start();
  }

  ngOnDestroy(): void {
    void this.scanner.stop();
  }

  protected toggleScan(): void {
    void (this.scanner.scanning() ? this.scanner.stop() : this.scanner.start());
  }

  protected pick(device: DeviceInfo): void {
    this.selected.set(device);
    void this.scanner.stop();
    void this.session.connect(device);
  }

  protected retry(): void {
    const device = this.selected();
    if (device) void this.session.connect(device);
  }

  protected cancel(): void {
    if (this.session.status() !== 'connected') void this.session.disconnect();
    this.selected.set(null);
  }

  protected openSession(): void {
    void this.scanner.stop();
    void this.router.navigateByUrl('/tabs/sessao', { replaceUrl: true });
  }

  protected leave(): void {
    void this.scanner.stop();
    void this.router.navigateByUrl('/tabs/dispositivos', { replaceUrl: true });
  }

  private noteFor(device: DeviceInfo): string {
    if (device.kind === 'wifi') return device.wifiMode === 'http' ? 'scan.commandsOnly' : 'scan.stream';
    if (device.kind === 'ble') return 'scan.bleNote';
    return device.paired ? 'scan.paired' : 'scan.notPaired';
  }
}
