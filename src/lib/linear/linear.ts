import type { DataType, Exercise, LinearAnswers, LinearStructure } from '../tree/types';
import { isValidValue, normalizeValue, splitList, valueKey } from '../tree/values';

/* ------------------------------------------------------------------ */
/*  Etiquetas                                                          */
/* ------------------------------------------------------------------ */

export const STRUCTURE_LABEL: Record<LinearStructure, string> = {
  LIST: 'Lista',
  STACK: 'Pila',
  QUEUE: 'Cola',
};

export const STRUCTURE_ICON: Record<LinearStructure, string> = {
  LIST: '📋',
  STACK: '🥞',
  QUEUE: '🚶',
};

/** Cómo se escribe el estado de cada estructura (orden de los elementos). */
export const STRUCTURE_ORDER_HINT: Record<LinearStructure, string> = {
  LIST: 'de inicio a fin (posición 0 primero)',
  STACK: 'de fondo a tope (el tope es el último)',
  QUEUE: 'de frente a final (el frente es el primero)',
};

/** ¿El ejercicio es de estructura lineal? (los anteriores no tienen `kind`). */
export function isLinearExercise(ex: Pick<Exercise, 'kind' | 'linear'> | null | undefined): boolean {
  return ex?.kind === 'LINEAR' && !!ex.linear;
}

/** Etiqueta corta para chips/pestañas: "ÁRBOL BST", "LISTA"... */
export function exerciseBadge(ex: Exercise): string {
  return isLinearExercise(ex) ? STRUCTURE_LABEL[ex.linear!.structure].toUpperCase() : ex.treeType;
}

/** Secuencias de ejemplo con las que arranca un ejercicio lineal nuevo. */
export const DEFAULT_OPS: Record<LinearStructure, string[]> = {
  LIST: ['add(5)', 'add(7)', 'add(9)', 'add(1, 4)', 'remove(0)', 'get(1)', 'head()', 'size()'],
  STACK: ['push(5)', 'push(7)', 'push(9)', 'pop()', 'peek()', 'push(3)', 'size()'],
  QUEUE: ['enqueue(5)', 'enqueue(7)', 'enqueue(9)', 'dequeue()', 'front()', 'enqueue(3)', 'size()'],
};

/** Ejercicio lineal nuevo con una secuencia de ejemplo para la estructura indicada. */
export function newLinearExercise(id: string, title: string, structure: LinearStructure = 'LIST'): Exercise {
  return {
    id,
    title,
    kind: 'LINEAR',
    treeType: 'BST',
    dataType: 'NUMBER',
    dataset: [],
    linear: { structure, ops: DEFAULT_OPS[structure] },
  };
}

/* ------------------------------------------------------------------ */
/*  Catálogo de operaciones                                            */
/* ------------------------------------------------------------------ */

type ArgKind = 'value' | 'index';

interface RunResult {
  state: string[];
  /** Dato devuelto por la operación (si devuelve algo). */
  output?: string;
  error?: string;
}

type Key = (v: string) => string;

interface OpDef {
  name: string;
  aliases?: string[];
  args: ArgKind[];
  /** ¿La operación devuelve un dato que cuenta como «extraído/devuelto»? */
  returns: boolean;
  signature: string;
  description: string;
  /** Ejemplo insertable. {v} y {w} se reemplazan por valores del tipo de dato; {i} por un índice. */
  example: string;
  run: (state: string[], args: string[], key: Key) => RunResult;
}

export interface OpInfo {
  signature: string;
  description: string;
  returns: boolean;
  example: string;
}

const ok = (state: string[], output?: string): RunResult => ({ state, output });
const fail = (state: string[], error: string): RunResult => ({ state, error });
const bool = (b: boolean) => (b ? 'true' : 'false');

function indexIn(raw: string, last: number): number | null {
  const i = Number(raw);
  return Number.isInteger(i) && i >= 0 && i <= last ? i : null;
}

const rangeMsg = (len: number, max: number) =>
  len === 0 ? 'La estructura está vacía' : `Posición fuera de rango (válido: 0 a ${max})`;

