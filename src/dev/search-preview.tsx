import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import { SearchExercisePanel, SearchReview } from '../components/student/SearchExercisePanel';
import { newSearchExercise, type SearchAlgorithm, type SearchDraft } from '../lib/search/search';
export function Preview() {
  const [algorithm, setAlgorithm] = useState<SearchAlgorithm>('CHAINING'),
    [draft, setDraft] = useState<SearchDraft>({ version: 1, actions: [] }),
    [score, setScore] = useState<number>(),
    [review, setReview] = useState(false);
  const ex = newSearchExercise(algorithm, 'preview');
  return (
    <main className="mx-auto max-w-5xl p-4">
      <h1 className="mb-3 text-2xl font-bold">Laboratorio local de búsqueda</h1>
      <p>Prueba aislada: no usa Firebase ni modifica grupos o entregas.</p>
      <div className="my-4 flex flex-wrap gap-3">
        <label>
          Tipo de ejercicio
          <select
            className="input"
            value={algorithm}
            onChange={(e) => {
              setAlgorithm(e.target.value as SearchAlgorithm);
              setDraft({ version: 1, actions: [] });
              setScore(undefined);
            }}
          >
            <option value="BINARY">Búsqueda binaria</option>
            <option value="CHAINING">Encadenamiento separado</option>
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
        <SearchReview exercise={ex} draft={draft} />
      ) : (
        <SearchExercisePanel
          key={algorithm}
          exercise={ex}
          draft={draft}
          onChange={setDraft}
          onEvaluate={(r) => setScore(r.total)}
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
