import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ read: vi.fn(), get: vi.fn(), delete: vi.fn() }));
vi.mock('./firebase', () => ({ isFirebaseConfigured: true, getDb: () => ({}) }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, name: string, id: string) => `${name}/${id}`,
  getDocsFromServer: mocks.read,
  runTransaction: (_db: unknown, callback: (transaction: unknown) => Promise<number>) => callback({ get: mocks.get, delete: mocks.delete }),
}));
import { deleteOrphanSubmissions, fetchOrphanSubmissions } from './db';
beforeEach(() => vi.resetAllMocks());

it('busca en el servidor y excluye las entregas de actividades vigentes', async () => {
  mocks.read.mockResolvedValueOnce({ docs: [{ id: 'live' }] });
  mocks.read.mockResolvedValueOnce({ docs: [
    { id: 'one', data: () => ({ activityId: 'live' }) },
    { id: 'two', data: () => ({ activityId: 'deleted' }) },
  ] });
  expect(await fetchOrphanSubmissions()).toEqual([{ id: 'two', activityId: 'deleted' }]);
});

it('rechaza la limpieza si la actividad reaparece después de buscar', async () => {
  mocks.get.mockResolvedValueOnce({ exists: () => true });
  await expect(deleteOrphanSubmissions('live', ['one'])).rejects.toThrow('La actividad existe');
  expect(mocks.delete).not.toHaveBeenCalled();
});

it('solo elimina documentos revisados del mismo activityId, omitiendo faltantes y duplicados', async () => {
  mocks.get.mockResolvedValueOnce({ exists: () => false });
  mocks.get.mockResolvedValueOnce({ exists: () => true, data: () => ({ activityId: 'deleted' }), ref: 'submissions/one' });
  mocks.get.mockResolvedValueOnce({ exists: () => true, data: () => ({ activityId: 'live' }), ref: 'submissions/two' });
  mocks.get.mockResolvedValueOnce({ exists: () => false });
  expect(await deleteOrphanSubmissions('deleted', ['one', 'one', 'two', 'missing'])).toBe(1);
  expect(mocks.delete).toHaveBeenCalledExactlyOnceWith('submissions/one');
});

it('no elimina si falla la comprobación de conexión', async () => {
  mocks.get.mockRejectedValueOnce(new Error('Sin conexión'));
  await expect(deleteOrphanSubmissions('deleted', ['one'])).rejects.toThrow('Sin conexión');
  expect(mocks.delete).not.toHaveBeenCalled();
});

it('limita la operación antes de consultar para evitar borrados parciales', async () => {
  await expect(deleteOrphanSubmissions('deleted', Array.from({ length: 201 }, (_, i) => String(i)))).rejects.toThrow('200');
  expect(mocks.get).not.toHaveBeenCalled();
});
