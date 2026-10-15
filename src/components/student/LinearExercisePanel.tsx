import type { ActivitySettings } from '../../lib/models';
import type { Exercise, LinearAnswers } from '../../lib/tree/types';
import {
  STRUCTURE_ICON,
  STRUCTURE_LABEL,
  STRUCTURE_ORDER_HINT,
  evaluateLinear,
  type LinearEvaluation,
} from '../../lib/linear/linear';
import { ScorePill } from '../ui';

interface Props {
  exercise: Exercise;
  settings: ActivitySettings;
  answers: LinearAnswers;
  onChangeAnswers: (a: LinearAnswers) => void;
  onSaveAndEvaluate: (evaluation: LinearEvaluation) => void;
  readOnly?: boolean;
  lastEvaluation?: LinearEvaluation | null;
}

/** Ejercicio de lista/pila/cola: el alumno ejecuta la secuencia y responde estado final y datos extraídos. */
export function LinearExercisePanel({
  exercise,
  settings,
  answers,
  onChangeAnswers,
  onSaveAndEvaluate,
  readOnly = false,
  lastEvaluation,
}: Props) {
  const cfg = exercise.linear!;
  const label = STRUCTURE_LABEL[cfg.structure];

  const update = (key: keyof LinearAnswers, val: string) => {
    if (readOnly) return;
    onChangeAnswers({ ...answers, [key]: val });
  };

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-2">
        {/* Enunciado: estado inicial + secuencia de operaciones */}
        <section className="card space-y-4 border-outline bg-surface-container" aria-label="Instrucciones del ejercicio">
          <div className="flex items-center gap-3 border-b border-outline pb-3">
            <span className="text-3xl" aria-hidden>
              {STRUCTURE_ICON[cfg.structure]}
            </span>
            <div>
              <h3 className="font-semibold text-text-primary">Ejecuta la secuencia sobre una {label.toLowerCase()}</h3>
              <p className="text-xs text-text-muted">
                Elementos escritos {STRUCTURE_ORDER_HINT[cfg.structure]}.
              </p>
            </div>
          </div>

          <div>
            <div className="label">Estado inicial</div>
            <div className="rounded-xl border border-outline bg-surface-variant/40 px-3 py-2 font-mono text-sm text-text-primary">
              {exercise.dataset.length > 0 ? `[ ${exercise.dataset.join(', ')} ]` : `${label} vacía`}
            </div>
          </div>

          <div>
            <div className="label">Operaciones (en orden)</div>
            <ol className="space-y-1.5">
              {cfg.ops.map((op, i) => (
                <li
                  key={`${op}-${i}`}
                  className="flex items-center gap-3 rounded-xl border border-outline bg-surface px-3 py-1.5"
                >
                  <span className="w-6 text-right font-mono text-xs text-text-muted">{i + 1}.</span>
                  <code className="font-mono text-sm font-semibold text-primary">{op}</code>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Respuestas */}
        <section className="card flex flex-col justify-between gap-4 border-outline bg-surface-container" aria-label="Respuestas">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-outline pb-3">
              <div>
                <h3 className="font-semibold text-text-primary">Tus respuestas</h3>
                <p className="text-xs text-text-muted">Separa los elementos con comas. Si queda vacío escribe «-».</p>
              </div>
              {lastEvaluation && <ScorePill score={lastEvaluation.total} label="Calificación" />}
            </div>

            <div>
              <label className="label" htmlFor="lin-final">
                1. Estado final de la {label.toLowerCase()} ({STRUCTURE_ORDER_HINT[cfg.structure]})
              </label>
              <input
                id="lin-final"
                type="text"
                className="input-mono text-sm"
                placeholder="Ej: 4, 5, 9"
                disabled={readOnly}
                autoComplete="off"
                value={answers.finalState}
                onChange={(e) => update('finalState', e.target.value)}
              />
            </div>

            <div>
              <label className="label" htmlFor="lin-extracted">
                2. Datos extraídos / devueltos por las operaciones (en orden)
              </label>
              <input
                id="lin-extracted"
                type="text"
                className="input-mono text-sm"
                placeholder="Ej: 1, 5, false (o '-' si ninguna devuelve un dato)"
                disabled={readOnly}
                autoComplete="off"
                value={answers.extracted}
                onChange={(e) => update('extracted', e.target.value)}
              />
              <p className="mt-1 text-xs text-text-muted">
                Incluye lo que devuelven operaciones como remove, get, pop, dequeue, head, peek, size, isEmpty…
              </p>
            </div>

            {lastEvaluation && settings.showFeedback && (
              <div className="rounded-xl border border-outline bg-surface-variant/40 p-3 text-xs">
                <div className="mb-2 font-medium text-text-primary">Desglose de Calificación ({lastEvaluation.total}/100)</div>
                <div className="space-y-1 divide-y divide-outline">
                  {lastEvaluation.items.map((it) => (
                    <div key={it.key} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-1.5">
                        <span className={it.correct ? 'text-emerald-500' : 'text-red-500'}>{it.correct ? '✓' : '✗'}</span>
                        <span className="text-text-secondary">{it.label}</span>
                      </div>
                      <div className="font-mono text-text-muted">
                        <span className={it.correct ? 'text-emerald-500' : 'text-text-muted'}>{it.points}</span>/{it.max} pts
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            id="btn-evaluate-exercise"
            type="button"
            disabled={readOnly}
            onClick={() => onSaveAndEvaluate(evaluateLinear(exercise, answers))}
            className="btn-primary w-full py-3 text-sm font-semibold tracking-wide"
          >
            <span>🚀 Guardar y Evaluar Ejercicio</span>
          </button>
        </section>
      </div>
    </div>
  );
}
