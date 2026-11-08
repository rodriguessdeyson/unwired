export type RangeResult = { yMin: number; yMax: number } | { yMin: null; yMax: null } | 'invalid';

function parseNumber(text: string): number | null {
  const value = text.trim().replace(',', '.');
  if (value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Inteiro dentro dos limites, ou null se o texto não servir. */
export function parseBounded(text: string, min: number, max: number): number | null {
  const parsed = parseNumber(text);
  if (parsed === null || !Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

/** Os dois campos vazios significam escala automática. */
export function parseRange(maxText: string, minText: string): RangeResult {
  if (maxText.trim() === '' && minText.trim() === '') return { yMin: null, yMax: null };
  const yMax = parseNumber(maxText);
  const yMin = parseNumber(minText);
  if (yMax === null || yMin === null || yMax <= yMin) return 'invalid';
  return { yMin, yMax };
}
