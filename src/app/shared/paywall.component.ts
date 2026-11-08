import { Component, effect, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { PremiumStore, PurchaseResult } from '../core/premium.store';
import { BottomSheetComponent } from './bottom-sheet.component';

type Notice = '' | 'pending' | 'error' | 'restoreNone' | 'web' | 'codeInvalid';

/** Painel de compra do Premium. Fica nas abas e abre por PremiumStore.require(). */
@Component({
  selector: 'app-paywall',
  host: { style: 'display: contents' },
  imports: [BottomSheetComponent, TranslocoPipe],
  template: `
    <app-bottom-sheet [open]="store.paywallOpen()" [title]="'premium.title' | transloco" (closed)="store.paywallOpen.set(false)">
      <ul class="flex flex-col gap-3 pb-5 text-[15px]">
        @for (item of benefits; track item) {
          <li class="flex items-start gap-3">
            <span aria-hidden="true" class="mt-[7px] shrink-0 size-2 rounded-full bg-link-400"></span>
            <span>{{ item | transloco }}</span>
          </li>
        }
      </ul>
      @if (notice()) {
        <p role="status" class="pb-3 text-sm" [class]="notice() === 'error' || notice() === 'codeInvalid' ? 'text-err' : 'text-mute'">{{ 'premium.' + notice() | transloco }}</p>
      }
      <button (click)="buy()" [disabled]="store.busy()" class="w-full min-h-[52px] rounded-xl bg-link-400 text-ink-900 text-base font-semibold disabled:opacity-60">
        {{ store.price() ? ('premium.buyPrice' | transloco: { price: store.price() }) : ('premium.buy' | transloco) }}
      </button>
      <button (click)="restore()" [disabled]="store.busy()" class="w-full min-h-[48px] mt-1.5 text-[15px] text-link-400 font-semibold disabled:opacity-60">{{ 'premium.restore' | transloco }}</button>
      <p class="pt-1 text-center text-xs text-mute">{{ 'premium.once' | transloco }}</p>
      @if (codeOpen()) {
        <form (submit)="redeem($event)" class="flex gap-2 pt-4" novalidate>
          <input [attr.aria-label]="'premium.codeLabel' | transloco" [placeholder]="'premium.codeLabel' | transloco" autocomplete="off" autocapitalize="characters" autocorrect="off" spellcheck="false" class="min-w-0 grow h-11 box-border px-3 rounded-xl border border-ink-600 bg-ink-900 font-mono text-sm uppercase" />
          <button type="submit" [disabled]="store.busy()" class="shrink-0 h-11 px-4 rounded-xl border border-ink-600 text-sm font-semibold disabled:opacity-60">{{ 'premium.codeApply' | transloco }}</button>
        </form>
      } @else {
        <button (click)="codeOpen.set(true)" class="w-full min-h-[44px] mt-2 text-sm text-mute underline underline-offset-2">{{ 'premium.haveCode' | transloco }}</button>
      }
    </app-bottom-sheet>
  `,
})
export class PaywallComponent {
  protected readonly store = inject(PremiumStore);
  protected readonly notice = signal<Notice>('');
  protected readonly codeOpen = signal(false);
  protected readonly benefits = ['premium.noAds', 'premium.export', 'premium.support'];

  constructor() {
    effect(() => {
      if (this.store.paywallOpen()) {
        this.notice.set('');
        this.codeOpen.set(false);
      }
    });
  }

  protected async buy(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.notice.set('web');
      return;
    }
    const result: PurchaseResult = await this.store.buy();
    this.notice.set(result === 'pending' ? 'pending' : result === 'error' ? 'error' : '');
  }

  protected async redeem(event: Event): Promise<void> {
    event.preventDefault();
    const field = (event.target as HTMLFormElement).querySelector('input');
    const ok = await this.store.redeem(field?.value ?? '');
    this.notice.set(ok ? '' : 'codeInvalid');
  }

  protected async restore(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      this.notice.set('web');
      return;
    }
    const restored = await this.store.restore();
    this.notice.set(restored ? '' : 'restoreNone');
  }
}
