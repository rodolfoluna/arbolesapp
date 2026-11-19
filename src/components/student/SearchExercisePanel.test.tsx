// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StudentActivityView } from './StudentActivityView';
import { saveExerciseSubmission } from '../../lib/db';
import { newSearchExercise, searchTrace } from '../../lib/search/search';
import { DEFAULT_SETTINGS, type Activity } from '../../lib/models';
vi.mock('../../lib/central', () => ({ centralEnabled: true }));
vi.mock('../../lib/auth', () => ({
  useAuth: () => ({ profile: { uid: 's', controlNumber: '001' } }),
}));
vi.mock('../../lib/db', () => ({ saveExerciseSubmission: vi.fn() }));
vi.mock('../tree/TreeCanvas', () => ({ TreeCanvas: () => null }));
const exercise = newSearchExercise('CHAINING', 'hash');
const activity: Activity = {
  id: 'search-test',
  title: 'Búsqueda',
  description: '',
  groupId: 'g',
  settings: DEFAULT_SETTINGS,
  exercises: [exercise],
};
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.resetAllMocks();
});
it('explica las colisiones, exige cálculo correcto y reanuda inserciones sin una escritura por clic', () => {
  const view = render(<StudentActivityView activity={activity} submission={null} />);
  fireEvent.click(screen.getByText('Explicación y algoritmo: Encadenamiento separado'));
  expect(screen.getByText(/Una tabla hash transforma/)).toBeTruthy();
  const input = () => screen.getByLabelText('Resultado calculado de h(10)');
  fireEvent.change(input(), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar cálculo hash' }));
  expect(screen.getByText(/Acción rechazada/)).toBeTruthy();
  fireEvent.change(input(), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Comprobar cálculo hash' }));
  fireEvent.click(screen.getByRole('button', { name: 'Elegir cubeta 3' }));
  fireEvent.click(screen.getByRole('button', { name: 'Clave 10, tarjeta 1' }));
  fireEvent.click(screen.getByRole('button', { name: 'Insertar al final' }));
  expect(screen.getByRole('button', { name: 'Visitar cubeta 3, nodo 0: 10' })).toBeTruthy();
  expect(screen.getByLabelText('Resultado calculado de h(17)')).toBeTruthy();
  expect(saveExerciseSubmission).not.toHaveBeenCalled();
  view.unmount();
  render(<StudentActivityView activity={activity} submission={null} />);
  expect(screen.getByRole('button', { name: 'Visitar cubeta 3, nodo 0: 10' })).toBeTruthy();
  expect(screen.getByText(/Pasos correctos: 3.*Errores: 1/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Guardar en la nube' }));
  expect(saveExerciseSubmission).toHaveBeenCalledTimes(1);
  expect(vi.mocked(saveExerciseSubmission).mock.calls[0][3].searchDraft!.actions).toHaveLength(4);
});
it('una evaluación fallida conserva el historial y el intento; confirmar actualiza solo la respuesta del backend', async () => {
  const ex = newSearchExercise('BINARY', 'binary');
  const a = { ...activity, exercises: [ex] };
  const actions = searchTrace(ex).map((s) => s.action);
  localStorage.setItem(
    'tree_sub_search-test_001_binary',
    JSON.stringify({
      tree: { rootId: null, nodes: {} },
      answers: {},
      updatedAt: Date.now(),
      attempts: 0,
      submitted: false,
      searchDraft: { version: 1, actions },
    }),
  );
  vi.mocked(saveExerciseSubmission).mockRejectedValueOnce(new Error('Sin conexión'));
  render(<StudentActivityView activity={a} submission={null} />);
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y evaluar búsqueda' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Sin conexión'));
  const data = JSON.parse(localStorage.getItem('tree_sub_search-test_001_binary')!);
  expect(data.attempts).toBe(0);
  expect(data.searchDraft.actions).toEqual(actions);
  vi.mocked(saveExerciseSubmission).mockResolvedValueOnce({
    id: 'search-test_001',
    activityId: 'search-test',
    controlNumber: '001',
    studentUid: 's',
    fullName: 'Alumno',
    exercisesData: { binary: { ...data, attempts: 1, score: 100, submitted: true } },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Guardar y evaluar búsqueda' }));
  await waitFor(() =>
    expect(JSON.parse(localStorage.getItem('tree_sub_search-test_001_binary')!).attempts).toBe(1),
  );
});