const LIST_OPS: OpDef[] = [
  {
    name: 'add',
    args: ['value'],
    returns: false,
    signature: 'add(x)',
    description: 'Agrega x al final de la lista.',
    example: 'add({v})',
    run: (s, [x]) => ok([...s, x]),
  },
  {
    name: 'add',
    args: ['index', 'value'],
    returns: false,
    signature: 'add(i, x)',
    description: 'Inserta x en la posición i (los demás se recorren a la derecha).',
    example: 'add({i}, {w})',
    run: (s, [i, x]) => {
      const idx = indexIn(i, s.length);
      if (idx === null) return fail(s, `Posición fuera de rango (válido: 0 a ${s.length})`);
      const next = [...s];
      next.splice(idx, 0, x);
      return ok(next);
    },
  },
  {
    name: 'remove',
    args: ['index'],
    returns: true,
    signature: 'remove(i)',
    description: 'Elimina y devuelve el elemento de la posición i.',
    example: 'remove({i})',
    run: (s, [i]) => {
      const idx = indexIn(i, s.length - 1);
      if (idx === null) return fail(s, rangeMsg(s.length, s.length - 1));
      const next = [...s];
      const [out] = next.splice(idx, 1);
      return ok(next, out);
    },
  },
  {
    name: 'get',
    aliases: ['getelementat', 'elementat'],
    args: ['index'],
    returns: true,
    signature: 'get(i)',
    description: 'Devuelve el elemento de la posición i sin quitarlo (también: getElementAt(i)).',
    example: 'get({i})',
    run: (s, [i]) => {
      const idx = indexIn(i, s.length - 1);
      if (idx === null) return fail(s, rangeMsg(s.length, s.length - 1));
      return ok(s, s[idx]);
    },
  },
  {
    name: 'set',
    args: ['index', 'value'],
    returns: false,
    signature: 'set(i, x)',
    description: 'Reemplaza el elemento de la posición i por x.',
    example: 'set({i}, {w})',
    run: (s, [i, x]) => {
      const idx = indexIn(i, s.length - 1);
      if (idx === null) return fail(s, rangeMsg(s.length, s.length - 1));
      const next = [...s];
      next[idx] = x;
      return ok(next);
    },
  },
  {
    name: 'head',
    args: [],
    returns: true,
    signature: 'head()',
    description: 'Devuelve el primer elemento sin quitarlo.',
    example: 'head()',
    run: (s) => (s.length === 0 ? fail(s, 'La lista está vacía') : ok(s, s[0])),
  },
  {
    name: 'tail',
    args: [],
    returns: true,
    signature: 'tail()',
    description: 'Devuelve el último elemento sin quitarlo.',
    example: 'tail()',
    run: (s) => (s.length === 0 ? fail(s, 'La lista está vacía') : ok(s, s[s.length - 1])),
  },
  {
    name: 'indexof',
    args: ['value'],
    returns: true,
    signature: 'indexOf(x)',
    description: 'Devuelve la posición de la primera aparición de x, o -1 si no está.',
    example: 'indexOf({v})',
    run: (s, [x], key) => ok(s, String(s.findIndex((e) => key(e) === key(x)))),
  },
  {
    name: 'size',
    args: [],
    returns: true,
    signature: 'size()',
    description: 'Devuelve cuántos elementos tiene la lista.',
    example: 'size()',
    run: (s) => ok(s, String(s.length)),
  },
  {
    name: 'isempty',
    args: [],
    returns: true,
    signature: 'isEmpty()',
    description: 'Devuelve true si la lista no tiene elementos, false si tiene.',
    example: 'isEmpty()',
    run: (s) => ok(s, bool(s.length === 0)),
  },
];

