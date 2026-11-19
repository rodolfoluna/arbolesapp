import { expect, it } from 'vitest';
import {
  newSearchExercise,
  searchErrors,
  searchTrace,
  replaySearch,
  evaluateSearch,
  type SearchAction,
  type SearchDraft,
} from './search';
const binary = () => newSearchExercise('BINARY', 'binary');
const hash = () => newSearchExercise('CHAINING', 'hash');
it('binaria encuentra extremos y centro y termina ausencias sin comparar fuera del arreglo', () => {
  const ex = {
    ...binary(),
    search: { algorithm: 'BINARY' as const, targets: ['4', '18', '42', '0', '15', '999'] },
  };
  const trace = searchTrace(ex);
  const result = evaluateSearch(ex, { version: 1, actions: trace.map((s) => s.action) });
  expect(result.complete).toBe(true);
  expect(result.total).toBe(100);
  expect(trace.filter((s) => s.action.type === 'found')).toHaveLength(3);
  expect(trace.filter((s) => s.action.type === 'absent')).toHaveLength(3);
  for (const step of trace.filter((s) => s.action.type === 'middle'))
    expect(step.action.index).toBe(Math.floor((step.before.low + step.before.high) / 2));
  for (const step of trace.filter((s) => s.action.type === 'absent'))
    expect(step.before.low).toBeGreaterThan(step.before.high);
});
it('binaria rechaza punto medio, comparación y descarte incorrectos sin avanzar', () => {
  const ex = binary();
  const wrong: SearchAction[] = [
    { type: 'middle', index: 2 },
    { type: 'compare', index: 3 },
    { type: 'left' },
  ];
  const r = replaySearch(ex, { version: 1, actions: wrong });
  expect(r.cursor).toBe(0);
  expect(r.errors).toBe(3);
  expect(r.board.low).toBe(0);
  expect(r.board.high).toBe(6);
  const actions = [...wrong, ...searchTrace(ex).map((s) => s.action)];
  const done = evaluateSearch(ex, { version: 1, actions });
  expect(done.complete).toBe(true);
  expect(done.total).toBeLessThan(100);
});
it('hash conserva todas las claves, inserta colisiones al final y busca secuencialmente hasta ∅', () => {
  const ex = hash(),
    trace = searchTrace(ex);
  const r = evaluateSearch(ex, { version: 1, actions: trace.map((s) => s.action) });
  expect(r.complete).toBe(true);
  expect(r.total).toBe(100);
  expect(r.board.buckets[3]).toEqual([0, 1, 2]);
  expect(r.board.buckets[1]).toEqual([3]);
  expect(r.items.map((i) => i.max)).toEqual([30, 35, 35]);
  const missing = trace.filter((s) => s.before.stage === 'SEARCH' && s.before.key === '31');
  expect(missing.filter((s) => s.action.type === 'compare')).toHaveLength(3);
  expect(missing.at(-1)!.action.type).toBe('absent');
  expect(missing.at(-1)!.before.node).toBe(3);
  for (const s of trace.filter((s) => s.action.type === 'hash'))
    expect(s.action.value).toBe(Number(s.before.key) % 7);
});
it('hash exige calcular antes de elegir cubeta y no permite reemplazar una colisión', () => {
  const ex = hash();
  const prefix: SearchAction[] = [
    { type: 'hash', value: 3 },
    { type: 'bucket', index: 3 },
    { type: 'insert', value: 0, index: 0 },
    { type: 'hash', value: 3 },
    { type: 'bucket', index: 3 },
  ];
  const draft: SearchDraft = {
    version: 1,
    actions: [
      { type: 'hash', value: 2 },
      { type: 'bucket', index: 3 },
      ...prefix,
      { type: 'insert', value: 1, index: 0 },
    ],
  };
  const r = replaySearch(ex, draft);
  expect(r.cursor).toBe(5);
  expect(r.errors).toBe(3);
  expect(r.board.buckets[3]).toEqual([0]);
  const resumed = replaySearch(
    ex,
    JSON.parse(
      JSON.stringify({
        ...draft,
        actions: [...draft.actions, { type: 'insert', value: 1, index: 1 }],
      }),
    ),
  );
  expect(resumed.cursor).toBe(6);
  expect(resumed.board.buckets[3]).toEqual([0, 1]);
  expect(resumed.errors).toBe(3);
});
it('cubeta vacía permite declarar ausencia sin visitar nodos ni comparar', () => {
  const ex = hash();
  ex.search!.targets = ['2'];
  const trace = searchTrace(ex),
    steps = trace.filter((s) => s.before.stage === 'SEARCH');
  expect(steps.map((s) => s.action.type)).toEqual(['hash', 'bucket', 'absent']);
});
it('rechaza saltarse nodos o declarar ausencia al principio de una cadena', () => {
  const ex = hash(),
    trace = searchTrace(ex),
    start = trace.findIndex((s) => s.before.stage === 'SEARCH');
  const draft: SearchDraft = {
    version: 1,
    actions: [
      ...trace.slice(0, start + 2).map((s) => s.action),
      { type: 'visit', index: 2, value: 3 },
      { type: 'absent' },
    ],
  };
  const r = replaySearch(ex, draft);
  expect(r.cursor).toBe(start + 2);
  expect(r.errors).toBe(2);
  expect(r.board.node).toBeNull();
});
it('valida orden, claves únicas, tamaño, objetivos y límites antes de crear pasos', () => {
  const cases = [
    { ...binary(), dataset: ['9', '4', '13'] },
    { ...binary(), dataset: ['1', '1', '2'] },
    { ...hash(), dataset: ['-1'] },
    { ...hash(), dataset: ['1000'] },
    { ...hash(), search: { ...hash().search!, tableSize: 1 } },
    { ...binary(), search: { ...binary().search!, targets: [] } },
  ];
  for (const ex of cases) {
    expect(searchErrors(ex).length).toBeGreaterThan(0);
    expect(() => searchTrace(ex)).toThrow();
  }
  expect(() =>
    replaySearch(binary(), { version: 2, actions: [] } as unknown as SearchDraft),
  ).toThrow('Historial');
});
it.each([2, 3, 7, 13])('hash funciona con tamaño %s, clave cero y extremos', (size) => {
  const ex = {
    ...hash(),
    dataset: ['0', '999', '26', '13', '1'],
    search: { algorithm: 'CHAINING' as const, tableSize: size, targets: ['0', '999', '998', '1'] },
  };
  const r = evaluateSearch(ex, { version: 1, actions: searchTrace(ex).map((s) => s.action) });
  expect(r.total).toBe(100);
  expect(r.board.buckets.flat().sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
});
