import { ParseMode } from '../models';

export interface ParsedValue {
  key: string;
  value: number;
}

export interface ParseResult {
  values: ParsedValue[];
  /** Formato que reconheceu a linha; `null` quando ela é só texto. */
  format: Exclude<ParseMode, 'auto' | 'legado'> | 'legado' | null;
}

const isNumeric = (text: string): boolean => text.trim() !== '' && Number.isFinite(Number(text));

/** Limites para uma linha enorme não travar a leitura; o rastreador só usa 8 canais. */
const JSON_MAX_VALUES = 32;
const JSON_MAX_DEPTH = 4;

/** Números de vetores e objetos aninhados também viram canais: `ondas[0]`, `sensor.temp`. */
function collectJson(node: unknown, key: string, depth: number, values: ParsedValue[]): void {
  if (values.length >= JSON_MAX_VALUES) return;
  if (typeof node === 'number') {
    if (Number.isFinite(node) && key) values.push({ key, value: node });
    return;
  }
  if (!node || typeof node !== 'object' || depth > JSON_MAX_DEPTH) return;
  if (Array.isArray(node)) {
    node.forEach((item, index) => collectJson(item, `${key}[${index}]`, depth + 1, values));
    return;
  }
  for (const [child, item] of Object.entries(node as Record<string, unknown>)) {
    collectJson(item, key ? `${key}.${child}` : child, depth + 1, values);
  }
}

function parseJson(line: string): ParsedValue[] {
  if (!line.trimStart().startsWith('{')) return [];
  try {
    const parsed: unknown = JSON.parse(line);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const values: ParsedValue[] = [];
    collectJson(parsed, '', 0, values);
    return values;
  } catch {
    return [];
  }
}

const XML_NUMBER = /^\s*(-?\d+(?:\.\d+)?)\s*$/;

/**
 * XML simples: números dentro de tags (`<temp>23.4</temp>`) e em atributos
 * (`<leitura temp="23.4"/>`). A declaração `<?xml version="1.0"?>` fica de fora.
 */
function parseXml(line: string): ParsedValue[] {
  if (!line.trimStart().startsWith('<')) return [];
  const text = line.replace(/<\?[\s\S]*?\?>/g, '');
  const values: ParsedValue[] = [];
  for (const [, key, content] of text.matchAll(/<([A-Za-z_][\w.-]*)(?:\s[^>]*)?>([^<]*)<\/\1\s*>/g)) {
    const number = content.match(XML_NUMBER);
    if (number) values.push({ key, value: Number(number[1]) });
  }
  for (const [, attributes] of text.matchAll(/<[A-Za-z_][\w.-]*((?:\s+[A-Za-z_][\w.-]*\s*=\s*(?:"[^"]*"|'[^']*'))+)\s*\/?>/g)) {
    for (const [, key, double, single] of attributes.matchAll(/([A-Za-z_][\w.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      const number = (double ?? single).match(XML_NUMBER);
      if (number) values.push({ key, value: Number(number[1]) });
    }
  }
  return values;
}

function parseKeyed(line: string): ParsedValue[] {
  const values: ParsedValue[] = [];
  for (const part of line.trim().split(/[\s,;]+/)) {
    const match = part.match(/^([A-Za-z_][\w-]*)[=:](-?\d+(?:\.\d+)?)$/);
    if (match) values.push({ key: match[1], value: Number(match[2]) });
  }
  return values;
}

function parseSeparated(line: string): ParsedValue[] {
  const parts = line.split(/[,;\t]/).map((part) => part.trim());
  if (parts.length < 2 || !parts.every(isNumeric)) return [];
  return parts.map((part, index) => ({ key: `Canal ${index + 1}`, value: Number(part) }));
}

function parseNumber(line: string): ParsedValue[] {
  return isNumeric(line) ? [{ key: 'Valor', value: Number(line) }] : [];
}

/** Interpreta uma linha. `legado` lê os 5 primeiros bytes, como o unWired antigo. */
export function parseLine(mode: ParseMode, line: string): ParseResult {
  switch (mode) {
    case 'json':
      return wrap(parseJson(line), 'json');
    case 'xml':
      return wrap(parseXml(line), 'xml');
    case 'chaves':
      return wrap(parseKeyed(line), 'chaves');
    case 'csv':
      return wrap(parseSeparated(line), 'csv');
    case 'numero':
      return wrap(parseNumber(line), 'numero');
    case 'legado':
      return wrap(parseNumber(line.slice(0, 5)), 'legado');
    case 'auto': {
      for (const [parser, format] of AUTO_ORDER) {
        const values = parser(line);
        if (values.length) return { values, format };
      }
      return { values: [], format: null };
    }
  }
}

const AUTO_ORDER = [
  [parseJson, 'json'],
  [parseXml, 'xml'],
  [parseKeyed, 'chaves'],
  [parseSeparated, 'csv'],
  [parseNumber, 'numero'],
] as const;

function wrap(values: ParsedValue[], format: ParseResult['format']): ParseResult {
  return { values, format: values.length ? format : null };
}

/**
 * Separa o fluxo em linhas. Linhas sem terminador saem por `flush()`, chamado
 * após um intervalo sem dados. No modo legado, cada mensagem tem 5 bytes.
 */
export class LineFramer {
  private buffer = '';

  constructor(
    private legacy = false,
    private readonly maxLength = 4096,
  ) {}

  setLegacy(legacy: boolean): void {
    this.legacy = legacy;
    this.buffer = '';
  }

  push(chunk: string): string[] {
    this.buffer += chunk;
    const lines: string[] = [];
    if (this.legacy) {
      while (this.buffer.length >= 5) {
        lines.push(this.buffer.slice(0, 5));
        this.buffer = this.buffer.slice(5);
      }
      return lines;
    }
    const parts = this.buffer.split(/\r\n|\n|\r/);
    this.buffer = parts.pop() ?? '';
    for (const part of parts) if (part.length) lines.push(part);
    if (this.buffer.length >= this.maxLength) {
      lines.push(this.buffer);
      this.buffer = '';
    }
    return lines;
  }

  flush(): string[] {
    if (!this.buffer.length) return [];
    const line = this.buffer;
    this.buffer = '';
    return [line];
  }
}
