import { describe, expect, it } from 'vitest';
import { buildAVL, buildBST, buildComplete } from './generate';
import { computeProps, inorder, levelOrder, postorder, preorder, toFlat } from './analyze';
import { evaluateExercise } from './evaluate';
import { addChild, deleteSubtree, setRoot, treeValues } from './edit';
import type { Exercise } from './types';

describe('generadores', () => {
  it('binario por niveles', () => {
    const t = buildComplete(['1', '2', '3', '4', '5']);
    expect(levelOrder(t)).toEqual(['1', '2', '3', '4', '5']);
    expect(preorder(t)).toEqual(['1', '2', '4', '5', '3']);
  });

  it('BST con duplicados a la derecha', () => {
    const t = buildBST(['50', '30', '70', '50', '30'], 'NUMBER');
    expect(preorder(t)).toEqual(['50', '30', '30', '70', '50']);
    expect(inorder(t)).toEqual(['30', '30', '50', '50', '70']);
  });

  it('BST numérico no lexicográfico', () => {
    const t = buildBST(['9', '10', '100', '2'], 'NUMBER');
    expect(inorder(t)).toEqual(['2', '9', '10', '100']);
  });

  it('BST con letras (orden alfabético español)', () => {
    const t = buildBST(['M', 'Ñ', 'N', 'O', 'a'], 'STRING');
    expect(inorder(t)).toEqual(['a', 'M', 'N', 'Ñ', 'O']);
  });

  it('AVL caso LR del plan', () => {
    const t = buildAVL(['45', '20', '60', '10', '30', '25'], 'NUMBER');
    expect(preorder(t)).toEqual(['30', '20', '10', '25', '45', '60']);
    expect(inorder(t)).toEqual(['10', '20', '25', '30', '45', '60']);
    expect(postorder(t)).toEqual(['10', '25', '20', '60', '45', '30']);
  });

  it('AVL rotaciones simples', () => {
    expect(preorder(buildAVL(['10', '20', '30'], 'NUMBER'))).toEqual(['20', '10', '30']); // RR
    expect(preorder(buildAVL(['30', '20', '10'], 'NUMBER'))).toEqual(['20', '10', '30']); // LL
    expect(preorder(buildAVL(['30', '10', '20'], 'NUMBER'))).toEqual(['20', '10', '30']); // LR
    expect(preorder(buildAVL(['10', '30', '20'], 'NUMBER'))).toEqual(['20', '10', '30']); // RL
  });

  it('AVL secuencia ascendente queda balanceado', () => {
    const t = buildAVL(['1', '2', '3', '4', '5', '6', '7'], 'NUMBER');
    expect(preorder(t)).toEqual(['4', '2', '1', '3', '6', '5', '7']);
  });
});

describe('propiedades', () => {
  const t = buildAVL(['45', '20', '60', '10', '30', '25'], 'NUMBER');
  it('altura y conjuntos', () => {
    const p = computeProps(t, 'EDGES', false);
    expect(p.height).toBe(2);
    expect(computeProps(t, 'LEVELS', false).height).toBe(3);
    expect(p.leaves).toEqual(['10', '25', '60']);
    expect(p.internals).toEqual(['20', '45']);
    expect(computeProps(t, 'EDGES', true).internals).toEqual(['30', '20', '45']);
  });
});

describe('evaluación', () => {
  const ex: Exercise = { id: 'e1', title: 'E1', treeType: 'AVL', dataType: 'NUMBER', dataset: ['45', '20', '60', '10', '30', '25'] };
  const settings = { heightMode: 'LEVELS' as const, rootIsInternal: false };

  it('respuesta perfecta = 100', () => {
    const tree = toFlat(buildAVL(ex.dataset, 'NUMBER'));
    const r = evaluateExercise(ex, settings, tree, {
      root: '30',
      leaves: '60, 10, 25',
      internals: '45 20',
      height: '3',
      preorder: '30, 20, 10, 25, 45, 60',
      inorder: '10,20,25,30,45,60',
      postorder: '10 25 20 60 45 30',
    });
    expect(r.structureExact).toBe(true);
    expect(r.total).toBe(100);
  });

  it('árbol manual BST sin balancear recibe crédito parcial', () => {
    let tree = setRoot({ rootId: null, nodes: {} }, '45').tree;
    const root = tree.rootId!;
    const a = addChild(tree, root, 'l', '20')!;
    tree = a.tree;
    tree = addChild(tree, root, 'r', '60')!.tree;
    const r = evaluateExercise(ex, settings, tree, {});
    expect(r.structureExact).toBe(false);
    expect(r.total).toBeLessThan(30);
  });

  it('edición: eliminar subárbol', () => {
    let tree = setRoot({ rootId: null, nodes: {} }, 'A').tree;
    const b = addChild(tree, tree.rootId!, 'l', 'B')!;
    tree = b.tree;
    tree = addChild(tree, b.id, 'l', 'C')!.tree;
    expect(treeValues(tree)).toEqual(['A', 'B', 'C']);
    tree = deleteSubtree(tree, b.id);
    expect(treeValues(tree)).toEqual(['A']);
    expect(Object.keys(tree.nodes)).toHaveLength(1);
  });
});