const STACK_OPS: OpDef[] = [
  {
    name: 'push',
    args: ['value'],
    returns: false,
    signature: 'push(x)',
    description: 'Apila x en el tope.',
    example: 'push({v})',
    run: (s, [x]) => ok([...s, x]),
  },
  {
    name: 'pop',
    args: [],
    returns: true,
    signature: 'pop()',
    description: 'Quita y devuelve el elemento del tope.',
    example: 'pop()',
    run: (s) => (s.length === 0 ? fail(s, 'La pila está vacía') : ok(s.slice(0, -1), s[s.length - 1])),
  },
  {
    name: 'peek',
    args: [],
    returns: true,
    signature: 'peek()',
    description: 'Devuelve el elemento del tope sin quitarlo.',
    example: 'peek()',
    run: (s) => (s.length === 0 ? fail(s, 'La pila está vacía') : ok(s, s[s.length - 1])),
  },
  {
    name: 'size',
    args: [],
    returns: true,
    signature: 'size()',
    description: 'Devuelve cuántos elementos tiene la pila.',
    example: 'size()',
    run: (s) => ok(s, String(s.length)),
  },
  {
    name: 'isempty',
    args: [],
    returns: true,
    signature: 'isEmpty()',
    description: 'Devuelve true si la pila no tiene elementos, false si tiene.',
    example: 'isEmpty()',
    run: (s) => ok(s, bool(s.length === 0)),
  },
];

const QUEUE_OPS: OpDef[] = [
  {
    name: 'enqueue',
    args: ['value'],
    returns: false,
    signature: 'enqueue(x)',
    description: 'Encola x al final de la cola.',
    example: 'enqueue({v})',
    run: (s, [x]) => ok([...s, x]),
  },
  {
    name: 'dequeue',
    args: [],
    returns: true,
    signature: 'dequeue()',
    description: 'Quita y devuelve el elemento del frente.',
    example: 'dequeue()',
    run: (s) => (s.length === 0 ? fail(s, 'La cola está vacía') : ok(s.slice(1), s[0])),
  },
  {
    name: 'front',
    args: [],
    returns: true,
    signature: 'front()',
    description: 'Devuelve el elemento del frente sin quitarlo.',
    example: 'front()',
    run: (s) => (s.length === 0 ? fail(s, 'La cola está vacía') : ok(s, s[0])),
  },
  {
    name: 'size',
    args: [],
    returns: true,
    signature: 'size()',
    description: 'Devuelve cuántos elementos tiene la cola.',
    example: 'size()',
    run: (s) => ok(s, String(s.length)),
  },
  {
    name: 'isempty',
    args: [],
    returns: true,
    signature: 'isEmpty()',
    description: 'Devuelve true si la cola no tiene elementos, false si tiene.',
    example: 'isEmpty()',
    run: (s) => ok(s, bool(s.length === 0)),
  },
];

const OPS: Record<LinearStructure, OpDef[]> = { LIST: LIST_OPS, STACK: STACK_OPS, QUEUE: QUEUE_OPS };

/** Operaciones disponibles para una estructura (para mostrarlas al profesor). */
export function opCatalog(structure: LinearStructure, dataType: DataType = 'NUMBER'): OpInfo[] {
  const v = dataType === 'NUMBER' ? '5' : 'A';
  const w = dataType === 'NUMBER' ? '7' : 'B';
  return OPS[structure].map((d) => ({
    signature: d.signature,
    description: d.description,
    returns: d.returns,
    example: d.example.replace('{v}', v).replace('{w}', w).replace('{i}', '0'),
  }));
}

/* ------------------------------------------------------------------ */
/*  Lectura de operaciones                                             */
/* ------------------------------------------------------------------ */

const TOKEN_RE = /[A-Za-z_]\w*\s*\([^()]*\)/g;
const CALL_RE = /^\s*([A-Za-z_]\w*)\s*\(([^()]*)\)\s*$/;

