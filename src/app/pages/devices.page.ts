import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { CHANNEL_COLORS, DeviceInfo, DeviceProfile } from '../core/models';
import { ChannelView, SessionStore } from '../core/session.store';
import { SettingsStore } from '../core/settings.store';
import { BottomSheetComponent } from '../shared/bottom-sheet.component';
import { CommandPadComponent } from '../shared/command-pad.component';

export function sparkPoints(history: number[]): string {
  if (history.length < 2) return '';
  const low = Math.min(...history);
  const range = Math.max(...history) - low || 1;
  return history
    .map((value, index) => `${((index / (history.length - 1)) * 100).toFixed(1)},${(92 - ((value - low) / range) * 84).toFixed(1)}`)
    .join(' ');
}

export function formatValue(value: number | null): string {
  if (value === null) return '--';
  return Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(2);
}

@Component({
  selector: 'app-devices',
  host: { class: 'ion-page' },
  imports: [BottomSheetComponent, CommandPadComponent, IonIcon, RouterLink, TranslocoPipe],
  template: `
    <div class="relative h-full flex flex-col overflow-hidden bg-ink-900 text-paper" style="padding-top: var(--ion-safe-area-top, 0)">
      <header class="shrink-0 flex items-center gap-3 px-5 pt-5 pb-3.5">
        <svg width="36" height="36" viewBox="0 0 36 36" role="img" aria-label="unWired"><rect width="36" height="36" rx="10" fill="#738DCA" /><rect x="10" y="17" width="4" height="10" rx="1" fill="#121018" /><rect x="16" y="9" width="4" height="18" rx="1" fill="#121018" /><rect x="22" y="20" width="4" height="7" rx="1" fill="#FFC90E" /></svg>
        <h1 class="text-[22px] font-bold tracking-tight">unWired</h1>
      </header>

      <main class="grow min-h-0 overflow-y-auto px-5 pb-2.5 flex flex-col gap-5">
        @if (session.device(); as device) {
          <section class="shrink-0 bg-ink-800 border border-ink-600 rounded-[20px] p-4 flex flex-col gap-3">
            <div class="flex items-center gap-2 text-[13px] font-semibold" [style.color]="statusColor()">
              <span class="size-2 rounded-full" [style.background]="statusColor()" aria-hidden="true"></span>
              {{ statusLabel() | transloco }}
              <span class="ml-auto font-mono font-normal text-mute text-xs">{{ transportLabel(device) }}</span>
            </div>
            <div>
              <h2 class="text-2xl font-semibold tracking-tight">{{ device.name }}</h2>
              <p class="mt-0.5 font-mono text-xs text-mute">{{ device.address }}</p>
            </div>

            @if (session.status() === 'connected') {
              @if (session.canReceive()) {
                @if (session.channels().length) {
                  <div class="grid grid-cols-2 gap-2.5">
                    @for (channel of session.visibleChannels(); track channel.key; let index = $index) {
                      <button
                        (click)="openEdit(channel.key)"
                        [attr.aria-label]="('devices.editChannel' | transloco) + ' ' + channel.name"
                        class="fade-up px-3 py-2.5 rounded-[14px] bg-ink-950 text-left flex flex-col gap-1"
                        [class.col-span-2]="session.visibleChannels().length % 2 === 1 && index === session.visibleChannels().length - 1"
                        [style.opacity]="channel.staleSeconds ? 0.6 : 1"
                        [style.animation-delay.ms]="index * 90"
                      >
                        <span class="flex items-center justify-between gap-1.5 text-xs font-semibold text-mute">
                          <span class="truncate">{{ channel.name }}</span>
                          <ion-icon name="create-outline" class="shrink-0 text-[13px]" aria-hidden="true" />
                        </span>
                        <span class="font-mono text-[25px] font-medium tracking-tight" [style.color]="channel.color">
                          {{ format(channel.value) }}<span class="ml-1 text-[13px] tracking-normal text-mute">{{ channel.unit }}</span>
                        </span>
                        @if (channel.staleSeconds) {
                          <span class="h-[26px] flex items-center text-xs text-mute">{{ 'devices.stale' | transloco: { seconds: channel.staleSeconds } }}</span>
                        } @else {
                          <svg class="w-full" height="26" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                            <polyline [attr.points]="spark(channel)" fill="none" [attr.stroke]="channel.color" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
                          </svg>
                        }
                      </button>
                    }
                  </div>
                  @if (session.hiddenCount()) {
                    <button (click)="session.showHiddenChannels()" class="min-h-11 text-link-300 text-sm font-semibold">
                      {{ 'devices.hidden' | transloco: { count: session.hiddenCount() } }}
                    </button>
                  }
                }

                @if (!session.linesReceived() && !session.channels().length) {
                  <div role="status" class="flex items-center gap-3 p-3.5 rounded-[14px] bg-ink-950">
                    <svg class="shrink-0" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
                      <rect class="wait-bar" x="3" y="6" width="5" height="18" rx="1" fill="#FFC90E" />
                      <rect class="wait-bar" style="animation-delay: 0.15s" x="11" y="6" width="5" height="18" rx="1" fill="#FFC90E" />
                      <rect class="wait-bar" style="animation-delay: 0.3s" x="19" y="6" width="5" height="18" rx="1" fill="#FFC90E" />
                    </svg>
                    <span>
                      <span class="block text-[15px] font-semibold">{{ 'devices.waiting' | transloco }}</span>
                      <span class="block mt-px text-[13px] text-mute">{{ 'devices.waitingHint' | transloco }}</span>
                    </span>
                  </div>
                } @else if (!session.channels().length) {
                  <div class="fade-up p-3 rounded-[14px] bg-ink-950 flex flex-col gap-1 font-mono text-[13px]">
                    @for (line of lastLines(); track line.id) {
                      <span class="truncate"><span [style.color]="line.dir === 'tx' ? '#9DB2EC' : '#FFC90E'">{{ line.dir === 'tx' ? 'TX' : 'RX' }}</span> {{ line.text }}</span>
                    }
                    <span class="mt-1 font-sans text-[13px] text-mute">{{ 'devices.textOnly' | transloco }}</span>
                  </div>
                }

                @if (!session.linesReceived()) {
                  <button (click)="session.toggleStream()" class="min-h-[50px] rounded-xl bg-link-400 text-ink-900 text-[15px] font-semibold">{{ 'devices.startStream' | transloco }}</button>
                }
              } @else {
                <app-command-pad />
              }
              <a
                routerLink="/tabs/sessao"
                class="min-h-[50px] flex items-center justify-center rounded-xl text-[15px] font-semibold no-underline"
                [class]="session.channels().length ? 'bg-link-400 text-ink-900' : 'border border-link-400 text-link-300'"
              >
                {{ (session.channels().length || !session.canReceive() ? 'devices.openSession' : 'devices.openTerminal') | transloco }}
              </a>
            }

            @if (session.status() === 'failed') {
              <a routerLink="/guia" class="min-h-11 flex items-center text-link-300 text-[15px] font-semibold no-underline">{{ 'devices.howTo' | transloco }}</a>
            }
            @if (session.status() === 'lost' || session.status() === 'failed') {
              <button (click)="session.reconnect()" class="min-h-[50px] rounded-xl bg-link-400 text-ink-900 text-[15px] font-semibold">{{ 'devices.reconnect' | transloco }}</button>
            }
            <button (click)="session.disconnect()" class="min-h-11 text-err text-sm font-semibold">{{ 'devices.disconnect' | transloco }}</button>
          </section>
        } @else {
          <section class="shrink-0 bg-ink-800 border border-ink-600 rounded-[20px] px-[18px] py-6 flex flex-col gap-2">
            <h2 class="text-[22px] font-semibold">{{ 'devices.none' | transloco }}</h2>
            <p class="text-[15px] leading-snug text-mute">{{ 'devices.noneHint' | transloco }}</p>
            <a routerLink="/guia" class="min-h-11 flex items-center text-link-300 text-[15px] font-semibold no-underline">{{ 'devices.howTo' | transloco }}</a>
          </section>
        }

        @if (recents().length) {
          <section class="shrink-0 flex flex-col gap-0.5">
            <h2 class="mb-1 text-[13px] font-semibold text-mute">{{ 'devices.recents' | transloco }}</h2>
            @for (recent of recents(); track recent.device.id) {
              <button (click)="session.connect(recent.device)" class="min-h-[60px] w-full flex items-center gap-3 px-0.5 py-2 border-b border-ink-700 text-left">
                <span class="grow min-w-0 flex flex-col gap-0.5">
                  <span class="text-base font-semibold truncate">{{ recent.device.name }}</span>
                  <span class="font-mono text-xs text-mute truncate">{{ transportLabel(recent.device) }}</span>
                </span>
                <ion-icon name="chevron-forward-outline" class="text-lg text-mute" aria-hidden="true" />
              </button>
            }
          </section>
        }
      </main>

      <div class="shrink-0 px-5 pt-2 pb-3 border-t border-ink-700">
        <a routerLink="/busca" class="min-h-[50px] flex items-center justify-center gap-2.5 rounded-[14px] border border-link-400 text-link-300 text-base font-semibold no-underline">
          <ion-icon name="search-outline" class="text-xl" aria-hidden="true" />
          {{ 'devices.search' | transloco }}
        </a>
      </div>

      <app-bottom-sheet [open]="editOpen()" [title]="('devices.editChannel' | transloco) + ' ' + (editingChannel()?.key ?? '')" (closed)="editOpen.set(false)">
        @if (editingChannel(); as channel) {
          <div class="flex flex-col gap-3.5">
          <div class="grid grid-cols-[2fr_1fr] gap-2.5">
            <div class="flex flex-col gap-1.5 min-w-0">
              <label for="channel-name" class="text-[13px] font-semibold">{{ 'devices.name' | transloco }}</label>
              <input id="channel-name" [value]="session.profile()?.channels?.[channel.key]?.name ?? channel.key" (input)="edit(channel.key, { name: $any($event.target).value })" autocomplete="off" class="h-12 box-border px-3 rounded-xl border border-ink-600 bg-ink-900 text-[15px] min-w-0" />
            </div>
            <div class="flex flex-col gap-1.5 min-w-0">
              <label for="channel-unit" class="text-[13px] font-semibold">{{ 'devices.unit' | transloco }}</label>
              <input id="channel-unit" [value]="channel.unit" (input)="edit(channel.key, { unit: $any($event.target).value })" autocomplete="off" class="h-12 box-border px-3 rounded-xl border border-ink-600 bg-ink-900 text-[15px] min-w-0" />
            </div>
          </div>
          <div role="group" [attr.aria-label]="'devices.color' | transloco" class="flex items-center gap-2.5">
            <span class="mr-auto text-[13px] font-semibold">{{ 'devices.color' | transloco }}</span>
            @for (color of colors; track color) {
              <button
                (click)="edit(channel.key, { color })"
                [attr.aria-label]="color"
                [attr.aria-pressed]="channel.color === color"
                class="size-11 rounded-full border-2 flex items-center justify-center"
                [style.border-color]="channel.color === color ? '#F3F0F7' : 'transparent'"
              >
                <span class="block size-7 rounded-full" [style.background]="color"></span>
              </button>
            }
          </div>
          <button (click)="openFormat()" class="min-h-11 flex items-center justify-between text-[15px]">
            {{ 'devices.format' | transloco }}
            <ion-icon name="chevron-forward-outline" class="text-lg text-mute" aria-hidden="true" />
          </button>
          <div class="grid grid-cols-2 gap-2.5">
            <button (click)="hide(channel.key)" class="min-h-[50px] rounded-xl border border-ink-600 text-[15px] font-semibold">{{ 'devices.hide' | transloco }}</button>
            <button (click)="editOpen.set(false)" class="min-h-[50px] rounded-xl bg-link-400 text-ink-900 text-[15px] font-semibold">{{ 'common.save' | transloco }}</button>
          </div>
          </div>
        }
      </app-bottom-sheet>

    </div>
  `,
})
export class DevicesPage {
  protected readonly session = inject(SessionStore);
  private readonly store = inject(SettingsStore);
  private readonly router = inject(Router);

