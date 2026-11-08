/**
 * IDs de anúncio e de compra. Os blocos abaixo são os de TESTE publicados pelo Google:
 * troque pelos seus antes de publicar (AdMob > Apps > Blocos de anúncios) e
 * troque também o APPLICATION_ID em android/app/src/main/AndroidManifest.xml.
 * Clicar nos seus próprios anúncios reais pode suspender a conta do AdMob.
 */
export const MONETIZATION = {
  /** Produto "único" (não consumível) do Play Console. O preço (R$ 4,99) é definido lá. */
  premiumProductId: 'unwired_premium',
  /**
   * SHA-256 do código de liberação informado ao revisor do Google Play em
   * "Conteúdo do app > Detalhes do login". O código em si não fica no repositório.
   * Para trocar: gere um novo código, calcule o SHA-256 e atualize aqui e no Console.
   */
  unlockCodeSha256: '10c981c65110b55d7889e55fd7527327a4368004ba17ba7892035d9070270b4f',
  /** Mantenha true até trocar os IDs; com IDs reais, false. */
  testAds: true,
  bannerAdId: 'ca-app-pub-3940256099942544/9214589741',
  interstitialAdId: 'ca-app-pub-3940256099942544/1033173712',
  /** Intervalo mínimo entre intersticiais e quantas desconexões antes do primeiro. */
  interstitialMinGapMs: 4 * 60_000,
  interstitialAfterSessions: 2,
} as const;
