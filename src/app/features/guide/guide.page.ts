import { Location } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { switchMap } from 'rxjs';
import { CodeExample, EXAMPLES, LANGUAGES } from './examples';
import { CodeToken, highlight, TokenKind } from './highlight';

interface GuideBlock {
  h?: string;
  p?: string;
  code?: string;
  steps?: string[];
  rows?: string[][];
}

interface GuideSection {
  id: string;
  title: string;
  blocks: GuideBlock[];
}

type Tab = 'guide' | 'code';
type CopyState = { id: string; ok: boolean } | null;

const TOKEN_COLOR: Record<TokenKind, string> = {
  plain: '#f3f0f7',
  comment: '#8d87a0',
  string: '#6fd3b0',
  number: '#ffc90e',
  keyword: '#9db2ec',
};

@Component({
  selector: 'app-guide',
  host: { class: 'ion-page' },
  imports: [IonIcon, TranslocoPipe],
  template: `
    <div class="h-full flex flex-col overflow-hidden bg-ink-900 text-paper" style="padding-top: var(--ion-safe-area-top, 0)">
      <header class="shrink-0 flex items-center gap-1 px-3 pt-3 pb-2">
        <button (click)="location.back()" [attr.aria-label]="'common.back' | transloco" class="size-11 flex items-center justify-center">
          <ion-icon name="chevron-back-outline" class="text-[22px]" aria-hidden="true" />
        </button>
        <h1 class="text-xl font-semibold">{{ 'guide.title' | transloco }}</h1>
      </header>

      <div role="group" class="relative shrink-0 h-11 mx-4 mb-3 p-[3px] box-border rounded-xl bg-ink-800 grid grid-cols-2">
        <div
          aria-hidden="true"
          class="absolute left-[3px] top-[3px] bottom-[3px] rounded-[9px] bg-ink-600 transition-transform duration-[420ms] ease-fluid"
          style="width: calc((100% - 6px) / 2)"
          [style.transform]="tab() === 'code' ? 'translateX(100%)' : 'none'"
        ></div>
        <button (click)="tab.set('guide')" [attr.aria-pressed]="tab() === 'guide'" class="relative text-sm font-semibold transition-colors" [class]="tab() === 'guide' ? 'text-paper' : 'text-mute'">{{ 'guide.tabGuide' | transloco }}</button>
        <button (click)="tab.set('code')" [attr.aria-pressed]="tab() === 'code'" class="relative text-sm font-semibold transition-colors" [class]="tab() === 'code' ? 'text-paper' : 'text-mute'">{{ 'guide.tabCode' | transloco }}</button>
      </div>

      <main class="grow min-h-0 overflow-y-auto px-4 flex flex-col gap-2" style="padding-bottom: max(20px, var(--ion-safe-area-bottom, 0))">
        @if (tab() === 'guide') {
          @for (section of sections(); track section.id) {
            <section class="shrink-0 rounded-2xl bg-ink-800 border border-ink-700 overflow-hidden">
              <button (click)="toggleSection(section.id)" [attr.aria-expanded]="openSection() === section.id" class="w-full min-h-[56px] flex items-center justify-between gap-3 px-4 text-left text-base font-semibold">
                {{ section.title }}
                <ion-icon name="chevron-forward-outline" class="shrink-0 text-lg text-mute transition-transform duration-300 ease-fluid" [class.rotate-90]="openSection() === section.id" aria-hidden="true" />
              </button>
              <div class="grid transition-[grid-template-rows] duration-[420ms] ease-fluid" [style.grid-template-rows]="openSection() === section.id ? '1fr' : '0fr'">
                <div class="min-h-0 overflow-hidden" [style.visibility]="openSection() === section.id ? 'visible' : 'hidden'">
                  <div class="px-4 pb-4 flex flex-col gap-3 text-[15px] leading-snug text-[#d6d1e0]">
                    @for (block of section.blocks; track $index) {
                      @if (block.h) {
                        <h2 class="mt-1 text-[15px] font-semibold text-paper">{{ block.h }}</h2>
                      }
                      @if (block.p) {
                        <p>{{ block.p }}</p>
                      }
                      @if (block.code) {
                        <!-- Respostas como UNWIRED_ACK;id=...;tcp=8080 quebram depois de cada ";", nunca no meio de um campo. -->
                        <p class="px-3 py-2.5 rounded-[10px] bg-ink-950 font-mono text-xs text-link-300 break-normal">@for (part of block.code.split(';'); track $index) {{{ part }}@if (!$last) {;<wbr />}}</p>
                      }
                      @if (block.steps) {
                        <ol class="m-0 p-0 list-none flex flex-col gap-2.5">
                          @for (step of block.steps; track $index; let number = $index) {
                            <li class="flex gap-2.5">
                              <span class="shrink-0 size-6 rounded-full bg-ink-700 flex items-center justify-center font-mono text-xs text-signal" aria-hidden="true">{{ number + 1 }}</span>
                              <span>{{ step }}</span>
                            </li>
                          }
                        </ol>
                      }
                      @if (block.rows) {
                        <dl class="flex flex-col rounded-xl bg-ink-950 overflow-hidden">
                          @for (row of block.rows; track $index) {
                            <div class="flex flex-col gap-0.5 px-3 py-2.5 border-b border-ink-700 last:border-b-0">
                              <dt class="font-mono text-[13px] text-signal break-all">{{ row[0] }}</dt>
                              <dd class="text-sm text-mute">{{ row[1] }}</dd>
                            </div>
                          }
                        </dl>
                      }
                    }
                  </div>
                </div>
              </div>
            </section>
          }
        } @else {
          <div role="group" class="shrink-0 flex gap-2 pb-1 overflow-x-auto">
            <button (click)="language.set('')" [attr.aria-pressed]="language() === ''" class="shrink-0 min-h-10 px-3.5 rounded-[20px] text-sm font-semibold border transition-colors" [class]="language() === '' ? 'bg-paper text-ink-900 border-paper' : 'border-ink-600'">{{ 'guide.allLanguages' | transloco }}</button>
            @for (item of languages; track item) {
              <button (click)="language.set(item)" [attr.aria-pressed]="language() === item" class="shrink-0 min-h-10 px-3.5 rounded-[20px] text-sm font-semibold border transition-colors" [class]="language() === item ? 'bg-paper text-ink-900 border-paper' : 'border-ink-600'">{{ item }}</button>
            }
          </div>

          @for (example of visibleExamples(); track example.id; let index = $index) {
            @if (index === 0 || visibleExamples()[index - 1].group !== example.group) {
              <h2 class="shrink-0 mt-2 px-1 text-[13px] font-semibold text-mute">{{ 'guide.groups.' + example.group | transloco }}</h2>
            }
            <section class="fade-up shrink-0 rounded-2xl bg-ink-800 border border-ink-700 overflow-hidden">
              <button (click)="toggleExample(example.id)" [attr.aria-expanded]="openExample() === example.id" class="w-full min-h-[72px] flex items-center gap-3 px-4 py-3 text-left">
                <span class="grow min-w-0 flex flex-col gap-1">
                  <span class="text-base font-semibold">{{ 'guide.examples.' + example.id + '.title' | transloco }}</span>
                  <span class="text-[13px] leading-snug text-mute">{{ 'guide.examples.' + example.id + '.desc' | transloco }}</span>
                  <span class="mt-0.5 flex items-center gap-1.5">
                    <span class="font-mono text-[11px] px-1.5 py-0.5 rounded bg-ink-700">{{ example.language }}</span>
                    <span class="font-mono text-[11px] px-1.5 py-0.5 rounded bg-ink-700">{{ example.link }}</span>
                  </span>
                </span>
                <ion-icon name="chevron-forward-outline" class="shrink-0 text-lg text-mute transition-transform duration-300 ease-fluid" [class.rotate-90]="openExample() === example.id" aria-hidden="true" />
              </button>
              @if (openExample() === example.id) {
                <div class="fade-up px-3 pb-3 flex flex-col gap-2">
                  <div class="flex items-center justify-between gap-2 pl-1">
                    <span class="font-mono text-xs text-mute truncate">{{ example.file }}</span>
                    <button (click)="copy(example)" class="shrink-0 min-h-11 px-4 rounded-xl bg-link-400 text-ink-900 text-sm font-semibold">
                      {{ copyLabel(example.id) | transloco }}
                    </button>
                  </div>
                  <pre class="m-0 p-3 rounded-xl bg-ink-950 overflow-x-auto font-mono text-xs leading-[1.55] select-text"><code>@for (token of openTokens(); track $index) {<span [style.color]="color(token)">{{ token.text }}</span>}</code></pre>
                </div>
              }
            </section>
          }
        }
      </main>
    </div>
  `,
})
export class GuidePage {
  protected readonly location = inject(Location);
  private readonly i18n = inject(TranslocoService);

