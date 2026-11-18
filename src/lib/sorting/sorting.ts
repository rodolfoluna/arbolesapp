import type { Exercise } from '../tree/types';

export const ALGORITHMS = [
  'BUCKET',
  'RADIX',
  'COUNTING',
  'SHELL',
  'HEAP',
  'QUICK',
  'MERGE',
  'INSERTION',
  'SELECTION',
  'BUBBLE',
] as const;
export type SortAlgorithm = (typeof ALGORITHMS)[number];
export const SORT_LABEL: Record<SortAlgorithm, string> = {
  BUCKET: 'Bucket',
  RADIX: 'Radix',
  COUNTING: 'Counting',
  SHELL: 'Shell',
  HEAP: 'Heap',
  QUICK: 'Quick',
  MERGE: 'Merge',
  INSERTION: 'Insertion',
  SELECTION: 'Selection',
  BUBBLE: 'Bubble',
};
export const SORT_VARIANT: Record<SortAlgorithm, string> = {
  BUBBLE:
    'Ascendente. Recorrido de izquierda a derecha; una pasada completa por cada extremo, sin corte anticipado.',
  SELECTION:
    'Buscar el mínimo de izquierda a derecha; conservar el primero en empates; intercambiar al terminar cada búsqueda.',
  INSERTION:
    'Extraer la clave; comparar hacia la izquierda; desplazar los mayores e insertar la clave en el hueco.',
  SHELL:
    'Inserción por saltos: floor(n/2), mitades enteras, hasta 1. Extraer clave y desplazar los mayores.',
  HEAP: 'Max-heap, construcción desde el último padre. Comparar hijo izquierdo y luego derecho; desempate conserva el padre. Extraer raíz al extremo.',
  QUICK:
    'Lomuto, pivote final. Comparar de izquierda a derecha usando ≤ pivote. Recursión izquierda y luego derecha; no hay intercambios consigo mismo.',
  MERGE:
    'División superior, mitad izquierda primero. Mezcla estable: en empate tomar izquierda; copiar al auxiliar y escribir de regreso.',
  BUCKET:
    'Diez cubetas por decenas (0–9, 10–19, …, 90–99). Distribuir de izquierda a derecha, ordenar cada cubeta con inserción por intercambios adyacentes y recoger en orden.',
  RADIX:
    'LSD decimal estable: unidades y después decenas, solo las posiciones necesarias. Distribución izquierda a derecha y recogida FIFO de las cubetas 0 a 9.',
  COUNTING:
    'Estable. Contar de izquierda a derecha, acumular de 1 al máximo, colocar desde la derecha en salida y copiar al arreglo.',
};
export const ACTION_LABEL = {
  compare: 'Comparar',
  swap: 'Intercambiar',
  take: 'Extraer clave',
  shift: 'Desplazar',
  insert: 'Insertar clave',
  pass: 'Siguiente pasada',
  minimum: 'Marcar mínimo',
  pivot: 'Elegir pivote',
  split: 'Dividir',
  copy: 'Copiar al auxiliar',
  write: 'Escribir en arreglo',
  distribute: 'Enviar a cubeta',
  collect: 'Recoger de cubeta',
  count: 'Contar',
  accumulate: 'Acumular conteo',
  place: 'Colocar en salida',
  extract: 'Extraer máximo',
} as const;
export type SortActionType = keyof typeof ACTION_LABEL;
export interface SortAction {
  type: SortActionType;
  cards: number[];
  target?: number;
}
export interface SortDraft {
  version: 1;
  actions: SortAction[];
}
export interface SortBoard {
  main: number[];
  auxiliary: number[];
  bins: number[][];
  counts: number[];
  held: number | null;
  phase: string;
}
export interface SortStep {
  action: SortAction;
  board: SortBoard;
}
export const SORT_ACTIONS: Record<SortAlgorithm, SortActionType[]> = {
  BUBBLE: ['compare', 'swap', 'pass'],
  SELECTION: ['compare', 'minimum', 'swap', 'pass'],
  INSERTION: ['take', 'compare', 'shift', 'insert', 'pass'],
  SHELL: ['take', 'compare', 'shift', 'insert', 'pass'],
  HEAP: ['compare', 'swap', 'extract', 'pass'],
  QUICK: ['pivot', 'compare', 'swap', 'pass'],
  MERGE: ['split', 'compare', 'copy', 'write', 'pass'],
  BUCKET: ['distribute', 'compare', 'swap', 'collect', 'pass'],
  RADIX: ['distribute', 'collect', 'pass'],
  COUNTING: ['count', 'accumulate', 'place', 'write', 'pass'],
};
export const TARGET_ACTIONS: SortActionType[] = [
  'insert',
  'shift',
  'copy',
  'write',
  'distribute',
  'collect',
  'count',
  'accumulate',
  'place',
];
export const isSortingExercise = (ex: Pick<Exercise, 'kind'> | null | undefined) =>
  ex?.kind === 'SORTING';
