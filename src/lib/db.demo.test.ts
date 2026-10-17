import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { EMPTY_ANSWERS, EMPTY_TREE } from './tree/types';
import type { Submission } from './models';

vi.mock('./firebase', () => ({ isFirebaseConfigured: false, getDb: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  });
  vi.stubGlobal('window', new EventTarget());
});
afterEach(() => vi.unstubAllGlobals());

it('conserva una evaluación y su reinicio con las listas del alumno suscritas', async () => {
  const db = await import('./db');
  let latest: Submission[] = [];
  const stopActivities = db.subscribeActivities(['gpo-ed-3a'], () => {});
  const stopSubmissions = db.subscribeMySubmissions('22010456', (items) => { latest = items; });
  db.saveExerciseSubmission(
    { uid: 'demo-student-1', controlNumber: '22010456', fullName: 'Alumno de prueba' },
    'act-practica-1', 'ex1',
    { tree: EMPTY_TREE, answers: EMPTY_ANSWERS, updatedAt: 1, submitted: true, attempts: 1, score: 35 },
  );
  expect(latest[0].exercisesData.ex1.score).toBe(35);
  expect((await db.fetchSubmissionsByActivity('act-practica-1'))[0].exercisesData.ex1.attempts).toBe(1);
  await db.resetExerciseSubmission('act-practica-1', '22010456', 'ex1');
  expect(latest[0].exercisesData.ex1.attempts).toBe(0);
  expect(latest[0].exercisesData.ex1.submitted).toBe(false);
  expect(JSON.parse(localStorage.getItem('arboles_demo_submissions')!)[0].exercisesData.ex1.attempts).toBe(0);
  stopActivities();
  stopSubmissions();
});

it('conserva un grupo creado mientras el panel escucha grupos, alumnos y actividades', async () => {
  const db = await import('./db');
  const stop = [db.subscribeGroups(() => {}), db.subscribeStudents(() => {}), db.subscribeActivities('ALL', () => {})];
  const id = await db.createGroup('Grupo QA');
  expect(JSON.parse(localStorage.getItem('arboles_demo_groups')!).some((g: { id: string }) => g.id === id)).toBe(true);
  stop.forEach((unsubscribe) => unsubscribe());
});

it('la suscripción por grupo conserva altas y bajas de membresía sin mezclar otros grupos', async () => {
  const db = await import('./db');
  let controls: string[] = [];
  const stop = db.subscribeStudentsInGroup('gpo-ed-3a', (students) => {
    controls = students.map((student) => student.controlNumber);
  });
  expect(controls).toEqual(['22010456', '22010457']);
  await db.setGroupMembership(['demo-student-3'], 'gpo-ed-3a', true);
  expect(controls).toEqual(['22010456', '22010457', '22010458']);
  await db.setGroupMembership(['demo-student-1'], 'gpo-ed-3a', false);
  expect(controls).toEqual(['22010457', '22010458']);
  stop();
  await db.setGroupMembership(['demo-student-2'], 'gpo-ed-3a', false);
  expect(controls).toEqual(['22010457', '22010458']);
});

it('un grupo vacío no inicia una consulta global del alumnado', async () => {
  const db = await import('./db');
  const callback = vi.fn();
  const stop = db.subscribeStudentsInGroup('', callback);
  expect(callback).toHaveBeenCalledExactlyOnceWith([], expect.any(Object));
  stop();
});

it('eliminar un grupo conserva alumnos, otros grupos y entregas', async () => {
  const db = await import('./db');
  const id = await db.createGroup('Grupo para eliminar');
  await db.setGroupMembership(['demo-student-1', 'demo-student-3'], id, true);
  const stop = db.subscribeStudents(() => {});
  await db.saveExerciseSubmission(
    { uid: 'demo-student-1', controlNumber: '22010456', fullName: 'Alumno de prueba' },
    'act-practica-1', 'ex1',
    { tree: EMPTY_TREE, answers: EMPTY_ANSWERS, updatedAt: 1, submitted: true, attempts: 1, score: 35 },
  );
  await db.deleteGroup(id);
  const students = JSON.parse(localStorage.getItem('arboles_demo_students')!);
  expect(students).toHaveLength(3);
  expect(students.find((s: { uid: string }) => s.uid === 'demo-student-1').groupIds).toEqual(['gpo-ed-3a']);
  expect(students.find((s: { uid: string }) => s.uid === 'demo-student-3').groupIds).toEqual(['gpo-ed-3b']);
  expect(JSON.parse(localStorage.getItem('arboles_demo_groups')!).some((g: { id: string }) => g.id === id)).toBe(false);
  expect((await db.fetchSubmissionsByActivity('act-practica-1'))[0].exercisesData.ex1.score).toBe(35);
  stop();
});

it('no elimina un grupo con actividades ni modifica sus integrantes', async () => {
  const db = await import('./db');
  const callback = vi.fn();
  const stop = db.subscribeGroups(callback);
  await expect(db.deleteGroup('gpo-ed-3a')).rejects.toThrow('actividades asignadas');
  expect(callback).toHaveBeenCalledTimes(1);
  expect(callback.mock.calls[0][0].some((g: { id: string }) => g.id === 'gpo-ed-3a')).toBe(true);
  stop();
});
