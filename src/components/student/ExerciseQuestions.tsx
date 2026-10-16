import { useState } from 'react';
import type { Answers, Exercise, FlatTree } from '../../lib/tree/types';
import type { ActivitySettings } from '../../lib/models';
import { evaluateExercise, type Evaluation } from '../../lib/tree/evaluate';
import { treeValues } from '../../lib/tree/edit';
import { ScorePill, cx } from '../ui';

interface Props {
  exercise: Exercise;
  settings: ActivitySettings;
  tree: FlatTree;
  answers: Answers;
  onChangeAnswers: (a: Answers) => void;
  onSaveAndEvaluate: (evaluation: Evaluation) => void;
  readOnly?: boolean;
  lastEvaluation?: Evaluation | null;
  attempts?: number;
  maxAttempts?: number;
}

export function ExerciseQuestions({
  exercise,
  settings,
  tree,
  answers,
  onChangeAnswers,
  onSaveAndEvaluate,
  readOnly = false,
  lastEvaluation,
  attempts = 0,
  maxAttempts,
}: Props) {
  const [activeField, setActiveField] = useState<keyof Answers | null>(null);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const currentTreeValues = treeValues(tree);

  const max = maxAttempts ?? settings.maxAttempts ?? 0;
  const hasExhaustedAttempts = max > 0 && attempts >= max;
  const isReadOnly = readOnly || hasExhaustedAttempts;

  const handleBlockedPaste = (e: React.ClipboardEvent | React.DragEvent) => {
    e.preventDefault();
    setPasteBlocked(true);
    setTimeout(() => setPasteBlocked(false), 3500);
  };

  const update = (key: keyof Answers, val: string) => {
    if (isReadOnly) return;
    onChangeAnswers({ ...answers, [key]: val });
  };

  // Ayudante para agregar un valor seleccionado con un clic a campos de lista
  const appendToField = (key: keyof Answers, val: string) => {
    if (isReadOnly) return;
    const current = answers[key].trim();
    if (key === 'root' || key === 'height') {
      update(key, val);
      return;
    }
    if (!current) {
      update(key, val);
    } else {
      update(key, `${current}, ${val}`);
    }
  };

  const handleEvaluate = () => {
    if (isReadOnly) return;
    const evalResult = evaluateExercise(exercise, settings, tree, answers);
    onSaveAndEvaluate(evalResult);
  };

  return (
    <div className="flex h-full flex-col justify-between overflow-y-auto p-4 sm:p-5">
      <div className="space-y-4">
        {/* Cabecera del Cuestionario */}
        <div className="flex items-center justify-between border-b border-outline pb-3">
          <div>
            <h3 className="font-semibold text-text-primary">Cuestionario Teórico</h3>
            <p className="text-xs text-text-muted">
              Analiza las propiedades del árbol que construiste a la izquierda
            </p>
          </div>
          {lastEvaluation && (
            <ScorePill score={lastEvaluation.total} label="Calificación" />
          )}
        </div>

        {/* Banner de Estado de Intentos */}
        {max > 0 && (
          <div
            className={cx(
              'rounded-xl border p-2.5 text-xs font-medium flex items-center justify-between gap-2',
              hasExhaustedAttempts
                ? 'border-red-500/40 bg-red-500/10 text-red-500 dark:text-red-400'
                : attempts > 0
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400'
                : 'border-primary/40 bg-primary/10 text-primary'
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">
                {hasExhaustedAttempts ? '🔒' : attempts > 0 ? '⚠️' : '🎯'}
              </span>
              <span>
                {hasExhaustedAttempts
                  ? `Intentos agotados (${attempts}/${max}). Este ejercicio ya no se puede modificar.`
                  : max === 1
                  ? 'Solo tienes 1 intento. Al pulsar "Guardar y Evaluar" se registrará tu nota final sin corrección.'
                  : attempts > 0
                  ? `Has usado ${attempts} de ${max} intentos. Te queda ${max - attempts} intento(s) para corregir.`
                  : `Tienes hasta ${max} intentos para verificar y corregir tus respuestas.`}
              </span>
            </div>
            <span className="shrink-0 rounded-full bg-surface-variant/80 px-2 py-0.5 font-mono text-[11px] font-bold">
              {attempts}/{max}
            </span>
          </div>
        )}

        {/* Notificación cuando intenta pegar texto */}
        {pasteBlocked && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/15 p-2.5 text-xs font-medium text-amber-600 dark:text-amber-400 flex items-center gap-2 animate-fade-up">
            <span>🚫</span>
            <span>No está permitido pegar texto en las respuestas. Por favor escribe tu respuesta manualmente.</span>
          </div>
        )}

        {/* Criterios activos del profesor */}
        <div className="rounded-xl border border-outline bg-surface-variant/40 p-2.5 text-[11px] text-text-muted">
          <span className="font-medium text-text-primary">Criterio de clase: </span>
          {settings.heightMode === 'LEVELS'
            ? 'Altura en niveles (raíz = 1)'
            : 'Altura en aristas (raíz = 0)'}
          {' · '}
          {settings.rootIsInternal
            ? 'La raíz con hijos cuenta como nodo interno'
            : 'La raíz no cuenta como nodo interno'}
        </div>

        {/* Chips de apoyo rápido para evitar errores de tipeo en celular */}
        {currentTreeValues.length > 0 && !isReadOnly && (
          <div className="rounded-xl border border-iris-500/20 bg-iris-500/5 p-2.5">
            <div className="mb-1 text-[11px] font-medium text-iris-300">
              Valores en tu árbol (toca para insertar en el campo activo):
            </div>
            <div className="flex flex-wrap gap-1">
              {currentTreeValues.map((val, idx) => (
                <button
                  key={`${val}-${idx}`}
                  type="button"
                  onClick={() => {
                    if (activeField) appendToField(activeField, val);
                  }}
                  className="rounded bg-iris-500/20 px-2 py-0.5 font-mono text-xs text-iris-200 transition hover:bg-iris-500/35 active:scale-95"
                  title="Toca para insertar en el campo seleccionado"
                >
                  {val}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Formulario de preguntas */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Raíz */}
          <div>
            <label className="label" htmlFor="ans-root">
              1. Nodo Raíz
            </label>
            <input
              id="ans-root"
              type="text"
              className="input-mono text-sm"
              placeholder="Ej: 30"
              disabled={isReadOnly}
              value={answers.root}
              onFocus={() => setActiveField('root')}
              onChange={(e) => update('root', e.target.value)}
              onPaste={handleBlockedPaste}
              onDrop={handleBlockedPaste}
              autoComplete="off"
            />
          </div>

          {/* Altura */}
          <div>
            <label className="label" htmlFor="ans-height">
              2. Altura del Árbol
            </label>
            <input
              id="ans-height"
              type="number"
              min="0"
              max="20"
              className="input-mono text-sm"
              placeholder="Ej: 3"
              disabled={isReadOnly}
              value={answers.height}
              onFocus={() => setActiveField('height')}
              onChange={(e) => update('height', e.target.value)}
              onPaste={handleBlockedPaste}
              onDrop={handleBlockedPaste}
              autoComplete="off"
            />
          </div>

          {/* Nodos Hoja */}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ans-leaves">
              3. Nodos Hoja (separados por coma)
            </label>
            <input
              id="ans-leaves"
              type="text"
              className="input-mono text-sm"
              placeholder="Ej: 10, 25, 60"
              disabled={isReadOnly}
              value={answers.leaves}
              onFocus={() => setActiveField('leaves')}
              onChange={(e) => update('leaves', e.target.value)}
              onPaste={handleBlockedPaste}
              onDrop={handleBlockedPaste}
              autoComplete="off"
            />
          </div>

          {/* Nodos Internos */}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ans-internals">
              4. Nodos Internos / Rama (separados por coma)
            </label>
            <input
              id="ans-internals"
              type="text"
              className="input-mono text-sm"
              placeholder="Ej: 20, 45 (o '-' si ninguno)"
              disabled={isReadOnly}
              value={answers.internals}
              onFocus={() => setActiveField('internals')}
              onChange={(e) => update('internals', e.target.value)}
              onPaste={handleBlockedPaste}
              onDrop={handleBlockedPaste}
              autoComplete="off"
            />
          </div>

          {/* Recorrido Preorden */}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ans-preorder">
              5. Recorrido Preorden (Raíz, Izq, Der)
            </label>
            <input
              id="ans-preorder"
              type="text"
              className="input-mono text-sm"
              placeholder="Ej: 30, 20, 10, 25, 45, 60"
              disabled={isReadOnly}
              value={answers.preorder}
              onFocus={() => setActiveField('preorder')}
              onChange={(e) => update('preorder', e.target.value)}
              onPaste={handleBlockedPaste}
              onDrop={handleBlockedPaste}
              autoComplete="off"
            />
          </div>

          {/* Recorrido Enorden */}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ans-inorder">
              6. Recorrido Enorden (Izq, Raíz, Der)
            </label>
            <input
              id="ans-inorder"
              type="text"
              className="input-mono text-sm"
              placeholder="Ej: 10, 20, 25, 30, 45, 60"
              disabled={isReadOnly}
              value={answers.inorder}
              onFocus={() => setActiveField('inorder')}
              onChange={(e) => update('inorder', e.target.value)}
              onPaste={handleBlockedPaste}
              onDrop={handleBlockedPaste}
              autoComplete="off"
            />
          </div>

          {/* Recorrido Postorden */}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ans-postorder">
              7. Recorrido Postorden (Izq, Der, Raíz)
            </label>
            <input
              id="ans-postorder"
              type="text"
              className="input-mono text-sm"
              placeholder="Ej: 10, 25, 20, 60, 45, 30"
              disabled={isReadOnly}
              value={answers.postorder}
              onFocus={() => setActiveField('postorder')}
              onChange={(e) => update('postorder', e.target.value)}
              onPaste={handleBlockedPaste}
              onDrop={handleBlockedPaste}
              autoComplete="off"
            />
          </div>
        </div>

        {/* Desglose de Resultados si ya fue evaluado */}
        {lastEvaluation && settings.showFeedback && (
          <div className="mt-4 rounded-xl border border-white/10 bg-ink-950/70 p-3 text-xs">
            <div className="mb-2 flex items-center justify-between font-medium text-white">
              <span>Desglose de Calificación ({lastEvaluation.total}/100)</span>
              <span
                className={
                  lastEvaluation.structureExact ? 'text-mint-400' : 'text-sun-400'
                }
              >
                {lastEvaluation.structureExact
                  ? '✓ Estructura 100% correcta'
                  : `Estructura: ${(lastEvaluation.structureMatch * 100).toFixed(0)}% coincidencia`}
              </span>
            </div>
            <div className="space-y-1 divide-y divide-white/[0.04]">
              {lastEvaluation.items.map((it) => (
                <div key={it.key} className="flex items-center justify-between py-1">
                  <div className="flex items-center gap-1.5">
                    <span className={it.correct ? 'text-mint-400' : 'text-coral-400'}>
                      {it.correct ? '✓' : '✗'}
                    </span>
                    <span className="text-slate-300">{it.label}</span>
                  </div>
                  <div className="font-mono text-slate-400">
                    <span className={it.correct ? 'text-mint-300' : 'text-slate-400'}>
                      {it.points}
                    </span>
                    /{it.max} pts
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Botón de Guardado y Evaluación */}
      <div className="mt-6 border-t border-white/[0.08] pt-3">
        <button
          id="btn-evaluate-exercise"
          type="button"
          disabled={isReadOnly}
          onClick={handleEvaluate}
          className={cx(
            'btn-primary w-full py-3 text-sm font-semibold tracking-wide transition-all',
            hasExhaustedAttempts && '!bg-surface-variant !text-text-muted !border-outline !cursor-not-allowed opacity-75'
          )}
        >
          <span>
            {hasExhaustedAttempts
              ? `🔒 Intentos agotados (${attempts}/${max})`
              : !settings.open
              ? 'Actividad cerrada (solo lectura)'
              : max === 1
              ? '🚀 Guardar y Evaluar (Único intento)'
              : max > 1
              ? `🚀 Guardar y Evaluar (Intento ${attempts + 1} de ${max})`
              : '🚀 Guardar y Evaluar Ejercicio'}
          </span>
        </button>
      </div>
    </div>
  );
}
