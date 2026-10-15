import type { AnswerKey, Answers, BNode, EvalSettings, Exercise, FlatTree } from './types';
import { computeProps, pathMap, toNested, type TreeProps } from './analyze';
import { buildExpected } from './generate';
import { splitList, valueKey } from './values';

export type ItemKey = 'structure' | AnswerKey;

export interface ItemResult {
  key: ItemKey;
  label: string;
  correct: boolean;
  points: number;
  max: number;
  expected: string;
  given: string;
}

export interface Evaluation {
  items: ItemResult[];
  total: number; // 0..100
  structureExact: boolean;
  /** Proporción de posiciones correctas en el árbol (0..1). */
  structureMatch: number;
  expectedTree: BNode | null;
  expectedProps: TreeProps;
}

/** Puntos por rubro (suman 100). */
export const WEIGHTS: Record<ItemKey, number> = {
  structure: 30,
  root: 10,
  leaves: 10,
  internals: 10,
  height: 10,
  preorder: 10,
  inorder: 10,
  postorder: 10,
};

export const ITEM_LABEL: Record<ItemKey, string> = {
  structure: 'Estructura del árbol',
  root: 'Raíz',
  leaves: 'Nodos hoja',
  internals: 'Nodos internos (rama)',
  height: 'Altura',
  preorder: 'Preorden',
  inorder: 'Enorden (inorden)',
  postorder: 'Postorden',
};

/**
 * Si es true, la estructura otorga crédito parcial proporcional a los nodos en la
 * posición correcta. Si es false, es todo o nada (esIgual(A, B)).
 */
export const STRUCTURE_PARTIAL_CREDIT = true;

const join = (xs: string[]) => xs.join(', ');

function sameSequence(a: string[], b: string[], key: (v: string) => string) {
  return a.length === b.length && a.every((v, i) => key(v) === key(b[i]));
}

/** Compara como multiconjunto (no importa el orden, sí las repeticiones). */
function sameMultiset(a: string[], b: string[], key: (v: string) => string) {
  if (a.length !== b.length) return false;
  const sa = a.map(key).sort();
  const sb = b.map(key).sort();
  return sa.every((v, i) => v === sb[i]);
}

export function expectedFor(ex: Exercise): BNode | null {
  return buildExpected(ex.treeType, ex.dataset, ex.dataType);
}

export function evaluateExercise(
  ex: Exercise,
  settings: EvalSettings,
  studentTree: FlatTree | null | undefined,
  answers: Partial<Answers> | null | undefined,
): Evaluation {
  const key = (v: string) => valueKey(v, ex.dataType);
  const expectedTree = expectedFor(ex);
  const exp = computeProps(expectedTree, settings.heightMode, settings.rootIsInternal);
  const student = studentTree ? toNested(studentTree) : null;
  const a: Answers = {
    root: answers?.root ?? '',
    leaves: answers?.leaves ?? '',
    internals: answers?.internals ?? '',
    height: answers?.height ?? '',
    preorder: answers?.preorder ?? '',
    inorder: answers?.inorder ?? '',
    postorder: answers?.postorder ?? '',
  };

  // --- Estructura (posición por posición) ---
  const pe = pathMap(expectedTree);
  const ps = pathMap(student);
  let matches = 0;
  for (const [path, val] of pe) {
    const sv = ps.get(path);
    if (sv !== undefined && key(sv) === key(val)) matches++;
  }
  const denom = Math.max(pe.size, ps.size);
  const structureMatch = denom === 0 ? 1 : matches / denom;
  const structureExact = pe.size === ps.size && matches === pe.size;
  const structurePoints = structureExact
    ? WEIGHTS.structure
    : STRUCTURE_PARTIAL_CREDIT
      ? Math.round(WEIGHTS.structure * structureMatch * 10) / 10
      : 0;

  const items: ItemResult[] = [
    {
      key: 'structure',
      label: ITEM_LABEL.structure,
      correct: structureExact,
      points: structurePoints,
      max: WEIGHTS.structure,
      expected: `${pe.size} nodos`,
      given: `${matches}/${pe.size} nodos en su posición` + (ps.size > pe.size ? ` (${ps.size - pe.size} de más)` : ''),
    },
  ];

  const push = (k: AnswerKey, correct: boolean, expected: string) => {
    items.push({
      key: k,
      label: ITEM_LABEL[k],
      correct,
      points: correct ? WEIGHTS[k] : 0,
      max: WEIGHTS[k],
      expected,
      given: a[k].trim(),
    });
  };

  const rootGiven = splitList(a.root);
  push('root', rootGiven.length === 1 && !!expectedTree && key(rootGiven[0]) === key(exp.root), exp.root);
  push('leaves', a.leaves.trim() !== '' && sameMultiset(splitList(a.leaves), exp.leaves, key), join(exp.leaves));
  const internalsGiven = splitList(a.internals);
  const internalsOk =
    exp.internals.length === 0
      ? /^\s*(-|ninguno|ninguna|n\/a|0)?\s*$/i.test(a.internals) && a.internals.trim() !== ''
      : sameMultiset(internalsGiven, exp.internals, key);
  push('internals', internalsOk, exp.internals.length ? join(exp.internals) : 'ninguno (escribe "-")');
  const hGiven = a.height.trim();
  push('height', hGiven !== '' && /^-?\d+$/.test(hGiven) && Number(hGiven) === exp.height, String(exp.height));
  push('preorder', a.preorder.trim() !== '' && sameSequence(splitList(a.preorder), exp.preorder, key), join(exp.preorder));
  push('inorder', a.inorder.trim() !== '' && sameSequence(splitList(a.inorder), exp.inorder, key), join(exp.inorder));
  push('postorder', a.postorder.trim() !== '' && sameSequence(splitList(a.postorder), exp.postorder, key), join(exp.postorder));

  const total = Math.round(items.reduce((s, it) => s + it.points, 0));
  return { items, total, structureExact, structureMatch, expectedTree, expectedProps: exp };
}

/** ¿El alumno ya llenó todo lo necesario para entregar? */
export function isComplete(tree: FlatTree | null | undefined, answers: Partial<Answers> | null | undefined): boolean {
  if (!tree?.rootId || !answers) return false;
  return (['root', 'leaves', 'internals', 'height', 'preorder', 'inorder', 'postorder'] as AnswerKey[]).every(
    (k) => (answers[k] ?? '').trim() !== '',
  );
}
