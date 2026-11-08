import { afterNextRender, Component, DestroyRef, effect, ElementRef, HostListener, inject, input, output, signal, viewChild } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { AdsService } from '../core/ads.service';
import { UnwiredSerial } from '../core/native-serial';

const CLOSE_DISTANCE = 80;
/** Duração da subida. O foco só vem depois, para o teclado não abrir no meio da animação. */
const OPEN_MS = 420;

interface BackButtonEvent extends Event {
  detail: { register(priority: number, handler: () => void): void };
}

/**
 * Painel que sobe da base da tela. Vai para o ion-app, para cobrir também a barra
 * de abas. Fecha pelo fundo, arrastando a alça ou com o botão Voltar.
 */
@Component({
  selector: 'app-bottom-sheet',
  host: { style: 'display: contents' },
  template: `
    <div
      (click)="closed.emit()"
      aria-hidden="true"
      class="absolute inset-0 z-[1000] bg-ink-950/70 transition-opacity duration-300"
      [style.opacity]="open() ? 1 : 0"
      [style.pointer-events]="open() ? 'auto' : 'none'"
    ></div>
    <section
      #panel
      role="dialog"
      aria-modal="true"
      [attr.aria-label]="title()"
      class="absolute inset-x-0 bottom-0 z-[1001] max-h-[85%] flex flex-col rounded-t-3xl bg-ink-800 text-paper border-t border-ink-600"
      style="will-change: transform"
      [style.transform]="open() ? 'translateY(' + dragOffset() + 'px)' : 'translateY(105%)'"
      [style.visibility]="open() ? 'visible' : 'hidden'"
      [style.transition]="dragging() ? 'none' : 'transform 420ms cubic-bezier(0.22, 1, 0.36, 1), visibility 420ms'"
    >
      <div
        (pointerdown)="dragStart($event)"
        (pointermove)="dragMove($event)"
        (pointerup)="dragEnd()"
        (pointercancel)="dragEnd()"
        class="shrink-0 px-5 pt-2.5 cursor-grab"
        style="touch-action: none"
      >
        <div class="mx-auto w-9 h-1 rounded-sm bg-ink-500" aria-hidden="true"></div>
        <h2 class="pt-3.5 pb-2 text-xl font-semibold">{{ title() }}</h2>
      </div>
      <!-- O pt-1 reserva o espaço do anel de foco, que esta área rolável cortaria. -->
      <div class="min-h-0 overflow-y-auto px-5 pt-1" style="padding-bottom: max(20px, var(--ion-safe-area-bottom, 0))">
        <ng-content />
      </div>
    </section>
  `,
})
export class BottomSheetComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly closed = output<void>();

  protected readonly dragOffset = signal(0);
  protected readonly dragging = signal(false);

  private readonly panel = viewChild.required<ElementRef<HTMLElement>>('panel');
  private dragStartY = 0;

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => document.querySelector('ion-app')?.appendChild(host));
    destroyRef.onDestroy(() => host.remove());

    // O banner nativo fica acima do WebView e cobriria os botões do painel.
    const ads = inject(AdsService);
    effect((onCleanup) => {
      if (this.open()) onCleanup(ads.suppress());
    });

    effect((onCleanup) => {
      if (!this.open()) {
        // Sem isso o teclado continuaria aberto depois de o painel fechar.
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && this.panel().nativeElement.contains(focused)) focused.blur();
        return;
      }
      this.dragOffset.set(0);
      const timer = setTimeout(() => {
        const field = this.panel().nativeElement.querySelector<HTMLElement>('[data-autofocus]');
        if (!field) return;
        field.focus({ preventScroll: true });
        // O WebView do Android não abre o teclado em foco feito por código.
        if (Capacitor.isNativePlatform()) void UnwiredSerial.showKeyboard();
      }, OPEN_MS);
      onCleanup(() => clearTimeout(timer));
    });
  }

  @HostListener('document:ionBackButton', ['$event'])
  protected onBackButton(event: Event): void {
    if (this.open()) (event as BackButtonEvent).detail.register(150, () => this.closed.emit());
  }

  @HostListener('document:keydown.escape')
  protected onEscape(): void {
    if (this.open()) this.closed.emit();
  }

  protected dragStart(event: PointerEvent): void {
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragStartY = event.clientY;
    this.dragging.set(true);
  }

  protected dragMove(event: PointerEvent): void {
    if (this.dragging()) this.dragOffset.set(Math.max(0, event.clientY - this.dragStartY));
  }

  protected dragEnd(): void {
    if (!this.dragging()) return;
    this.dragging.set(false);
    if (this.dragOffset() > CLOSE_DISTANCE) this.closed.emit();
    else this.dragOffset.set(0);
  }
}
