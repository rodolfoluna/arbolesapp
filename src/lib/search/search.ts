import type { Exercise } from '../tree/types';
export const SEARCH_ALGORITHMS = ['BINARY', 'CHAINING'] as const;
export type SearchAlgorithm = (typeof SEARCH_ALGORITHMS)[number];
export interface SearchConfig {
  algorithm: SearchAlgorithm;
  targets: string[];
  tableSize?: number;
}
export const SEARCH_LABEL: Record<SearchAlgorithm, string> = {
  BINARY: 'Búsqueda binaria',
  CHAINING: 'Encadenamiento separado',
};
export const SEARCH_ACTIONS = {
  middle: 'Elegir punto medio',
  compare: 'Comparar',
  left: 'Descartar mitad izquierda',
  right: 'Descartar mitad derecha',
  found: 'Encontrado',
  absent: 'No encontrado',
  hash: 'Comprobar cálculo hash',
  bucket: 'Elegir cubeta',
  insert: 'Insertar al final',
  visit: 'Visitar nodo',
  next: 'Siguiente nodo',
} as const;
export type SearchActionType = keyof typeof SEARCH_ACTIONS;
export interface SearchAction {
  type: SearchActionType;
  index?: number;
  value?: number;
}
export interface SearchDraft {
  version: 1;
  actions: SearchAction[];
}
export type SearchCategory = 'hash' | 'insert' | 'search';
export interface SearchBoard {
  low: number;
  high: number;
  middle: number | null;
  buckets: number[][];
  bucket: number | null;
  node: number | null;
  hashResult: number | null;
  stage: 'INSERT' | 'SEARCH';
  key: string;
  query: number;
  inserting: number | null;
  phase: string;
}
export interface SearchStep {
  action: SearchAction;
  category: SearchCategory;
  before: SearchBoard;
  after: SearchBoard;
}
export const isSearchExercise = (ex: Pick<Exercise, 'kind'> | null | undefined) =>
  ex?.kind === 'SEARCH';
