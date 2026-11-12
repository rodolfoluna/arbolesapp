import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import type { Server } from 'node:http';
import { createApp } from './app.ts';
import { memoryStore } from './testing.ts';
import type { Identity } from './identity.ts';
import { HttpError } from './identity.ts';

const origin = 'http://localhost:5173';
const teacher: Identity = { id: '00000000-0000-4000-8000-000000000001', role: 'teacher', full_name: 'Profesor', control_number: null, active: true, must_change_password: false, auth_version: 1 };
const student: Identity = { ...teacher, id: '00000000-0000-4000-8000-000000000002', role: 'student', control_number: '001A' };
const store = memoryStore({
  users: [{ id: 't', role: 'teacher', central_user_id: teacher.id }, { id: 's', role: 'student', controlNumber: '001A', groupIds: [], central_user_id: student.id }],
  identityLinks: [{ id: teacher.id, localUid: 't' }, { id: student.id, localUid: 's' }],
  groups: [{ id: 'g', name: 'Grupo' }],
});
let identity = teacher;
const authenticate = vi.fn(async () => identity);
const students = vi.fn(async () => ({ students: [], total: 0, page: 1, page_size: 50 }));
const app = createApp(store, { [origin]: 'client' }, { authenticate, students });
let server: Server, url: string;
beforeAll(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address(); url = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});
afterAll(async () => { await new Promise<void>((resolve) => server.close(() => resolve())); });
const request = (path: string, init: RequestInit = {}) => fetch(url + path, { ...init, headers: { Origin: origin, Authorization: 'Bearer fixture-access-token', ...init.headers } });

it('usa CORS exacto y no permite cookies como identidad ni cachear respuestas', async () => {
  const denied = await request('/api/me', { headers: { Origin: 'https://otro.example' } });
  expect(denied.status).toBe(403);
  const missing = await request('/api/me', { headers: { Authorization: '', Cookie: 'session=fake' } });
  expect(missing.status).toBe(401);
  identity = teacher;
  const me = await request('/api/me');
  expect(me.headers.get('cache-control')).toContain('no-store');
  expect(me.headers.get('access-control-allow-origin')).toBe(origin);
  expect(((await me.json()) as any).profile.uid).toBe('t');
});
it('el alumno no accede al directorio; búsqueda y paginación se reenvían al catálogo para profesor', async () => {
  identity = student;
  expect((await request('/api/students?search=ana&page=1')).status).toBe(403);
  identity = teacher;
  expect((await request('/api/students?search=Ana%20L%C3%B3pez&page=2')).status).toBe(200);
  expect(students).toHaveBeenLastCalledWith('fixture-access-token', origin, 'Ana López', 2);
});
it('403 y 503 centrales cierran el acceso antes de ejecutar una mutación', async () => {
  for (const status of [403, 503]) {
    authenticate.mockRejectedValueOnce(new HttpError(status, 'Acceso no disponible.'));
    const result = await request('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operation: 'createGroup', input: { name: 'No crear' } }) });
    expect(result.status).toBe(status);
  }
  expect(await store.list('groups')).toHaveLength(1);
});
it('no acepta estado activo aportado por el navegador en una incorporación', async () => {
  identity = teacher;
  const result = await request('/api/import-student', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ centralId: student.id, controlNumber: '001A', groupId: 'g', active: true }) });
  expect(result.status).toBe(400);
});
