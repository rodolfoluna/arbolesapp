// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { OrphanSubmissions } from './OrphanSubmissions';
import { deleteOrphanSubmissions, fetchOrphanSubmissions } from '../../lib/db';

vi.mock('../../lib/db', () => ({ fetchOrphanSubmissions: vi.fn(), deleteOrphanSubmissions: vi.fn() }));
const orphan = { id: 'old_student', activityId: 'old', controlNumber: '123', fullName: 'Alumno de prueba', studentUid: 'student', exercisesData: {} };
beforeEach(() => vi.resetAllMocks());
afterEach(cleanup);

it('no consulta al abrir; busca al pulsar y cancelar no elimina', async () => {
  vi.mocked(fetchOrphanSubmissions).mockResolvedValueOnce([orphan]);
  render(<OrphanSubmissions />);
  expect(fetchOrphanSubmissions).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Buscar entregas sin actividad' }));
  await waitFor(() => expect(screen.getByText(/Alumno de prueba/)).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar 1 entregas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(deleteOrphanSubmissions).not.toHaveBeenCalled();
});

it('conserva las entregas al fallar y permite reintentar la confirmación', async () => {
  vi.mocked(fetchOrphanSubmissions).mockResolvedValueOnce([orphan]);
  vi.mocked(deleteOrphanSubmissions).mockRejectedValueOnce(new Error('Sin conexión')).mockResolvedValueOnce(1);
  render(<OrphanSubmissions />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar entregas sin actividad' }));
  await waitFor(() => expect(screen.getByText(/Alumno de prueba/)).toBeTruthy());
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar 1 entregas' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('Sin conexión'));
  expect(screen.getByText(/Alumno de prueba/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
  await waitFor(() => expect(screen.getByText('No hay entregas de actividades eliminadas.')).toBeTruthy());
  expect(deleteOrphanSubmissions).toHaveBeenLastCalledWith('old', ['old_student']);
});

it('una búsqueda fallida informa el error sin mostrar un falso resultado vacío', async () => {
  vi.mocked(fetchOrphanSubmissions).mockRejectedValueOnce(new Error('Sin conexión'));
  render(<OrphanSubmissions />);
  fireEvent.click(screen.getByRole('button', { name: 'Buscar entregas sin actividad' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  expect(screen.queryByText('No hay entregas de actividades eliminadas.')).toBeNull();
});