const integer = (s: string) => /^\d{1,3}$/.test(s);
export function searchErrors(ex: Exercise): string[] {
  if (!isSearchExercise(ex)) return [];
  const c = ex.search,
    errors: string[] = [];
  if (!c || !SEARCH_ALGORITHMS.includes(c.algorithm)) return ['Selecciona un tipo de búsqueda.'];
  if (
    ex.dataType !== 'NUMBER' ||
    ex.dataset.length < (c.algorithm === 'BINARY' ? 3 : 1) ||
    ex.dataset.length > (c.algorithm === 'BINARY' ? 31 : 12) ||
    ex.dataset.some((v) => !integer(v))
  )
    errors.push('Usa enteros de 0 a 999: de 3 a 31 para binaria y de 1 a 12 para encadenamiento.');
  if (new Set(ex.dataset.map(Number)).size !== ex.dataset.length)
    errors.push('No se admiten claves repetidas.');
  if (
    !Array.isArray(c.targets) ||
    c.targets.length < 1 ||
    c.targets.length > 6 ||
    c.targets.some((v) => !integer(v))
  )
    errors.push('Define de 1 a 6 objetivos enteros entre 0 y 999.');
  if (
    c.algorithm === 'BINARY' &&
    ex.dataset.some((v, i) => i > 0 && Number(v) <= Number(ex.dataset[i - 1]))
  )
    errors.push('La búsqueda binaria requiere un arreglo estrictamente creciente.');
  if (
    c.algorithm === 'CHAINING' &&
    (!Number.isInteger(c.tableSize) || c.tableSize! < 2 || c.tableSize! > 13)
  )
    errors.push('El tamaño de tabla debe ser un entero entre 2 y 13.');
  return errors;
}
export function newSearchExercise(
  algorithm: SearchAlgorithm,
  id: string = crypto.randomUUID(),
): Exercise {
  return {
    id,
    title: SEARCH_LABEL[algorithm],
    kind: 'SEARCH',
    treeType: 'BST',
    dataType: 'NUMBER',
    dataset:
      algorithm === 'BINARY' ? ['4', '9', '13', '18', '26', '35', '42'] : ['10', '17', '24', '8'],
    search: {
      algorithm,
      targets: algorithm === 'BINARY' ? ['26', '15', '4'] : ['24', '8', '31'],
      ...(algorithm === 'CHAINING' ? { tableSize: 7 } : {}),
    },
  };
}
export function searchTrace(ex: Exercise): SearchStep[] {
  const errors = searchErrors(ex);
  if (errors.length || !ex.search)
    throw new Error(errors.join(' ') || 'Falta configuración de búsqueda.');
  const config = ex.search;
  const board: SearchBoard = {
    low: 0,
    high: ex.dataset.length - 1,
    middle: null,
    buckets: Array.from(
      { length: config.algorithm === 'CHAINING' ? config.tableSize! : 0 },
      () => [],
    ),
    bucket: null,
    node: null,
    hashResult: null,
    stage: config.algorithm === 'CHAINING' ? 'INSERT' : 'SEARCH',
    key: '',
    query: 0,
    inserting: null,
    phase: '',
  };
  const trace: SearchStep[] = [];
  const emit = (action: SearchAction, category: SearchCategory, mutate = () => {}) => {
    const before = structuredClone(board);
    mutate();
    trace.push({ action, category, before, after: structuredClone(board) });
  };
  if (config.algorithm === 'BINARY') {
    for (let q = 0; q < config.targets.length; q++) {
      board.query = q;
      board.key = config.targets[q];
      board.low = 0;
      board.high = ex.dataset.length - 1;
      board.middle = null;
      board.phase = `Buscar ${board.key} · objetivo ${q + 1}/${config.targets.length}`;
      let found = false;
      while (board.low <= board.high) {
        const mid = Math.floor((board.low + board.high) / 2);
        emit({ type: 'middle', index: mid }, 'search', () => {
          board.middle = mid;
        });
        emit({ type: 'compare', index: mid }, 'search');
        const value = Number(ex.dataset[mid]),
          key = Number(board.key);
        if (value === key) {
          emit({ type: 'found' }, 'search');
          found = true;
          break;
        }
        if (value < key)
          emit({ type: 'left' }, 'search', () => {
            board.low = mid + 1;
            board.middle = null;
          });
        else
          emit({ type: 'right' }, 'search', () => {
            board.high = mid - 1;
            board.middle = null;
          });
      }
      if (!found) emit({ type: 'absent' }, 'search');
    }
  } else {
    const size = config.tableSize!;
    for (let i = 0; i < ex.dataset.length; i++) {
      board.stage = 'INSERT';
      board.inserting = i;
      board.key = ex.dataset[i];
      board.bucket = null;
      board.node = null;
      board.hashResult = null;
      board.phase = `Insertar clave ${board.key} · ${i + 1}/${ex.dataset.length}`;
      const k = Number(board.key) % size;
      emit({ type: 'hash', value: k }, 'hash', () => {
        board.hashResult = k;
      });
      emit({ type: 'bucket', index: k }, 'insert', () => {
        board.bucket = k;
      });
      const position = board.buckets[k].length;
      // value identifies the insertion card; index is its position in the chain.
      emit({ type: 'insert', value: i, index: position }, 'insert', () => {
        board.buckets[k].push(i);
      });
    }
    for (let q = 0; q < config.targets.length; q++) {
      board.stage = 'SEARCH';
      board.inserting = null;
      board.query = q;
      board.key = config.targets[q];
      board.bucket = null;
      board.node = null;
      board.hashResult = null;
      board.phase = `Buscar clave ${board.key} · ${q + 1}/${config.targets.length}`;
      const k = Number(board.key) % size;
      emit({ type: 'hash', value: k }, 'hash', () => {
        board.hashResult = k;
      });
      emit({ type: 'bucket', index: k }, 'search', () => {
        board.bucket = k;
      });
      const chain = board.buckets[k];
      let found = false;
      if (chain.length) {
        emit({ type: 'visit', index: 0, value: k }, 'search', () => {
          board.node = 0;
        });
        for (let i = 0; i < chain.length; i++) {
          emit({ type: 'compare' }, 'search');
          if (Number(ex.dataset[chain[i]]) === Number(board.key)) {
            emit({ type: 'found' }, 'search');
            found = true;
            break;
          }
          emit({ type: 'next' }, 'search', () => {
            board.node = i + 1;
          });
        }
      }
      if (!found) emit({ type: 'absent' }, 'search');
    }
  }
  return trace;
}
export function validSearchDraft(value: unknown): value is SearchDraft {
  if (!value || typeof value !== 'object') return false;
  const d = value as SearchDraft;
  return (
    d.version === 1 &&
    Array.isArray(d.actions) &&
    d.actions.length <= 3000 &&
    d.actions.every(
      (a) =>
        a &&
        Object.hasOwn(SEARCH_ACTIONS, a.type) &&
        (a.index === undefined || (Number.isInteger(a.index) && a.index >= 0 && a.index <= 999)) &&
        (a.value === undefined || (Number.isInteger(a.value) && a.value >= 0 && a.value <= 999)),
    )
  );
}
const same = (a: SearchAction, b: SearchAction) =>
  a.type === b.type && a.index === b.index && a.value === b.value;