  protected readonly colors = CHANNEL_COLORS;
  protected readonly editing = signal<string | null>(null);
  protected readonly editOpen = signal(false);
  protected readonly format = formatValue;

  protected readonly editingChannel = computed<ChannelView | null>(() => {
    const key = this.editing();
    return key ? (this.session.channels().find((channel) => channel.key === key) ?? null) : null;
  });
  protected readonly lastLines = computed(() => this.session.log().slice(-3));
  protected readonly recents = computed<DeviceProfile[]>(() => {
    const currentId = this.session.device()?.id;
    return Object.values(this.store.profiles())
      .filter((profile) => profile.device.id !== currentId && profile.lastUsedAt > 0)
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, 5);
  });
  protected readonly statusColor = computed(() => {
    const status = this.session.status();
    if (status === 'connected') return '#6FD3B0';
    return status === 'connecting' ? '#FFC90E' : '#FF9C8E';
  });
  protected readonly statusLabel = computed(() => {
    const labels = { connected: 'devices.connectedTo', connecting: 'devices.connecting', lost: 'devices.lost', failed: 'devices.failed', idle: 'devices.none' };
    return labels[this.session.status()];
  });

  protected spark(channel: ChannelView): string {
    return sparkPoints(channel.history);
  }

  protected transportLabel(device: DeviceInfo): string {
    if (device.kind === 'spp') return 'SPP';
    if (device.kind === 'ble') return 'BLE';
    return device.wifiMode === 'http' ? 'Wi-Fi · HTTP' : 'Wi-Fi · TCP';
  }

  protected edit(key: string, patch: { name?: string; unit?: string; color?: string }): void {
    this.session.editChannel(key, patch);
  }

  protected openEdit(key: string): void {
    this.editing.set(key);
    this.editOpen.set(true);
  }

  protected hide(key: string): void {
    this.session.editChannel(key, { hidden: true });
    this.editOpen.set(false);
  }

  protected openFormat(): void {
    this.editOpen.set(false);
    void this.router.navigateByUrl('/formato');
  }
}
