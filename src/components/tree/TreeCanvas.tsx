import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DataType, FlatTree } from '../../lib/tree/types';
import { toNested } from '../../lib/tree/analyze';
import { computeLayout, H_GAP, NODE_R, V_GAP } from '../../lib/tree/layout';
import { addChild, collectSubtree, deleteSubtree, editValue, setRoot, treeValues } from '../../lib/tree/edit';
import { ValuePrompt } from './ValuePrompt';
import { ConfirmDialog, cx } from '../ui';

type Tone = 'ok' | 'bad' | 'missing';

interface Props {
  tree: FlatTree;
  editable?: boolean;
  onChange?: (t: FlatTree) => void;
  dataType?: DataType;
  dataset?: string[];
  /** Colorea nodos (comparación alumno vs esperado en el panel del profesor). */
  nodeTone?: (id: string) => Tone | undefined;
  className?: string;
  emptyLabel?: string;
  idPrefix?: string;
}

type Prompt =
  | { kind: 'root' }
  | { kind: 'child'; parentId: string; side: 'l' | 'r' }
  | { kind: 'edit'; id: string }
  | null;

const MIN_K = 0.25;
const MAX_K = 2.5;

export function TreeCanvas({
  tree,
  editable = false,
  onChange,
  dataType = 'NUMBER',
  dataset = [],
  nodeTone,
  className,
  emptyLabel = 'Árbol vacío',
  idPrefix = 'tree',
}: Props) {
  const nested = useMemo(() => toNested(tree), [tree]);
  const layout = useMemo(() => computeLayout(nested), [nested]);
  const used = useMemo(() => treeValues(tree), [tree]);

  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 600, h: 400 });
  const [view, setView] = useState({ x: 0, y: 0, k: 1 });
  const userMoved = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [prompt, setPrompt] = useState<Prompt>(null);
  const [confirmDel, setConfirmDel] = useState<{ id: string; count: number } | null>(null);
  const history = useRef<FlatTree[]>([]);
  const [, force] = useState(0);
  const newIds = useRef(new Set<string>());

  // ---- tamaño del contenedor ----
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(() => {
    const k = Math.max(MIN_K, Math.min(1.35, Math.min(size.w / layout.width, size.h / layout.height) * 0.94));
    setView({
      k,
      x: (size.w - layout.width * k) / 2,
      y: Math.max(8, Math.min((size.h - layout.height * k) / 2, 40)),
    });
  }, [size, layout.width, layout.height]);

  // Ajuste automático mientras el usuario no haya movido la vista manualmente.
  useEffect(() => {
    if (!userMoved.current) fit();
  }, [fit]);

  // Si se borra el nodo seleccionado, se limpia la selección.
  useEffect(() => {
    if (selected && !tree.nodes[selected]) setSelected(null);
  }, [tree, selected]);

  // ---- edición ----
  const commit = useCallback(
    (next: FlatTree) => {
      history.current.push(tree);
      if (history.current.length > 60) history.current.shift();
      onChange?.(next);
      force((n) => n + 1);
    },
    [tree, onChange],
  );

  const undo = () => {
    const prev = history.current.pop();
    if (prev) {
      onChange?.(prev);
      force((n) => n + 1);
    }
  };

  const handlePromptSubmit = (value: string) => {
    if (!prompt) return;
    if (prompt.kind === 'root') {
      const r = setRoot(tree, value);
      newIds.current.add(r.id);
      commit(r.tree);
      setSelected(r.id);
    } else if (prompt.kind === 'child') {
      const r = addChild(tree, prompt.parentId, prompt.side, value);
      if (r) {
        newIds.current.add(r.id);
        commit(r.tree);
        setSelected(r.id);
      }
    } else if (prompt.kind === 'edit') {
      commit(editValue(tree, prompt.id, value));
    }
    setPrompt(null);
  };

  const requestDelete = (id: string) => {
    const count = collectSubtree(tree, id).length;
    if (count > 1) setConfirmDel({ id, count });
    else {
      commit(deleteSubtree(tree, id));
      setSelected(null);
    }
  };

  // ---- teclado (PC) ----
  useEffect(() => {
    if (!editable) return;
    const onKey = (e: KeyboardEvent) => {
      if (prompt || confirmDel) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (!selected) return;
      const n = tree.nodes[selected];
      if (!n) return;
      if (e.key === 'Delete' || e.key === 'Backspace') requestDelete(selected);
      else if (e.key === 'Escape') setSelected(null);
      else if (e.key === 'Enter') setPrompt({ kind: 'edit', id: selected });
      else if (e.key === 'ArrowLeft' && !n.l) setPrompt({ kind: 'child', parentId: selected, side: 'l' });
      else if (e.key === 'ArrowRight' && !n.r) setPrompt({ kind: 'child', parentId: selected, side: 'r' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ---- pan / zoom (ratón, rueda y gestos táctiles) ----
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ startDist: number; startK: number; moved: boolean; sx: number; sy: number; vx: number; vy: number } | null>(null);
  const dragged = useRef(false);

  const zoomAt = useCallback((factor: number, cx0: number, cy0: number) => {
    userMoved.current = true;
    setView((v) => {
      const k = Math.max(MIN_K, Math.min(MAX_K, v.k * factor));
      const f = k / v.k;
      return { k, x: cx0 - (cx0 - v.x) * f, y: cy0 - (cy0 - v.y) * f };
    });
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent) => {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged.current = false;
    const pts = [...pointers.current.values()];
    if (pts.length === 1) {
      gesture.current = { startDist: 0, startK: view.k, moved: false, sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
    } else if (pts.length === 2) {
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      gesture.current = { startDist: d, startK: view.k, moved: true, sx: 0, sy: 0, vx: view.x, vy: view.y };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId) || !gesture.current) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...pointers.current.values()];
    const g = gesture.current;
    if (pts.length === 1) {
      const dx = e.clientX - g.sx;
      const dy = e.clientY - g.sy;
      if (!g.moved && Math.hypot(dx, dy) > 6) {
        g.moved = true;
        dragged.current = true;
        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
      }
      if (g.moved) {
        userMoved.current = true;
        setView((v) => ({ ...v, x: g.vx + dx, y: g.vy + dy }));
      }
    } else if (pts.length === 2 && g.startDist > 0) {
      dragged.current = true;
      const rect = wrapRef.current!.getBoundingClientRect();
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const mx = (pts[0].x + pts[1].x) / 2 - rect.left;
      const my = (pts[0].y + pts[1].y) / 2 - rect.top;
      const target = Math.max(MIN_K, Math.min(MAX_K, g.startK * (d / g.startDist)));
      zoomAt(target / view.k, mx, my);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) gesture.current = null;
    else if (pointers.current.size === 1) {
      const [p] = [...pointers.current.values()];
      gesture.current = { startDist: 0, startK: view.k, moved: true, sx: p.x, sy: p.y, vx: view.x, vy: view.y };
    }
  };

  const clickNode = (id: string) => {
    if (dragged.current || !editable) return;
    setSelected((s) => (s === id ? null : id));
  };

  const selNode = selected ? tree.nodes[selected] : null;
  const selLayout = selected ? layout.byId[selected] : null;
  const isEmpty = layout.nodes.length === 0;

  const promptTitle =
    prompt?.kind === 'root'
      ? 'Crear nodo raíz'
      : prompt?.kind === 'child'
        ? `Hijo ${prompt.side === 'l' ? 'izquierdo' : 'derecho'} de ${tree.nodes[prompt.parentId]?.v ?? ''}`
        : prompt?.kind === 'edit'
          ? `Editar valor (${tree.nodes[prompt.id]?.v ?? ''})`
          : '';

  return (
    <div ref={wrapRef} className={cx('tree-canvas relative h-full w-full overflow-hidden select-none', className)}>
      <svg
        className="absolute inset-0 h-full w-full"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={(e) => {
          if (e.target === e.currentTarget && !dragged.current) setSelected(null);
        }}
      >
        <defs>
          <linearGradient id={`${idPrefix}-node`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#1c2742" />
            <stop offset="1" stopColor="#0f172a" />
          </linearGradient>
          <linearGradient id={`${idPrefix}-root`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#34d399" />
            <stop offset="1" stopColor="#06b6d4" />
          </linearGradient>
          <filter id={`${idPrefix}-glow`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {layout.edges.map((ed) => (
            <line
              key={ed.from + ed.to}
              x1={ed.x1}
              y1={ed.y1}
              x2={ed.x2}
              y2={ed.y2}
              stroke="var(--canvas-node-stroke)"
              strokeOpacity="0.45"
              strokeWidth={2.5}
              strokeLinecap="round"
            />
          ))}

          {/* Huecos para hijos (solo en el nodo seleccionado) */}
          {editable && selNode && selLayout && (
            <>
              {(['l', 'r'] as const).map((side) =>
                selNode[side] ? null : (
                  <g
                    key={side}
                    className="ghost-slot"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!dragged.current) setPrompt({ kind: 'child', parentId: selected!, side });
                    }}
                  >
                    <line
                      x1={selLayout.x}
                      y1={selLayout.y}
                      x2={selLayout.x + (side === 'l' ? -H_GAP / 2 : H_GAP / 2)}
                      y2={selLayout.y + V_GAP * 0.8}
                      stroke="var(--primary)"
                      strokeOpacity="0.5"
                      strokeWidth={2}
                      strokeDasharray="4 5"
                    />
                    <circle
                      cx={selLayout.x + (side === 'l' ? -H_GAP / 2 : H_GAP / 2)}
                      cy={selLayout.y + V_GAP * 0.8}
                      r={NODE_R * 0.72}
                      fill="var(--primary-container)"
                      stroke="var(--primary)"
                      strokeWidth={2}
                      strokeDasharray="4 4"
                    />
                    <text
                      x={selLayout.x + (side === 'l' ? -H_GAP / 2 : H_GAP / 2)}
                      y={selLayout.y + V_GAP * 0.8}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fill="var(--on-primary-container)"
                      fontSize={20}
                      fontWeight={700}
                    >
                      +
                    </text>
                  </g>
                ),
              )}
            </>
          )}

          {layout.nodes.map((n) => {
            const isRoot = n.id === tree.rootId;
            const isSel = n.id === selected;
            const tone = nodeTone?.(n.id);
            const fs = n.val.length <= 3 ? 15 : n.val.length <= 5 ? 12 : 9.5;
            const fresh = newIds.current.has(n.id);
            if (fresh) setTimeout(() => newIds.current.delete(n.id), 400);

            const fill =
              tone === 'ok'
                ? 'var(--color-green-bg)'
                : tone === 'bad'
                ? 'var(--color-red-bg)'
                : tone === 'missing'
                ? 'var(--color-amber-bg)'
                : isRoot
                ? 'var(--primary)'
                : 'var(--surface-container)';

            const stroke =
              tone === 'ok'
                ? 'var(--color-green)'
                : tone === 'bad'
                ? 'var(--color-red)'
                : tone === 'missing'
                ? 'var(--color-amber)'
                : isSel
                ? 'var(--primary)'
                : isRoot
                ? 'var(--primary)'
                : 'var(--canvas-node-stroke)';

            const textFill =
              tone === 'ok'
                ? 'var(--color-green)'
                : tone === 'bad'
                ? 'var(--color-red)'
                : tone === 'missing'
                ? 'var(--color-amber)'
                : isRoot
                ? 'var(--on-primary)'
                : 'var(--text-primary)';

            return (
              <g
                key={n.id}
                className={cx(editable && 'tree-node', fresh && 'tree-node-enter')}
                onClick={(e) => {
                  e.stopPropagation();
                  clickNode(n.id);
                }}
              >
                {isSel && <circle cx={n.x} cy={n.y} r={NODE_R + 7} fill="var(--primary-container)" opacity="0.6" filter={`url(#${idPrefix}-glow)`} />}
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={NODE_R}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={isSel ? 3.5 : 2}
                  className="transition-colors duration-150"
                />
                <text
                  x={n.x}
                  y={n.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="'JetBrains Mono Variable', monospace"
                  fontSize={fs}
                  fontWeight={700}
                  fill={textFill}
                >
                  {n.val}
                </text>
                <title>{n.val}</title>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Estado vacío */}
      {isEmpty && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
          {editable ? (
            <button
              id={`${idPrefix}-create-root`}
              className="btn-primary pointer-events-auto px-6 py-3.5 text-base animate-pop"
              onClick={() => setPrompt({ kind: 'root' })}
            >
              <span className="text-xl leading-none">+</span> Crear nodo raíz
            </button>
          ) : (
            <span className="text-sm text-slate-500">{emptyLabel}</span>
          )}
        </div>
      )}

      {/* Controles de vista */}
      {!isEmpty && (
        <div className="absolute right-2 top-2 flex flex-col gap-1.5">
          <button className="btn-secondary btn-sm h-8 w-8 !p-0" title="Acercar" onClick={() => zoomAt(1.2, size.w / 2, size.h / 2)}>
            +
          </button>
          <button className="btn-secondary btn-sm h-8 w-8 !p-0" title="Alejar" onClick={() => zoomAt(1 / 1.2, size.w / 2, size.h / 2)}>
            −
          </button>
          <button
            className="btn-secondary btn-sm h-8 w-8 !p-0"
            title="Centrar árbol"
            onClick={() => {
              userMoved.current = false;
              fit();
            }}
          >
            ⤢
          </button>
          {editable && (
            <button
              id={`${idPrefix}-undo`}
              className="btn-secondary btn-sm h-8 w-8 !p-0"
              title="Deshacer (Ctrl+Z)"
              disabled={history.current.length === 0}
              onClick={undo}
            >
              ↶
            </button>
          )}
        </div>
      )}

      {/* Barra de acciones del nodo seleccionado (Material 3 Pill Bar) */}
      {editable && selNode && selected && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center px-2">
          <div className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-full border border-outline bg-surface-container shadow-xl p-1.5 animate-fade-up">
            <span className="px-3 font-mono text-sm font-bold text-primary">{selNode.v}</span>
            <button
              id="node-add-left"
              className="btn-ghost btn-sm rounded-full text-text-primary"
              disabled={!!selNode.l}
              onClick={() => setPrompt({ kind: 'child', parentId: selected, side: 'l' })}
            >
              ↙ Hijo izq
            </button>
            <button
              id="node-add-right"
              className="btn-ghost btn-sm rounded-full text-text-primary"
              disabled={!!selNode.r}
              onClick={() => setPrompt({ kind: 'child', parentId: selected, side: 'r' })}
            >
              Hijo der ↘
            </button>
            <button
              id="node-edit"
              className="btn-ghost btn-sm rounded-full text-text-primary"
              onClick={() => setPrompt({ kind: 'edit', id: selected })}
            >
              ✎ Editar
            </button>
            <button
              id="node-delete"
              className="btn-sm btn rounded-full !text-red-500 hover:bg-red-500/10"
              onClick={() => requestDelete(selected)}
            >
              🗑 Eliminar
            </button>
          </div>
        </div>
      )}

      {editable && (
        <ValuePrompt
          open={!!prompt}
          title={promptTitle}
          initial={prompt?.kind === 'edit' ? (tree.nodes[prompt.id]?.v ?? '') : ''}
          dataType={dataType}
          dataset={dataset}
          usedValues={prompt?.kind === 'edit' ? used.filter((_, i) => i !== used.indexOf(tree.nodes[prompt.id]?.v ?? '')) : used}
          onSubmit={handlePromptSubmit}
          onClose={() => setPrompt(null)}
        />
      )}
      <ConfirmDialog
        open={!!confirmDel}
        title="Eliminar subárbol"
        danger
        confirmLabel={`Eliminar ${confirmDel?.count ?? ''} nodos`}
        message={
          <>
            Se eliminará el nodo <b className="font-mono text-white">{confirmDel ? tree.nodes[confirmDel.id]?.v : ''}</b> y todos sus
            descendientes ({confirmDel?.count} nodos). Puedes deshacer con ↶.
          </>
        }
        onConfirm={() => {
          if (confirmDel) {
            commit(deleteSubtree(tree, confirmDel.id));
            setSelected(null);
          }
        }}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
}
