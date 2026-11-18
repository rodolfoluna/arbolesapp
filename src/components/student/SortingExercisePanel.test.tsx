// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudentActivityView } from './StudentActivityView';
import { saveExerciseSubmission } from '../../lib/db';
import { newSortingExercise, sortingTrace } from '../../lib/sorting/sorting';
import { DEFAULT_SETTINGS, type Activity } from '../../lib/models';
vi.mock('../../lib/central', () => ({ centralEnabled: true }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ profile: { uid: 's', controlNumber: '001' } }),
}));
vi.mock('../../lib/db', () => ({ saveExerciseSubmission: vi.fn() }));
vi.mock('../tree/TreeCanvas', () => ({ TreeCanvas: () => null }));
const exercise = { ...newSortingExercise('BUBBLE', 'bubble'), dataset: ['3', '1', '2'] };
const activity: Activity = {
  id: 'sorting-test',
  title: 'Prueba',
  groupId: 'g',
  description: '',
  settings: DEFAULT_SETTINGS,
  exercises: [exercise],
};
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.resetAllMocks();
});
it('lee pseudocódigo, rechaza intercambio prematuro, guarda errores y avance local sin escrituras por clic, y reanuda al recargar', () => {
  const view = render(<StudentActivityView activity={activity} submission={null} />);
  fireEvent.click(screen.getByText('Leer algoritmo: Bubble'));
  expect(screen.getByText(/para fin = n-1/)).toBeTruthy();
  const first = () => screen.getByRole('button', { name: 'Arreglo posición 0: 3, tarjeta 1' });
  const second = () => screen.getByRole('button', { name: 'Arreglo posición 1: 1, tarjeta 2' });
  fireEvent.click(first());
  fireEvent.click(second());
  fireEvent.click(screen.getByRole('button', { name: 'Intercambiar' }));
  expect(screen.getByText(/Movimiento rechazado/)).toBeTruthy();
  expect(first()).toBeTruthy();
  fireEvent.click(first());
  fireEvent.click(second());
  fireEvent.click(screen.getByRole('button', { name: 'Comparar' }));
  fireEvent.click(first());
  fireEvent.click(second());
  fireEvent.click(screen.getByRole('button', { name: 'Intercambiar' }));
  expect(screen.getByRole('button', { name: 'Arreglo posición 0: 1, tarjeta 2' })).toBeTruthy();
  expect(saveExerciseSubmission).not.toHaveBeenCalled();
  const stored = JSON.parse(localStorage.getItem('tree_sub_sorting-test_001_bubble')!);
  expect(stored.sortingDraft.actions).toHaveLength(3);
  expect(stored.attempts).toBe(0);
  view.unmount();
  render(<StudentActivityView activity={activity} submission={null} />);
  expect(screen.getByText(/Pasos correctos: 2.*Errores: 1/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Arreglo posición 0: 1, tarjeta 2' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar en la nube' }));
  expect(saveExerciseSubmission).toHaveBeenCalledTimes(1);
  expect(vi.mocked(saveExerciseSubmission).mock.calls[0][4]).toBe('save');
});

it('un envío fallido mantiene el historial y no consume intentos; el resultado confirmado procede del backend', async () => {
  const actions = sortingTrace(exercise).map((step) => step.action);
  localStorage.setItem(
    'tree_sub_sorting-test_001_bubble',
    JSON.stringify({
      tree: { rootId: null, nodes: {} },
      answers: {},
      sortingDraft: { version: 1, actions },
      updatedAt: Date.now(),
      submitted: false,
      attempts: 0,
    }),
  );
  vi.mocked(saveExerciseSubmission).mockRejectedValueOnce(new Error('Falla de red'));
  render(<StudentActivityView activity={activity} submission={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y evaluar recorrido' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Falla de red'));
  let saved = JSON.parse(localStorage.getItem('tree_sub_sorting-test_001_bubble')!);
  expect(saved.sortingDraft.actions).toEqual(actions);
  expect(saved.attempts).toBe(0);
  vi.mocked(saveExerciseSubmission).mockResolvedValueOnce({
    id: 'sorting-test_001',
    activityId: activity.id,
    studentUid: 's',
    controlNumber: '001',
    fullName: 'Alumno',
    exercisesData: { bubble: { ...saved, attempts: 1, score: 100, submitted: true } },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y evaluar recorrido' }));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('tree_sub_sorting-test_001_bubble')!).attempts).toBe(1),
  );
  saved = JSON.parse(localStorage.getItem('tree_sub_sorting-test_001_bubble')!);
  expect(saved.score).toBe(100);
  expect(saveExerciseSubmission).toHaveBeenCalledTimes(2);
});
