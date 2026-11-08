import { ParsedValue } from './parser';

export interface TrackedChannel {
  key: string;
  values: (number | null)[];
  last: number | null;
  lastAt: number;
}

/**
 * Transforma leituras em canais. Um nome só vira canal depois de aparecer em
 * `confirmAfter` linhas, para uma mensagem solta não criar bloco na tela.
 */
export class ChannelTracker {
  readonly xs: number[] = [];
  private readonly confirmed = new Map<string, TrackedChannel>();
  private readonly candidates = new Map<string, number>();
  private sequence = 0;

  constructor(
    private readonly confirmAfter = 3,
    private readonly maxChannels = 8,
    private readonly maxSamples = 20000,
  ) {}

  /** Nomes salvos no perfil já contam como confirmados. */
  seed(keys: string[]): void {
    for (const key of keys) this.confirm(key);
  }

  add(values: ParsedValue[], now = Date.now()): void {
    if (!values.length) return;
    const visible = values.filter((value) => this.observe(value.key));
    if (!visible.length) return;

    this.sequence += 1;
    this.xs.push(this.sequence);
    const seen = new Set(visible.map((value) => value.key));
    for (const channel of this.confirmed.values()) {
      if (!seen.has(channel.key)) channel.values.push(null);
    }
    for (const { key, value } of visible) {
      const channel = this.confirmed.get(key)!;
      channel.values.push(value);
      channel.last = value;
      channel.lastAt = now;
    }
    this.trim();
  }

  channels(): TrackedChannel[] {
    return [...this.confirmed.values()];
  }

  clear(): void {
    this.xs.length = 0;
    for (const channel of this.confirmed.values()) channel.values.length = 0;
  }

  private observe(key: string): boolean {
    if (this.confirmed.has(key)) return true;
    const count = (this.candidates.get(key) ?? 0) + 1;
    this.candidates.set(key, count);
    if (count < this.confirmAfter || this.confirmed.size >= this.maxChannels) return false;
    this.confirm(key);
    return true;
  }

  private confirm(key: string): void {
    if (this.confirmed.has(key) || this.confirmed.size >= this.maxChannels) return;
    this.confirmed.set(key, {
      key,
      values: new Array<number | null>(this.xs.length).fill(null),
      last: null,
      lastAt: 0,
    });
  }

  private trim(): void {
    const excess = this.xs.length - this.maxSamples;
    if (excess <= 0) return;
    this.xs.splice(0, excess);
    for (const channel of this.confirmed.values()) channel.values.splice(0, excess);
  }
}
