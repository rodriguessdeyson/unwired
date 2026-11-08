import { describe, expect, it } from 'vitest';
import { chartWindow, stableRange } from './chart-math';

const following = { locked: false, lockStart: 0, follow: true, frozen: 0 };
const numbers = (count: number) => Array.from({ length: count }, (_, index) => index + 1);

describe('chartWindow', () => {
  it('cresce a partir da esquerda antes de encher a janela', () => {
    expect(chartWindow(numbers(10), 120, following)).toEqual({ from: 0, to: 10, min: 1, max: 120 });
  });

  it('acompanha o fim depois de encher', () => {
    expect(chartWindow(numbers(200), 120, following)).toEqual({ from: 80, to: 200, min: 81, max: 200 });
  });

  it('congela no ponto escolhido', () => {
    expect(chartWindow(numbers(300), 100, { ...following, follow: false, frozen: 150 })).toEqual({ from: 50, to: 150, min: 51, max: 150 });
  });

  it('recomeça a janela no eixo travado', () => {
    expect(chartWindow(numbers(250), 100, { ...following, locked: true, lockStart: 0 })).toEqual({ from: 200, to: 250, min: 201, max: 300 });
  });
});

describe('stableRange', () => {
  it('não muda enquanto os dados couberem', () => {
    const first = stableRange(40, 60, null);
    expect(stableRange(42, 58, first)).toBe(first);
    expect(stableRange(41.3, 59.9, first)).toBe(first);
  });

  it('expande quando um valor sai da faixa', () => {
    const first = stableRange(40, 60, null);
    const next = stableRange(40, 200, first);
    expect(next[1]).toBeGreaterThanOrEqual(200);
    expect(next[0]).toBeLessThanOrEqual(40);
  });

  it('encolhe quando os dados passam a ocupar pouco', () => {
    const wide = stableRange(0, 1000, null);
    const next = stableRange(500, 510, wide);
    expect(next[1] - next[0]).toBeLessThan(100);
  });

  it('sempre contém os dados, inclusive valor constante e negativos', () => {
    for (const [min, max] of [[5, 5], [0, 0], [-30, -10], [3.3, 3.31]]) {
      const [low, high] = stableRange(min, max, null);
      expect(low).toBeLessThanOrEqual(min);
      expect(high).toBeGreaterThanOrEqual(max);
      expect(high).toBeGreaterThan(low);
    }
  });

  it('sem dados, mantém o que havia', () => {
    expect(stableRange(null, null, [1, 2])).toEqual([1, 2]);
    expect(stableRange(null, null, null)).toEqual([0, 1]);
  });
});
