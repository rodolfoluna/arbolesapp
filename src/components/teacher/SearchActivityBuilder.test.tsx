// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ActivityBuilder } from './ActivityBuilder';
import { saveActivity } from '../../lib/db';
vi.mock('../../lib/db', () => ({
  saveActivity: vi.fn().mockResolvedValue(undefined),
  newActivityId: () => 'local-search',
}));
vi.mock('../tree/TreeCanvas', () => ({ TreeCanvas: () => null }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it('permite añadir exactamente los dos nuevos tipos y publicar su configuración con explicaciones', async () => {
  const saved = vi.fn();
  render(
    <ActivityBuilder groups={[{ id: 'g', name: 'Grupo' }]} onSaved={saved} onCancel={() => {}} />,
  );
  fireEvent.change(screen.getByLabelText('Título de la Actividad'), {
    target: { value: 'Búsquedas' },
  });
  fireEvent.click(screen.getByRole('button', { name: '+ Búsqueda binaria' }));
  expect(screen.getByText('Explicación y algoritmo: Búsqueda binaria')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '+ Encadenamiento separado' }));
  expect(screen.getByText('Explicación y algoritmo: Encadenamiento separado')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Publicar Actividad' }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const ex = vi.mocked(saveActivity).mock.calls[0][0].exercises;
  expect(ex.filter((x) => x.kind === 'SEARCH').map((x) => x.search!.algorithm)).toEqual([
    'BINARY',
    'CHAINING',
  ]);
  expect(ex.at(-1)!.search!.tableSize).toBe(7);
});

it('la plantilla genera solo los dos ejercicios de búsqueda', async () => {
  vi.stubGlobal(
    'confirm',
    vi.fn(() => true),
  );
  render(
    <ActivityBuilder
      groups={[{ id: 'g', name: 'Grupo' }]}
      onSaved={() => {}}
      onCancel={() => {}}
    />,
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Plantilla: búsqueda binaria y encadenamiento' }),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Publicar Actividad' }));
  await waitFor(() =>
    expect(vi.mocked(saveActivity).mock.calls.at(-1)![0].exercises).toHaveLength(2),
  );
});
