import type { BNode, DataType, FlatTree, HeightMode } from './types';

/* ------------------------------------------------------------------ */
/* Conversión plano <-> anidado                                        */
/* ------------------------------------------------------------------ */

export function toNested(tree: FlatTree): BNode | null {
  const seen = new Set<string>();
  const build = (id: string | null): BNode | null => {
    if (!id || seen.has(id)) return null; // protección ante ciclos/datos corruptos
    const n = tree.nodes[id];
    if (!n) return null;
    seen.add(id);
    return { id, val: n.v, left: build(n.l), right: build(n.r) };
  };
  return build(tree.rootId);
}

export function toFlat(root: BNode | null): FlatTree {
  const nodes: FlatTree['nodes'] = {};
  const walk = (n: BNode | null): string | null => {
    if (!n) return null;
    nodes[n.id] = { v: n.val, l: walk(n.left), r: walk(n.right) };
    return n.id;
  };
  const rootId = walk(root);
  return { rootId, nodes };
}

/* ------------------------------------------------------------------ */
/* Propiedades                                                         */
/* ------------------------------------------------------------------ */

export function countNodes(n: BNode | null): number {
  return n ? 1 + countNodes(n.left) + countNodes(n.right) : 0;
}

/** Altura en aristas (nodo único = 0, árbol vacío = -1). */
export function heightEdges(n: BNode | null): number {
  return n ? 1 + Math.max(heightEdges(n.left), heightEdges(n.right)) : -1;
}

export function treeHeight(n: BNode | null, mode: HeightMode): number {
  const h = heightEdges(n);
  if (!n) return 0;
  return mode === 'EDGES' ? h : h + 1;
}

export function preorder(n: BNode | null, out: string[] = []): string[] {
  if (n) {
    out.push(n.val);
    preorder(n.left, out);
    preorder(n.right, out);
  }
  return out;
}

export function inorder(n: BNode | null, out: string[] = []): string[] {
  if (n) {
    inorder(n.left, out);
    out.push(n.val);
    inorder(n.right, out);
  }
  return out;
}

export function postorder(n: BNode | null, out: string[] = []): string[] {
  if (n) {
    postorder(n.left, out);
    postorder(n.right, out);
    out.push(n.val);
  }
  return out;
}

export function levelOrder(n: BNode | null): string[] {
  const out: string[] = [];
  const q: BNode[] = n ? [n] : [];
  while (q.length) {
    const cur = q.shift()!;
    out.push(cur.val);
    if (cur.left) q.push(cur.left);
    if (cur.right) q.push(cur.right);
  }
  return out;
}

/** Hojas, en orden de izquierda a derecha. */
export function leaves(n: BNode | null, out: string[] = []): string[] {
  if (!n) return out;
  if (!n.left && !n.right) out.push(n.val);
  leaves(n.left, out);
  leaves(n.right, out);
  return out;
}

/** Nodos internos (rama): tienen al menos un hijo. La raíz se incluye según el criterio. */
export function internals(root: BNode | null, rootIsInternal: boolean): string[] {
  const out: string[] = [];
  const walk = (n: BNode | null) => {
    if (!n) return;
    const hasChild = !!(n.left || n.right);
    if (hasChild && (n !== root || rootIsInternal)) out.push(n.val);
    walk(n.left);
    walk(n.right);
  };
  walk(root);
  return out;
}

/** Factor de equilibrio altura(izq) - altura(der). */
export function balanceFactor(n: BNode | null): number {
  return n ? heightEdges(n.left) - heightEdges(n.right) : 0;
}

export interface TreeProps {
  root: string;
  leaves: string[];
  internals: string[];
  height: number;
  preorder: string[];
  inorder: string[];
  postorder: string[];
  count: number;
}

export function computeProps(root: BNode | null, mode: HeightMode, rootIsInternal: boolean): TreeProps {
  return {
    root: root ? root.val : '',
    leaves: leaves(root),
    internals: internals(root, rootIsInternal),
    height: treeHeight(root, mode),
    preorder: preorder(root),
    inorder: inorder(root),
    postorder: postorder(root),
    count: countNodes(root),
  };
}

/** Mapa ruta -> valor ("" = raíz, "L", "LR", ...) usado para comparar estructura. */
export function pathMap(n: BNode | null, path = '', out = new Map<string, string>()): Map<string, string> {
  if (!n) return out;
  out.set(path, n.val);
  pathMap(n.left, path + 'L', out);
  pathMap(n.right, path + 'R', out);
  return out;
}

export function sameStructure(a: BNode | null, b: BNode | null, key: (v: string) => string): boolean {
  if (!a || !b) return a === b;
  return key(a.val) === key(b.val) && sameStructure(a.left, b.left, key) && sameStructure(a.right, b.right, key);
}

export type { DataType };
