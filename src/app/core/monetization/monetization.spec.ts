import { describe, expect, it } from 'vitest';
import { interstitialDue } from './ads.service';
import { MONETIZATION } from './monetization.config';
import { hashUnlockCode, ownsPremium } from './premium.store';

describe('ownsPremium', () => {
  const id = 'unwired_premium';

  it('libera com a compra concluída', () => {
    expect(ownsPremium([{ productIdentifier: id, purchaseState: '1' }], id)).toBe(true);
  });

  it('não libera compra pendente nem outro produto', () => {
    expect(ownsPremium([{ productIdentifier: id, purchaseState: '2' }], id)).toBe(false);
    expect(ownsPremium([{ productIdentifier: 'outro', purchaseState: '1' }], id)).toBe(false);
    expect(ownsPremium([], id)).toBe(false);
  });
});

describe('interstitialDue', () => {
  const gap = 4 * 60_000;

  it('não aparece nas primeiras sessões', () => {
    expect(interstitialDue({ sessions: 1, lastShownAt: 0 }, 10 * gap, 2, gap)).toBe(false);
    expect(interstitialDue({ sessions: 2, lastShownAt: 0 }, 10 * gap, 2, gap)).toBe(true);
  });

  it('respeita o intervalo mínimo', () => {
    const now = 100 * gap;
    expect(interstitialDue({ sessions: 5, lastShownAt: now - gap + 1 }, now, 2, gap)).toBe(false);
    expect(interstitialDue({ sessions: 5, lastShownAt: now - gap }, now, 2, gap)).toBe(true);
  });
});

describe('hashUnlockCode', () => {
  it('calcula o SHA-256 ignorando maiúsculas e espaços', async () => {
    const abc = 'b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78';
    expect(await hashUnlockCode('ABC')).toBe(abc);
    expect(await hashUnlockCode('  a b c ')).toBe(abc);
  });

  it('recusa um código errado', async () => {
    expect(await hashUnlockCode('REVIEW-ERRADO')).not.toBe(MONETIZATION.unlockCodeSha256);
  });
});

describe('IDs de anúncio', () => {
  const googleTest = 'ca-app-pub-3940256099942544';
  const ids = [MONETIZATION.bannerAdId, MONETIZATION.interstitialAdId];

  it('testAds acompanha os IDs: só true com os IDs de teste do Google', () => {
    for (const id of ids) expect(id.startsWith(googleTest)).toBe(MONETIZATION.testAds);
  });

  it('os blocos são da mesma conta do AdMob', () => {
    const publishers = new Set(ids.map((id) => id.split('/')[0]));
    expect(publishers.size).toBe(1);
  });
});
