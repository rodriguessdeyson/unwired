import { describe, expect, it } from 'vitest';
import { isKeyboardOpen } from './viewport.service';

describe('isKeyboardOpen', () => {
  it('reconhece a tela encolhida pelo teclado', () => {
    expect(isKeyboardOpen(873, 533)).toBe(true);
  });

  it('ignora pequenas mudanças das barras do sistema', () => {
    expect(isKeyboardOpen(873, 873)).toBe(false);
    expect(isKeyboardOpen(873, 820)).toBe(false);
  });
});
