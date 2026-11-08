import { Component, computed, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { SavedCommand } from '../core/models';
import { SessionStore } from '../core/session.store';
import { BottomSheetComponent } from './bottom-sheet.component';

/**
 * Botões de comando salvos do dispositivo, com "Novo comando". Manter um pressionado
 * pede para removê-lo. Usado em Dispositivos e na sessão de quem só recebe comandos.
 */
@Component({
  selector: 'app-command-pad',
  host: { class: 'flex flex-col gap-2.5' },
  imports: [BottomSheetComponent, TranslocoPipe],
  template: `
    <div class="grid grid-cols-2 gap-2">
      <!-- Rótulos podem se repetir: a posição é a chave. -->
      @for (saved of commands(); track $index) {
        <button
          (click)="send(saved)"
          (contextmenu)="askRemove($event, saved)"
          class="fade-up min-h-14 px-2.5 py-1.5 rounded-xl border border-ink-600 bg-ink-950 text-left flex flex-col gap-0.5 text-sm font-semibold"
        >
          <span class="truncate w-full">{{ saved.label }}</span>
          <span class="truncate w-full font-mono text-[11px] font-normal text-mute">{{ saved.command }}</span>
        </button>
      }
      <button (click)="add()" class="min-h-14 rounded-xl border border-dashed border-ink-600 text-link-300 text-sm font-semibold">+ {{ 'devices.addCommand' | transloco }}</button>
    </div>
    <p role="status" class="text-[13px]" [style.color]="result() ? (ok() ? '#6FD3B0' : '#FF9C8E') : '#A8A2B8'">
      {{ result() || ('devices.commandsHint' | transloco) }}
    </p>

    <app-bottom-sheet [open]="sheetOpen()" [title]="(sheet().mode === 'add' ? 'devices.addCommand' : 'devices.removeCommand') | transloco" (closed)="sheetOpen.set(false)">
      @for (current of [sheet()]; track current.version) {
        @if (current.mode === 'add') {
          <form (submit)="saveNew($event)" class="flex flex-col gap-3.5" novalidate>
            <div class="flex flex-col gap-1.5">
              <label for="new-command" class="text-[13px] font-semibold">{{ 'common.command' | transloco }}</label>
              <input id="new-command" data-autofocus (input)="newCommand = $any($event.target).value" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" class="h-[52px] box-border px-3.5 rounded-xl border border-ink-600 bg-ink-900 font-mono text-base" />
              @if (error()) {
                <p class="text-sm text-err">{{ 'common.required' | transloco }}</p>
              }
            </div>
            <div class="flex flex-col gap-1.5">
              <label for="new-label" class="text-[13px] font-semibold">{{ 'devices.commandLabel' | transloco }}</label>
              <input id="new-label" (input)="newLabel = $any($event.target).value" autocomplete="off" class="h-[52px] box-border px-3.5 rounded-xl border border-ink-600 bg-ink-900 text-base" />
            </div>
            <div class="grid grid-cols-2 gap-2.5">
              <button type="button" (click)="sheetOpen.set(false)" class="min-h-[50px] rounded-xl border border-ink-600 text-[15px] font-semibold">{{ 'common.cancel' | transloco }}</button>
              <button type="submit" class="min-h-[50px] rounded-xl bg-link-400 text-ink-900 text-[15px] font-semibold">{{ 'common.save' | transloco }}</button>
            </div>
          </form>
        } @else {
          <div class="flex flex-col gap-3.5">
            <p class="text-[15px]">{{ current.saved?.label }} <span class="ml-1 font-mono text-[13px] text-mute break-all">{{ current.saved?.command }}</span></p>
            <div class="grid grid-cols-2 gap-2.5">
              <button (click)="sheetOpen.set(false)" class="min-h-[50px] rounded-xl border border-ink-600 text-[15px] font-semibold">{{ 'common.cancel' | transloco }}</button>
              <button (click)="confirmRemove()" class="min-h-[50px] rounded-xl bg-err text-ink-900 text-[15px] font-semibold">{{ 'common.remove' | transloco }}</button>
            </div>
          </div>
        }
      }
    </app-bottom-sheet>
  `,
})
export class CommandPadComponent {
  private readonly session = inject(SessionStore);
  private readonly i18n = inject(TranslocoService);

  protected readonly commands = computed(() => this.session.profile()?.commands ?? []);
  protected readonly result = signal('');
  protected readonly ok = signal(true);
  protected readonly sheetOpen = signal(false);
  protected readonly sheet = signal<{ mode: 'add' | 'remove'; version: number; saved: SavedCommand | null }>({ mode: 'add', version: 0, saved: null });
  protected readonly error = signal(false);
  protected newLabel = '';
  protected newCommand = '';

  protected async send(saved: SavedCommand): Promise<void> {
    const ok = await this.session.send(saved.command);
    this.ok.set(ok);
    this.result.set(ok ? `${this.i18n.translate('devices.sent')} ${saved.command}` : this.i18n.translate('devices.sendFailed'));
  }

  protected add(): void {
    this.newLabel = '';
    this.newCommand = '';
    this.error.set(false);
    this.sheet.update((current) => ({ mode: 'add', version: current.version + 1, saved: null }));
    this.sheetOpen.set(true);
  }

  protected saveNew(event: Event): void {
    event.preventDefault();
    const command = this.newCommand.trim();
    if (!command) {
      this.error.set(true);
      return;
    }
    this.session.saveCommands([...this.commands(), { label: this.newLabel.trim() || command, command }]);
    this.sheetOpen.set(false);
  }

  protected askRemove(event: Event, saved: SavedCommand): void {
    event.preventDefault();
    this.sheet.update((current) => ({ mode: 'remove', version: current.version + 1, saved }));
    this.sheetOpen.set(true);
  }

  protected confirmRemove(): void {
    const saved = this.sheet().saved;
    this.session.saveCommands(this.commands().filter((item) => item.label !== saved?.label || item.command !== saved?.command));
    this.sheetOpen.set(false);
  }
}
