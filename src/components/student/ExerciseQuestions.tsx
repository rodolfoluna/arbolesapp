import { useState } from 'react';
import type { Answers, Exercise, FlatTree } from '../../lib/tree/types';
import type { ActivitySettings } from '../../lib/models';
import { evaluateExercise, type Evaluation } from '../../lib/tree/evaluate';
import { treeValues } from '../../lib/tree/edit';
import { ScorePill } from '../ui';

interface Props {
  exercise: Exercise;
  settings: ActivitySettings;
  tree: FlatTree;
  answers: Answers;
  onChangeAnswers: (a: Answers) => void;
  onSaveAndEvaluate: (evaluation: Evaluation) => void;
  readOnly?: boolean;
  lastEvaluation?: Evaluation | null;
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
}: Props) {
  const [activeField, setActiveField] = useState<keyof Answers | null>(null);
  const currentTreeValues = treeValues(tree);

  const update = (key: keyof Answers, val: string) => {
    if (readOnly) return;
    onChangeAnswers({ ...answers, [key]: val });
  };

  // Ayudante para agregar un valor seleccionado con un clic a campos de lista
  const appendToField = (key: keyof Answers, val: string) => {
    if (readOnly) return;
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
    const evalResult = evaluateExercise(exercise, settings, tree, answers);
    onSaveAndEvaluate(evalResult);
  };

  return (
    <div className="flex h-full flex-col justify-between overflow-y-auto p-4 sm:p-5">
      <div className="space-y-4">
        {/* Cabecera del Cuestionario */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
          <div>
            <h3 className="font-semibold text-white">Cuestionario Teórico</h3>
            <p className="text-xs text-slate-400">
              Analiza las propiedades del árbol que construiste a la izquierda
            </p>
          </div>
          {lastEvaluation && (
            <ScorePill score={lastEvaluation.total} label="Calificación" />
          )}
        </div>

        {/* Criterios activos del profesor */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5 text-[11px] text-slate-400">
          <span className="font-medium text-slate-300">Criterio de clase: </span>
          {settings.heightMode === 'LEVELS'
            ? 'Altura en niveles (raíz = 1)'
            : 'Altura en aristas (raíz = 0)'}
          {' · '}
          {settings.rootIsInternal
            ? 'La raíz con hijos cuenta como nodo interno'
            : 'La raíz no cuenta como nodo interno'}
        </div>

        {/* Chips de apoyo rápido para evitar errores de tipeo en celular */}
        {currentTreeValues.length > 0 && !readOnly && (
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
              disabled={readOnly}
              value={answers.root}
              onFocus={() => setActiveField('root')}
              onChange={(e) => update('root', e.target.value)}
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
              disabled={readOnly}
              value={answers.height}
              onFocus={() => setActiveField('height')}
              onChange={(e) => update('height', e.target.value)}
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
              disabled={readOnly}
              value={answers.leaves}
              onFocus={() => setActiveField('leaves')}
              onChange={(e) => update('leaves', e.target.value)}
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
              disabled={readOnly}
              value={answers.internals}
              onFocus={() => setActiveField('internals')}
              onChange={(e) => update('internals', e.target.value)}
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
              disabled={readOnly}
              value={answers.preorder}
              onFocus={() => setActiveField('preorder')}
              onChange={(e) => update('preorder', e.target.value)}
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
              disabled={readOnly}
              value={answers.inorder}
              onFocus={() => setActiveField('inorder')}
              onChange={(e) => update('inorder', e.target.value)}
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
              disabled={readOnly}
              value={answers.postorder}
              onFocus={() => setActiveField('postorder')}
              onChange={(e) => update('postorder', e.target.value)}
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
          disabled={readOnly}
          onClick={handleEvaluate}
          className="btn-primary w-full py-3 text-sm font-semibold tracking-wide"
        >
          <span>🚀 Guardar y Evaluar Ejercicio</span>
        </button>
      </div>
    </div>
  );
}