export function sortingErrors(ex: Exercise): string[] {
  if (!isSortingExercise(ex)) return [];
  const errors: string[] = [];
  if (!ex.sorting || !ALGORITHMS.includes(ex.sorting.algorithm))
    errors.push('Selecciona un algoritmo de ordenamiento.');
  if (
    ex.dataType !== 'NUMBER' ||
    ex.dataset.length < 3 ||
    ex.dataset.length > 12 ||
    ex.dataset.some((v) => !/^\d{1,2}$/.test(v) || Number(v) > 99)
  )
    errors.push('Usa de 3 a 12 números enteros entre 0 y 99. Se admiten repetidos.');
  return errors;
}
export function newSortingExercise(
  algorithm: SortAlgorithm,
  id: string = crypto.randomUUID(),
): Exercise {
  return {
    id,
    title: SORT_LABEL[algorithm],
    kind: 'SORTING',
    treeType: 'BST',
    dataType: 'NUMBER',
    dataset: ['42', '17', '8', '63', '24', '5'],
    sorting: { algorithm },
  };
}
export function initialBoard(ex: Exercise): SortBoard {
  return {
    main: ex.dataset.map((_, i) => i),
    auxiliary: Array(ex.dataset.length).fill(-1),
    bins: Array.from({ length: 10 }, () => []),
    counts: Array(Math.max(...ex.dataset.map(Number)) + 1).fill(0),
    held: null,
    phase: 'Inicio',
  };
}
/** Canonical steps include snapshots only locally; cloud drafts contain the compact action log. */
export function sortingTrace(ex: Exercise): SortStep[] {
  const errors = sortingErrors(ex);
  if (errors.length || !ex.sorting) throw new Error(errors.join(' ') || 'Falta algoritmo');
  const b = initialBoard(ex),
    steps: SortStep[] = [];
  const value = (id: number) => Number(ex.dataset[id]);
  const emit = (type: SortActionType, cards: number[] = [], target?: number, mutate = () => {}) => {
    mutate();
    steps.push({
      action: { type, cards, ...(target === undefined ? {} : { target }) },
      board: structuredClone(b),
    });
  };
  const compare = (a: number, c: number) => emit('compare', [a, c]);
  const swap = (i: number, j: number) => {
    if (i !== j)
      emit('swap', [b.main[i], b.main[j]], undefined, () => {
        [b.main[i], b.main[j]] = [b.main[j], b.main[i]];
      });
  };
  const pass = () => emit('pass');
  const n = b.main.length;
  const insertion = (gap: number) => {
    for (let i = gap; i < n; i++) {
      b.phase = `Salto ${gap} · insertar posición ${i}`;
      const key = b.main[i];
      emit('take', [key], undefined, () => {
        b.held = key;
        b.main[i] = -1;
      });
      let j = i;
      while (j >= gap) {
        compare(b.main[j - gap], key);
        if (value(b.main[j - gap]) <= value(key)) break;
        const from = j - gap;
        emit('shift', [b.main[from]], j, () => {
          b.main[j] = b.main[from];
          b.main[from] = -1;
        });
        j = from;
      }
      emit('insert', [key], j, () => {
        b.main[j] = key;
        b.held = null;
      });
      pass();
    }
  };
  switch (ex.sorting.algorithm) {
    case 'BUBBLE':
      for (let end = n - 1; end > 0; end--) {
        b.phase = `Burbuja · extremo ${end}`;
        for (let j = 0; j < end; j++) {
          compare(b.main[j], b.main[j + 1]);
          if (value(b.main[j]) > value(b.main[j + 1])) swap(j, j + 1);
        }
        pass();
      }
      break;
    case 'SELECTION':
      for (let i = 0; i < n - 1; i++) {
        let min = i;
        b.phase = `Selección · posición ${i}`;
        for (let j = i + 1; j < n; j++) {
          compare(b.main[min], b.main[j]);
          if (value(b.main[j]) < value(b.main[min])) {
            emit('minimum', [b.main[j]]);
            min = j;
          }
        }
        swap(i, min);
        pass();
      }
      break;
    case 'INSERTION':
      insertion(1);
      break;
    case 'SHELL':
      for (let gap = Math.floor(n / 2); gap > 0; gap = Math.floor(gap / 2)) insertion(gap);
      break;
    case 'HEAP': {
      const sift = (start: number, size: number) => {
        let root = start;
        while (root * 2 + 1 < size) {
          let largest = root;
          const l = root * 2 + 1,
            r = l + 1;
          compare(b.main[largest], b.main[l]);
          if (value(b.main[l]) > value(b.main[largest])) largest = l;
          if (r < size) {
            compare(b.main[largest], b.main[r]);
            if (value(b.main[r]) > value(b.main[largest])) largest = r;
          }
          if (largest === root) break;
          swap(root, largest);
          root = largest;
        }
      };
      b.phase = 'Construir max-heap';
      for (let i = Math.floor(n / 2) - 1; i >= 0; i--) sift(i, n);
      pass();
      for (let end = n - 1; end > 0; end--) {
        b.phase = `Extraer máximo · extremo ${end}`;
        emit('extract', [b.main[0], b.main[end]], undefined, () => {
          [b.main[0], b.main[end]] = [b.main[end], b.main[0]];
        });
        sift(0, end);
        pass();
      }
      break;
    }
    case 'QUICK': {
      const quick = (lo: number, hi: number) => {
        if (lo >= hi) return;
        b.phase = `Partición [${lo}, ${hi}]`;
        const pivot = b.main[hi];
        emit('pivot', [pivot]);
        let i = lo;
        for (let j = lo; j < hi; j++) {
          compare(b.main[j], pivot);
          if (value(b.main[j]) <= value(pivot)) {
            swap(i, j);
            i++;
          }
        }
        swap(i, hi);
        pass();
        quick(lo, i - 1);
        quick(i + 1, hi);
      };
      quick(0, n - 1);
      break;
    }
    case 'MERGE': {
      const merge = (lo: number, hi: number) => {
        if (lo >= hi) return;
        const mid = Math.floor((lo + hi) / 2);
        b.phase = `Dividir [${lo}, ${hi}] en ${mid}`;
        emit('split', [b.main[lo], b.main[hi]]);
        merge(lo, mid);
        merge(mid + 1, hi);
        b.phase = `Mezclar [${lo}, ${mid}] y [${mid + 1}, ${hi}]`;
        const left = b.main.slice(lo, mid + 1),
          right = b.main.slice(mid + 1, hi + 1);
        let l = 0,
          r = 0,
          k = lo;
        while (l < left.length || r < right.length) {
          let id: number;
          if (l < left.length && r < right.length) {
            compare(left[l], right[r]);
            id = value(left[l]) <= value(right[r]) ? left[l++] : right[r++];
          } else id = l < left.length ? left[l++] : right[r++];
          const dest = k++;
          emit('copy', [id], dest, () => {
            b.auxiliary[dest] = id;
          });
        }
        for (let j = lo; j <= hi; j++) {
          const id = b.auxiliary[j];
          emit('write', [id], j, () => {
            b.main[j] = id;
            b.auxiliary[j] = -1;
          });
        }
        pass();
      };
      merge(0, n - 1);
      break;
    }
    case 'BUCKET':
    case 'RADIX': {
      const radix = ex.sorting.algorithm === 'RADIX';
      const max = Math.max(...ex.dataset.map(Number));
      for (let digit = 1; digit <= (radix ? Math.max(1, max) : 1); digit *= 10) {
        b.phase = radix
          ? `Distribuir · dígito ${digit === 1 ? 'unidades' : 'decenas'}`
          : 'Distribuir por decenas';
        for (let i = 0; i < n; i++) {
          const id = b.main[i],
            bucket = radix ? Math.floor(value(id) / digit) % 10 : Math.floor(value(id) / 10);
          emit('distribute', [id], bucket, () => {
            b.bins[bucket].push(id);
            b.main[i] = -1;
          });
        }
        pass();
        if (!radix)
          for (let k = 0; k < 10; k++) {
            b.phase = `Ordenar cubeta ${k} por inserción`;
            const bin = b.bins[k];
            for (let i = 1; i < bin.length; i++) {
              let j = i;
              while (j > 0) {
                compare(bin[j - 1], bin[j]);
                if (value(bin[j - 1]) <= value(bin[j])) break;
                const at = j;
                emit('swap', [bin[j - 1], bin[j]], undefined, () => {
                  [bin[at - 1], bin[at]] = [bin[at], bin[at - 1]];
                });
                j--;
              }
            }
          }
        b.phase = radix ? 'Recoger cubetas FIFO de 0 a 9' : 'Recoger cubetas de 0 a 9';
        let out = 0;
        for (const bin of b.bins)
          while (bin.length) {
            const id = bin[0],
              dest = out++;
            emit('collect', [id], dest, () => {
              b.main[dest] = bin.shift()!;
            });
          }
        pass();
        if (!radix) break;
      }
      break;
    }
    case 'COUNTING': {
      b.phase = 'Contar frecuencias de izquierda a derecha';
      for (const id of b.main) {
        const k = value(id);
        emit('count', [id], k, () => {
          b.counts[k]++;
        });
      }
      pass();
      b.phase = 'Acumular conteos desde 1 hasta el máximo';
      for (let k = 1; k < b.counts.length; k++)
        emit('accumulate', [], k, () => {
          b.counts[k] += b.counts[k - 1];
        });
      pass();
      b.phase = 'Salida estable: recorrer origen de derecha a izquierda';
      for (let i = n - 1; i >= 0; i--) {
        const id = b.main[i],
          k = value(id),
          dest = b.counts[k] - 1;
        emit('place', [id], dest, () => {
          b.auxiliary[dest] = id;
          b.counts[k]--;
        });
      }
      pass();
      b.phase = 'Copiar salida al arreglo';
      for (let i = 0; i < n; i++) {
        const id = b.auxiliary[i];
        emit('write', [id], i, () => {
          b.main[i] = id;
          b.auxiliary[i] = -1;
        });
      }
      pass();
      break;
    }
  }
  return steps;
}
function sameAction(a: SortAction, b: SortAction) {
  if (a.type !== b.type || a.target !== b.target || a.cards.length !== b.cards.length) return false;
  const symmetric = ['compare', 'swap', 'extract', 'split'].includes(a.type);
  return (symmetric ? [...a.cards].sort((x, y) => x - y) : a.cards).every(
    (id, i) => id === (symmetric ? [...b.cards].sort((x, y) => x - y) : b.cards)[i],
  );
}
export function validSortingDraft(draft: unknown): draft is SortDraft {
  if (!draft || typeof draft !== 'object') return false;
  const d = draft as SortDraft;
  return (
    d.version === 1 &&
    Array.isArray(d.actions) &&
    d.actions.length <= 5000 &&
    d.actions.every(
      (a) =>
        a &&
        Object.hasOwn(ACTION_LABEL, a.type) &&
        Array.isArray(a.cards) &&
        a.cards.length <= 2 &&
        a.cards.every((id) => Number.isInteger(id) && id >= 0 && id <= 11) &&
        (a.target === undefined || (Number.isInteger(a.target) && a.target >= 0 && a.target <= 99)),
    )
  );
}
export function replaySorting(ex: Exercise, draft?: SortDraft) {
  const trace = sortingTrace(ex);
  let cursor = 0,
    errors = 0;
  const events: { accepted: boolean; action: SortAction; step: number }[] = [];
  if (draft && !validSortingDraft(draft)) throw new Error('Historial de ordenamiento no válido.');
  for (const action of draft?.actions || []) {
    const accepted = cursor < trace.length && sameAction(action, trace[cursor].action);
    events.push({ accepted, action, step: cursor + 1 });
    if (accepted) cursor++;
    else errors++;
  }
  const complete = cursor === trace.length;
  return {
    cursor,
    errors,
    complete,
    totalSteps: trace.length,
    board: cursor ? trace[cursor - 1].board : initialBoard(ex),
    phase: trace[cursor]?.board.phase || 'Terminado',
    events,
  };
}
export function evaluateSorting(ex: Exercise, draft?: SortDraft) {
  const r = replaySorting(ex, draft);
  const progress = r.cursor / r.totalSteps;
  const accuracy = r.cursor / (r.cursor + r.errors || 1);
  return {
    ...r,
    total: Math.round(100 * progress * accuracy),
    structureExact: r.complete,
    items: [
      {
        key: 'procedure',
        label: 'Procedimiento correcto',
        correct: r.complete,
        points: Math.round(100 * progress * accuracy),
        max: 100,
        expected: `${r.totalSteps} pasos correctos, sin errores`,
        given: `${r.cursor} pasos correctos; ${r.errors} errores; ${r.complete ? 'completo' : 'incompleto'}`,
      },
    ],
  };
}