  protected readonly tab = signal<Tab>(inject(ActivatedRoute).snapshot.queryParamMap.get('aba') === 'codigo' ? 'code' : 'guide');
  protected readonly openSection = signal<string | null>('start');
  protected readonly openExample = signal<string | null>(null);
  protected readonly language = signal('');
  protected readonly copied = signal<CopyState>(null);
  protected readonly languages = LANGUAGES;

  // Acompanha a troca de idioma sem recarregar a tela.
  protected readonly sections = toSignal(
    this.i18n.langChanges$.pipe(switchMap((lang) => this.i18n.selectTranslateObject<GuideSection[]>('guide.sections', {}, lang))),
    { initialValue: this.i18n.translateObject('guide.sections') as unknown as GuideSection[] },
  );
  protected readonly visibleExamples = computed(() => {
    const language = this.language();
    return language ? EXAMPLES.filter((example) => example.language === language) : EXAMPLES;
  });
  protected readonly openTokens = computed(() => {
    const example = EXAMPLES.find((item) => item.id === this.openExample());
    return example ? highlight(example.code) : [];
  });

  private copyTimer?: ReturnType<typeof setTimeout>;

  protected toggleSection(id: string): void {
    this.openSection.update((current) => (current === id ? null : id));
  }

  protected toggleExample(id: string): void {
    this.copied.set(null);
    this.openExample.update((current) => (current === id ? null : id));
  }

  protected color(token: CodeToken): string {
    return TOKEN_COLOR[token.kind];
  }

  protected copyLabel(id: string): string {
    const state = this.copied();
    if (state?.id !== id) return 'guide.copy';
    return state.ok ? 'guide.copied' : 'guide.copyFailed';
  }

  protected async copy(example: CodeExample): Promise<void> {
    let ok = true;
    try {
      await navigator.clipboard.writeText(example.code);
    } catch {
      ok = false;
    }
    this.copied.set({ id: example.id, ok });
    clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => this.copied.set(null), 2000);
  }
}
