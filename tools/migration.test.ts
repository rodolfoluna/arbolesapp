import { expect, it } from 'vitest';
import { migrationPlan, applyLinks, transferReviewedSubmissions } from './migration.ts';
import { memoryStore } from '../server/testing.ts';
const central = [
  { id: '00000000-0000-4000-8000-000000000001', role: 'teacher' as const, control_number: null, full_name: 'Profesor', active: true },
  { id: '00000000-0000-4000-8000-000000000002', role: 'student' as const, control_number: '001AB', full_name: 'Alumno', active: true },
];
const users = [{ id: 'teacher-old', role: 'teacher' }, { id: 'student-old', role: 'student', controlNumber: ' 001ab ', groupIds: ['g'] }];
it('normaliza solo bordes y mayúsculas, conserva ceros y nunca enlaza por nombre', () => {
  const plan = migrationPlan(users, central, 'teacher-old', central[0].id);
  expect(plan.proposals).toEqual([{ localUid: 'teacher-old', centralId: central[0].id }, { localUid: 'student-old', centralId: central[1].id }]);
  const missing = migrationPlan([...users, { id: 'same-name', role: 'student', controlNumber: '001 AB' }], central, 'teacher-old', central[0].id);
  expect(missing.conflicts).toEqual([{ localUid: 'same-name', reason: 'Sin coincidencia central.' }]);
});
it('reporta duplicados y no elige automáticamente entre cuentas reemplazadas', () => {
  const plan = migrationPlan([...users, { ...users[1], id: 'student-reset' }], central, 'teacher-old', central[0].id);
  expect(plan.proposals).toHaveLength(1);
  expect(plan.conflicts).toHaveLength(2);
});
it('aplica vínculos manteniendo IDs, membresías, actividades y entregas y se puede repetir', async () => {
  const store = memoryStore({ users, groups: [{ id: 'g', name: 'Original' }], activities: [{ id: 'a', groupId: 'g' }], submissions: [{ id: 'a_001AB', studentUid: 'student-old', score: 80 }] });
  const before = await store.list('submissions');
  const plan = migrationPlan(users, central, 'teacher-old', central[0].id);
  await applyLinks(store, central, plan.proposals, plan.proposals[0]);
  await applyLinks(store, central, plan.proposals, plan.proposals[0]);
  expect((await store.get('users', 'student-old'))!.groupIds).toEqual(['g']);
  expect(await store.list('submissions')).toEqual(before);
  expect((await store.get('identityLinks', central[1].id))!.localUid).toBe('student-old');
  expect((await store.list('activities'))[0].id).toBe('a');
});
it('impide una identidad central duplicada y discrepancias de rol', async () => {
  const store = memoryStore({ users: [...users, { id: 'other', role: 'student', central_user_id: central[1].id }] });
  await expect(applyLinks(store, central, [{ localUid: 'teacher-old', centralId: central[0].id }, { localUid: 'student-old', centralId: central[1].id }], { localUid: 'teacher-old', centralId: central[0].id })).rejects.toMatchObject({ status: 409 });
  await expect(applyLinks(store, central, [{ localUid: 'student-old', centralId: central[0].id }], { localUid: 'student-old', centralId: central[0].id })).rejects.toMatchObject({ status: 409 });
});

it('las entregas de cuentas reemplazadas solo cambian propietario mediante revisión explícita', async () => {
  const original = { id: 'a_001AB', activityId: 'a', controlNumber: '001AB', studentUid: 'replaced', exercisesData: { ex: { attempts: 1, score: 80 } } };
  const store = memoryStore({ users: [...users, { id: 'replaced', role: 'student', controlNumber: '001AB', disabled: true }], submissions: [original] });
  await applyLinks(store, central, [{ localUid: 'teacher-old', centralId: central[0].id }, { localUid: 'student-old', centralId: central[1].id }], { localUid: 'teacher-old', centralId: central[0].id });
  await transferReviewedSubmissions(store, [{ submissionId: original.id, fromUid: 'replaced', toUid: 'student-old' }]);
  expect(await store.get('submissions', original.id)).toMatchObject({ ...original, studentUid: 'student-old', central_user_id: central[1].id, legacy_student_uid: 'replaced' });
});
