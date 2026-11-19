import { expect, it } from 'vitest';
import { educationalService } from './service';
import { memoryStore } from './testing';
import type { Identity } from './identity';
import { EMPTY_ANSWERS, EMPTY_TREE } from '../src/lib/tree/types';
import { SEARCH_ALGORITHMS, newSearchExercise, searchTrace } from '../src/lib/search/search';
const teacher: Identity = {
  id: '00000000-0000-4000-8000-000000000001',
  role: 'teacher',
  active: true,
  must_change_password: false,
  full_name: 'Profesor',
  control_number: null,
  auth_version: 1,
};
const student: Identity = {
  ...teacher,
  id: '00000000-0000-4000-8000-000000000002',
  role: 'student',
  control_number: '001',
  full_name: 'Alumno',
};
function setup() {
  const store = memoryStore({
    users: [
      { id: 't', role: 'teacher', central_user_id: teacher.id },
      {
        id: 's',
        role: 'student',
        controlNumber: '001',
        groupIds: ['g'],
        central_user_id: student.id,
      },
    ],
    identityLinks: [
      { id: teacher.id, localUid: 't' },
      { id: student.id, localUid: 's' },
    ],
    groups: [{ id: 'g', name: 'Grupo' }],
    activities: [],
    submissions: [],
  });
  return { store, service: educationalService(store) };
}
const activity = () => ({
  id: 'a',
  title: 'Búsquedas',
  description: '',
  groupId: 'g',
  settings: {
    open: true,
    showFeedback: true,
    maxAttempts: 1,
    heightMode: 'LEVELS',
    rootIsInternal: false,
  },
  exercises: SEARCH_ALGORITHMS.map((a) => newSearchExercise(a, a)),
});
it.each(SEARCH_ALGORITHMS)(
  'evalúa %s en servidor, conserva errores y bloquea segundo intento',
  async (algorithm) => {
    const { service, store } = setup();
    const a = activity();
    await service.execute(teacher, 'saveActivity', { activity: a });
    const ex = a.exercises.find((x) => x.search!.algorithm === algorithm)!;
    const input = {
      activityId: 'a',
      exerciseId: algorithm,
      intent: 'save',
      data: {
        tree: EMPTY_TREE,
        answers: EMPTY_ANSWERS,
        searchDraft: { version: 1, actions: [{ type: 'found' }] },
        score: 100,
        attempts: -999,
        errors: 0,
      },
    };
    const saved = await service.execute(student, 'saveSubmission', input);
    expect(saved.exercisesData[algorithm].attempts).toBe(0);
    expect(saved.exercisesData[algorithm].score).toBeUndefined();
    await expect(
      service.execute(student, 'saveSubmission', { ...input, intent: 'evaluate' }),
    ).rejects.toMatchObject({ status: 400 });
    const actions = [{ type: 'found' }, ...searchTrace(ex).map((s) => s.action)];
    const done = await service.execute(student, 'saveSubmission', {
      ...input,
      intent: 'evaluate',
      data: { ...input.data, searchDraft: { version: 1, actions } },
    });
    expect(done.exercisesData[algorithm].attempts).toBe(1);
    expect(done.exercisesData[algorithm].score).toBeLessThan(100);
    expect(done.exercisesData[algorithm].submitted).toBe(true);
    await expect(service.execute(student, 'saveSubmission', input)).rejects.toMatchObject({
      status: 403,
    });
    expect(await store.list('groups')).toHaveLength(1);
  },
);
it('rechaza configuración inválida y conserva grupos durante publicación', async () => {
  const { service, store } = setup();
  const a = activity();
  a.exercises[0].dataset = ['9', '2', '1'];
  await expect(service.execute(teacher, 'saveActivity', { activity: a })).rejects.toThrow();
  expect(await store.list('activities')).toHaveLength(0);
  expect(await store.list('groups')).toHaveLength(1);
});
