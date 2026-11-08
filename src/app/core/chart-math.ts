export interface ChartWindow {
  from: number;
  to: number;
  min: number;
  max: number;
}

/**
 * Calcula o trecho visível: acompanhando, congelado ou com o eixo X travado.
 * Antes de encher a janela, a linha cresce a partir da esquerda.
 */
export function chartWindow(
  xs: number[],
  size: number,
  options: { locked: boolean; lockStart: number; follow: boolean; frozen: number },
): ChartWindow {
  const count = xs.length;
  if (options.locked) {
    const base = Math.min(options.lockStart, count);
    const from = base + Math.floor((count - base) / size) * size;
    const min = xs[from] ?? xs[count - 1] ?? 0;
    return { from, to: count, min, max: min + size - 1 };
  }
  const to = options.follow ? count : Math.min(options.frozen, count);
  const from = Math.max(0, to - size);
  if (to < size) {
    const min = xs[0] ?? 0;
    return { from, to, min, max: min + size - 1 };
  }
  const max = xs[to - 1] ?? size - 1;
  return { from, to, min: max - size + 1, max };
}

function niceStep(span: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(span));
  const normalized = span / magnitude;
  return (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
}

/**
 * Escala Y que não salta a cada amostra: mantém a faixa atual enquanto os dados
 * couberem nela e só encolhe quando eles passam a ocupar pouco espaço.
 */
export function stableRange(min: number | null, max: number | null, previous: [number, number] | null): [number, number] {
  if (min === null || max === null || !Number.isFinite(min) || !Number.isFinite(max)) return previous ?? [0, 1];
  const span = max - min || Math.abs(max) * 0.1 || 1;
  if (previous && min >= previous[0] && max <= previous[1] && span >= (previous[1] - previous[0]) * 0.3) return previous;
  const step = niceStep((span * 1.2) / 4);
  return [Math.floor((min - span * 0.1) / step) * step, Math.ceil((max + span * 0.1) / step) * step];
}
