// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CentralGroupManager } from './CentralGroupManager';
import { centralFetch } from '../../lib/central';
vi.mock('../../lib/central', () => ({ centralFetch: vi.fn(), refreshCentralData: vi.fn(), centralUrl: 'https://aula-identidad.onrender.com' }));
vi.mock('../../lib/db', () => ({ subscribeStudents: vi.fn((cb) => { cb([]); return () => {}; }), createGroup: vi.fn(), deleteGroup: vi.fn(), setGroupMembership: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('busca y pagina con texto codificado, bloquea suspendidos y envía solo identidad/grupo seleccionados', async () => {
  vi.mocked(centralFetch).mockResolvedValueOnce({ students: [
    { id: 'uuid-active', control_number: '001A', full_name: 'Ana activa', active: true },
    { id: 'uuid-inactive', control_number: '002A', full_name: 'Ana suspendida', active: false },
  ], page: 1, page_size: 50, total: 51 });
  vi.mocked(centralFetch).mockResolvedValueOnce({ students: [], page: 2, page_size: 50, total: 51 });
  vi.mocked(centralFetch).mockResolvedValueOnce({ profile: {} });
  render(<CentralGroupManager groups={[{ id: 'local-group', name: 'Clase local' }]} />);
  expect(centralFetch).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'local-group' } });
  fireEvent.change(screen.getByLabelText('Buscar por nombre o número de control'), { target: { value: 'Ana López' } });
  fireEvent.click(screen.getByRole('button', { name: 'Buscar en el catálogo central' }));
  await waitFor(() => expect(screen.getByLabelText('Ana activa · 001A')).toBeTruthy());
  expect((screen.getByLabelText('Ana suspendida · 002A (cuenta suspendida)') as HTMLInputElement).disabled).toBe(true);
  fireEvent.click(screen.getByLabelText('Ana activa · 001A'));
  fireEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
  await waitFor(() => expect(screen.getByText('Página 2 · 51 resultados')).toBeTruthy());
  expect(centralFetch).toHaveBeenLastCalledWith('/api/students?search=Ana%20L%C3%B3pez&page=2');
  fireEvent.click(screen.getByRole('button', { name: 'Incorporar al grupo local' }));
  await waitFor(() => expect(centralFetch).toHaveBeenLastCalledWith('/api/import-student', { centralId: 'uuid-active', controlNumber: '001A', groupId: 'local-group' }));
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Se incorporaron 1'));
});
