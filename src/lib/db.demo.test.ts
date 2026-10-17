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
