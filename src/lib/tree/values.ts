import type { DataType } from './types';

/** Separa una lista escrita por el alumno/profesor: comas, punto y coma o espacios. */
export function splitList(text: string): string[] {
  return text
    .split(/[,;\s]+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

/** Normaliza un valor capturado (p. ej. "07" -> "7" para números). */
export function normalizeValue(raw: string, dataType: DataType): string {
  const t = raw.trim();
  if (dataType === 'NUMBER') {
    const n = Number(t);
    return t !== '' && Number.isFinite(n) ? String(n) : t;
  }
  return t;
}

/** Clave de comparación de igualdad (insensible a mayúsculas para letras). */
export function valueKey(raw: string, dataType: DataType): string {
  const t = normalizeValue(raw, dataType);
  return dataType === 'STRING' ? t.toLocaleUpperCase('es') : t;
}

/**
 * Comparación de orden usada por BST/AVL.
 * - Números: orden numérico.
 * - Letras: orden alfabético español (Ñ después de N), sin distinguir mayúsculas.
 */
export function compareValues(a: string, b: string, dataType: DataType): number {
  if (dataType === 'NUMBER') {
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na === nb ? 0 : na < nb ? -1 : 1;
  }
  return a.trim().localeCompare(b.trim(), 'es', { sensitivity: 'accent' });
}

export function isValidValue(raw: string, dataType: DataType): boolean {
  const t = raw.trim();
  if (!t || /[,;\s]/.test(t)) return false;
  if (dataType === 'NUMBER') return Number.isFinite(Number(t));
  return true;
}

/** Convierte el texto del profesor en el conjunto de datos normalizado. */
export function parseDataset(text: string, dataType: DataType): { values: string[]; invalid: string[] } {
  const values: string[] = [];
  const invalid: string[] = [];
  for (const token of splitList(text)) {
    if (isValidValue(token, dataType)) values.push(normalizeValue(token, dataType));
    else invalid.push(token);
  }
  return { values, invalid };
}

export function hasDuplicates(values: string[], dataType: DataType): boolean {
  const keys = values.map((v) => valueKey(v, dataType));
  return new Set(keys).size !== keys.length;
}

const LETTERS = 'ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'.split('');

/** Genera datos aleatorios para un ejercicio. */
export function randomDataset(opts: {
  count: number;
  dataType: DataType;
  min?: number;
  max?: number;
  unique?: boolean;
}): string[] {
  const { count, dataType, unique = true } = opts;
  if (dataType === 'STRING') {
    const pool = [...LETTERS];
    const out: string[] = [];
    for (let i = 0; i < count; i++) {
      if (unique) {
        if (pool.length === 0) break;
        const idx = Math.floor(Math.random() * pool.length);
        out.push(pool.splice(idx, 1)[0]);
      } else {
        out.push(LETTERS[Math.floor(Math.random() * LETTERS.length)]);
      }
    }
    return out;
  }
  const min = Math.ceil(opts.min ?? 1);
  const max = Math.floor(opts.max ?? 99);
  const span = max - min + 1;
  const out: string[] = [];
  const used = new Set<number>();
  let guard = 0;
  while (out.length < count && guard < 10000) {
    guard++;
    const n = min + Math.floor(Math.random() * span);
    if (unique && used.has(n)) {
      if (used.size >= span) break;
      continue;
    }
    used.add(n);
    out.push(String(n));
  }
  return out;
}
