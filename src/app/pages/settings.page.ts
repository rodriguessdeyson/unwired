import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonIcon } from '@ionic/angular';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { resolveLanguage } from '../app.config';
import { LineEnding } from '../core/models';
import { parseBounded } from '../core/settings-input';
import { AdsService } from '../core/ads.service';
import { PremiumStore } from '../core/premium.store';
import { AppSettings, SettingsStore } from '../core/settings.store';
import { BottomSheetComponent } from '../shared/bottom-sheet.component';

type NumberKey = 'historyChars' | 'discoveryPort' | 'streamPort';
type TextKey = 'startCommand' | 'stopCommand';

interface ChoiceOption {
  id: string;
  label: string;
}

type Editor =
  | { kind: 'number'; title: string; key: NumberKey; min: number; max: number; value: string }
  | { kind: 'text'; title: string; key: TextKey; value: string }
  | { kind: 'choice'; title: string; options: ChoiceOption[]; selected: string; apply: (id: string) => void };

const ENDINGS: { id: LineEnding; label: string }[] = [
  { id: 'crlf', label: 'CRLF' },
  { id: 'lf', label: 'LF' },
  { id: 'cr', label: 'CR' },
  { id: 'none', label: 'settings.none' },
];
const LANGUAGES = [
  { id: '', label: 'settings.langAuto' },
  { id: 'pt', label: 'Português' },
  { id: 'en', label: 'English' },
  { id: 'es', label: 'Español' },
];

const FIELD_CLASS = 'w-full h-[52px] box-border px-3.5 rounded-xl border border-ink-600 bg-ink-900 font-mono text-base';

@Component({
  selector: 'app-settings',
  host: { class: 'ion-page' },
  imports: [BottomSheetComponent, IonIcon, TranslocoPipe],
  template: `
    <div class="relative h-full flex flex-col overflow-hidden bg-ink-900 text-paper" style="padding-top: var(--ion-safe-area-top, 0)">
      <header class="shrink-0 px-5 pt-5 pb-3">
        <h1 class="text-[28px] font-bold tracking-tight">{{ 'settings.title' | transloco }}</h1>
      </header>
      <main class="grow min-h-0 overflow-y-auto px-5 pb-5 flex flex-col gap-[22px]">
        @for (group of groups(); track group.title) {
          <section class="shrink-0">
            <h2 class="mb-2 text-[13px] font-semibold text-mute">{{ group.title | transloco }}</h2>
            <div class="bg-ink-800 border border-ink-700 rounded-2xl overflow-hidden">
              @for (row of group.rows; track row.label) {
                <button (click)="row.action()" class="w-full min-h-[52px] flex items-center justify-between gap-3 px-3.5 py-2 border-b border-ink-700 last:border-b-0 text-[15px] text-left">
                  <span>{{ row.label | transloco }}</span>
                  <span class="font-mono text-[13px] text-mute whitespace-nowrap flex items-center gap-1">
                    {{ row.value }}
                    @if (row.chevron) {
                      <ion-icon name="chevron-forward-outline" class="text-base" aria-hidden="true" />
                    }
                  </span>
                </button>
              }
            </div>
          </section>
        }
      </main>

      <app-bottom-sheet [open]="sheetOpen()" [title]="editor()?.title ?? ''" (closed)="closeSheet()">
        <!-- Recria os campos a cada abertura, para não herdar o que foi digitado antes. -->
        @for (current of editorList(); track version()) {
          @switch (current.kind) {
            @case ('choice') {
              <div role="radiogroup" [attr.aria-label]="current.title" class="flex flex-col">
                @for (option of current.options; track option.id) {
                  <button role="radio" [attr.aria-checked]="option.id === current.selected" (click)="choose(current, option.id)" class="min-h-[54px] flex items-center gap-3.5 border-b border-ink-700 last:border-b-0 text-base text-left">
                    <span aria-hidden="true" class="shrink-0 size-5 box-border rounded-full" [style.border]="option.id === current.selected ? '6px solid #9DB2EC' : '2px solid #5A5370'"></span>
                    {{ option.label }}
                  </button>
                }
              </div>
            }
            @default {
              <form (submit)="save($event)" class="flex flex-col gap-3.5" novalidate>
                @if (current.kind === 'number') {
                  <input data-autofocus [attr.aria-label]="current.title" [value]="current.value" (input)="first = $any($event.target).value" inputmode="numeric" autocomplete="off" [class]="fieldClass" />
                  <p class="text-sm" [class]="error() ? 'text-err' : 'text-mute'">{{ 'settings.between' | transloco: { min: current.min, max: current.max } }}</p>
                }
                @if (current.kind === 'text') {
                  <input data-autofocus [attr.aria-label]="current.title" [value]="current.value" (input)="first = $any($event.target).value" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" [class]="fieldClass" />
                  @if (error()) {
                    <p class="text-sm text-err">{{ 'common.required' | transloco }}</p>
                  }
                }
                <div class="grid grid-cols-2 gap-2.5">
                  <button type="button" (click)="closeSheet()" class="min-h-[50px] rounded-xl border border-ink-600 text-[15px] font-semibold">{{ 'common.cancel' | transloco }}</button>
                  <button type="submit" class="min-h-[50px] rounded-xl bg-link-400 text-ink-900 text-[15px] font-semibold">{{ 'common.save' | transloco }}</button>
                </div>
              </form>
            }
          }
        }
      </app-bottom-sheet>
    </div>
  `,
})
export class SettingsPage implements OnInit {
  private readonly store = inject(SettingsStore);
  private readonly router = inject(Router);
  private readonly i18n = inject(TranslocoService);
  private readonly premium = inject(PremiumStore);
  private readonly ads = inject(AdsService);

