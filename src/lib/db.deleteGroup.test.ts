import { beforeEach, expect, it, vi } from 'vitest';

const firestore = vi.hoisted(() => ({
  getDocsFromServer: vi.fn(),
  update: vi.fn(), delete: vi.fn(), commit: vi.fn(async () => {}),
}));
vi.mock('./firebase', () => ({ isFirebaseConfigured: true, getDb: () => ({}) }));
vi.mock('firebase/firestore', async (importOriginal) => ({
  ...await importOriginal<typeof import('firebase/firestore')>(),
  collection: (_db: unknown, name: string) => name,
  doc: (_db: unknown, name: string, id: string) => `${name}/${id}`,
  query: (...parts: unknown[]) => parts,
  getDocsFromServer: firestore.getDocsFromServer,
  writeBatch: () => ({ update: firestore.update, delete: firestore.delete, commit: firestore.commit }),
}));
import { deleteGroup } from './db';

beforeEach(() => vi.resetAllMocks());

it('elimina todas las membresías devueltas por el servidor y el grupo en un único lote', async () => {
  firestore.getDocsFromServer.mockResolvedValueOnce({ empty: true });
  firestore.getDocsFromServer.mockResolvedValueOnce({ size: 2, docs: [{ ref: 'users/active' }, { ref: 'users/disabled' }] });
  await deleteGroup('group');
  expect(firestore.update.mock.calls.map(([ref]) => ref)).toEqual(['users/active', 'users/disabled']);
  expect(firestore.delete).toHaveBeenCalledExactlyOnceWith('groups/group');
  expect(firestore.commit).toHaveBeenCalledTimes(1);
});

it('si hay actividades no consulta miembros ni escribe', async () => {
  firestore.getDocsFromServer.mockResolvedValueOnce({ empty: false });
  await expect(deleteGroup('group')).rejects.toThrow('actividades asignadas');
  expect(firestore.getDocsFromServer).toHaveBeenCalledTimes(1);
  expect(firestore.commit).not.toHaveBeenCalled();
});

it('sin acceso al servidor no autoriza el borrado con datos de caché', async () => {
  firestore.getDocsFromServer.mockRejectedValueOnce(new Error('Sin conexión'));
  await expect(deleteGroup('group')).rejects.toThrow('Sin conexión');
  expect(firestore.delete).not.toHaveBeenCalled();
  expect(firestore.commit).not.toHaveBeenCalled();
});

it('rechaza grupos mayores que el lote permitido sin aplicar cambios parciales', async () => {
  firestore.getDocsFromServer.mockResolvedValueOnce({ empty: true });
  firestore.getDocsFromServer.mockResolvedValueOnce({ size: 500 });
  await expect(deleteGroup('group')).rejects.toThrow('499');
  expect(firestore.update).not.toHaveBeenCalled();
  expect(firestore.delete).not.toHaveBeenCalled();
});
