import { Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe } from '@jsverse/transloco';
import { SettingsStore } from '../../core/settings/settings.store';

const LAST_STEP = 3;

@Component({
  selector: 'app-onboarding',
  host: { class: 'ion-page' },
  imports: [IonIcon, TranslocoPipe],
  template: `
    <div class="h-full flex flex-col overflow-hidden bg-ink-900 text-paper" style="padding-top: var(--ion-safe-area-top, 0)">
      <div class="min-h-16 flex items-center justify-between px-3 pt-2 shrink-0">
        <button
          (click)="back()"
          [attr.aria-label]="'onboarding.previous' | transloco"
          [style.opacity]="step() === 0 ? 0 : 1"
          [style.pointer-events]="step() === 0 ? 'none' : 'auto'"
          class="size-11 flex items-center justify-center transition-opacity"
        >
          <ion-icon name="chevron-back-outline" class="text-[22px]" aria-hidden="true" />
        </button>
        @if (step() < last) {
          <button (click)="step.set(last)" class="min-h-11 px-3 text-link-300 text-[15px] font-semibold">
            {{ 'onboarding.skip' | transloco }}
          </button>
        }
      </div>

      <div class="grow min-h-0 overflow-hidden">
        <div
          class="h-full flex transition-transform duration-500 ease-fluid"
          style="width: 400%"
          [style.transform]="'translateX(' + -25 * step() + '%)'"
        >
          <!-- Marca -->
          <section [attr.aria-hidden]="step() !== 0" class="w-1/4 px-6 flex flex-col overflow-y-auto">
            <div class="h-[300px] shrink-0 flex flex-col items-center justify-center gap-7">
              <svg width="140" height="140" viewBox="0 0 36 36" aria-hidden="true">
                <rect width="36" height="36" rx="9" fill="#738DCA" />
                <rect class="ob-bar" x="10" y="17" width="4" height="10" rx="1" fill="#121018" />
                <rect class="ob-bar" style="animation-delay: 0.14s" x="16" y="9" width="4" height="18" rx="1" fill="#121018" />
                <rect class="ob-bar" style="animation-delay: 0.28s" x="22" y="20" width="4" height="7" rx="1" fill="#FFC90E" />
              </svg>
              <svg class="max-w-full" width="300" height="56" viewBox="0 0 300 56" aria-hidden="true">
                <path class="ob-trace" pathLength="1" d="M0 40 L24 34 L48 18 L72 12 L96 24 L120 42 L144 36 L168 16 L192 8 L216 24 L240 42 L264 30 L300 14" fill="none" stroke="#FFC90E" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />
              </svg>
            </div>
            <h1 class="mt-4 mb-3 text-[38px] leading-[1.05] font-bold tracking-tight">{{ 'onboarding.t1' | transloco }}</h1>
            <p class="text-[17px] leading-snug text-mute">{{ 'onboarding.b1' | transloco }}</p>
          </section>

          <!-- Conexões -->
          <section [attr.aria-hidden]="step() !== 1" class="w-1/4 px-6 flex flex-col overflow-y-auto">
            <div class="relative h-[300px] shrink-0 overflow-hidden">
              @for (delay of [0, 1, 2]; track delay) {
                <div class="ob-ring absolute left-1/2 top-1/2 -ml-[130px] -mt-[130px] size-[260px] rounded-full border border-link-400" [style.animation-delay.s]="delay"></div>
              }
              <svg class="absolute inset-0 size-full" viewBox="0 0 342 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
                <g fill="none" stroke="#9DB2EC" stroke-width="2" stroke-linecap="round">
                  <path class="ob-flow" d="M171 150 L70 62" />
                  <path class="ob-flow" d="M171 150 L274 96" />
                  <path class="ob-flow" d="M171 150 L180 250" />
                </g>
              </svg>
              <div class="absolute left-1/2 top-1/2 -ml-[30px] -mt-[30px] size-[60px] rounded-[18px] bg-brand flex items-center justify-center">
                <svg width="30" height="30" viewBox="0 0 36 36" aria-hidden="true"><rect x="8" y="17" width="5" height="12" rx="1" fill="#121018" /><rect x="16" y="7" width="5" height="22" rx="1" fill="#121018" /><rect x="24" y="20" width="5" height="9" rx="1" fill="#FFC90E" /></svg>
              </div>
              @for (chip of chips; track chip.name) {
                <div class="ob-chip absolute px-3.5 py-2.5 rounded-xl bg-ink-800 border border-ink-600" [style.left]="chip.left" [style.right]="chip.right" [style.top.px]="chip.top" [style.animation-delay.s]="chip.delay">
                  <p class="font-semibold text-[15px]">{{ chip.name }}</p>
                  <p class="mt-0.5 font-mono text-xs text-mute">{{ chip.kind }}</p>
                </div>
              }
            </div>
            <h1 class="mt-4 mb-3 text-[38px] leading-[1.05] font-bold tracking-tight">{{ 'onboarding.t2' | transloco }}</h1>
            <p class="text-[17px] leading-snug text-mute">{{ 'onboarding.b2' | transloco }}</p>
          </section>

          <!-- Gesto -->
          <section [attr.aria-hidden]="step() !== 2" class="w-1/4 px-6 flex flex-col overflow-y-auto">
            <div class="h-[300px] shrink-0 flex items-center justify-center">
              <div class="w-[220px] h-[290px] box-border p-2.5 rounded-[28px] bg-ink-800 border border-ink-600 flex flex-col gap-2">
                <div class="ob-mini-chart shrink-0 rounded-2xl bg-ink-950 overflow-hidden flex">
                  <svg class="size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                    <polyline points="0,70 12,50 24,28 36,38 48,68 60,60 72,26 84,20 100,50" fill="none" stroke="#FFC90E" stroke-width="2" vector-effect="non-scaling-stroke" />
                    <polyline points="0,40 14,44 28,36 42,48 56,42 70,52 84,44 100,50" fill="none" stroke="#9DB2EC" stroke-width="2" vector-effect="non-scaling-stroke" />
                  </svg>
                </div>
                <div class="grow min-h-0 rounded-2xl bg-ink-950 p-2.5 flex flex-col gap-1.5 overflow-hidden font-mono text-[11px]">
                  <div class="self-center w-8 h-1 rounded-sm bg-ink-600 shrink-0"></div>
                  <div><span class="text-signal">RX</span> T=42.10 H=61.2</div>
                  <div><span class="text-link-400">TX</span> LED1=ON</div>
                  <div><span class="text-signal">RX</span> T=42.31 H=60.9</div>
                  <div><span class="text-signal">RX</span> T=42.54 H=60.8</div>
                  <div><span class="text-link-400">TX</span> STATUS</div>
                </div>
              </div>
            </div>
            <h1 class="mt-4 mb-3 text-[38px] leading-[1.05] font-bold tracking-tight">{{ 'onboarding.t3' | transloco }}</h1>
            <p class="text-[17px] leading-snug text-mute">{{ 'onboarding.b3' | transloco }}</p>
          </section>

          <!-- Permissões -->
          <section [attr.aria-hidden]="step() !== 3" class="w-1/4 px-6 flex flex-col overflow-y-auto">
            <h1 class="mt-4 mb-3 text-[38px] leading-[1.05] font-bold tracking-tight">{{ 'onboarding.t4' | transloco }}</h1>
            <p class="text-[17px] leading-snug text-mute">{{ 'onboarding.b4' | transloco }}</p>
            <ul class="mt-7 flex flex-col gap-3.5">
              @for (item of ['p1', 'p2', 'p3']; track item) {
                <li class="p-4 rounded-2xl bg-ink-800 border border-ink-700">
                  <h2 class="text-base font-semibold">{{ 'onboarding.' + item | transloco }}</h2>
                  <p class="mt-1 text-sm leading-snug text-mute">{{ 'onboarding.' + item + 'b' | transloco }}</p>
                </li>
              }
            </ul>
          </section>
        </div>
      </div>

      <div class="shrink-0 px-6 pt-3 flex flex-col gap-3.5" style="padding-bottom: max(24px, var(--ion-safe-area-bottom, 0))">
        <div role="img" [attr.aria-label]="progressLabel()" class="flex gap-1.5 justify-center">
          @for (dot of [0, 1, 2, 3]; track dot) {
            <div
              class="h-1.5 w-7 rounded-sm transition-colors duration-300"
              [style.background]="dot <= step() ? '#FFC90E' : '#38324A'"
            ></div>
          }
        </div>
        @if (step() < last) {
          <button (click)="step.set(step() + 1)" class="min-h-[54px] rounded-[14px] bg-link-400 text-ink-900 text-base font-semibold">
            {{ 'onboarding.continue' | transloco }}
          </button>
        } @else {
          <button (click)="finish('/busca')" class="min-h-[54px] rounded-[14px] bg-link-400 text-ink-900 text-base font-semibold">
            {{ 'onboarding.allow' | transloco }}
          </button>
          <button (click)="finish('/tabs/dispositivos')" class="min-h-11 text-link-300 text-[15px] font-medium">
            {{ 'onboarding.notNow' | transloco }}
          </button>
        }
      </div>
    </div>
  `,
})
export class OnboardingPage {
  private readonly store = inject(SettingsStore);
  private readonly router = inject(Router);

  protected readonly last = LAST_STEP;
  protected readonly step = signal(0);
  protected readonly progressLabel = computed(() => `${this.step() + 1} / ${LAST_STEP + 1}`);
  protected readonly chips = [
    { name: 'HC-05', kind: 'SPP', left: '4px', right: 'auto', top: 36, delay: 0 },
    { name: 'ESP32', kind: 'BLE', left: 'auto', right: '4px', top: 66, delay: 0.6 },
    { name: 'ESP8266', kind: 'WIFI', left: 'calc(50% - 46px)', right: 'auto', top: 228, delay: 1.2 },
  ];

  protected back(): void {
    this.step.update((value) => Math.max(0, value - 1));
  }

  protected finish(target: string): void {
    this.store.update({ onboarded: true });
    void this.router.navigateByUrl(target, { replaceUrl: true });
  }
}