function stripQuotes(s: string): string {
  const t = s.trim();
  return /^(["']).*\1$/.test(t) && t.length >= 2 ? t.slice(1, -1).trim() : t;
}

/** Descompone "add(0, 5)" en nombre y argumentos. */
export function parseCall(op: string): { name: string; args: string[] } | null {
  const m = CALL_RE.exec(op);
  if (!m) return null;
  const inner = m[2].trim();
  return { name: m[1], args: inner === '' ? [] : inner.split(',').map(stripQuotes) };
}

/** Texto canónico de una operación: nombre(arg1, arg2). */
function canonicalOp(op: string): string {
  const c = parseCall(op);
  return c ? `${c.name}(${c.args.join(', ')})` : op.trim();
}

/**
 * Extrae las operaciones de un texto libre. Acepta una por línea o separadas por comas:
 * "add(5), add(7)\nremove(0)". `leftover` trae el texto que no pudo reconocerse.
 */
export function tokenizeOps(text: string): { ops: string[]; leftover: string } {
  const ops = (text.match(TOKEN_RE) ?? []).map(canonicalOp);
  const leftover = text.replace(TOKEN_RE, ' ').replace(/[,;\s]+/g, ' ').trim();
  return { ops, leftover };
}

/* ------------------------------------------------------------------ */
/*  Simulación                                                         */
/* ------------------------------------------------------------------ */

export interface StepResult {
  op: string;
  /** Dato devuelto por la operación. */
  output?: string;
  error?: string;
  /** Estado de la estructura después de la operación. */
  state: string[];
}

export interface Simulation {
  steps: StepResult[];
  initial: string[];
  finalState: string[];
  /** Datos devueltos por las operaciones que devuelven algo, en orden. */
  extracted: string[];
  /** Cantidad de operaciones con error (no válidas). */
  errorCount: number;
}

/** Igualdad entre datos: números normalizados, letras sin distinguir mayúsculas, true/false sin mayúsculas. */
export function linearKey(v: string, dataType: DataType): string {
  const t = v.trim();
  if (/^(true|false)$/i.test(t)) return t.toLowerCase();
  return valueKey(t, dataType);
}

function runOp(
  structure: LinearStructure,
  dataType: DataType,
  state: string[],
  op: string,
): { result: RunResult; returns: boolean } {
  const key: Key = (v) => linearKey(v, dataType);
  const call = parseCall(op);
  if (!call) return { result: fail(state, 'Operación mal escrita (usa nombre(argumentos))'), returns: false };

  const lname = call.name.toLowerCase();
  const sameName = OPS[structure].filter((d) => d.name === lname || d.aliases?.includes(lname));
  if (sameName.length === 0) {
    const names = [...new Set(OPS[structure].map((d) => d.signature.split('(')[0]))].join(', ');
    return {
      result: fail(state, `«${call.name}» no existe en ${STRUCTURE_LABEL[structure].toLowerCase()} (usa: ${names})`),
      returns: false,
    };
  }
  const def = sameName.find((d) => d.args.length === call.args.length);
  if (!def) {
    const expected = sameName.map((d) => d.signature).join(' o ');
    return { result: fail(state, `Cantidad de argumentos incorrecta (usa: ${expected})`), returns: false };
  }

  const args: string[] = [];
  for (let i = 0; i < def.args.length; i++) {
    const raw = call.args[i];
    if (def.args[i] === 'index') {
      if (!/^\d+$/.test(raw)) return { result: fail(state, `«${raw}» no es una posición válida (entero ≥ 0)`), returns: def.returns };
      args.push(raw);
    } else {
      if (!isValidValue(raw, dataType)) {
        return {
          result: fail(state, `«${raw}» no es un ${dataType === 'NUMBER' ? 'número' : 'dato'} válido`),
          returns: def.returns,
        };
      }
      args.push(normalizeValue(raw, dataType));
    }
  }
  return { result: def.run(state, args, key), returns: def.returns };
}

/** Ejecuta la secuencia sobre la estructura y devuelve el estado final y los datos extraídos. */
export function simulate(
  structure: LinearStructure,
  dataType: DataType,
  initial: string[],
  ops: string[],
): Simulation {
  let state = [...initial];
  const steps: StepResult[] = [];
  const extracted: string[] = [];
  let errorCount = 0;

  for (const op of ops) {
    const { result, returns } = runOp(structure, dataType, state, op);
    if (result.error) {
      errorCount++;
      steps.push({ op, error: result.error, state });
      continue;
    }
    state = result.state;
    if (returns && result.output !== undefined) extracted.push(result.output);
    steps.push({ op, output: returns ? result.output : undefined, state });
  }
  return { steps, initial: [...initial], finalState: state, extracted, errorCount };
}

/** Simula un ejercicio lineal; null si el ejercicio no es lineal. */
export function simulateExercise(ex: Exercise): Simulation | null {
  if (!isLinearExercise(ex)) return null;
  return simulate(ex.linear!.structure, ex.dataType, ex.dataset, ex.linear!.ops);
}

/** Errores de un ejercicio lineal (para impedir publicar ejercicios imposibles de resolver). */
export function linearExerciseErrors(ex: Exercise): string[] {
  if (!isLinearExercise(ex)) return [];
  const errors: string[] = [];
  const label = ex.title || 'Ejercicio';
  if (ex.linear!.ops.length === 0) errors.push(`${label}: agrega al menos una operación.`);
  const sim = simulateExercise(ex)!;
  sim.steps.forEach((s, i) => {
    if (s.error) errors.push(`${label}, operación ${i + 1} (${s.op}): ${s.error}.`);
  });
  return errors;
}

/* ------------------------------------------------------------------ */
/*  Evaluación                                                         */
/* ------------------------------------------------------------------ */

export type LinearItemKey = 'finalState' | 'extracted';

export interface LinearItem {
  key: LinearItemKey;
  label: string;
  correct: boolean;
  points: number;
  max: number;
  expected: string;
  given: string;
}

export interface LinearEvaluation {
  items: LinearItem[];
  total: number; // 0..100
  /** Equivale a "el estado final es correcto" (se guarda como structureExact en la entrega). */
  structureExact: boolean;
}

export const LINEAR_WEIGHTS: Record<LinearItemKey, number> = { finalState: 50, extracted: 50 };

export const LINEAR_ITEM_LABEL: Record<LinearItemKey, string> = {
  finalState: 'Estado final de la estructura',
  extracted: 'Datos extraídos / devueltos',
};

const EMPTY_WORDS = new Set(['-', 'ninguno', 'ninguna', 'vacia', 'vacía', 'vacio', 'vacío', 'nada', 'n/a']);

/** Lee una lista escrita por el alumno: admite comas, espacios y corchetes. */
export function parseAnswerList(text: string): string[] {
  return splitList(text.replace(/[[\](){}]/g, ' '));
}

function sameSequence(a: string[], b: string[], dataType: DataType) {
  return a.length === b.length && a.every((v, i) => linearKey(v, dataType) === linearKey(b[i], dataType));
}

/** Para respuestas vacías el alumno debe escribirlo explícitamente ("-", "vacía", "[]"). */
function matchesList(text: string, expected: string[], dataType: DataType): boolean {
  if (text.trim() === '') return false;
  const given = parseAnswerList(text);
  if (expected.length === 0) return given.every((t) => EMPTY_WORDS.has(t.toLowerCase()));
  return sameSequence(given, expected, dataType);
}

const show = (xs: string[], empty: string) => (xs.length ? xs.join(', ') : empty);

export function evaluateLinear(
  ex: Exercise,
  answers: Partial<LinearAnswers> | null | undefined,
): LinearEvaluation {
  const sim = simulateExercise(ex) ?? { finalState: [], extracted: [] };
  const finalGiven = answers?.finalState ?? '';
  const extractedGiven = answers?.extracted ?? '';

  const finalOk = matchesList(finalGiven, sim.finalState, ex.dataType);
  const extractedOk = matchesList(extractedGiven, sim.extracted, ex.dataType);

  const items: LinearItem[] = [
    {
      key: 'finalState',
      label: LINEAR_ITEM_LABEL.finalState,
      correct: finalOk,
      points: finalOk ? LINEAR_WEIGHTS.finalState : 0,
      max: LINEAR_WEIGHTS.finalState,
      expected: show(sim.finalState, '(vacía)'),
      given: finalGiven.trim(),
    },
    {
      key: 'extracted',
      label: LINEAR_ITEM_LABEL.extracted,
      correct: extractedOk,
      points: extractedOk ? LINEAR_WEIGHTS.extracted : 0,
      max: LINEAR_WEIGHTS.extracted,
      expected: show(sim.extracted, '(ninguno)'),
      given: extractedGiven.trim(),
    },
  ];
  return { items, total: items.reduce((s, it) => s + it.points, 0), structureExact: finalOk };
}
