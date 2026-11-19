import { useState } from 'react';
import type { Exercise } from '../../lib/tree/types';
import {
  SEARCH_ALGORITHMS,
  SEARCH_LABEL,
  describeSearchAction,
  newSearchExercise,
  searchErrors,
  searchTrace,
} from '../../lib/search/search';
import { SearchReader } from '../student/SearchExercisePanel';
export function SearchExerciseEditor({
  exercise,
  onChange,
}: {
  exercise: Exercise;
  onChange: (patch: Partial<Exercise>) => void;
}) {
  const [raw, setRaw] = useState(exercise.dataset.join(', ')),
    [targets, setTargets] = useState(exercise.search!.targets.join(', '));
  const errors = searchErrors(exercise);
  const parse = (v: string) =>
    v
      .trim()
      .split(/[\s,;]+/)
      .filter(Boolean);
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
          Tipo de búsqueda
          <select
            className="input"
            value={exercise.search!.algorithm}
            onChange={(e) => {
              const next = newSearchExercise(
                e.target.value as (typeof SEARCH_ALGORITHMS)[number],
                exercise.id,
              );
              setRaw(next.dataset.join(', '));
              setTargets(next.search!.targets.join(', '));
              onChange(next);
            }}
          >
            {SEARCH_ALGORITHMS.map((a) => (
              <option key={a} value={a}>
                {SEARCH_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          {exercise.search!.algorithm === 'BINARY'
            ? 'Arreglo ordenado (estrictamente creciente)'
            : 'Claves por insertar, en orden'}
          <input
            className="input"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              onChange({ dataset: parse(e.target.value) });
            }}
          />
        </label>
        <label className="block">
          Objetivos de búsqueda (de 1 a 6)
          <input
            className="input"
            value={targets}
            onChange={(e) => {
              setTargets(e.target.value);
              onChange({ search: { ...exercise.search!, targets: parse(e.target.value) } });
            }}
          />
        </label>
        {exercise.search!.algorithm === 'CHAINING' && (
          <label className="block">
            Número de cubetas m (2 a 13)
            <input
              className="input w-28"
              type="number"
              min={2}
              max={13}
              value={exercise.search!.tableSize ?? 7}
              onChange={(e) =>
                onChange({ search: { ...exercise.search!, tableSize: Number(e.target.value) } })
              }
            />
            <span className="block">
              Función: h(k) = k mod m. Las colisiones se insertan al final de la cadena.
            </span>
          </label>
        )}
        <p>
          Claves enteras de 0 a 999, sin repetidos. Incluye objetivos presentes y ausentes para
          evaluar ambos casos. Cambiar de tipo carga un ejemplo nuevo.
        </p>
        {errors.map((e) => (
          <p role="alert" key={e}>
            {e}
          </p>
        ))}
      </div>
      <SearchReader exercise={exercise} />
      {!errors.length && (
        <details className="card">
          <summary>Procedimiento esperado (profesor)</summary>
          <ol className="max-h-96 list-decimal overflow-auto pl-6 text-sm">
            {searchTrace(exercise).map((s, i) => (
              <li key={i}>
                {s.before.phase}: {describeSearchAction(exercise, s.action)}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
