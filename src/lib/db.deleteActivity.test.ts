import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), update: vi.fn(), delete: vi.fn(), batchDelete: vi.fn(), commit: vi.fn() }));
vi.mock('./firebase', () => ({ isFirebaseConfigured: true, getDb: () => ({}) }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, name: string, id: string) => `${name}/${id}`,
  query: (...args: unknown[]) => args,
  getDocsFromServer: mocks.read,
  updateDoc: mocks.update,
  deleteDoc: mocks.delete,
  writeBatch: () => ({ delete: mocks.batchDelete, commit: mocks.commit }),
}));
import { deleteActivity } from './db';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.update.mockResolvedValue(undefined);
  mocks.delete.mockResolvedValue(undefined);
  mocks.commit.mockResolvedValue(undefined);
});

it('conserva entregas por defecto sin consultarlas', async () => {
  await deleteActivity('activity');
  expect(mocks.delete).toHaveBeenCalledExactlyOnceWith('activities/activity');
  expect(mocks.read).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});

it('cierra la actividad, limpia más de un lote y elimina la actividad al finalizar', async () => {
  mocks.read.mockResolvedValueOnce({ size: 400, docs: Array.from({ length: 400 }, (_, i) => ({ ref: `submissions/${i}` })) });
  mocks.read.mockResolvedValueOnce({ size: 1, docs: [{ ref: 'submissions/400' }] });
  await deleteActivity('activity', true);
  expect(mocks.update).toHaveBeenCalledWith('activities/activity', expect.objectContaining({ 'settings.open': false }));
  expect(mocks.commit).toHaveBeenCalledTimes(2);
  expect(mocks.batchDelete).toHaveBeenCalledTimes(402);
  expect(mocks.batchDelete).toHaveBeenLastCalledWith('activities/activity');
  expect(mocks.delete).not.toHaveBeenCalled();
});

it('elimina una actividad sin entregas en un lote', async () => {
  mocks.read.mockResolvedValueOnce({ size: 0, docs: [] });
  await deleteActivity('activity', true);
  expect(mocks.batchDelete).toHaveBeenCalledExactlyOnceWith('activities/activity');
  expect(mocks.commit).toHaveBeenCalledTimes(1);
});

it('una falla intermedia conserva la actividad cerrada para poder reintentar', async () => {
  mocks.read.mockResolvedValueOnce({ size: 400, docs: Array.from({ length: 400 }, (_, i) => ({ ref: `submissions/${i}` })) });
  mocks.read.mockRejectedValueOnce(new Error('Sin conexión'));
  await expect(deleteActivity('activity', true)).rejects.toThrow('Sin conexión');
  expect(mocks.batchDelete.mock.calls.some(([ref]) => ref === 'activities/activity')).toBe(false);
  expect(mocks.commit).toHaveBeenCalledTimes(1);
  mocks.read.mockResolvedValueOnce({ size: 0, docs: [] });
  await deleteActivity('activity', true);
  expect(mocks.batchDelete).toHaveBeenLastCalledWith('activities/activity');
});
