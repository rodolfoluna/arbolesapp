import { useMemo, useState } from 'react';
import type { Exercise } from '../../lib/tree/types';
import {
  ACTION_LABEL,
  SORT_ACTIONS,
  SORT_LABEL,
  SORT_VARIANT,
  TARGET_ACTIONS,
  evaluateSorting,
  replaySorting,
  sortingTrace,
  type SortActionType,
  type SortDraft,
} from '../../lib/sorting/sorting';
import { PSEUDOCODE } from '../../lib/sorting/pseudocode';

export function AlgorithmReader({ exercise }: { exercise: Exercise }) {
  const algorithm = exercise.sorting!.algorithm;
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">
        Leer algoritmo: {SORT_LABEL[algorithm]}
      </summary>
      <p className="my-3 text-sm">{SORT_VARIANT[algorithm]}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-surface-variant p-4 font-mono text-sm">
        {PSEUDOCODE[algorithm]}
      </pre>
    </details>
  );
}
export function SortingExercisePanel({
  exercise,
  draft,
  onChange,
  onEvaluate,
  readOnly,
  showFeedback,
  score,
  attempts,
  maxAttempts,
  canRestart,
  onRestart,
}: {
  exercise: Exercise;
  draft: SortDraft;
  onChange: (draft: SortDraft) => void;
  onEvaluate: (result: { total: number; structureExact: boolean }) => void;
  readOnly: boolean;
  showFeedback: boolean;
  score?: number;
  attempts: number;
  maxAttempts: number;
  canRestart?: boolean;
  onRestart?: () => void;
}) {
  const [selected, setSelected] = useState<number[]>([]),
    [target, setTarget] = useState(0),
    [message, setMessage] = useState('');
  const run = useMemo(() => replaySorting(exercise, draft), [exercise, draft]);
  const algorithm = exercise.sorting!.algorithm;
  const clickCard = (id: number) => {
    if (!readOnly)
      setSelected((prev) =>
        prev.includes(id)
          ? prev.filter((x) => x !== id)
          : prev.length < 2
            ? [...prev, id]
            : [prev[1], id],
      );
  };
  const cards = (ids: number[], name: string) => (
    <div className="flex flex-wrap gap-2" aria-label={name}>
      {ids.map((id, i) => (
        <div key={`${name}-${i}`} className="text-center">
          <span className="block text-xs text-text-muted">{i}</span>
          <button
            disabled={readOnly || id < 0}
            onClick={() => clickCard(id)}
            aria-pressed={selected.includes(id)}
            aria-label={
              id < 0
                ? `${name} posición ${i} vacía`
                : `${name} posición ${i}: ${exercise.dataset[id]}, tarjeta ${id + 1}`
            }
            className={`min-w-14 rounded-xl border-2 px-3 py-4 font-mono text-xl ${selected.includes(id) ? 'border-primary bg-primary-container' : 'border-outline bg-surface'}`}
          >
            {id < 0 ? '□' : exercise.dataset[id]}
            {id >= 0 && <small className="block text-xs text-text-muted">#{id + 1}</small>}
          </button>
        </div>
      ))}
    </div>
  );
  const act = (type: SortActionType) => {
    if (readOnly || run.complete || draft.actions.length >= 5000) return;
    const action = {
      type,
      cards: type === 'pass' || type === 'accumulate' ? [] : selected,
      ...(TARGET_ACTIONS.includes(type) ? { target } : {}),
    };
    const next = { version: 1 as const, actions: [...draft.actions, action] };
    const check = replaySorting(exercise, next);
    setMessage(
      check.cursor > run.cursor
        ? 'Paso correcto.'
        : 'Movimiento rechazado. No corresponde a este paso, selección o destino. El arreglo no cambia y se suma un error.',
    );
    onChange(next);
    setSelected([]);
  };
  return (
    <section className="space-y-5 overflow-y-auto p-4 sm:p-6">
      <AlgorithmReader exercise={exercise} />
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold">
          {SORT_LABEL[algorithm]} · {run.phase}
        </h3>
        <p>
          Pasos correctos: {run.cursor}/{run.totalSteps} · Errores: {run.errors} · Evaluaciones:{' '}
          {attempts}
          {maxAttempts ? `/${maxAttempts}` : ''}
        </p>
        <p className="text-sm text-text-muted">
          Selecciona tarjetas y ejecuta la acción. Las posiciones comienzan en 0; # identifica cada
          tarjeta, incluso si se repite un número. Comparar, intercambiar, dividir y extraer máximo
          requieren dos tarjetas; las demás acciones sobre tarjetas requieren una. Siguiente pasada
          y acumular no requieren tarjetas.
        </p>
        <h4 className="font-semibold">Arreglo</h4>
        {cards(run.board.main, 'Arreglo')}
        {run.board.held !== null && (
          <>
            <h4>Clave extraída</h4>
            {cards([run.board.held], 'Clave')}
          </>
        )}
        {['MERGE', 'COUNTING'].includes(algorithm) && (
          <>
            <h4>Auxiliar / salida</h4>
            {cards(run.board.auxiliary, 'Auxiliar')}
          </>
        )}
        {['BUCKET', 'RADIX'].includes(algorithm) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {run.board.bins.map((bin, i) => (
              <div key={i} className="rounded-lg border border-outline p-2">
                <h4>
                  Cubeta {i}
                  {algorithm === 'BUCKET' ? ` (${i * 10}–${i * 10 + 9})` : ''}
                </h4>
                {bin.length ? (
                  cards(bin, `Cubeta ${i}`)
                ) : (
                  <span className="text-text-muted">Vacía</span>
                )}
              </div>
            ))}
          </div>
        )}
        {algorithm === 'COUNTING' && (
          <>
            <h4>Conteos C[valor] (acumulados durante esa fase)</h4>
            <div className="flex max-h-40 flex-wrap gap-1 overflow-auto">
              {run.board.counts.map((count, i) => (
                <button
                  key={i}
                  disabled={readOnly}
                  className="btn-secondary btn-sm"
                  onClick={() => setTarget(i)}
                  aria-label={`Conteo ${i}: ${count}`}
                >
                  {i}: {count}
                </button>
              ))}
            </div>
          </>
        )}
        {SORT_ACTIONS[algorithm].some((t) => TARGET_ACTIONS.includes(t)) && (
          <label className="block">
            Destino (posición, cubeta o valor del conteo)
            <input
              type="number"
              min={0}
              max={99}
              className="input w-28"
              value={target}
              onChange={(e) =>
                setTarget(Math.min(99, Math.max(0, Math.trunc(Number(e.target.value) || 0))))
              }
              disabled={readOnly}
            />
          </label>
        )}
        <p className="text-sm">
          Seleccionadas:{' '}
          {selected.map((id) => `${exercise.dataset[id]} (#${id + 1})`).join(', ') || 'ninguna'}.{' '}
          {TARGET_ACTIONS.some((t) => SORT_ACTIONS[algorithm].includes(t))
            ? `Destino: ${target}.`
            : ''}
        </p>
        <div className="flex flex-wrap gap-2">
          {SORT_ACTIONS[algorithm].map((type) => (
            <button
              key={type}
              className="btn-secondary"
              disabled={readOnly || run.complete || draft.actions.length >= 5000}
              onClick={() => act(type)}
            >
              {ACTION_LABEL[type]}
            </button>
          ))}
        </div>
        <p role="status">
          {message || 'Sigue el algoritmo. Una acción incorrecta no modifica el estado.'}
        </p>
        {draft.actions.length >= 5000 && (
          <p role="alert">
            Se alcanzó el límite de 5000 acciones. Guarda el historial y solicita revisión al
            profesor.
          </p>
        )}
        <p className="text-sm">
          Nota = 100 × avance × (pasos correctos / acciones registradas). Para evaluar debes
          terminar el recorrido. Cada movimiento rechazado queda en el historial y reduce la nota.
        </p>
        <button
          className="btn-primary"
          disabled={readOnly || !run.complete}
          onClick={() => onEvaluate(evaluateSorting(exercise, draft))}
        >
          Guardar y evaluar recorrido
        </button>
        {canRestart && (
          <button className="btn-secondary" disabled={readOnly} onClick={onRestart}>
            Nuevo recorrido para otro intento
          </button>
        )}
        {!run.complete && (
          <p>
            Completa todos los pasos antes de evaluar. Puedes guardar el avance con «Guardar en la
            nube».
          </p>
        )}
        {showFeedback && score !== undefined && (
          <p className="font-semibold">Última calificación confirmada: {score}%</p>
        )}
      </div>
    </section>
  );
}
export function SortingReview({ exercise, draft }: { exercise: Exercise; draft?: SortDraft }) {
  const r = evaluateSorting(exercise, draft),
    trace = sortingTrace(exercise);
  return (
    <div className="space-y-4">
      <AlgorithmReader exercise={exercise} />
      <p>
        {r.cursor}/{r.totalSteps} pasos · {r.errors} errores ·{' '}
        {r.complete ? 'Recorrido completo' : 'Incompleto'}
      </p>
      <p>
        Estado actual: {r.board.main.map((id) => (id < 0 ? '□' : exercise.dataset[id])).join(', ')}
      </p>
      <div className="max-h-96 overflow-auto">
        <table className="table-base text-xs">
          <thead>
            <tr>
              <th>Acción</th>
              <th>Tarjetas / destino</th>
              <th>Resultado</th>
              <th>Paso esperado</th>
            </tr>
          </thead>
          <tbody>
            {r.events.map((event, i) => (
              <tr key={i}>
                <td>
                  {i + 1}. {ACTION_LABEL[event.action.type]}
                </td>
                <td>
                  {event.action.cards
                    .map((id) => `${exercise.dataset[id]} (#${id + 1})`)
                    .join(', ')}{' '}
                  {event.action.target !== undefined ? `→ ${event.action.target}` : ''}
                </td>
                <td>{event.accepted ? 'Correcto' : 'Error; no avanza'}</td>
                <td>
                  {trace[event.step - 1]
                    ? `${event.step}: ${ACTION_LABEL[trace[event.step - 1].action.type]}`
                    : 'Fin'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
