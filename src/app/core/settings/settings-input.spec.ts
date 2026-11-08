import { describe, expect, it } from 'vitest';
import { parseBounded, parseRange } from './settings-input';

describe('parseBounded', () => {
  it('aceita inteiros dentro dos limites', () => {
    expect(parseBounded(' 500 ', 20, 1000)).toBe(500);
  });

  it('recusa em vez de corrigir sozinho', () => {
    expect(parseBounded('5', 20, 1000)).toBeNull();
    expect(parseBounded('5000', 20, 1000)).toBeNull();
    expect(parseBounded('10.5', 1, 100)).toBeNull();
    expect(parseBounded('abc', 1, 100)).toBeNull();
    expect(parseBounded('', 1, 100)).toBeNull();
  });
});

describe('parseRange', () => {
  it('vazio volta para automático', () => {
    expect(parseRange('', ' ')).toEqual({ yMin: null, yMax: null });
  });

  it('aceita negativos e vírgula decimal', () => {
    expect(parseRange('50,5', '-5')).toEqual({ yMin: -5, yMax: 50.5 });
  });

  it('recusa faixa incompleta ou invertida', () => {
    expect(parseRange('50', '')).toBe('invalid');
    expect(parseRange('', '0')).toBe('invalid');
    expect(parseRange('10', '20')).toBe('invalid');
    expect(parseRange('10', '10')).toBe('invalid');
  });
});
