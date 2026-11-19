import { useMemo, useState } from 'react';
import type { Exercise } from '../../lib/tree/types';
import {
  describeSearchAction,
  SEARCH_LABEL,
  evaluateSearch,
  replaySearch,
  searchTrace,
  type SearchDraft,
  type SearchAction,
} from '../../lib/search/search';
import { SEARCH_EXPLANATION } from '../../lib/search/explanation';
export function SearchReader({ exercise }: { exercise: Exercise }) {
  const content = SEARCH_EXPLANATION[exercise.search!.algorithm];
  return (
    <details className="card">
      <summary className="cursor-pointer font-semibold">
        Explicación y algoritmo: {SEARCH_LABEL[exercise.search!.algorithm]}
      </summary>
      <p className="my-4 leading-relaxed">{content.text}</p>
      <pre className="whitespace-pre-wrap rounded-xl bg-surface-variant p-4 font-mono text-sm">
        {content.pseudocode}
      </pre>
    </details>
  );
}
export function SearchExercisePanel({
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
  draft: SearchDraft;
  onChange: (d: SearchDraft) => void;
  onEvaluate: (e: { total: number; structureExact: boolean }) => void;
  readOnly: boolean;
  showFeedback: boolean;
  score?: number;
  attempts: number;
  maxAttempts: number;
  canRestart?: boolean;
  onRestart?: () => void;
}) {
  const run = useMemo(() => replaySearch(exercise, draft), [exercise, draft]);
  const b = run.board,
    binary = exercise.search!.algorithm === 'BINARY';
  const [selected, setSelected] = useState<number | null>(null),
    [hash, setHash] = useState(0),
    [position, setPosition] = useState(0),
    [message, setMessage] = useState('');
  const locked = readOnly || run.complete || draft.actions.length >= 3000;
  const action = (a: SearchAction) => {
    if (locked) return;
    const next: SearchDraft = { version: 1, actions: [...draft.actions, a] };
    const result = replaySearch(exercise, next);
    setMessage(
      result.cursor > run.cursor
        ? 'Paso correcto.'
        : 'Acción rechazada: revisa el cálculo, la selección o el paso del algoritmo. No cambia el estado y se suma un error.',
    );
    onChange(next);
    setSelected(null);
  };
  const integer = (value: string) => Math.min(999, Math.max(0, Math.trunc(Number(value) || 0)));
  return (
    <section className="space-y-5 p-4 sm:p-6">
      <SearchReader exercise={exercise} />
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold">
          {SEARCH_LABEL[exercise.search!.algorithm]} ·{' '}
          {run.complete ? 'Recorrido completo' : b.phase}
        </h3>
        <p>
          Pasos correctos: {run.cursor}/{run.totalSteps} · Errores: {run.errors} · Evaluaciones:{' '}
          {attempts}
          {maxAttempts ? `/${maxAttempts}` : ''}
        </p>
        {!binary && (
          <p className="text-sm">
            Errores de cálculo hash: {run.metrics.hash.errors} · Inserción:{' '}
            {run.metrics.insert.errors} · Búsqueda: {run.metrics.search.errors}
          </p>
        )}
        <p className="text-lg">
          {b.stage === 'INSERT' ? 'Clave por insertar' : 'Objetivo de búsqueda'}:{' '}
          <strong className="font-mono">{b.key}</strong>
        </p>
        {binary ? (
          <>
            <p>
              Límite bajo: {b.low} · Límite alto: {b.high} · Punto medio elegido:{' '}
              {b.middle ?? 'pendiente'}
            </p>
            <div className="flex flex-wrap gap-2" aria-label="Arreglo ordenado">
              {exercise.dataset.map((v, i) => (
                <button
                  key={i}
                  aria-label={`Posición ${i}: ${v}`}
                  aria-pressed={selected === i}
                  disabled={locked}
                  onClick={() => setSelected(i)}
                  className={`min-w-16 rounded-xl border-2 p-3 font-mono text-xl ${selected === i || b.middle === i ? 'border-primary bg-primary-container' : 'border-outline bg-surface'} ${i < b.low || i > b.high ? 'opacity-40' : ''}`}
                >
                  <small className="block text-xs">índice {i}</small>
                  {v}
                </button>
              ))}
            </div>
            <p className="text-sm">
              Selecciona la tarjeta del punto medio y pulsa «Elegir punto medio». Después compara y
              decide qué mitad descartar. Las posiciones comienzan en 0.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                className="btn-secondary"
                disabled={locked}
                onClick={() => action({ type: 'middle', index: selected ?? 999 })}
              >
                Elegir punto medio
              </button>
              <button
                className="btn-secondary"
                disabled={locked}
                onClick={() => action({ type: 'compare', index: selected ?? b.middle ?? 999 })}
              >
                Comparar
              </button>
              <button
                className="btn-secondary"
                disabled={locked}
                onClick={() => action({ type: 'left' })}
              >
                Descartar mitad izquierda
              </button>
              <button
                className="btn-secondary"
                disabled={locked}
                onClick={() => action({ type: 'right' })}
              >
                Descartar mitad derecha
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="font-mono">
              h(k) = k mod {exercise.search!.tableSize} · Inserción al final de la cadena
            </p>
            <div className="flex flex-wrap items-end gap-3">
              <label>
                Resultado calculado de h({b.key})
                <input
                  className="input w-28"
                  type="number"
                  min={0}
                  max={999}
                  value={hash}
                  disabled={locked}
                  onChange={(e) => setHash(integer(e.target.value))}
                />
              </label>
              <button
                disabled={locked}
                className="btn-secondary"
                onClick={() => action({ type: 'hash', value: hash })}
              >
                Comprobar cálculo hash
              </button>
            </div>
            <p>
              Resultado aceptado: {b.hashResult ?? 'pendiente'} · Cubeta seleccionada:{' '}
              {b.bucket ?? 'pendiente'}
            </p>
            {b.stage === 'INSERT' && (
              <div>
                <h4 className="mb-2 font-semibold">Claves pendientes (en el orden indicado)</h4>
                <div className="flex flex-wrap gap-2">
                  {exercise.dataset.map((v, i) =>
                    b.buckets.some((bin) => bin.includes(i)) ? null : (
                      <button
                        key={i}
                        disabled={locked}
                        aria-label={`Clave ${v}, tarjeta ${i + 1}`}
                        aria-pressed={selected === i}
                        className={`rounded-xl border-2 p-3 font-mono text-xl ${selected === i ? 'border-primary bg-primary-container' : 'border-outline'}`}
                        onClick={() => setSelected(i)}
                      >
                        {v}
                      </button>
                    ),
                  )}
                </div>
              </div>
            )}
            <div className="space-y-2" aria-label="Tabla hash">
              {b.buckets.map((chain, i) => (
                <div
                  key={i}
                  className={`flex flex-wrap items-center gap-2 rounded-xl border p-2 ${b.bucket === i ? 'border-primary' : 'border-outline'}`}
                >
                  <button
                    disabled={locked}
                    className="btn-secondary btn-sm"
                    onClick={() => action({ type: 'bucket', index: i })}
                    aria-label={`Elegir cubeta ${i}`}
                  >
                    Cubeta {i}
                  </button>
                  {chain.map((id, j) => (
                    <span className="flex items-center gap-2" key={id}>
                      <button
                        className={`rounded-lg border p-3 font-mono ${b.bucket === i && b.node === j ? 'border-primary bg-primary-container' : 'border-outline'}`}
                        disabled={locked}
                        aria-label={`Visitar cubeta ${i}, nodo ${j}: ${exercise.dataset[id]}`}
                        onClick={() => action({ type: 'visit', index: j, value: i })}
                      >
                        {exercise.dataset[id]}
                        <small className="block">nodo {j}</small>
                      </button>
                      <span>→</span>
                    </span>
                  ))}
                  <span
                    className={
                      b.bucket === i && b.node === chain.length ? 'font-bold text-primary' : ''
                    }
                  >
                    ∅
                  </span>
                </div>
              ))}
            </div>
            {b.stage === 'INSERT' ? (
              <div className="flex flex-wrap items-end gap-3">
                <label>
                  Posición de inserción en la cadena (desde 0)
                  <input
                    className="input w-24"
                    type="number"
                    min={0}
                    max={999}
                    value={position}
                    disabled={locked}
                    onChange={(e) => setPosition(integer(e.target.value))}
                  />
                </label>
                <button
                  className="btn-secondary"
                  disabled={locked}
                  onClick={() =>
                    action({ type: 'insert', index: position, value: selected ?? 999 })
                  }
                >
                  Insertar al final
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <p className="w-full text-sm">
                  Pulsa el primer nodo para visitarlo. Compara y avanza con «Siguiente nodo». No se
                  pueden saltar nodos.
                </p>
                <button
                  className="btn-secondary"
                  disabled={locked}
                  onClick={() => action({ type: 'compare' })}
                >
                  Comparar
                </button>
                <button
                  className="btn-secondary"
                  disabled={locked}
                  onClick={() => action({ type: 'next' })}
                >
                  Siguiente nodo
                </button>
              </div>
            )}
          </>
        )}
        {(binary || b.stage === 'SEARCH') && (
          <div className="flex flex-wrap gap-2">
            <button
              className="btn-secondary"
              disabled={locked}
              onClick={() => action({ type: 'found' })}
            >
              Encontrado
            </button>
            <button
              className="btn-secondary"
              disabled={locked}
              onClick={() => action({ type: 'absent' })}
            >
              No encontrado
            </button>
          </div>
        )}
        <p role="status">
          {message ||
            'Sigue los pasos del algoritmo. Una acción incorrecta no hace avanzar el ejercicio.'}
        </p>
        {run.complete && (
          <p>
            Terminaste todas las inserciones y búsquedas previstas. Puedes evaluar el recorrido.
          </p>
        )}
        {draft.actions.length >= 3000 && (
          <p role="alert">
            Alcanzaste 3000 acciones. Guarda el historial y solicita revisión al profesor.
          </p>
        )}
        <p className="text-sm">
          {binary
            ? 'Se evalúa el procedimiento de búsqueda (100 puntos).'
            : 'Rúbrica: cálculo hash 30 puntos; inserciones y colisiones 35; búsquedas 35.'}{' '}
          Los errores reducen la nota. Solo evaluar consume un intento.
        </p>
        <button
          className="btn-primary"
          disabled={readOnly || !run.complete}
          onClick={() => onEvaluate(evaluateSearch(exercise, draft))}
        >
          Guardar y evaluar búsqueda
        </button>
        {canRestart && (
          <button className="btn-secondary" disabled={readOnly} onClick={onRestart}>
            Nuevo recorrido para otro intento
          </button>
        )}
        {showFeedback && score !== undefined && (
          <p className="font-semibold">Última calificación confirmada: {score}%</p>
        )}
      </div>
    </section>
  );
}
export function SearchReview({ exercise, draft }: { exercise: Exercise; draft?: SearchDraft }) {
  const r = evaluateSearch(exercise, draft),
    trace = searchTrace(exercise);
  return (
    <div className="space-y-4">
      <SearchReader exercise={exercise} />
      <p>
        {r.cursor}/{r.totalSteps} pasos · {r.errors} errores ·{' '}
        {r.complete ? 'Completo' : 'Incompleto'}
      </p>
      <div className="max-h-96 overflow-auto">
        <table className="table-base text-xs">
          <thead>
            <tr>
              <th>Paso y clave</th>
              <th>Acción del alumno</th>
              <th>Resultado</th>
              <th>Acción esperada</th>
            </tr>
          </thead>
          <tbody>
            {r.events.map((e, i) => (
              <tr key={i}>
                <td>
                  {i + 1}. {trace[e.step - 1]?.before.phase || 'Fin'}
                </td>
                <td>{describeSearchAction(exercise, e.action)}</td>
                <td>{e.accepted ? 'Correcto' : 'Error; no avanza'}</td>
                <td>
                  {trace[e.step - 1]
                    ? describeSearchAction(exercise, trace[e.step - 1].action)
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
