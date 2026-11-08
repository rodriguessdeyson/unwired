import { NgTemplateOutlet } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, inject, signal, viewChild, viewChildren } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { chartWindow } from '../core/chart-math';
import { parseBounded, parseRange } from '../core/settings-input';
import { AdsService } from '../core/ads.service';
import { ExportService } from '../core/export.service';
import { PremiumStore } from '../core/premium.store';
import { SessionStore } from '../core/session.store';
import { SettingsStore } from '../core/settings.store';
import { ViewportService } from '../core/viewport.service';
import { BottomSheetComponent } from '../shared/bottom-sheet.component';
import { CommandPadComponent } from '../shared/command-pad.component';
import { formatValue } from './devices.page';
import { LiveChartComponent } from './live-chart.component';

type Pane = 'chart' | 'split' | 'terminal';

const MINI_CHART = 92;
const KEYBOARD_CHART = 48;
const HANDLE = 46;
const TERMINAL_MIN = 280;
const CONTROLS = 52;
const MOTION_MS = 420;
const CURVE = `${MOTION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`;
const ALL = '*';
const SMALL_FIELD = 'w-full min-w-0 h-11 box-border px-2.5 rounded-xl border bg-ink-900 font-mono text-sm';

interface RangeDraft {
  key: string;
  name: string;
  color: string;
  min: string;
  max: string;
}

interface ChartDraft {
  window: string;
  all: RangeDraft;
  channels: RangeDraft[];
}

const asText = (value: number | null | undefined) => (value === null || value === undefined ? '' : String(value));

export function toHex(text: string): string {
  return Array.from(new TextEncoder().encode(text))
    .map((byte) => byte.toString(16).padStart(2, '0').toUpperCase())
    .join(' ');
}

/** Junta os gráficos separados em uma única imagem. */
function stackCanvases(canvases: HTMLCanvasElement[]): HTMLCanvasElement {
  if (canvases.length === 1) return canvases[0];
  const result = document.createElement('canvas');
  result.width = Math.max(...canvases.map((canvas) => canvas.width));
  result.height = canvases.reduce((sum, canvas) => sum + canvas.height, 0);
  const context = result.getContext('2d')!;
  context.fillStyle = '#0c0a11';
  context.fillRect(0, 0, result.width, result.height);
  let y = 0;
  for (const canvas of canvases) {
    context.drawImage(canvas, 0, y);
    y += canvas.height;
  }
  return result;
}

