// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ActivityBuilder } from './ActivityBuilder';
import { saveActivity } from '../../lib/db';
import { ALGORITHMS } from '../../lib/sorting/sorting';
vi.mock('../../lib/db', () => ({
  saveActivity: vi.fn().mockResolvedValue(undefined),
  newActivityId: () => 'local-activity',
}));
vi.mock('../tree/TreeCanvas', () => ({ TreeCanvas: () => null }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('genera y guarda una actividad con exactamente un ejercicio por algoritmo y su lector', async () => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  const onSaved = vi.fn();
  render(
    <ActivityBuilder groups={[{ id: 'g', name: 'Grupo' }]} onSaved={onSaved} onCancel={() => {}} />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Plantilla: los 10 algoritmos de ordenamiento' }),
  );
  expect(screen.getByText('Leer algoritmo: Bucket')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar Actividad' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  const activity = vi.mocked(saveActivity).mock.calls[0][0];
  expect(activity.groupId).toBe('g');
  expect(activity.exercises).toHaveLength(10);
  expect(activity.exercises.map((ex) => ex.sorting!.algorithm)).toEqual(ALGORITHMS);
  expect(new Set(activity.exercises.map((ex) => ex.id)).size).toBe(10);
});
