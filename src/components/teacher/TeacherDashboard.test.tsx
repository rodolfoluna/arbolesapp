// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { TeacherDashboard } from './TeacherDashboard';
import { GroupManager } from './GroupManager';
import * as db from '../../lib/db';

const fixture = vi.hoisted(() => ({
  groups: [{ id: 'qa', name: 'Pruebas' }, { id: 'class', name: 'Clase' }],
  activities: [
    { id: 'a-qa', groupId: 'qa', title: 'Actividad QA', description: '', exercises: [], settings: { open: true } },
    { id: 'a-class', groupId: 'class', title: 'Actividad Clase', description: '', exercises: [], settings: { open: true } },
  ],
  students: [
    { uid: 'qa-student', role: 'student', controlNumber: 'QA1', fullName: 'Alumno QA', groupIds: ['qa'], mustChangePassword: false },
    { uid: 'class-student', role: 'student', controlNumber: 'CL1', fullName: 'Alumno Clase', groupIds: ['class'], mustChangePassword: false },
  ],
  stopGroups: vi.fn(), stopActivities: vi.fn(), stopStudents: vi.fn(), stopRoster: vi.fn(),
}));

vi.mock('../../lib/db', () => ({
  subscribeActivities: vi.fn((_groups, cb) => { cb(fixture.activities); return fixture.stopActivities; }),
  subscribeGroups: vi.fn((cb) => { cb(fixture.groups); return fixture.stopGroups; }),
  subscribeStudents: vi.fn((cb) => { cb(fixture.students); return fixture.stopStudents; }),
  subscribeStudentsInGroup: vi.fn((groupId, cb) => {
    cb(fixture.students.filter((student) => student.groupIds.includes(groupId)));
    return fixture.stopRoster;
  }),
  fetchSubmissionsByActivity: vi.fn(async () => []),
  deleteActivity: vi.fn(), setActivityOpen: vi.fn(), createGroup: vi.fn(), deleteGroup: vi.fn(),
  updateStudentName: vi.fn(), removeStudent: vi.fn(), fetchCredentials: vi.fn(),
  newActivityId: vi.fn(), saveActivity: vi.fn(), resetExerciseSubmission: vi.fn(),
}));
vi.mock('../../lib/accounts', () => ({
  createStudents: vi.fn(), downloadCsv: vi.fn(), parseStudentsCsv: vi.fn(), resetStudentPassword: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it('abrir el panel carga actividades y grupos sin consultar alumnado ni entregas', () => {
  render(<TeacherDashboard />);
  expect(screen.getByRole('heading', { name: 'Actividades Creadas' })).toBeTruthy();
  expect(screen.getByRole('heading', { name: 'Actividad QA' })).toBeTruthy();
  expect(db.subscribeActivities).toHaveBeenCalledTimes(1);
  expect(db.subscribeGroups).toHaveBeenCalledTimes(1);
  expect(db.subscribeStudents).not.toHaveBeenCalled();
  expect(db.subscribeStudentsInGroup).not.toHaveBeenCalled();
  expect(db.fetchSubmissionsByActivity).not.toHaveBeenCalled();
});

it('la matriz carga solo su grupo y cancela la escucha anterior al cambiar de actividad', async () => {
  render(<TeacherDashboard />);
  fireEvent.click(screen.getByRole('button', { name: '📊 Matriz de Avances' }));
  await waitFor(() => expect(screen.getByText('Alumno QA')).toBeTruthy());
  expect(screen.queryByText('Alumno Clase')).toBeNull();
  expect(db.subscribeStudentsInGroup).toHaveBeenLastCalledWith('qa', expect.any(Function), expect.any(Function));
  expect(db.subscribeStudents).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Actividad Clase' }));
  await waitFor(() => expect(screen.getByText('Alumno Clase')).toBeTruthy());
  expect(screen.queryByText('Alumno QA')).toBeNull();
  expect(db.subscribeStudentsInGroup).toHaveBeenLastCalledWith('class', expect.any(Function), expect.any(Function));
  expect(fixture.stopRoster).toHaveBeenCalledTimes(1);
});

it('gestión conserva el listado completo y reutiliza los grupos sin otra suscripción', async () => {
  render(<TeacherDashboard />);
  fireEvent.click(screen.getByRole('button', { name: '👥 Alumnos y Grupos' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Todos los alumnos (2)' })).toBeTruthy());
  expect(db.subscribeStudents).toHaveBeenCalledTimes(1);
  expect(db.subscribeGroups).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole('button', { name: 'Todos los alumnos (2)' }));
  expect(screen.getByText('Alumno QA')).toBeTruthy();
  expect(screen.getByText('Alumno Clase')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: '📋 Actividades y Prácticas' }));
  expect(fixture.stopStudents).toHaveBeenCalledTimes(1);
});

it('una falla al cargar el grupo muestra reintento y no exporta una lista vacía', async () => {
  vi.mocked(db.subscribeStudentsInGroup).mockImplementationOnce((_groupId, _cb, onError) => {
    onError?.(new Error('Sin permiso'));
    return fixture.stopRoster;
  });
  render(<TeacherDashboard />);
  fireEvent.click(screen.getByRole('button', { name: '📊 Matriz de Avances' }));
  await waitFor(() => expect(screen.getByText(/No se pudo cargar el alumnado del grupo/)).toBeTruthy());
  expect((screen.getByRole('button', { name: '📥 Exportar Calificaciones (CSV)' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Actualizar avances' }));
  await waitFor(() => expect(screen.getByText('Alumno QA')).toBeTruthy());
  expect(screen.queryByText(/No se pudo cargar el alumnado del grupo/)).toBeNull();
});

it('cancelar la eliminación no escribe y confirmar impide envíos duplicados', async () => {
  let finish!: () => void;
  vi.mocked(db.deleteGroup).mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  render(<GroupManager groups={fixture.groups} />);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar grupo' }));
  expect(screen.getByText(/Se conservarán las cuentas/)).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(db.deleteGroup).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar grupo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
  expect(db.deleteGroup).toHaveBeenCalledExactlyOnceWith('qa');
  expect((screen.getByRole('button', { name: 'Eliminando…' }) as HTMLButtonElement).disabled).toBe(true);
  finish();
  await waitFor(() => expect(screen.queryByText('Confirmar eliminación')).toBeNull());
  expect(screen.getByText('Todos los Alumnos Registrados')).toBeTruthy();
});

it('una eliminación fallida conserva la selección y permite reintentar', async () => {
  vi.mocked(db.deleteGroup).mockRejectedValueOnce(new Error('Este grupo tiene actividades asignadas.'));
  vi.mocked(db.deleteGroup).mockResolvedValueOnce(undefined);
  render(<GroupManager groups={fixture.groups} />);
  fireEvent.click(screen.getByRole('button', { name: 'Eliminar grupo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('actividades asignadas'));
  expect(screen.getByText('Alumnos de Pruebas')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar eliminación' }));
  await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  expect(db.deleteGroup).toHaveBeenCalledTimes(2);
});
