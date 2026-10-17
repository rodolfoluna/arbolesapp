import type { ExerciseSubmission } from './models';

/** Los borradores más recientes nunca deben perderse por una respuesta tardía de la nube. */
export function latestExercise(
  remote: ExerciseSubmission | undefined,
  local: ExerciseSubmission | undefined,
): ExerciseSubmission | undefined {
  if (!local) return remote;
  if (!remote) return local;
  return local.updatedAt > remote.updatedAt ? local : remote;
}

/** Cada edición se conserva localmente. Solo un envío explícito usa la nube. */
export function persistExerciseDraft(
  key: string,
  data: ExerciseSubmission,
  reason: 'edit' | 'save' | 'evaluate',
  send: (data: ExerciseSubmission) => void,
): boolean {
  let stored = true;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    stored = false;
  }
  // Un almacenamiento lleno no debe impedir guardar o evaluar en Firebase.
  if (reason !== 'edit') send(data);
  return stored;
}
