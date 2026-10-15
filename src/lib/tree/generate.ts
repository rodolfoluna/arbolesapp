import type { BNode, DataType, TreeType } from './types';
import { compareValues } from './values';
import { heightEdges } from './analyze';

/**
 * Generador OCULTO del árbol esperado (canónico). Nunca se muestra al alumno mientras
 * resuelve; solo se usa para calificar y para la vista previa del profesor.
 */

let seq = 0;
const nid = () => `x${++seq}`;
const mk = (val: string): BNode => ({ id: nid(), val, left: null, right: null });

/** Binario por niveles: arriba->abajo, izquierda->derecha (hijos de i en 2i+1 y 2i+2). */
export function buildComplete(values: string[]): BNode | null {
  if (values.length === 0) return null;
  const nodes = values.map(mk);
  for (let i = 0; i < nodes.length; i++) {
    const l = 2 * i + 1;
    const r = 2 * i + 2;
    if (l < nodes.length) nodes[i].left = nodes[l];
    if (r < nodes.length) nodes[i].right = nodes[r];
  }
  return nodes[0];
}

/** BST: menores a la izquierda, mayores o iguales a la derecha. */
export function buildBST(values: string[], dataType: DataType): BNode | null {
  let root: BNode | null = null;
  for (const v of values) {
    const node = mk(v);
    if (!root) {
      root = node;
      continue;
    }
    let cur = root;
    for (;;) {
      if (compareValues(v, cur.val, dataType) < 0) {
        if (!cur.left) {
          cur.left = node;
          break;
        }
        cur = cur.left;
      } else {
        if (!cur.right) {
          cur.right = node;
          break;
        }
        cur = cur.right;
      }
    }
  }
  return root;
}

/* ----------------------------- AVL -------------------------------- */

const h = (n: BNode | null) => heightEdges(n);
const bf = (n: BNode | null) => (n ? h(n.left) - h(n.right) : 0);

function rotateRight(y: BNode): BNode {
  const x = y.left!;
  y.left = x.right;
  x.right = y;
  return x;
}

function rotateLeft(x: BNode): BNode {
  const y = x.right!;
  x.right = y.left;
  y.left = x;
  return y;
}

function avlInsert(node: BNode | null, v: string, dataType: DataType): BNode {
  if (!node) return mk(v);
  if (compareValues(v, node.val, dataType) < 0) node.left = avlInsert(node.left, v, dataType);
  else node.right = avlInsert(node.right, v, dataType); // iguales a la derecha

  const balance = bf(node);
  if (balance > 1) {
    // Pesado a la izquierda
    if (bf(node.left) < 0) node.left = rotateLeft(node.left!); // caso LR
    return rotateRight(node); // caso LL
  }
  if (balance < -1) {
    // Pesado a la derecha
    if (bf(node.right) > 0) node.right = rotateRight(node.right!); // caso RL
    return rotateLeft(node); // caso RR
  }
  return node;
}

export function buildAVL(values: string[], dataType: DataType): BNode | null {
  let root: BNode | null = null;
  for (const v of values) root = avlInsert(root, v, dataType);
  return root;
}

/** Construye el árbol esperado según el tipo solicitado por el profesor. */
export function buildExpected(treeType: TreeType, values: string[], dataType: DataType): BNode | null {
  switch (treeType) {
    case 'COMPLETE':
      return buildComplete(values);
    case 'BST':
      return buildBST(values, dataType);
    case 'AVL':
      return buildAVL(values, dataType);
  }
}