export function replaySearch(ex: Exercise, draft?: SearchDraft) {
  if (draft && !validSearchDraft(draft)) throw new Error('Historial de búsqueda no válido.');
  const trace = searchTrace(ex);
  let cursor = 0;
  const metrics: Record<SearchCategory, { correct: number; errors: number; steps: number }> = {
    hash: { correct: 0, errors: 0, steps: 0 },
    insert: { correct: 0, errors: 0, steps: 0 },
    search: { correct: 0, errors: 0, steps: 0 },
  };
  trace.forEach((s) => metrics[s.category].steps++);
  const events: {
    action: SearchAction;
    accepted: boolean;
    step: number;
    category: SearchCategory;
  }[] = [];
  for (const action of draft?.actions || []) {
    const expected = trace[cursor];
    const accepted = !!expected && same(action, expected.action);
    const category = expected?.category || 'search';
    events.push({ action, accepted, step: cursor + 1, category });
    if (accepted) {
      metrics[category].correct++;
      cursor++;
    } else metrics[category].errors++;
  }
  return {
    cursor,
    totalSteps: trace.length,
    complete: cursor === trace.length,
    errors: Object.values(metrics).reduce((n, m) => n + m.errors, 0),
    metrics,
    events,
    board: cursor < trace.length ? trace[cursor].before : trace.at(-1)!.after,
  };
}
export function evaluateSearch(ex: Exercise, draft?: SearchDraft) {
  const r = replaySearch(ex, draft),
    weights: Record<SearchCategory, number> =
      ex.search!.algorithm === 'BINARY'
        ? { hash: 0, insert: 0, search: 100 }
        : { hash: 30, insert: 35, search: 35 };
  const labels = {
    hash: 'Cálculo de la función hash',
    insert: 'Inserciones y colisiones',
    search: 'Procedimiento de búsqueda',
  };
  const items = (Object.keys(weights) as SearchCategory[])
    .filter((k) => weights[k] > 0)
    .map((k) => {
      const m = r.metrics[k];
      const points = Math.round(
        weights[k] * (m.correct / (m.steps || 1)) * (m.correct / (m.correct + m.errors || 1)),
      );
      return {
        key: k,
        label: labels[k],
        correct: m.correct === m.steps && m.errors === 0,
        points,
        max: weights[k],
        expected: `${m.steps} pasos correctos sin errores`,
        given: `${m.correct} pasos correctos; ${m.errors} errores`,
      };
    });
  return {
    ...r,
    total: items.reduce((s, item) => s + item.points, 0),
    structureExact: r.complete && r.errors === 0,
    items,
  };
}

export function describeSearchAction(ex: Exercise, a: SearchAction): string {
  const label = SEARCH_ACTIONS[a.type];
  if (a.type === 'hash') return `${label}: ${a.value}`;
  if (a.type === 'insert')
    return `${label}: clave ${ex.dataset[a.value ?? -1] ?? '?'} en posición ${a.index}`;
  if (a.type === 'bucket') return `${label} ${a.index}`;
  if (a.type === 'visit') return `${label} ${a.index} de la cubeta ${a.value}`;
  return a.index === undefined ? label : `${label} (índice ${a.index})`;
}
