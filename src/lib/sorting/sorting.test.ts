import { describe, expect, it } from 'vitest';
import {
  ALGORITHMS,
  evaluateSorting,
  newSortingExercise,
  replaySorting,
  sortingErrors,
  sortingTrace,
} from './sorting';
import type { SortAction, SortDraft } from './sorting';
describe.each(ALGORITHMS)('%s', (algorithm) => {
  const datasets = [
    ['3', '1', '2'],
    ['0', '0', '0'],
    ['99', '0', '8', '99', '10', '1'],
    ['1', '2', '3', '4'],
    ['9', '8', '7', '6', '5', '4', '3', '2', '1', '0'],
  ];
  it.each(datasets.map((d) => [d]))('termina ordenado sin perder tarjetas: %j', (dataset) => {
    const ex = { ...newSortingExercise(algorithm, 'test'), dataset };
    const trace = sortingTrace(ex);
    const run = evaluateSorting(ex, { version: 1, actions: trace.map((s) => s.action) });
    expect(run.complete).toBe(true);
    expect(run.errors).toBe(0);
    expect(run.total).toBe(100);
    expect([...run.board.main].sort((a, b) => a - b)).toEqual(dataset.map((_, i) => i));
    expect(run.board.main.map((id) => Number(dataset[id]))).toEqual(
      dataset.map(Number).sort((a, b) => a - b),
    );
  });
  it('rechaza una pasada prematura sin mover tarjetas y conserva el error al reanudar', () => {
    const ex = { ...newSortingExercise(algorithm, 'test'), dataset: ['3', '1', '2'] };
    const draft: SortDraft = { version: 1, actions: [{ type: 'pass', cards: [] }] };
    const run = replaySorting(ex, JSON.parse(JSON.stringify(draft)));
    expect(run.cursor).toBe(0);
    expect(run.errors).toBe(1);
    expect(run.board.main).toEqual([0, 1, 2]);
    const finished = evaluateSorting(ex, {
      version: 1,
      actions: [...draft.actions, ...sortingTrace(ex).map((s) => s.action)],
    });
    expect(finished.complete).toBe(true);
    expect(finished.errors).toBe(1);
    expect(finished.total).toBeLessThan(100);
  });
});
it('exige comparar antes de intercambiar y rechaza pareja o destino incorrectos', () => {
  const ex = { ...newSortingExercise('BUBBLE', 'x'), dataset: ['3', '1', '2'] };
  let actions: SortAction[] = [{ type: 'swap', cards: [0, 1] }];
  expect(replaySorting(ex, { version: 1, actions }).cursor).toBe(0);
  actions.push({ type: 'compare', cards: [0, 2] });
  expect(replaySorting(ex, { version: 1, actions }).cursor).toBe(0);
  actions.push({ type: 'compare', cards: [1, 0] });
  expect(replaySorting(ex, { version: 1, actions }).cursor).toBe(1);
  actions.push({ type: 'swap', cards: [0, 1] });
  expect(replaySorting(ex, { version: 1, actions }).board.main).toEqual([1, 0, 2]);
  const radix = { ...ex, sorting: { algorithm: 'RADIX' as const } };
  expect(
    replaySorting(radix, { version: 1, actions: [{ type: 'distribute', cards: [0], target: 2 }] })
      .cursor,
  ).toBe(0);
  expect(
    replaySorting(radix, { version: 1, actions: [{ type: 'distribute', cards: [0], target: 3 }] })
      .cursor,
  ).toBe(1);
});
it.each(['BUCKET', 'RADIX', 'COUNTING', 'MERGE', 'INSERTION', 'BUBBLE'] as const)(
  'preserva orden estable de valores iguales en %s',
  (algorithm) => {
    const ex = { ...newSortingExercise(algorithm, 'x'), dataset: ['12', '3', '12', '3', '12'] };
    const result = sortingTrace(ex).at(-1)!.board.main;
    expect(result).toEqual([1, 3, 0, 2, 4]);
  },
);
it('rechaza rangos o tamaños no soportados antes de construir pasos', () => {
  for (const dataset of [
    [],
    ['1', '2'],
    ['1', '-1', '2'],
    ['1', '100', '2'],
    ['1', '2.5', '2'],
    Array(13).fill('3'),
  ]) {
    const ex = { ...newSortingExercise('COUNTING', 'x'), dataset };
    expect(sortingErrors(ex).length).toBeGreaterThan(0);
    expect(() => sortingTrace(ex)).toThrow();
  }
});

it('no acepta historiales dañados o versiones desconocidas', () => {
  const ex = newSortingExercise('BUBBLE', 'bad');
  for (const draft of [
    { version: 2, actions: [] },
    { version: 1, actions: [{ type: 'swap', cards: null }] },
    { version: 1, actions: Array(5001).fill({ type: 'pass', cards: [] }) },
  ]) {
    expect(() => replaySorting(ex, draft as unknown as SortDraft)).toThrow('Historial');
  }
});
