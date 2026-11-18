import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { SortingExercisePanel, SortingReview } from '../components/student/SortingExercisePanel';
import {
  ALGORITHMS,
  SORT_LABEL,
  newSortingExercise,
  type SortAlgorithm,
  type SortDraft,
} from '../lib/sorting/sorting';
export function Preview() {
  const [algorithm, setAlgorithm] = useState<SortAlgorithm>('BUBBLE');
  const [draft, setDraft] = useState<SortDraft>({ version: 1, actions: [] });
  const [score, setScore] = useState<number>();
  const [review, setReview] = useState(false);
  const exercise = {
    ...newSortingExercise(algorithm, 'local-preview'),
    dataset: ['32', '14', '23', '14'],
  };
  return (
    <main className="mx-auto max-w-6xl p-4">
      <h1 className="mb-3 text-2xl font-bold">Laboratorio local de ordenamiento</h1>
      <p className="mb-4">
        Vista de prueba sin conexión a Firebase. Estas acciones no crean actividades ni entregas
        reales.
      </p>
      <div className="flex flex-wrap gap-3">
        <label>
          Algoritmo
          <select
            className="input"
            value={algorithm}
            onChange={(e) => {
              setAlgorithm(e.target.value as SortAlgorithm);
              setDraft({ version: 1, actions: [] });
              setScore(undefined);
            }}
          >
            {ALGORITHMS.map((a) => (
              <option key={a} value={a}>
                {SORT_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <button className="btn-secondary" onClick={() => setReview(!review)}>
          {review ? 'Ver como alumno' : 'Ver revisión docente'}
        </button>
        <button
          className="btn-secondary"
          onClick={() => {
            setDraft({ version: 1, actions: [] });
            setScore(undefined);
          }}
        >
          Reiniciar prueba local
        </button>
      </div>
      {review ? (
        <SortingReview exercise={exercise} draft={draft} />
      ) : (
        <SortingExercisePanel
          key={algorithm}
          exercise={exercise}
          draft={draft}
          onChange={setDraft}
          onEvaluate={(result) => setScore(result.total)}
          readOnly={false}
          showFeedback={true}
          score={score}
          attempts={score === undefined ? 0 : 1}
          maxAttempts={0}
        />
      )}
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<Preview />);
