import type { FlatTree } from './types';

/** Operaciones inmutables sobre el árbol plano que construye el alumno a mano. */

export function newNodeId(): string {
  return 'n' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
}

export function setRoot(_tree: FlatTree, val: string): { tree: FlatTree; id: string } {
  const id = newNodeId();
  return { tree: { rootId: id, nodes: { [id]: { v: val, l: null, r: null } } }, id };
}

export function addChild(
  tree: FlatTree,
  parentId: string,
  side: 'l' | 'r',
  val: string,
): { tree: FlatTree; id: string } | null {
  const parent = tree.nodes[parentId];
  if (!parent || parent[side]) return null;
  const id = newNodeId();
  return {
    id,
    tree: {
      rootId: tree.rootId,
      nodes: {
        ...tree.nodes,
        [parentId]: { ...parent, [side]: id },
        [id]: { v: val, l: null, r: null },
      },
    },
  };
}

export function editValue(tree: FlatTree, id: string, val: string): FlatTree {
  const n = tree.nodes[id];
  if (!n) return tree;
  return { rootId: tree.rootId, nodes: { ...tree.nodes, [id]: { ...n, v: val } } };
}

export function collectSubtree(tree: FlatTree, id: string | null, out: string[] = []): string[] {
  if (!id || !tree.nodes[id] || out.includes(id)) return out;
  out.push(id);
  collectSubtree(tree, tree.nodes[id].l, out);
  collectSubtree(tree, tree.nodes[id].r, out);
  return out;
}

export function findParent(tree: FlatTree, id: string): { parentId: string; side: 'l' | 'r' } | null {
  for (const [pid, n] of Object.entries(tree.nodes)) {
    if (n.l === id) return { parentId: pid, side: 'l' };
    if (n.r === id) return { parentId: pid, side: 'r' };
  }
  return null;
}

export function deleteSubtree(tree: FlatTree, id: string): FlatTree {
  if (id === tree.rootId) return { rootId: null, nodes: {} };
  const remove = new Set(collectSubtree(tree, id));
  const nodes: FlatTree['nodes'] = {};
  for (const [nid, n] of Object.entries(tree.nodes)) {
    if (remove.has(nid)) continue;
    nodes[nid] = { v: n.v, l: n.l && remove.has(n.l) ? null : n.l, r: n.r && remove.has(n.r) ? null : n.r };
  }
  return { rootId: tree.rootId, nodes };
}

/** Valores presentes en el árbol (alcanzables desde la raíz), en preorden. */
export function treeValues(tree: FlatTree): string[] {
  return collectSubtree(tree, tree.rootId).map((id) => tree.nodes[id].v);
}

export function isEmptyTree(tree: FlatTree | null | undefined): boolean {
  return !tree || !tree.rootId || !tree.nodes[tree.rootId];
}
