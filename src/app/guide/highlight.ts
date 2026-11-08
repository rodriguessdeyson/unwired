export type TokenKind = 'plain' | 'comment' | 'string' | 'number' | 'keyword';

export interface CodeToken {
  kind: TokenKind;
  text: string;
}

const KEYWORDS =
  'and|as|async|await|bool|break|case|char|class|const|continue|def|elif|else|except|False|false|float|for|from|function|if|import|in|int|let|long|not|null|or|pass|return|static|String|True|true|try|uint16_t|uint8_t|unsigned|void|volatile|while|with';

// Em ordem: comentários (o # de diretivas como #include não conta), textos, números e palavras-chave.
const PATTERN = new RegExp(
  [
    '(\\/\\*[\\s\\S]*?\\*\\/|\\/\\/[^\\n]*|#(?!include|define|if|endif|error|\\w*else)[^\\n]*)',
    '("(?:[^"\\\\\\n]|\\\\.)*"|\'(?:[^\'\\\\\\n]|\\\\.)*\'|`(?:[^`\\\\]|\\\\.)*`)',
    '(\\b\\d+(?:\\.\\d+)?\\b)',
    `(\\b(?:${KEYWORDS})\\b)`,
  ].join('|'),
  'g',
);

/** Coloração leve: reconhece só o que é comum às linguagens dos exemplos. */
export function highlight(code: string): CodeToken[] {
  const tokens: CodeToken[] = [];
  let position = 0;
  for (const match of code.matchAll(PATTERN)) {
    if (match.index > position) tokens.push({ kind: 'plain', text: code.slice(position, match.index) });
    const kind: TokenKind = match[1] ? 'comment' : match[2] ? 'string' : match[3] ? 'number' : 'keyword';
    tokens.push({ kind, text: match[0] });
    position = match.index + match[0].length;
  }
  if (position < code.length) tokens.push({ kind: 'plain', text: code.slice(position) });
  return tokens;
}
