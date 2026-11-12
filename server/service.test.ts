import { beforeEach, expect, it } from 'vitest';
import { memoryStore } from './testing.ts';
import { educationalService } from './service.ts';
import type { Identity } from './identity.ts';
import { EMPTY_TREE, EMPTY_ANSWERS } from '../src/lib/tree/types.ts';
export const teacher: Identity = { id: '00000000-0000-4000-8000-000000000001', role: 'teacher', active: true, must_change_password: false, full_name: 'Profesor', control_number: null, auth_version: 2 };
export const student: Identity = { ...teacher, id: '00000000-0000-4000-8000-000000000002', role: 'student', full_name: 'Alumno', control_number: '001A' };
const seed = () => ({
  users: [{ id: 'old-teacher', uid: 'old-teacher', role: 'teacher', central_user_id: teacher.id },
    { id: 'old-student', uid: 'old-student', role: 'student', controlNumber: '001A', groupIds: ['old-group'], central_user_id: student.id },
    { id: 'other-student', role: 'student', controlNumber: '002A', groupIds: ['other-group'] }],
  identityLinks: [{ id: teacher.id, localUid: 'old-teacher' }, { id: student.id, localUid: 'old-student' }],
  groups: [{ id: 'old-group', name: 'Grupo existente' }, { id: 'other-group', name: 'Otro grupo' }],
  activities: [{ id: 'old-activity', groupId: 'old-group', title: 'Actividad existente', settings: { open: true, maxAttempts: 1, heightMode: 'LEVELS', rootIsInternal: false }, exercises: [{ id: 'ex', title: 'Ejercicio', treeType: 'BST', dataType: 'NUMBER', dataset: ['1'] }] },
    { id: 'other-activity', groupId: 'other-group', settings: { open: true }, exercises: [] }],
  submissions: [{ id: 'old-activity_002A', activityId: 'old-activity', studentUid: 'other-student', controlNumber: '002A', exercisesData: {} }],
});
let store = memoryStore(seed());
let service = educationalService(store);
beforeEach(() => { store = memoryStore(seed()); service = educationalService(store); });

it('vincula el profesor existente sin reemplazar IDs, actividades ni grupos', async () => {
  expect((await service.execute(teacher, 'me')).uid).toBe('old-teacher');
  expect((await service.execute(teacher, 'groups'))[0].id).toBe('old-group');
  expect((await service.execute(teacher, 'activities'))[0].id).toBe('old-activity');
});
it.each(['students', 'createGroup', 'membership', 'saveActivity', 'deleteActivity', 'submissions', 'resetSubmission', 'orphanSubmissions', 'deleteOrphans'])('el alumno no ejecuta %s aunque envíe rol/UUID falsos', async (operation) => {
  await expect(service.execute(student, operation, { role: 'teacher', uid: 'old-teacher' })).rejects.toMatchObject({ status: 403 });
});
it('solo devuelve actividades y grupos propios; prohíbe consultar otra actividad y otra entrega', async () => {
  expect((await service.execute(student, 'groups')).map((item: any) => item.id)).toEqual(['old-group']);
  expect((await service.execute(student, 'activities')).map((item: any) => item.id)).toEqual(['old-activity']);
  await expect(service.execute(student, 'activity', { id: 'other-activity' })).rejects.toMatchObject({ status: 403 });
  await expect(service.execute(student, 'submission', { activityId: 'old-activity', controlNumber: '002A' })).rejects.toMatchObject({ status: 403 });
  expect(await service.execute(student, 'mySubmissions')).toEqual([]);
});
it('rechaza usuarios sin vinculación, conflictos de rol y usuarios deshabilitados localmente', async () => {
  await expect(service.execute({ ...student, id: crypto.randomUUID() }, 'me')).rejects.toMatchObject({ status: 403 });
  await expect(service.execute({ ...student, role: 'teacher' }, 'groups')).rejects.toMatchObject({ status: 403 });
  const user = (await store.get('users', 'old-student'))!;
  await store.put('users', user.id, { ...user, disabled: true });
  await expect(service.execute(student, 'me')).rejects.toMatchObject({ status: 403 });
});
it('calcula la nota y los intentos en servidor, sin confiar en valores del navegador', async () => {
  const input = { activityId: 'old-activity', exerciseId: 'ex', intent: 'evaluate', data: { tree: EMPTY_TREE, answers: EMPTY_ANSWERS, score: 100, attempts: -100, studentUid: 'other-student' } };
  const result = await service.execute(student, 'saveSubmission', input);
  expect(result.studentUid).toBe('old-student');
  expect(result.exercisesData.ex.attempts).toBe(1);
  expect(result.exercisesData.ex.score).toBeLessThan(100);
  await expect(service.execute(student, 'saveSubmission', input)).rejects.toMatchObject({ status: 403 });
  await service.execute(teacher, 'resetSubmission', { activityId: 'old-activity', controlNumber: '001A', exerciseId: 'ex' });
  expect((await service.execute(student, 'saveSubmission', input)).exercisesData.ex.attempts).toBe(1);
});
it('un borrador no consume intentos y una actividad cerrada no admite envíos', async () => {
  const input = { activityId: 'old-activity', exerciseId: 'ex', intent: 'save', data: { tree: EMPTY_TREE, answers: EMPTY_ANSWERS } };
  expect((await service.execute(student, 'saveSubmission', input)).exercisesData.ex.attempts).toBe(0);
  await service.execute(teacher, 'setActivityOpen', { id: 'old-activity', open: false });
  await expect(service.execute(student, 'saveSubmission', input)).rejects.toMatchObject({ status: 403 });
});
it('elimina solo las entregas de la actividad indicada y conserva las demás', async () => {
  await store.put('submissions', 'else', { activityId: 'other-activity', studentUid: 'other-student' });
  await service.execute(teacher, 'deleteActivity', { id: 'old-activity', deleteSubmissions: true });
  expect(await store.get('activities', 'old-activity')).toBeNull();
  expect((await store.list('submissions')).map((item) => item.id)).toEqual(['else']);
});
it('catálogo suspendido bloqueado, membresías únicas y referencias históricas sin autoenlace', async () => {
  const candidate = { id: crypto.randomUUID(), control_number: '003A', full_name: 'Nuevo alumno', active: false };
  await expect(service.importStudent(teacher, candidate, 'old-group')).rejects.toMatchObject({ status: 403 });
  const profile = await service.importStudent(teacher, { ...candidate, active: true }, 'old-group');
  const repeated = await service.importStudent(teacher, { ...candidate, active: true }, 'old-group');
  expect(repeated.uid).toBe(profile.uid);
  expect(repeated.groupIds).toEqual(['old-group']);
  await expect(service.importStudent(teacher, { ...candidate, id: crypto.randomUUID(), control_number: '002A', active: true }, 'old-group')).rejects.toMatchObject({ status: 409 });
});
it('eliminar un grupo con actividades falla sin alterar las membresías', async () => {
  await expect(service.execute(teacher, 'deleteGroup', { id: 'old-group' })).rejects.toMatchObject({ status: 409 });
  expect((await store.get('users', 'old-student'))!.groupIds).toEqual(['old-group']);
});
