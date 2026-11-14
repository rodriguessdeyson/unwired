/**
 * IDs de anúncio e de compra. Os blocos são os reais do AdMob (Apps > unWired), e o ID do
 * app fica no APPLICATION_ID de android/app/src/main/AndroidManifest.xml. O build de release
 * falha se encontrar os IDs de teste do Google (ca-app-pub-3940256099942544) ou testAds: true.
 * Não clique nos seus próprios anúncios: isso pode suspender a conta do AdMob. Para testar no
 * aparelho, cadastre-o como dispositivo de teste no AdMob.
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
  /** true só com os IDs de teste do Google; o release não aceita true. */
  testAds: false,
  bannerAdId: 'ca-app-pub-4749632185565734/4499028419',
  interstitialAdId: 'ca-app-pub-4749632185565734/4728073219',
  /** Intervalo mínimo entre intersticiais e quantas desconexões antes do primeiro. */
  interstitialMinGapMs: 4 * 60_000,
  interstitialAfterSessions: 2,
} as const;
