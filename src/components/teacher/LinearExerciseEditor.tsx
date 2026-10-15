import { useMemo, useState } from 'react';
import type { DataType, Exercise, LinearStructure } from '../../lib/tree/types';
import { parseDataset } from '../../lib/tree/values';
import {
  DEFAULT_OPS,
  STRUCTURE_ICON,
  STRUCTURE_LABEL,
  STRUCTURE_ORDER_HINT,
  opCatalog,
  simulate,
  tokenizeOps,
} from '../../lib/linear/linear';
import { cx } from '../ui';

const STRUCTURES: LinearStructure[] = ['LIST', 'STACK', 'QUEUE'];

interface Props {
  exercise: Exercise;
  onChange: (patch: Partial<Exercise>) => void;
}

/** Editor del profesor para un ejercicio de lista/pila/cola, con vista previa de la solución. */
export function LinearExerciseEditor({ exercise, onChange }: Props) {
  const cfg = exercise.linear!;
  const [text, setText] = useState(cfg.ops.join('\n'));
  const [initialText, setInitialText] = useState(exercise.dataset.join(', '));

  const tokens = useMemo(() => tokenizeOps(text), [text]);
  const catalog = useMemo(() => opCatalog(cfg.structure, exercise.dataType), [cfg.structure, exercise.dataType]);
  const invalidInitial = useMemo(
    () => parseDataset(initialText, exercise.dataType).invalid,
    [initialText, exercise.dataType],
  );
  const sim = useMemo(
    () => simulate(cfg.structure, exercise.dataType, exercise.dataset, cfg.ops),
    [cfg.structure, exercise.dataType, exercise.dataset, cfg.ops],
  );

  const setOps = (next: string) => {
    setText(next);
    onChange({ linear: { ...cfg, ops: tokenizeOps(next).ops } });
  };

  const insertOp = (op: string) => {
    const base = text.trimEnd();
    setOps(base ? `${base}\n${op}` : op);
  };

  const setStructure = (structure: LinearStructure) => {
    if (structure === cfg.structure) return;
    const untouched =
      tokens.ops.length === 0 || tokens.ops.join('|') === DEFAULT_OPS[cfg.structure].join('|');
    const nextOps = untouched ? DEFAULT_OPS[structure] : cfg.ops;
    if (untouched) setText(nextOps.join('\n'));
    onChange({ linear: { structure, ops: nextOps } });
  };

  const setDataType = (dataType: DataType) => {
    if (dataType === exercise.dataType) return;
    setInitialText('');
    onChange({ dataType, dataset: [] });
  };

  const fmt = (xs: string[], empty: string) => (xs.length ? xs.join(', ') : empty);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Configuración */}
      <div className="card space-y-4 border-outline bg-surface-container">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="lin-title">
              Título del Ejercicio
            </label>
            <input
              id="lin-title"
              className="input"
              value={exercise.title}
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </div>
          <div>
            <div className="label">Tipo de dato</div>
            <div className="flex gap-2">
              {(['NUMBER', 'STRING'] as DataType[]).map((dt) => (
                <button
                  key={dt}
                  type="button"
                  onClick={() => setDataType(dt)}
                  className={cx(
                    'btn-sm flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition',
                    exercise.dataType === dt
                      ? 'border-primary bg-primary-container text-on-primary-container'
                      : 'border-outline bg-surface text-text-secondary hover:bg-surface-variant',
                  )}
                >
                  {dt === 'NUMBER' ? 'Números' : 'Letras'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="label">Estructura de datos</div>
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Estructura de datos">
            {STRUCTURES.map((s) => (
              <button
                key={s}
                id={`linear-structure-${s.toLowerCase()}`}
                type="button"
                role="radio"
                aria-checked={cfg.structure === s}
                onClick={() => setStructure(s)}
                className={cx(
                  'flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 text-xs font-semibold transition',
                  cfg.structure === s
                    ? 'border-primary bg-primary-container text-on-primary-container shadow-xs'
                    : 'border-outline bg-surface text-text-secondary hover:bg-surface-variant',
                )}
              >
                <span className="text-xl" aria-hidden>
                  {STRUCTURE_ICON[s]}
                </span>
                {STRUCTURE_LABEL[s]}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-text-muted">Los elementos se escriben {STRUCTURE_ORDER_HINT[cfg.structure]}.</p>
        </div>

        <div>
          <label className="label" htmlFor="lin-initial">
            Datos iniciales de la estructura (opcional)
          </label>
          <input
            id="lin-initial"
            className="input-mono text-sm"
            placeholder={exercise.dataType === 'NUMBER' ? 'Ej: 10, 20, 30 (vacío = estructura vacía)' : 'Ej: A, B, C (vacío = estructura vacía)'}
            value={initialText}
            onChange={(e) => {
              setInitialText(e.target.value);
              onChange({ dataset: parseDataset(e.target.value, exercise.dataType).values });
            }}
          />
          {invalidInitial.length > 0 && (
            <p className="mt-1 text-xs text-red-500">Valores no válidos (se ignoran): {invalidInitial.join(', ')}</p>
          )}
        </div>

        {/* Instrucciones disponibles según la estructura */}
        <div>
          <div className="label">Instrucciones disponibles para {STRUCTURE_LABEL[cfg.structure].toLowerCase()} (toca para agregar)</div>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {catalog.map((op) => (
              <button
                key={op.signature}
                type="button"
                onClick={() => insertOp(op.example)}
                title={`Agregar ${op.example}`}
                className="rounded-xl border border-outline bg-surface px-3 py-2 text-left transition hover:border-primary hover:bg-surface-variant"
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="font-mono text-xs font-bold text-primary">{op.signature}</code>
                  {op.returns && (
                    <span className="rounded-full bg-amber-500/15 px-1.5 py-px text-[9px] font-semibold text-amber-600 dark:text-amber-400">
                      devuelve dato
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] leading-snug text-text-muted">{op.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="lin-ops">
            Secuencia de operaciones (una por línea o separadas por coma)
          </label>
          <textarea
            id="lin-ops"
            className="input-mono min-h-[150px] text-sm"
            spellCheck={false}
            placeholder={'add(5)\nadd(7)\nremove(0)\nhead()'}
            value={text}
            onChange={(e) => setOps(e.target.value)}
          />
          {tokens.leftover && (
            <p className="mt-1 text-xs text-red-500">
              No se reconoce: «{tokens.leftover}». Escribe cada operación como nombre(argumentos).
            </p>
          )}
          <p className="mt-1 text-xs text-text-muted">{cfg.ops.length} operaciones.</p>
        </div>
      </div>

      {/* Vista previa de la solución */}
      <div className="card flex flex-col overflow-hidden !p-0 border-outline bg-surface-container">
        <div className="flex items-center justify-between border-b border-outline px-4 py-2.5">
          <span className="text-xs font-semibold text-text-primary">
            Solución esperada ({STRUCTURE_LABEL[cfg.structure]})
          </span>
          <span
            className={cx(
              'rounded px-2 py-0.5 font-mono text-[11px]',
              sim.errorCount > 0 ? 'bg-red-500/10 text-red-500' : 'bg-primary-container text-on-primary-container',
            )}
          >
            {sim.errorCount > 0 ? `${sim.errorCount} con error` : 'secuencia válida'}
          </span>
        </div>

        <div className="space-y-1 border-b border-outline bg-surface-variant/40 p-4 text-xs">
          <div>
            <span className="text-text-muted">Estado inicial:</span>{' '}
            <span className="font-mono text-text-primary">{fmt(sim.initial, '(vacía)')}</span>
          </div>
          <div>
            <span className="text-text-muted">Estado final:</span>{' '}
            <b className="font-mono text-text-primary">{fmt(sim.finalState, '(vacía)')}</b>
          </div>
          <div>
            <span className="text-text-muted">Datos extraídos / devueltos:</span>{' '}
            <b className="font-mono text-text-primary">{fmt(sim.extracted, '(ninguno)')}</b>
          </div>
        </div>

        <div className="max-h-[420px] overflow-auto">
          <table className="table-base text-xs">
            <thead>
              <tr className="bg-surface-variant">
                <th className="w-8">#</th>
                <th>Operación</th>
                <th>Devuelve</th>
                <th>Estado después</th>
              </tr>
            </thead>
            <tbody>
              {sim.steps.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-text-muted">
                    Agrega operaciones para ver la solución paso a paso.
                  </td>
                </tr>
              )}
              {sim.steps.map((st, i) => (
                <tr key={i} className={st.error ? 'bg-red-500/5' : undefined}>
                  <td className="font-mono text-text-muted">{i + 1}</td>
                  <td className="font-mono font-semibold text-primary">{st.op}</td>
                  <td className="font-mono">
                    {st.error ? (
                      <span className="text-red-500">⚠ {st.error}</span>
                    ) : st.output !== undefined ? (
                      <b className="text-text-primary">{st.output}</b>
                    ) : (
                      <span className="text-text-muted">—</span>
                    )}
                  </td>
                  <td className="font-mono text-text-secondary">{fmt(st.state, '(vacía)')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
