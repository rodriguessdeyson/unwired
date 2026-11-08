import { Injectable, signal } from '@angular/core';

const KEYBOARD_MIN_HEIGHT = 120;
const PHONE_LANDSCAPE_MAX_HEIGHT = 500;

/** O teclado encolhe a tela; uma barra do sistema mudando de tamanho não chega a tanto. */
export function isKeyboardOpen(fullHeight: number, currentHeight: number): boolean {
  return fullHeight - currentHeight >= KEYBOARD_MIN_HEIGHT;
}

/**
 * Estado da tela que o CSS sozinho não acerta. Com o teclado aberto, a tela pode
 * ficar mais larga que alta, e media queries de orientação viram "paisagem".
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  readonly keyboard = signal(false);
  readonly landscape = signal(false);

  private readonly fullHeight = { portrait: 0, landscape: 0 };

  constructor() {
    window.addEventListener('resize', () => this.measure());
    screen.orientation?.addEventListener('change', () => this.measure());
    document.addEventListener('scroll', (event) => this.undoStrayScroll(event), true);
    document.addEventListener('focusin', (event) => this.revealFocused(event));
    this.measure();
  }

  private orientation(): 'portrait' | 'landscape' {
    const type = screen.orientation?.type ?? (innerWidth > innerHeight ? 'landscape' : 'portrait');
    return type.startsWith('landscape') ? 'landscape' : 'portrait';
  }

  private measure(): void {
    const orientation = this.orientation();
    this.fullHeight[orientation] = Math.max(this.fullHeight[orientation], innerHeight);
    const keyboard = isKeyboardOpen(this.fullHeight[orientation], innerHeight);
    const landscape = orientation === 'landscape' && this.fullHeight.landscape <= PHONE_LANDSCAPE_MAX_HEIGHT;
    this.keyboard.set(keyboard);
    this.landscape.set(landscape);
    document.documentElement.classList.toggle('keyboard-open', keyboard);
    document.documentElement.classList.toggle('phone-landscape', landscape);
  }

  /** Ao focar um campo, o navegador rola até containers com overflow hidden, e a tela inteira salta. */
  private undoStrayScroll(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
      return;
    }
    const style = getComputedStyle(target);
    if (style.overflowY === 'hidden' && target.scrollTop) target.scrollTop = 0;
    if (style.overflowX === 'hidden' && target.scrollLeft) target.scrollLeft = 0;
  }

  private revealFocused(event: FocusEvent): void {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || target.closest('[role="dialog"]')) return;
    // Espera o teclado abrir e a tela encolher.
    setTimeout(() => target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 350);
  }
}
