import { useState } from 'react';
import type { Exercise } from '../../lib/tree/types';
import {
  ALGORITHMS,
  SORT_LABEL,
  sortingErrors,
  sortingTrace,
  ACTION_LABEL,
} from '../../lib/sorting/sorting';
import { AlgorithmReader } from '../student/SortingExercisePanel';
export function SortingExerciseEditor({
  exercise,
  onChange,
}: {
  exercise: Exercise;
  onChange: (patch: Partial<Exercise>) => void;
}) {
  const [raw, setRaw] = useState(exercise.dataset.join(', '));
  const errors = sortingErrors(exercise);
  return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <label className="block">
          Título del ejercicio
          <input
            className="input"
            value={exercise.title}
            onChange={(e) => onChange({ title: e.target.value })}
          />
        </label>
        <label className="block">
          Algoritmo
          <select
            className="input"
            value={exercise.sorting!.algorithm}
            onChange={(e) =>
              onChange({ sorting: { algorithm: e.target.value as (typeof ALGORITHMS)[number] } })
            }
          >
            {ALGORITHMS.map((a) => (
              <option key={a} value={a}>
                {SORT_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Números en orden inicial
          <input
            className="input"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              onChange({
                dataset: e.target.value
                  .trim()
                  .split(/[\s,;]+/)
                  .filter(Boolean),
              });
            }}
          />
        </label>
        <p>
          De 3 a 12 enteros entre 0 y 99; se admiten repetidos. El orden inicial forma parte del
          ejercicio.
        </p>
        {errors.map((e) => (
          <p role="alert" key={e}>
            {e}
          </p>
        ))}
      </div>
      <AlgorithmReader exercise={exercise} />
      {!errors.length && (
        <details className="card">
          <summary>Vista previa del procedimiento esperado (profesor)</summary>
          <ol className="max-h-96 list-decimal overflow-auto pl-6 text-sm">
            {sortingTrace(exercise).map((step, i) => (
              <li key={i}>
                {step.board.phase}: {ACTION_LABEL[step.action.type]}{' '}
                {step.action.cards.map((id) => `${exercise.dataset[id]} (#${id + 1})`).join(', ')}
                {step.action.target === undefined ? '' : ` → ${step.action.target}`}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
