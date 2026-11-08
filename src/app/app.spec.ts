import { describe, expect, it } from 'vitest';
import { resolveLanguage } from './app.config';

describe('resolveLanguage', () => {
  it('prefere o idioma salvo', () => {
    expect(resolveLanguage('es', 'pt-BR')).toBe('es');
  });

  it('usa o idioma do sistema quando disponível', () => {
    expect(resolveLanguage('', 'pt-BR')).toBe('pt');
  });

  it('cai para inglês em outros idiomas', () => {
    expect(resolveLanguage('', 'fr-FR')).toBe('en');
  });
});
