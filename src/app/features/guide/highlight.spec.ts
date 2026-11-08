import { describe, expect, it } from 'vitest';
import { highlight } from './highlight';

const kinds = (code: string) => highlight(code).filter((token) => token.kind !== 'plain').map((token) => [token.kind, token.text]);

describe('highlight', () => {
  it('nunca altera o texto', () => {
    const code = '#include <x.h>\nconst int a = 5; // nota\nprint("oi # não é comentário")\n';
    expect(highlight(code).map((token) => token.text).join('')).toBe(code);
  });

  it('separa comentários dos dois estilos', () => {
    expect(kinds('// a\n# b')).toEqual([
      ['comment', '// a'],
      ['comment', '# b'],
    ]);
  });

  it('não confunde diretivas com comentários', () => {
    expect(kinds('#include <a.h>').some(([kind]) => kind === 'comment')).toBe(false);
  });

  it('não vê comentário dentro de texto', () => {
    expect(kinds('"http://x"')).toEqual([['string', '"http://x"']]);
  });

  it('marca números e palavras-chave', () => {
    expect(kinds('return 200')).toEqual([
      ['keyword', 'return'],
      ['number', '200'],
    ]);
  });
});
