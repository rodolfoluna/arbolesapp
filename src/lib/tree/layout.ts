import type { BNode } from './types';

export interface LayoutNode {
  id: string;
  val: string;
  x: number;
  y: number;
  depth: number;
  hasLeft: boolean;
  hasRight: boolean;
}

export interface LayoutEdge {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Layout {
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  width: number;
  height: number;
  byId: Record<string, LayoutNode>;
}

export const NODE_R = 24;
export const H_GAP = 58;
export const V_GAP = 84;
export const PAD = 48;

/**
 * Posicionamiento por recorrido en orden (Knuth): x = índice en orden, y = nivel.
 * Nunca hay traslapes y un hijo único queda claramente a la izquierda o a la derecha.
 */
export function computeLayout(root: BNode | null): Layout {
  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  const byId: Record<string, LayoutNode> = {};
  let idx = 0;
  let maxDepth = 0;

  const walk = (n: BNode | null, depth: number) => {
    if (!n) return;
    walk(n.left, depth + 1);
    const ln: LayoutNode = {
      id: n.id,
      val: n.val,
      x: PAD + idx * H_GAP,
      y: PAD + depth * V_GAP,
      depth,
      hasLeft: !!n.left,
      hasRight: !!n.right,
    };
    idx++;
    maxDepth = Math.max(maxDepth, depth);
    nodes.push(ln);
    byId[n.id] = ln;
    walk(n.right, depth + 1);
  };
  walk(root, 0);

  const link = (n: BNode | null) => {
    if (!n) return;
    for (const c of [n.left, n.right]) {
      if (!c) continue;
      const a = byId[n.id];
      const b = byId[c.id];
      edges.push({ from: n.id, to: c.id, x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      link(c);
    }
  };
  link(root);

  return {
    nodes,
    edges,
    byId,
    width: Math.max(1, idx - 1) * H_GAP + PAD * 2,
    height: maxDepth * V_GAP + PAD * 2,
  };
}