@Component({
  selector: 'app-session',
  host: { class: 'ion-page' },
  imports: [BottomSheetComponent, CommandPadComponent, IonIcon, LiveChartComponent, NgTemplateOutlet, RouterLink, TranslocoPipe],
  template: `
    <div class="relative h-full flex flex-col overflow-hidden bg-ink-900 text-paper" style="padding: var(--ion-safe-area-top, 0) var(--ion-safe-area-right, 0) 0 var(--ion-safe-area-left, 0)">
      @if (session.device(); as device) {
        <header class="shrink-0 flex items-center" [class]="landscape() ? 'h-[52px] pl-3 pr-1 gap-3' : 'h-14 pl-4 pr-1'">
          @if (landscape()) {
            <div class="shrink-0 max-w-[110px] min-w-0 flex items-center gap-1.5">
              <span class="live-dot shrink-0 size-[7px] rounded-full" [style.background]="stateColor()" [attr.aria-label]="stateLabel() | transloco"></span>
              <h1 class="text-sm font-semibold truncate">{{ device.name }}</h1>
            </div>
            @if (session.canReceive()) {
              <div class="grow min-w-0"><ng-container *ngTemplateOutlet="readoutsTemplate" /></div>
              <div class="shrink-0"><ng-container *ngTemplateOutlet="controlsTemplate" /></div>
            } @else {
              <div class="grow"></div>
            }
          } @else {
            <div class="grow min-w-0">
              <h1 class="text-lg font-semibold truncate leading-tight">{{ device.name }}</h1>
              <p class="flex items-center gap-1.5 text-xs font-semibold" [style.color]="stateColor()">
                <span class="live-dot size-[7px] rounded-full" [style.background]="stateColor()" aria-hidden="true"></span>
                {{ stateLabel() | transloco }}
              </p>
            </div>
          }
          @if (session.canReceive()) {
            <button (click)="session.clear()" [attr.aria-label]="'session.clear' | transloco" class="shrink-0 size-11 flex items-center justify-center text-mute">
              <ion-icon name="trash-outline" class="text-xl" aria-hidden="true" />
            </button>
          }
          <button (click)="menu.set(!menu())" [attr.aria-label]="'session.more' | transloco" [attr.aria-expanded]="menu()" class="shrink-0 size-11 flex items-center justify-center text-mute">
            <ion-icon name="ellipsis-vertical" class="text-xl" aria-hidden="true" />
          </button>
        </header>

        @if (!session.canReceive()) {
          <div class="grow min-h-0 flex flex-col">
            <div class="grow min-h-0 overflow-y-auto px-4 pt-1 pb-3">
              <app-command-pad />
            </div>
            <div class="shrink-0 border-t border-ink-700">
              <ng-container *ngTemplateOutlet="commandForm" />
            </div>
          </div>
        } @else {
        @if (!landscape() && !viewport.keyboard()) {
          <div role="group" [attr.aria-label]="'session.layout' | transloco" class="relative shrink-0 h-11 mx-3 mb-2 p-[3px] box-border rounded-xl bg-ink-800 grid grid-cols-3">
            <div
              class="absolute left-[3px] top-[3px] bottom-[3px] rounded-[9px] bg-ink-600"
              aria-hidden="true"
              style="width: calc((100% - 6px) / 3)"
              [style.transform]="'translateX(' + paneIndex() * 100 + '%)'"
              [style.transition]="'transform ' + curve"
            ></div>
            @for (option of panes; track option.id) {
              <button (click)="setPane(option.id)" [attr.aria-pressed]="pane() === option.id" class="relative text-sm font-semibold transition-colors" [class]="pane() === option.id ? 'text-paper' : 'text-mute'">
                {{ option.label | transloco }}
              </button>
            }
          </div>
        }

        <div #stage class="grow min-h-0 flex" [class]="landscape() ? 'flex-row' : 'flex-col'">
          <section
            class="box-border px-3 flex flex-col overflow-hidden"
            [class]="landscape() ? 'grow min-w-0 pb-2' : 'shrink-0'"
            [style.height]="landscape() ? 'auto' : chartHeight() + 'px'"
            [style.transition]="dragHeight() === null ? 'height ' + curve : 'none'"
          >
            @if (session.canReceive()) {
              @if (!landscape() && !viewport.keyboard()) {
                <div class="shrink-0 h-11 px-1"><ng-container *ngTemplateOutlet="readoutsTemplate" /></div>
              }

              <!-- Os controles não ocupam o fluxo: aparecem e somem sem empurrar nada. -->
              <div
                class="relative grow min-h-0"
                [class.mt-1]="!landscape() && !viewport.keyboard()"
                [style.padding-bottom.px]="reserveControls()"
                [style.transition]="dragHeight() === null ? 'padding-bottom ' + curve : 'none'"
              >
                @if (separateActive()) {
                  <div class="h-full flex flex-col gap-1.5 overflow-y-auto no-scrollbar">
                    @for (channel of chartChannels(); track channel.key) {
                      <div class="relative flex-1 min-h-[76px] rounded-[14px] bg-ink-950 border border-ink-700 overflow-hidden">
                        <span class="absolute left-12 top-1.5 z-10 flex items-baseline gap-2 text-[11px] pointer-events-none">
                          <span class="font-semibold" [style.color]="channel.color">{{ channel.name }}</span>
                          @if (stats().get(channel.key); as item) {
                            <span class="font-mono text-mute">↓{{ item.min }} ↑{{ item.max }}</span>
                          }
                        </span>
                        <app-live-chart [only]="channel.key" [muted]="muted()" [windowSize]="windowSize()" [locked]="locked()" [lockStart]="lockStart()" [follow]="follow()" [frozen]="frozen()" [yMin]="channelRange(channel.key).yMin" [yMax]="channelRange(channel.key).yMax" />
                      </div>
                    }
                  </div>
                } @else {
                  <div class="relative h-full rounded-[14px] bg-ink-950 border border-ink-700 overflow-hidden">
                    <app-live-chart
                      [muted]="muted()"
                      [windowSize]="windowSize()"
                      [locked]="locked()"
                      [lockStart]="lockStart()"
                      [follow]="follow()"
                      [frozen]="frozen()"
                      [yMin]="combinedRange().yMin"
                      [yMax]="combinedRange().yMax"
                      [compact]="compactChart()"
                    />
                    @if (pane() === 'chart') {
                      <dl class="absolute right-2 top-1.5 flex flex-col items-end gap-0.5 font-mono text-[11px] pointer-events-none transition-opacity duration-300" [style.opacity]="chartHeight() >= 400 ? 1 : 0">
                        @for (channel of chartChannels(); track channel.key) {
                          @if (stats().get(channel.key); as item) {
                            <div class="flex gap-1.5 text-mute">
                              <dt class="font-semibold" [style.color]="channel.color">{{ channel.name }}</dt>
                              <dd>↓{{ item.min }} ~{{ item.avg }} ↑{{ item.max }}</dd>
                            </div>
                          }
                        }
                      </dl>
                    }
                  </div>
                }

                @if (!landscape() && !viewport.keyboard()) {
                  <div
                    class="absolute inset-x-0 bottom-0 transition-opacity duration-200"
                    [style.opacity]="showControls() ? 1 : 0"
                    [style.visibility]="showControls() ? 'visible' : 'hidden'"
                  >
                    <ng-container *ngTemplateOutlet="controlsTemplate" />
                  </div>
                }
              </div>
            }
          </section>

          <section
            class="flex flex-col overflow-hidden bg-ink-800 border-ink-600"
            [class]="landscape() ? 'shrink-0 border-l' : 'grow min-h-0 mt-2 rounded-t-[22px] border-t'"
            [style.width]="landscape() ? (terminalOpen() ? '300px' : '0') : 'auto'"
            [style.transition]="landscape() ? 'width ' + curve : 'none'"
          >
            @if (!landscape()) {
              <button
                (pointerdown)="dragStart($event)"
                (pointermove)="dragMove($event)"
                (pointerup)="dragEnd()"
                (pointercancel)="dragEnd()"
                (click)="handleClick()"
                [attr.aria-label]="'session.handle' | transloco"
                class="shrink-0 flex flex-col items-stretch gap-1 px-4 pt-1.5 text-left cursor-grab"
                style="touch-action: none"
                [style.height.px]="handleHeight"
              >
                <span class="self-center w-9 h-1 rounded-sm bg-ink-500" aria-hidden="true"></span>
                <span class="flex items-baseline gap-2.5 min-w-0">
                  <span class="shrink-0 text-sm font-semibold">{{ 'session.terminal' | transloco }}</span>
                  <span class="grow min-w-0 font-mono text-xs text-mute truncate">{{ lastLine() }}</span>
                  <span class="shrink-0 font-mono text-xs text-mute">{{ session.log().length }}</span>
                </span>
              </button>
            }

            <div class="grow min-h-0 flex flex-col transition-opacity" [class.pt-2]="landscape()" [style.opacity]="pane() === 'chart' && dragHeight() === null && !landscape() ? 0 : 1" [style.min-width]="landscape() ? '300px' : 'auto'">
              <div class="grow min-h-0 mx-3 rounded-xl bg-ink-950 overflow-y-auto flex flex-col-reverse">
                <div class="p-2.5 flex flex-col gap-1 font-mono text-[13px] leading-[1.4]">
                  @if (!lines().length) {
                    <p class="font-sans text-sm text-mute">{{ (session.canReceive() ? 'session.logEmpty' : 'session.sendOnly') | transloco }}</p>
                  }
                  @for (line of lines(); track line.id) {
                    <div class="flex gap-2">
                      <span class="shrink-0 text-faint">{{ line.time }}</span>
                      <span class="shrink-0 font-medium" [style.color]="line.dir === 'tx' ? '#9DB2EC' : '#FFC90E'">{{ line.dir === 'tx' ? 'TX' : 'RX' }}</span>
                      <span class="break-all" [style.color]="line.dir === 'tx' ? '#C3D0F4' : '#F3F0F7'">{{ hex() ? hexOf(line.text) : line.text }}</span>
                    </div>
                  }
                </div>
              </div>

              <div role="group" class="shrink-0 flex items-center gap-1.5 px-3 pt-2 overflow-x-auto no-scrollbar">
                @if (session.canReceive()) {
                  <button (click)="session.receiving.set(!session.receiving())" [attr.aria-pressed]="session.receiving()" class="shrink-0 min-h-9 px-3 rounded-[18px] text-[13px] font-semibold border transition-colors" [class]="session.receiving() ? 'bg-paper text-ink-900 border-paper' : 'border-ink-600'">{{ 'session.receive' | transloco }}</button>
                  <button (click)="hex.set(!hex())" [attr.aria-pressed]="hex()" class="shrink-0 min-h-9 px-3 rounded-[18px] text-[13px] font-semibold border transition-colors" [class]="hex() ? 'bg-paper text-ink-900 border-paper' : 'border-ink-600'">{{ 'session.hex' | transloco }}</button>
                  <span class="shrink-0 w-px h-5 mx-0.5 bg-ink-600" aria-hidden="true"></span>
                }
                @for (saved of session.profile()?.commands ?? []; track $index) {
                  <button (click)="session.send(saved.command)" class="shrink-0 min-h-9 px-3 rounded-[9px] border border-ink-600 bg-ink-700 font-mono text-xs">{{ saved.label }}</button>
                }
              </div>

              <ng-container *ngTemplateOutlet="commandForm" />
            </div>
          </section>
        </div>
        }

        <ng-template #commandForm>
              <form (submit)="submit($event)" class="shrink-0 flex gap-1.5 px-3 pt-2 pb-2.5">
                <label for="command" class="sr-only">{{ 'common.command' | transloco }}</label>
                <input
                  #command
                  id="command"
                  autocorrect="off"
                  [placeholder]="'common.commandHint' | transloco"
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck="false"
                  class="grow min-w-0 h-11 box-border px-3 rounded-xl border border-ink-600 bg-ink-900 font-mono text-sm"
                />
                <button type="submit" class="h-11 px-3.5 rounded-xl bg-link-400 text-ink-900 text-sm font-semibold">{{ 'common.send' | transloco }}</button>
              </form>
        </ng-template>

        <div
          role="menu"
          [style.top.px]="landscape() ? 50 : 54"
          class="absolute right-2 z-20 w-[250px] flex flex-col rounded-2xl overflow-hidden bg-ink-700 border border-ink-600 origin-top-right transition-all duration-200 ease-fluid"
          [style.opacity]="menu() ? 1 : 0"
          [style.transform]="menu() ? 'scale(1)' : 'scale(0.92)'"
          [style.visibility]="menu() ? 'visible' : 'hidden'"
        >
          @if (session.canReceive()) {
            <button role="menuitem" (click)="saveImage()" class="min-h-[46px] px-3.5 text-left text-[15px]">{{ 'session.saveImage' | transloco }}@if (!premium.premium()) {<span class="ml-2 px-1.5 py-0.5 rounded-md bg-link-400/15 text-link-400 text-[11px] font-semibold align-middle">PRO</span>}</button>
            <button role="menuitem" (click)="exportCsv()" class="min-h-[46px] px-3.5 text-left text-[15px]">{{ 'session.exportCsv' | transloco }}@if (!premium.premium()) {<span class="ml-2 px-1.5 py-0.5 rounded-md bg-link-400/15 text-link-400 text-[11px] font-semibold align-middle">PRO</span>}</button>
          }
          <button role="menuitem" (click)="exportLog()" class="min-h-[46px] px-3.5 text-left text-[15px]">{{ 'session.exportLog' | transloco }}@if (!premium.premium()) {<span class="ml-2 px-1.5 py-0.5 rounded-md bg-link-400/15 text-link-400 text-[11px] font-semibold align-middle">PRO</span>}</button>
          <button role="menuitem" (click)="disconnect()" class="min-h-[46px] px-3.5 text-left border-t border-ink-600 text-err text-[15px] font-semibold">{{ 'session.disconnect' | transloco }}</button>
        </div>

        <app-bottom-sheet [open]="chartSheet()" [title]="'session.chartSettings' | transloco" (closed)="chartSheet.set(false)">
          <!-- Recria os campos a cada abertura, para não herdar o que foi digitado antes. -->
          @for (draft of chartDrafts(); track chartVersion()) {
            <form (submit)="saveChart($event)" class="flex flex-col gap-5" novalidate>
              <div class="flex flex-col gap-1.5">
                <label for="chart-window" class="text-[13px] font-semibold">{{ 'settings.window' | transloco }}</label>
                <input id="chart-window" data-autofocus inputmode="numeric" autocomplete="off" [value]="draft.window" (input)="draft.window = $any($event.target).value" [class]="smallField" [class.border-err]="chartInvalid().has('window')" [class.border-ink-600]="!chartInvalid().has('window')" />
                <p class="text-sm" [class]="chartInvalid().has('window') ? 'text-err' : 'text-mute'">{{ 'settings.between' | transloco: { min: 20, max: 1000 } }}</p>
              </div>

              <fieldset class="min-w-0 m-0 p-0 border-0 flex flex-col gap-2">
                <legend class="mb-2 text-[13px] font-semibold">{{ 'settings.yRange' | transloco }}</legend>
                @if (session.visibleChannels().length > 1) {
                  <button type="button" role="switch" (click)="draftSeparate.set(!draftSeparate())" [attr.aria-checked]="draftSeparate()" class="mb-1 min-h-11 flex items-center justify-between gap-3 text-[15px] text-left">
                    {{ 'session.separate' | transloco }}
                    <span aria-hidden="true" class="shrink-0 w-11 h-[26px] p-[3px] box-border rounded-full transition-colors" [class]="draftSeparate() ? 'bg-link-400' : 'bg-ink-600'">
                      <span class="block size-5 rounded-full bg-paper transition-transform duration-200" [style.transform]="draftSeparate() ? 'translateX(18px)' : 'none'"></span>
                    </span>
                  </button>
                }
                <div class="grid grid-cols-[minmax(0,1fr)_92px_92px] gap-2 text-xs font-semibold text-mute" aria-hidden="true">
                  <span></span><span class="px-1">{{ 'session.minShort' | transloco }}</span><span class="px-1">{{ 'session.maxShort' | transloco }}</span>
                </div>
                @for (row of draftSeparate() && session.visibleChannels().length > 1 ? draft.channels : [draft.all]; track row.key) {
                  <div class="grid grid-cols-[minmax(0,1fr)_92px_92px] items-center gap-2">
                    <span class="truncate text-sm font-semibold" [style.color]="row.color">{{ row.key === all ? ('session.allChannels' | transloco) : row.name }}</span>
                    <input [attr.aria-label]="(row.key === all ? ('session.allChannels' | transloco) : row.name) + ', ' + ('settings.yMin' | transloco)" [value]="row.min" (input)="row.min = $any($event.target).value" autocomplete="off" placeholder="auto" [class]="smallField" [class.border-err]="chartInvalid().has(row.key)" [class.border-ink-600]="!chartInvalid().has(row.key)" />
                    <input [attr.aria-label]="(row.key === all ? ('session.allChannels' | transloco) : row.name) + ', ' + ('settings.yMax' | transloco)" [value]="row.max" (input)="row.max = $any($event.target).value" autocomplete="off" placeholder="auto" [class]="smallField" [class.border-err]="chartInvalid().has(row.key)" [class.border-ink-600]="!chartInvalid().has(row.key)" />
                  </div>
                }
                <p class="mt-1 text-sm" [class]="hasRangeError() ? 'text-err' : 'text-mute'">{{ (hasRangeError() ? 'settings.rangeInvalid' : 'settings.emptyAuto') | transloco }}</p>
              </fieldset>

              <div class="grid grid-cols-2 gap-2.5">
                <button type="button" (click)="chartSheet.set(false)" class="min-h-[50px] rounded-xl border border-ink-600 text-[15px] font-semibold">{{ 'common.cancel' | transloco }}</button>
                <button type="submit" class="min-h-[50px] rounded-xl bg-link-400 text-ink-900 text-[15px] font-semibold">{{ 'common.save' | transloco }}</button>
              </div>
            </form>
          }
        </app-bottom-sheet>

        <ng-template #readoutsTemplate>
          <div class="h-11 flex items-center gap-3 overflow-x-auto overflow-y-hidden no-scrollbar">
            @for (channel of session.visibleChannels(); track channel.key) {
              <button
                (click)="toggleMuted(channel.key)"
                [attr.aria-pressed]="!muted().has(channel.key)"
                class="shrink-0 min-w-[68px] text-left transition-opacity"
                [style.opacity]="muted().has(channel.key) || channel.staleSeconds ? 0.45 : 1"
                [style.color]="channel.color"
              >
                <span class="block text-[11px] leading-[14px] font-semibold text-mute whitespace-nowrap">{{ channel.name }}</span>
                <span class="block font-mono text-xl font-medium leading-6 tracking-tight whitespace-nowrap">{{ format(channel.value) }}<span class="ml-1 text-xs tracking-normal text-mute">{{ channel.unit }}</span></span>
              </button>
            }
          </div>
        </ng-template>

        <ng-template #controlsTemplate>
          <div role="group" class="flex items-center gap-1.5">
            <button (click)="session.toggleStream()" [attr.aria-label]="(session.running() ? 'session.stop' : 'session.start') | transloco" class="shrink-0 w-11 h-11 rounded-xl bg-link-400 text-ink-900 flex items-center justify-center">
              <ion-icon [name]="session.running() ? 'pause' : 'play'" class="text-lg" aria-hidden="true" />
            </button>
            <button (click)="toggleLock()" [attr.aria-pressed]="locked()" class="min-w-0 min-h-11 px-1.5 rounded-xl text-[13px] font-semibold border transition-colors whitespace-nowrap" [class.grow]="!landscape()" [class]="locked() ? 'bg-paper text-ink-900 border-paper' : 'border-ink-600'">{{ 'session.lock' | transloco }}</button>
            <button (click)="toggleFollow()" [attr.aria-pressed]="follow()" class="min-w-0 min-h-11 px-1.5 rounded-xl text-[13px] font-semibold border transition-colors whitespace-nowrap" [class.grow]="!landscape()" [class]="follow() ? 'bg-paper text-ink-900 border-paper' : 'border-ink-600'">{{ 'session.scroll' | transloco }}</button>
            <button (click)="openChartSettings()" [attr.aria-label]="'session.chartSettings' | transloco" class="shrink-0 size-11 rounded-xl flex items-center justify-center border border-ink-600">
              <ion-icon name="options-outline" class="text-xl" aria-hidden="true" />
            </button>
            @if (session.visibleChannels().length > 1) {
              <button (click)="toggleSeparate()" [attr.aria-pressed]="separate()" [attr.aria-label]="'session.separate' | transloco" class="shrink-0 size-11 rounded-xl flex items-center justify-center border transition-colors" [class]="separate() ? 'bg-paper text-ink-900 border-paper' : 'border-ink-600'">
                <ion-icon name="reorder-two-outline" class="text-xl" aria-hidden="true" />
              </button>
            }
            @if (landscape()) {
              <button (click)="terminalOpen.set(!terminalOpen())" [attr.aria-pressed]="terminalOpen()" [attr.aria-label]="'session.terminal' | transloco" class="shrink-0 size-11 rounded-xl flex items-center justify-center border transition-colors" [class]="terminalOpen() ? 'bg-paper text-ink-900 border-paper' : 'border-ink-600'">
                <ion-icon name="terminal-outline" class="text-xl" aria-hidden="true" />
              </button>
            }
          </div>
        </ng-template>
      } @else {
        <div class="grow flex flex-col items-center justify-center gap-4 p-6 text-center">
          <p class="text-[17px] text-mute">{{ 'session.empty' | transloco }}</p>
          <a routerLink="/busca" class="min-h-[50px] px-5 flex items-center rounded-[14px] bg-link-400 text-ink-900 font-semibold no-underline">{{ 'session.search' | transloco }}</a>
        </div>
      }
    </div>
  `,
})
export class SessionPage {
  protected readonly session = inject(SessionStore);
  protected readonly store = inject(SettingsStore);
  protected readonly viewport = inject(ViewportService);
  private readonly exporter = inject(ExportService);
  protected readonly premium = inject(PremiumStore);
  private readonly ads = inject(AdsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly stage = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly charts = viewChildren(LiveChartComponent);
  private readonly commandInput = viewChild<ElementRef<HTMLInputElement>>('command');

  protected readonly curve = CURVE;
  protected readonly all = ALL;
  protected readonly smallField = SMALL_FIELD;
  protected readonly handleHeight = HANDLE;
  protected readonly format = formatValue;
  protected readonly hexOf = toHex;
  protected readonly landscape = this.viewport.landscape;
  protected readonly panes: { id: Pane; label: string }[] = [
    { id: 'chart', label: 'session.chart' },
    { id: 'split', label: 'session.split' },
    { id: 'terminal', label: 'session.terminal' },
  ];

  protected readonly pane = signal<Pane>('split');
  protected readonly dragHeight = signal<number | null>(null);
  protected readonly stageHeight = signal(640);
  protected readonly terminalOpen = signal(false);
  protected readonly menu = signal(false);
  protected readonly muted = signal<ReadonlySet<string>>(new Set());
  protected readonly windowSize = signal(this.store.settings().windowSize);
  protected readonly locked = signal(false);
  protected readonly lockStart = signal(0);
  protected readonly follow = signal(true);
  protected readonly frozen = signal(0);
  protected readonly logFrozen = signal(0);
  protected readonly hex = signal(false);
  /** O gráfico só troca de forma depois de a animação terminar, para não piscar no meio. */
  protected readonly compactChart = signal(false);
  protected readonly chartSheet = signal(false);
  protected readonly chartVersion = signal(0);
  protected readonly chartDraft = signal<ChartDraft | null>(null);
  protected readonly chartDrafts = computed(() => {
    const draft = this.chartDraft();
    return draft ? [draft] : [];
  });
  protected readonly draftSeparate = signal(false);
  protected readonly chartInvalid = signal<ReadonlySet<string>>(new Set());
  protected readonly hasRangeError = computed(() => [...this.chartInvalid()].some((key) => key !== 'window'));
  /** Faixa do gráfico com todos os canais; perfis antigos herdam a dos ajustes gerais. */
  protected readonly combinedRange = computed(() => {
    const profile = this.session.profile();
    const settings = this.store.settings();
    return profile && profile.yMin !== undefined ? { yMin: profile.yMin ?? null, yMax: profile.yMax ?? null } : { yMin: settings.yMin, yMax: settings.yMax };
  });

  private drag: { y: number; height: number; moved: boolean } | null = null;
  private skipClick = false;

  private readonly snaps = computed<Record<Pane, number>>(() => {
    const height = this.stageHeight();
    if (this.viewport.keyboard()) return { chart: KEYBOARD_CHART, split: KEYBOARD_CHART, terminal: KEYBOARD_CHART };
    return {
      chart: Math.max(MINI_CHART, height - HANDLE - 8),
      split: Math.max(MINI_CHART, Math.min(Math.round(height * 0.45), height - TERMINAL_MIN)),
      terminal: MINI_CHART,
    };
  });
  protected readonly chartHeight = computed(() => this.dragHeight() ?? this.snaps()[this.pane()]);
  protected readonly paneIndex = computed(() => this.panes.findIndex((option) => option.id === this.pane()));
  protected readonly showControls = computed(() => this.chartHeight() >= 200);
  protected readonly reserveControls = computed(() => (!this.landscape() && this.showControls() ? CONTROLS : 0));
  private readonly wantsCompact = computed(() => !this.landscape() && this.chartHeight() < 140);
  protected readonly separate = computed(() => !!this.session.profile()?.separateCharts);
  protected readonly chartChannels = computed(() => this.session.visibleChannels().filter((channel) => !this.muted().has(channel.key)));
  // Na faixa estreita do modo Terminal não cabem vários gráficos.
  protected readonly separateActive = computed(() => this.separate() && !this.compactChart() && this.chartChannels().length > 1);
  protected readonly stateLabel = computed(() => {
    const status = this.session.status();
    if (status === 'lost') return 'devices.lost';
    if (status === 'connecting') return 'devices.connecting';
    // Só comandos não transmite: basta dizer que está conectado.
    if (!this.session.canReceive()) return 'devices.connectedTo';
    return this.session.running() ? 'session.streaming' : 'session.paused';
  });
  protected readonly stateColor = computed(() => {
    const status = this.session.status();
    if (status === 'lost' || status === 'failed') return '#FF9C8E';
    return this.session.running() || !this.session.canReceive() ? '#6FD3B0' : '#A8A2B8';
  });
  protected readonly stats = computed(() => {
    this.session.tick();
    const tracker = this.session.tracker();
    const range = chartWindow(tracker.xs, this.windowSize(), {
      locked: this.locked(),
      lockStart: this.lockStart(),
      follow: this.follow(),
      frozen: this.frozen(),
    });
    const result = new Map<string, { min: string; avg: string; max: string }>();
    for (const channel of tracker.channels()) {
      const values = channel.values.slice(range.from, range.to).filter((value): value is number => value !== null);
      if (!values.length) continue;
      result.set(channel.key, {
        min: formatValue(Math.min(...values)),
        avg: formatValue(values.reduce((sum, value) => sum + value, 0) / values.length),
        max: formatValue(Math.max(...values)),
      });
    }
    return result;
  });
  protected readonly lines = computed(() => {
    const log = this.session.log();
    return (this.follow() ? log : log.slice(0, this.logFrozen())).slice(-200);
  });
  protected readonly lastLine = computed(() => {
    const log = this.session.log();
    const last = log[log.length - 1];
    return last ? `${last.dir === 'tx' ? 'TX' : 'RX'} ${last.text}` : '';
  });

  constructor() {
    effect((onCleanup) => {
      const wanted = this.wantsCompact();
      // Ao abrir o gráfico, os eixos voltam já; ao fechar, só no fim da animação.
      if (!wanted) {
        this.compactChart.set(false);
        return;
      }
      const timer = setTimeout(() => this.compactChart.set(true), MOTION_MS);
      onCleanup(() => clearTimeout(timer));
    });

    afterNextRender(() => {
      const observer = new ResizeObserver(() => {
        const height = this.stage()?.nativeElement.clientHeight;
        if (height) this.stageHeight.set(height);
      });
      const watch = setInterval(() => {
        const element = this.stage()?.nativeElement;
        if (element) {
          observer.observe(element);
          clearInterval(watch);
        }
      }, 200);
      this.destroyRef.onDestroy(() => {
        clearInterval(watch);
        observer.disconnect();
      });
    });
  }

  protected setPane(pane: Pane): void {
    this.dragHeight.set(null);
    this.pane.set(pane);
  }

  protected dragStart(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.drag = { y: event.clientY, height: this.chartHeight(), moved: false };
  }

  protected dragMove(event: PointerEvent): void {
    if (!this.drag) return;
    const delta = event.clientY - this.drag.y;
    if (Math.abs(delta) > 4) this.drag.moved = true;
    if (this.drag.moved) {
      const { chart, terminal } = this.snaps();
      this.dragHeight.set(Math.min(chart, Math.max(terminal, this.drag.height + delta)));
    }
  }

  protected dragEnd(): void {
    if (!this.drag) return;
    const moved = this.drag.moved;
    this.drag = null;
    if (!moved) return;
    this.skipClick = true;
    const height = this.chartHeight();
    const snaps = this.snaps();
    const nearest = (Object.keys(snaps) as Pane[]).sort((a, b) => Math.abs(snaps[a] - height) - Math.abs(snaps[b] - height))[0];
    this.setPane(nearest);
  }

  protected handleClick(): void {
    if (this.skipClick) {
      this.skipClick = false;
      return;
    }
    const next: Record<Pane, Pane> = { chart: 'split', split: 'terminal', terminal: 'split' };
    this.setPane(next[this.pane()]);
  }

  protected toggleMuted(key: string): void {
    this.muted.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected toggleSeparate(): void {
    this.session.setSeparateCharts(!this.separate());
  }

  protected toggleLock(): void {
    this.lockStart.set(this.session.tracker().xs.length);
    this.locked.update((value) => !value);
  }

  /** Vale para o gráfico e para o registro: os dois congelam no mesmo ponto. */
  protected toggleFollow(): void {
    this.frozen.set(this.session.tracker().xs.length);
    this.logFrozen.set(this.session.log().length);
    this.follow.update((value) => !value);
  }

  protected channelRange(key: string): { yMin: number | null; yMax: number | null } {
    const edit = this.session.profile()?.channels[key];
    return { yMin: edit?.yMin ?? null, yMax: edit?.yMax ?? null };
  }

  protected openChartSettings(): void {
    this.menu.set(false);
    const combined = this.combinedRange();
    this.chartDraft.set({
      window: String(this.windowSize()),
      all: { key: ALL, name: '', color: '#F3F0F7', min: asText(combined.yMin), max: asText(combined.yMax) },
      channels: this.session.visibleChannels().map((channel) => {
        const range = this.channelRange(channel.key);
        return { key: channel.key, name: channel.name, color: channel.color, min: asText(range.yMin), max: asText(range.yMax) };
      }),
    });
    this.draftSeparate.set(this.separate());
    this.chartInvalid.set(new Set());
    this.chartVersion.update((value) => value + 1);
    this.chartSheet.set(true);
  }

  protected saveChart(event: Event): void {
    event.preventDefault();
    const draft = this.chartDraft();
    if (!draft) return;
    const invalid = new Set<string>();
    const windowSize = parseBounded(draft.window, 20, 1000);
    if (windowSize === null) invalid.add('window');
    // Só valem as linhas à vista: as do outro modo ficam como estavam.
    const separate = this.draftSeparate() && this.session.visibleChannels().length > 1;
    const rows = separate ? draft.channels : [draft.all];
    const ranges = new Map<string, { yMin: number | null; yMax: number | null }>();
    for (const row of rows) {
      const range = parseRange(row.max, row.min);
      if (range === 'invalid') invalid.add(row.key);
      else ranges.set(row.key, range);
    }
    this.chartInvalid.set(invalid);
    if (invalid.size || windowSize === null) return;

    this.windowSize.set(windowSize);
    this.store.update({ windowSize });
    const combined = ranges.get(ALL) ?? this.combinedRange();
    ranges.delete(ALL);
    this.session.saveChartRanges(combined, Object.fromEntries(ranges));
    if (this.session.visibleChannels().length > 1 && separate !== this.separate()) this.session.setSeparateCharts(separate);
    this.chartSheet.set(false);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    // Sem binding de value: reescrever o campo a cada tecla quebra a composição do teclado Android.
    const input = this.commandInput()?.nativeElement;
    const text = input?.value.trim();
    if (!input || !text) return;
    input.value = '';
    void this.session.send(text);
  }

  protected saveImage(): void {
    this.menu.set(false);
    if (!this.premium.require()) return;
    const canvases = this.charts()
      .map((chart) => chart.canvas())
      .filter((canvas): canvas is HTMLCanvasElement => !!canvas);
    if (canvases.length) void this.exporter.exportImage(stackCanvases(canvases));
  }

  protected exportCsv(): void {
    this.menu.set(false);
    if (!this.premium.require()) return;
    void this.exporter.exportCsv();
  }

  protected exportLog(): void {
    this.menu.set(false);
    if (!this.premium.require()) return;
    void this.exporter.exportLog();
  }

  protected disconnect(): void {
    this.menu.set(false);
    void this.session.disconnect().then(() => this.ads.onSessionEnded());
  }
}
