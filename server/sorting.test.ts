import { expect, it } from 'vitest';
import { educationalService } from './service';
import { memoryStore } from './testing';
import type { Identity } from './identity';
import { EMPTY_ANSWERS, EMPTY_TREE } from '../src/lib/tree/types';
import { ALGORITHMS, newSortingExercise, sortingTrace } from '../src/lib/sorting/sorting';
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
  title: 'Ordenamiento',
  description: 'Prueba',
  groupId: 'g',
  settings: {
    open: true,
    showFeedback: true,
    maxAttempts: 1,
    heightMode: 'LEVELS',
    rootIsInternal: false,
  },
  exercises: ALGORITHMS.map((a) => ({ ...newSortingExercise(a, a), dataset: ['3', '1', '2'] })),
});
it('publica diez algoritmos, guarda avance sin intento, rechaza evaluación incompleta y recalcula nota ignorando contadores falsos', async () => {
  const { store, service } = setup();
  const a = activity();
  await service.execute(teacher, 'saveActivity', { activity: a });
  const input = {
    activityId: 'a',
    exerciseId: 'BUBBLE',
    intent: 'save',
    data: {
      tree: EMPTY_TREE,
      answers: EMPTY_ANSWERS,
      sortingDraft: { version: 1, actions: [{ type: 'swap', cards: [0, 1] }] },
      score: 100,
      attempts: -5,
      errors: 0,
    },
  };
  const saved = await service.execute(student, 'saveSubmission', input);
  expect(saved.exercisesData.BUBBLE.attempts).toBe(0);
  expect(saved.exercisesData.BUBBLE.score).toBeUndefined();
  await expect(
    service.execute(student, 'saveSubmission', { ...input, intent: 'evaluate' }),
  ).rejects.toMatchObject({ status: 400 });
  expect((await store.get('submissions', 'a_001'))!.exercisesData.BUBBLE.attempts).toBe(0);
  const actions = [
    ...input.data.sortingDraft.actions,
    ...sortingTrace(a.exercises[9]).map((s) => s.action),
  ];
  const result = await service.execute(student, 'saveSubmission', {
    ...input,
    intent: 'evaluate',
    data: { ...input.data, sortingDraft: { version: 1, actions } },
  });
  expect(result.exercisesData.BUBBLE.attempts).toBe(1);
  expect(result.exercisesData.BUBBLE.score).toBeLessThan(100);
  expect(result.exercisesData.BUBBLE.score).toBeGreaterThan(0);
  await expect(service.execute(student, 'saveSubmission', input)).rejects.toMatchObject({
    status: 403,
  });
  expect(await store.list('groups')).toHaveLength(1);
});
it('rechaza algoritmos y datos no soportados en actividades del profesor', async () => {
  const { service } = setup();
  const a = activity();
  a.exercises[0].dataset = ['-1', '2', '3'];
  await expect(service.execute(teacher, 'saveActivity', { activity: a })).rejects.toThrow();
});

it.each(ALGORITHMS)('califica en servidor el recorrido completo de %s', async (algorithm) => {
  const { service } = setup();
  const a = activity();
  await service.execute(teacher, 'saveActivity', { activity: a });
  const exercise = a.exercises.find((ex) => ex.sorting!.algorithm === algorithm)!;
  const result = await service.execute(student, 'saveSubmission', {
    activityId: 'a',
    exerciseId: algorithm,
    intent: 'evaluate',
    data: {
      tree: EMPTY_TREE,
      answers: EMPTY_ANSWERS,
      sortingDraft: { version: 1, actions: sortingTrace(exercise).map((s) => s.action) },
      score: -1,
      attempts: 100,
    },
  });
  expect(result.exercisesData[algorithm]).toMatchObject({
    score: 100,
    attempts: 1,
    submitted: true,
  });
});
