// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudentActivityView } from './StudentActivityView';
import { saveExerciseSubmission } from '../../lib/db';
import type { Activity, Submission } from '../../lib/models';
vi.mock('../../lib/central', () => ({ centralEnabled: true }));
vi.mock('../../lib/auth', () => ({ useAuth: () => ({ profile: { uid: 'local-student', controlNumber: '001A' } }) }));
vi.mock('../../lib/db', () => ({ saveExerciseSubmission: vi.fn() }));
vi.mock('../tree/TreeCanvas', () => ({ TreeCanvas: () => null }));
vi.mock('./ExerciseQuestions', () => ({ ExerciseQuestions: ({ onSaveAndEvaluate, readOnly, attempts }: any) => <button disabled={readOnly} onClick={() => onSaveAndEvaluate({ total: 100, structureExact: true })}>Evaluar prueba ({attempts})</button> }));
const activity: Activity = { id: 'a', groupId: 'g', title: 'Prueba', description: '', settings: { open: true, maxAttempts: 1, heightMode: 'LEVELS', rootIsInternal: false, showFeedback: true }, exercises: [{ id: 'ex', title: 'Ejercicio', treeType: 'BST', dataType: 'NUMBER', dataset: ['1'] }] };
afterEach(() => { cleanup(); vi.resetAllMocks(); localStorage.clear(); });
it('una evaluación central fallida conserva borrador sin consumir intentos', async () => {
  vi.mocked(saveExerciseSubmission).mockRejectedValueOnce(new Error('Sin conexión'));
  render(<StudentActivityView activity={activity} submission={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Evaluar prueba (0)' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Sin conexión'));
  expect((screen.getByRole('button', { name: 'Evaluar prueba (0)' }) as HTMLButtonElement).disabled).toBe(false);
  const draft = JSON.parse(localStorage.getItem('tree_sub_a_001A_ex')!);
  expect(draft.attempts).toBe(0);
  expect(draft.submitted).toBe(false);
});
it('solo confirma el intento y resultado devueltos por el backend', async () => {
  let finish!: (submission: Submission) => void;
  vi.mocked(saveExerciseSubmission).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  render(<StudentActivityView activity={activity} submission={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Evaluar prueba (0)' }));
  expect((screen.getByRole('button', { name: 'Evaluar prueba (0)' }) as HTMLButtonElement).disabled).toBe(true);
  const draft = JSON.parse(localStorage.getItem('tree_sub_a_001A_ex')!);
  finish({ id: 'a_001A', activityId: 'a', controlNumber: '001A', studentUid: 'local-student', fullName: 'Alumno', exercisesData: { ex: { ...draft, attempts: 1, score: 40, submitted: true } } });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Evaluar prueba (1)' })).toBeTruthy());
  expect(JSON.parse(localStorage.getItem('tree_sub_a_001A_ex')!).score).toBe(40);
});
