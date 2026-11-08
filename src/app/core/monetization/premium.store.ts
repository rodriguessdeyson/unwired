import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { NativePurchases, PURCHASE_TYPE, type Transaction } from '@capgo/native-purchases';
import { MONETIZATION } from './monetization.config';

const PREMIUM_KEY = 'premium';
const CODE_KEY = 'premiumCode';

export type PurchaseResult = 'ok' | 'cancelled' | 'pending' | 'error';

/** No Android, só purchaseState "1" (PURCHASED) vale; "pendente" ainda não foi pago. */
export function ownsPremium(purchases: readonly Pick<Transaction, 'productIdentifier' | 'purchaseState'>[], productId: string): boolean {
  return purchases.some((purchase) => purchase.productIdentifier === productId && (purchase.purchaseState === undefined || purchase.purchaseState === '1'));
}

/** Normaliza o que foi digitado (maiúsculas, sem espaços) e calcula o SHA-256 em hexadecimal. */
export async function hashUnlockCode(input: string): Promise<string> {
  const normalized = input.trim().toUpperCase().replace(/\s+/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Compra única pelo Google Play, sem servidor. O resultado fica salvo para o app
 * abrir sem anúncios mesmo offline e é conferido com o Play a cada abertura.
 */
@Injectable({ providedIn: 'root' })
export class PremiumStore {
  readonly premium = signal(false);
  /** Preço localizado vindo do Play (ex.: "R$ 4,99"); vazio até carregar. */
  readonly price = signal('');
  readonly available = signal(false);
  readonly busy = signal(false);
  readonly paywallOpen = signal(false);
  /** Verdadeiro depois que o estado salvo foi lido: os anúncios esperam por isso. */
  readonly ready = signal(false);

  /** Compra confirmada pelo Play e liberação por código são guardadas separadamente. */
  private purchased = false;
  private unlocked = false;

  async load(): Promise<void> {
    const [saved, code] = await Promise.all([Preferences.get({ key: PREMIUM_KEY }), Preferences.get({ key: CODE_KEY })]);
    this.purchased = saved.value === '1';
    this.unlocked = code.value === MONETIZATION.unlockCodeSha256;
    this.premium.set(this.purchased || this.unlocked);
    this.ready.set(true);
    if (Capacitor.isNativePlatform()) void this.refresh();
  }

  /** Abre a tela de compra quando falta o Premium. Retorna se já pode seguir. */
  require(): boolean {
    if (this.premium()) return true;
    this.paywallOpen.set(true);
    return false;
  }

  async buy(): Promise<PurchaseResult> {
    if (!Capacitor.isNativePlatform() || this.busy()) return 'error';
    this.busy.set(true);
    try {
      const purchase = await NativePurchases.purchaseProduct({
        productIdentifier: MONETIZATION.premiumProductId,
        productType: PURCHASE_TYPE.INAPP,
      });
      if (purchase.purchaseState && purchase.purchaseState !== '1') return 'pending';
      await this.grant(true);
      return 'ok';
    } catch (error) {
      return /cancel/i.test(String((error as { message?: string })?.message ?? error)) ? 'cancelled' : 'error';
    } finally {
      this.busy.set(false);
    }
  }

  /**
   * Liberação sem compra, para a revisão do Google Play. Não há conta: o resultado
   * fica só neste aparelho. Trocar o código numa versão nova invalida o antigo.
   */
  async redeem(input: string): Promise<boolean> {
    if (!input.trim()) return false;
    const hash = await hashUnlockCode(input);
    if (hash !== MONETIZATION.unlockCodeSha256) return false;
    this.unlocked = true;
    await Preferences.set({ key: CODE_KEY, value: hash });
    this.premium.set(true);
    this.paywallOpen.set(false);
    return true;
  }

  /** Recupera a compra feita em outro aparelho ou depois de reinstalar. */
  async restore(): Promise<boolean> {
    if (!Capacitor.isNativePlatform() || this.busy()) return false;
    this.busy.set(true);
    try {
      await NativePurchases.restorePurchases();
      return await this.refresh();
    } catch {
      return false;
    } finally {
      this.busy.set(false);
    }
  }

  private async refresh(): Promise<boolean> {
    try {
      const { isBillingSupported } = await NativePurchases.isBillingSupported();
      this.available.set(isBillingSupported);
      if (!isBillingSupported) return this.premium();
      const [{ purchases }, product] = await Promise.all([
        NativePurchases.getPurchases({ productType: PURCHASE_TYPE.INAPP }),
        NativePurchases.getProduct({ productIdentifier: MONETIZATION.premiumProductId, productType: PURCHASE_TYPE.INAPP }).catch(() => null),
      ]);
      if (product) this.price.set(product.product.priceString);
      // Reembolsos somem da lista: por isso a resposta do Play também pode tirar o Premium.
      await this.grant(ownsPremium(purchases, MONETIZATION.premiumProductId));
      return this.premium();
    } catch {
      // Sem rede ou sem Play: mantém o que estava salvo.
      return this.premium();
    }
  }

  private async grant(value: boolean): Promise<void> {
    this.purchased = value;
    this.premium.set(value || this.unlocked);
    if (this.premium()) this.paywallOpen.set(false);
    await Preferences.set({ key: PREMIUM_KEY, value: value ? '1' : '0' });
  }
}
