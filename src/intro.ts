import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

/** Tempo mínimo da abertura animada, para a animação não aparecer pela metade. */
const MIN_MS = 1400;

/**
 * Abertura animada (#intro em index.html). No Android, troca a tela do sistema por ela
 * sem transição (as duas começam iguais) e só então inicia a animação. Devolve a função
 * que encerra a abertura quando o app estiver pronto.
 */
export function startIntro(): () => void {
  const intro = document.getElementById('intro');
  if (!intro) return () => undefined;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let startedAt = performance.now();
  const play = () => {
    startedAt = performance.now();
    intro.classList.add('play');
  };

  if (Capacitor.isNativePlatform()) {
    // A tela do sistema bloqueia o desenho do WebView até ser escondida.
    void SplashScreen.hide()
      .catch(() => undefined)
      .then(() => setTimeout(play, 50));
  } else {
    play();
  }

  let finished = false;
  return () => {
    if (finished) return;
    finished = true;
    const wait = reduced ? 0 : Math.max(0, MIN_MS - (performance.now() - startedAt));
    setTimeout(() => {
      intro.classList.add('done');
      intro.addEventListener('transitionend', () => intro.remove(), { once: true });
      setTimeout(() => intro.remove(), 600);
    }, wait);
  };
}
