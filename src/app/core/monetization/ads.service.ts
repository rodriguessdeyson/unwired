import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  AdmobConsentStatus,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
} from '@capacitor-community/admob';
import { MONETIZATION } from './monetization.config';
import { PremiumStore } from './premium.store';

export interface InterstitialState {
  sessions: number;
  lastShownAt: number;
}

/** Nunca na primeira sessão, e com folga entre um e outro. */
export function interstitialDue(state: InterstitialState, now: number, after: number, gapMs: number): boolean {
  return state.sessions >= after && now - state.lastShownAt >= gapMs;
}

/**
 * Banner nas abas Dispositivos e Ajustes, e um intersticial ocasional ao
 * desconectar. Nada aparece na Sessão (gráfico e terminal) nem para quem tem o Premium.
 */
@Injectable({ providedIn: 'root' })
export class AdsService {
  private readonly premium = inject(PremiumStore);

  private readonly started = signal(false);
  private readonly wanted = signal(false);
  private readonly margin = signal(0);
  private readonly suppressed = signal(0);
  private readonly bannerHeight = signal(0);

  /** Mostra a entrada "Privacidade dos anúncios" nos Ajustes (exigida na UE/Reino Unido). */
  readonly privacyOptionsRequired = signal(false);

  private readonly showBanner = computed(
    () => this.started() && !this.premium.premium() && this.wanted() && this.suppressed() === 0,
  );
  /** Espaço que as abas reservam acima da barra para o banner nativo. */
  readonly bannerSpace = computed(() => (this.showBanner() ? this.bannerHeight() : 0));

  private starting: Promise<void> | null = null;
  private bannerCreated = false;
  private bannerMargin = -1;
  private interstitialReady = false;
  private interstitial: InterstitialState = { sessions: 0, lastShownAt: 0 };

  constructor() {
    effect(() => {
      const show = this.showBanner();
      const margin = this.margin();
      void this.applyBanner(show, margin);
    });
    effect(() => {
      if (this.premium.premium() && this.bannerCreated) {
        this.bannerCreated = false;
        void AdMob.removeBanner().catch(() => undefined);
      }
    });
  }

  /**
   * Pede o consentimento (UMP) e inicia o SDK. As abas chamam ao entrar, para o
   * formulário de consentimento não aparecer por cima da apresentação inicial.
   */
  start(): Promise<void> {
    if (!Capacitor.isNativePlatform() || this.premium.premium()) return Promise.resolve();
    this.starting ??= this.init().finally(() => {
      if (!this.started()) this.starting = null;
    });
    return this.starting;
  }

  private async init(): Promise<void> {
    try {
      let consent = await AdMob.requestConsentInfo();
      if (consent.isConsentFormAvailable && consent.status === AdmobConsentStatus.REQUIRED) {
        consent = await AdMob.showConsentForm();
      }
      this.privacyOptionsRequired.set(consent.privacyOptionsRequirementStatus === 'REQUIRED');
      if (!consent.canRequestAds || this.premium.premium()) return;
      await AdMob.initialize({ initializeForTesting: MONETIZATION.testAds });
      await AdMob.addListener(BannerAdPluginEvents.SizeChanged, (size) => this.bannerHeight.set(size.height));
      this.started.set(true);
      void this.prepareInterstitial();
    } catch {
      // Sem rede ou sem Play Services: o app segue sem anúncios.
    }
  }

  /** As abas informam se a aba atual aceita banner e a distância da barra até a base da tela. */
  setBannerSlot(wanted: boolean, marginDp: number): void {
    this.wanted.set(wanted);
    this.margin.set(Math.max(0, Math.round(marginDp)));
  }

  /** Um painel aberto esconde o banner, que ficaria por cima dos botões. */
  suppress(): () => void {
    this.suppressed.update((count) => count + 1);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.suppressed.update((count) => Math.max(0, count - 1));
    };
  }

  async showPrivacyOptions(): Promise<void> {
    await AdMob.showPrivacyOptionsForm().catch(() => undefined);
  }

  /** Chamado quando o usuário encerra uma sessão. */
  async onSessionEnded(): Promise<void> {
    this.interstitial.sessions++;
    const now = Date.now();
    if (!this.started() || this.premium.premium() || !this.interstitialReady) return;
    if (!interstitialDue(this.interstitial, now, MONETIZATION.interstitialAfterSessions, MONETIZATION.interstitialMinGapMs)) return;
    this.interstitialReady = false;
    try {
      await AdMob.showInterstitial();
      this.interstitial = { sessions: 0, lastShownAt: now };
    } catch {
      // Falhou ao mostrar: tenta de novo na próxima.
    }
    void this.prepareInterstitial();
  }

  private async prepareInterstitial(): Promise<void> {
    try {
      await AdMob.prepareInterstitial({ adId: MONETIZATION.interstitialAdId, isTesting: MONETIZATION.testAds });
      this.interstitialReady = true;
    } catch {
      this.interstitialReady = false;
    }
  }

  private async applyBanner(show: boolean, margin: number): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      if (!show) {
        if (this.bannerCreated) await AdMob.hideBanner();
        return;
      }
      if (this.bannerCreated && margin === this.bannerMargin) {
        await AdMob.resumeBanner();
        return;
      }
      if (this.bannerCreated) await AdMob.removeBanner();
      this.bannerCreated = true;
      this.bannerMargin = margin;
      await AdMob.showBanner({
        adId: MONETIZATION.bannerAdId,
        isTesting: MONETIZATION.testAds,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position: BannerAdPosition.BOTTOM_CENTER,
        margin,
      });
    } catch {
      this.bannerCreated = false;
    }
  }
}