  private readonly versionName = signal('');

  protected readonly fieldClass = FIELD_CLASS;
  protected readonly sheetOpen = signal(false);
  protected readonly editor = signal<Editor | null>(null);
  protected readonly version = signal(0);
  protected readonly error = signal(false);
  protected readonly editorList = computed(() => {
    const editor = this.editor();
    return editor ? [editor] : [];
  });
  protected first = '';

  protected readonly groups = computed(() => {
    const settings = this.store.settings();
    const ending = ENDINGS.find((option) => option.id === settings.lineEnding)?.label ?? 'CRLF';
    const language = LANGUAGES.find((option) => option.id === settings.lang)?.label ?? 'settings.langAuto';
    const premium = this.premium.premium();
    return [
      {
        title: 'premium.title',
        rows: [
          premium
            ? { label: 'premium.status', value: this.t('premium.active'), action: () => undefined }
            : { label: 'premium.upgrade', value: this.premium.price(), chevron: true, action: () => this.premium.paywallOpen.set(true) },
        ],
      },
      {
        title: 'settings.terminal',
        rows: [
          { label: 'settings.history', value: String(settings.historyChars), action: () => this.editNumber('historyChars', 'settings.history', 500, 200000) },
          { label: 'settings.lineEnding', value: this.label(ending), action: () => this.chooseEnding() },
        ],
      },
      {
        title: 'settings.stream',
        rows: [
          { label: 'settings.start', value: settings.startCommand, action: () => this.editText('startCommand', 'settings.start') },
          { label: 'settings.stop', value: settings.stopCommand, action: () => this.editText('stopCommand', 'settings.stop') },
          { label: 'settings.defaultFormat', value: '', chevron: true, action: () => void this.router.navigateByUrl('/formato') },
        ],
      },
      {
        title: 'settings.wifi',
        rows: [
          { label: 'settings.discovery', value: String(settings.discoveryPort), action: () => this.editNumber('discoveryPort', 'settings.discovery', 1, 65535) },
          { label: 'settings.streamPort', value: String(settings.streamPort), action: () => this.editNumber('streamPort', 'settings.streamPort', 1, 65535) },
        ],
      },
      {
        title: 'settings.about',
        rows: [
          { label: 'settings.language', value: this.label(language), action: () => this.chooseLanguage() },
          { label: 'settings.guide', value: '', chevron: true, action: () => void this.router.navigateByUrl('/guia') },
          { label: 'settings.examples', value: '', chevron: true, action: () => void this.router.navigateByUrl('/guia?aba=codigo') },
          { label: 'settings.rate', value: '', chevron: true, action: () => this.rate() },
          ...(this.ads.privacyOptionsRequired() && !premium
            ? [{ label: 'settings.adPrivacy', value: '', chevron: true, action: () => void this.ads.showPrivacyOptions() }]
            : []),
          { label: 'settings.version', value: this.versionName(), action: () => undefined },
        ],
      },
    ];
  });

