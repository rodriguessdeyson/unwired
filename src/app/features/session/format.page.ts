import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { ParseMode } from '../../core/models';
import { parseLine } from '../../core/data/parser';
import { SessionStore } from '../../core/session/session.store';
import { SettingsStore } from '../../core/settings/settings.store';
import { formatValue } from '../devices/devices.page';

@Component({
  selector: 'app-format',
  host: { class: 'ion-page' },
  imports: [IonIcon, TranslocoPipe],
  template: `
    <div class="h-full flex flex-col overflow-hidden bg-ink-900 text-paper" style="padding-top: var(--ion-safe-area-top, 0)">
      <header class="shrink-0 flex items-center gap-1 px-3 pt-3 pb-2">
        <button (click)="location.back()" [attr.aria-label]="'common.back' | transloco" class="size-11 flex items-center justify-center">
          <ion-icon name="chevron-back-outline" class="text-[22px]" aria-hidden="true" />
        </button>
        <div class="min-w-0">
          <h1 class="text-xl font-semibold">{{ 'format.title' | transloco }}</h1>
          <p class="mt-px text-[13px] text-mute truncate">{{ session.device()?.name ?? ('format.defaultFor' | transloco) }}</p>
        </div>
      </header>

      <main class="grow min-h-0 overflow-y-auto px-5 pt-2 pb-6 flex flex-col gap-5" style="padding-bottom: max(24px, var(--ion-safe-area-bottom, 0))">
        <section class="shrink-0 flex flex-col gap-2">
          <label for="sample" class="text-sm font-semibold">{{ 'format.sample' | transloco }}</label>
          <input id="sample" [value]="sample()" (input)="sample.set($any($event.target).value)" autocomplete="off" autocapitalize="off" spellcheck="false" class="h-[50px] box-border px-3.5 rounded-xl border border-ink-600 bg-ink-950 font-mono text-sm" />
          <div role="status" class="min-h-[92px] box-border p-3 rounded-[14px] bg-ink-800 border border-ink-700 flex flex-col gap-2">
            @if (result().values.length) {
              <span class="text-[13px] font-semibold text-ok">
                @if (mode() === 'auto') {
                  {{ 'format.detected' | transloco: { count: result().values.length, format: (formatName() | transloco) } }}
                } @else {
                  {{ 'format.channels' | transloco: { count: result().values.length } }}
                }
              </span>
              <div class="flex flex-wrap gap-1.5">
                @for (value of result().values; track value.key) {
                  <span class="px-2.5 py-1.5 rounded-lg bg-ink-950 font-mono text-[13px]"><span class="text-mute">{{ value.key }}</span> <span class="text-signal">{{ format(value.value) }}</span></span>
                }
              </div>
            } @else {
              <span class="text-[13px] font-semibold text-mute">{{ 'format.none' | transloco }}</span>
            }
          </div>
        </section>

        <section role="radiogroup" [attr.aria-label]="'format.title' | transloco" class="shrink-0 flex flex-col bg-ink-800 border border-ink-700 rounded-2xl overflow-hidden">
          @for (option of options; track option.id) {
            <button role="radio" [attr.aria-checked]="mode() === option.id" (click)="choose(option.id)" class="min-h-[62px] flex items-center gap-3 px-3.5 py-2 border-b border-ink-700 text-left">
              <span aria-hidden="true" class="shrink-0 size-5 box-border rounded-full transition-all" [style.border]="mode() === option.id ? '6px solid #9DB2EC' : '2px solid #5A5370'"></span>
              <span class="min-w-0 flex flex-col gap-0.5">
                <span class="text-[15px] font-semibold">{{ 'format.' + option.id | transloco }}</span>
                <span class="font-mono text-xs text-mute">{{ option.example ?? ('format.' + option.id + 'Ex' | transloco) }}</span>
              </span>
            </button>
          }
        </section>
      </main>
    </div>
  `,
})
export class FormatPage {
  protected readonly session = inject(SessionStore);
  private readonly store = inject(SettingsStore);
  protected readonly location = inject(Location);
  protected readonly format = formatValue;

  protected readonly options: { id: ParseMode; example?: string }[] = [
    { id: 'auto' },
    { id: 'chaves', example: 'T=23.41 H=60.90' },
    { id: 'csv', example: '23.41,60.90' },
    { id: 'json', example: '{"temp":23.41}' },
    { id: 'xml', example: '<temp>23.41</temp>' },
    { id: 'numero', example: '23.41' },
    { id: 'legado' },
  ];

  protected readonly mode = signal<ParseMode>(this.session.profile()?.format ?? this.store.settings().defaultFormat);
  protected readonly sample = signal(this.lastReceived() ?? 'T=23.41 H=60.90');
  protected readonly result = computed(() => parseLine(this.mode(), this.sample()));
  protected readonly formatName = computed(() => `format.${this.result().format ?? 'auto'}`);

  protected choose(mode: ParseMode): void {
    this.mode.set(mode);
    if (this.session.profile()) this.session.setFormat(mode);
    else this.store.update({ defaultFormat: mode });
  }

  private lastReceived(): string | undefined {
    return [...this.session.log()].reverse().find((line) => line.dir === 'rx')?.text;
  }
}