  async ngOnInit(): Promise<void> {
    if (Capacitor.isNativePlatform()) this.versionName.set((await CapacitorApp.getInfo()).version);
    else this.versionName.set('web');
  }

  protected closeSheet(): void {
    this.sheetOpen.set(false);
  }

  protected choose(editor: Extract<Editor, { kind: 'choice' }>, id: string): void {
    editor.apply(id);
    this.closeSheet();
  }

  protected save(event: Event): void {
    event.preventDefault();
    const editor = this.editor();
    if (!editor || editor.kind === 'choice') return;
    const patch = this.readPatch(editor);
    if (!patch) {
      this.error.set(true);
      return;
    }
    this.store.update(patch);
    this.closeSheet();
  }

  private readPatch(editor: Exclude<Editor, { kind: 'choice' }>): Partial<AppSettings> | null {
    switch (editor.kind) {
      case 'number': {
        const value = parseBounded(this.first, editor.min, editor.max);
        return value === null ? null : ({ [editor.key]: value } as Partial<AppSettings>);
      }
      case 'text': {
        const value = this.first.trim();
        return value ? ({ [editor.key]: value } as Partial<AppSettings>) : null;
      }
    }
  }

  private openSheet(editor: Editor, first = ''): void {
    this.first = first;
    this.error.set(false);
    this.editor.set(editor);
    this.version.update((value) => value + 1);
    this.sheetOpen.set(true);
  }

  private t(key: string): string {
    return this.i18n.translate(key);
  }

  /** CRLF, LF e os nomes dos idiomas já são o próprio texto; só as chaves com ponto se traduzem. */
  private label(text: string): string {
    return text.includes('.') ? this.t(text) : text;
  }

  private editNumber(key: NumberKey, label: string, min: number, max: number): void {
    const value = String(this.store.settings()[key]);
    this.openSheet({ kind: 'number', title: this.t(label), key, min, max, value }, value);
  }

  private editText(key: TextKey, label: string): void {
    const value = this.store.settings()[key];
    this.openSheet({ kind: 'text', title: this.t(label), key, value }, value);
  }

  private chooseEnding(): void {
    this.openSheet({
      kind: 'choice',
      title: this.t('settings.lineEnding'),
      options: ENDINGS.map((option) => ({ id: option.id, label: this.label(option.label) })),
      selected: this.store.settings().lineEnding,
      apply: (id) => this.store.update({ lineEnding: id as LineEnding }),
    });
  }

  private chooseLanguage(): void {
    this.openSheet({
      kind: 'choice',
      title: this.t('settings.language'),
      options: LANGUAGES.map((option) => ({ id: option.id, label: this.label(option.label) })),
      selected: this.store.settings().lang,
      apply: (id) => this.setLanguage(id),
    });
  }

  private setLanguage(lang: string): void {
    this.store.update({ lang });
    const resolved = resolveLanguage(lang, navigator.language);
    this.i18n.setActiveLang(resolved);
    document.documentElement.lang = resolved;
  }

  private rate(): void {
    window.open('https://play.google.com/store/apps/details?id=com.rad.unwired', '_system');
  }
}
