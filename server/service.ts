import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpError, type Identity } from './identity.ts';
import type { DataStore, Row } from './store.ts';
import { evaluateExercise } from '../src/lib/tree/evaluate.ts';
import { evaluateLinear, isLinearExercise } from '../src/lib/linear/linear.ts';
import type { Activity, ExerciseSubmission } from '../src/lib/models.ts';

export const normalizeControl = (value: string) => value.trim().toUpperCase();
const idSchema = z.string().min(1).max(200).regex(/^[^/]+$/).refine((id) => id !== '.' && id !== '..');
const str = z.string().max(4000);
const treeSchema = z.object({ rootId: z.string().nullable(), nodes: z.record(z.string(), z.object({ v: str, l: z.string().nullable(), r: z.string().nullable() })) });
const answersSchema = z.object({ root: str, leaves: str, internals: str, height: str, preorder: str, inorder: str, postorder: str });
const draftSchema = z.object({ tree: treeSchema, answers: answersSchema, linearAnswers: z.object({ finalState: str, extracted: str }).optional() });
const exerciseSchema = z.object({
  id: idSchema, title: z.string().max(300), kind: z.enum(['TREE', 'LINEAR']).optional(),
  treeType: z.enum(['COMPLETE', 'BST', 'AVL']), dataType: z.enum(['NUMBER', 'STRING']), dataset: z.array(z.string().max(100)).max(100),
  linear: z.object({ structure: z.enum(['LIST', 'STACK', 'QUEUE']), ops: z.array(z.string().max(200)).max(200) }).optional(),
}).refine((ex) => ex.kind !== 'LINEAR' || !!ex.linear);
const activitySchema = z.object({
  id: idSchema, groupId: idSchema, title: z.string().trim().min(1).max(300), description: z.string().max(10000),
  exercises: z.array(exerciseSchema).min(1).max(50).refine((items) => new Set(items.map((ex) => ex.id)).size === items.length),
  settings: z.object({ open: z.boolean(), showFeedback: z.boolean(), heightMode: z.enum(['LEVELS', 'EDGES']), rootIsInternal: z.boolean(), maxAttempts: z.number().int().min(0).max(1000).optional() }),
});

function requireTeacher(identity: Identity) {
  if (identity.role !== 'teacher') throw new HttpError(403, 'Esta operación es exclusiva del profesor.');
}
function profileDto(row: Row) {
  return { uid: row.id, role: row.role, controlNumber: row.controlNumber || '', fullName: row.fullName || '', email: '',
    groupIds: row.groupIds || [], central_user_id: row.central_user_id, disabled: !!row.disabled, mustChangePassword: false };
}
function validTree(tree: z.infer<typeof treeSchema>) {
  if (Object.keys(tree.nodes).length > 300) throw new HttpError(400, 'El árbol supera el límite de nodos.');
  const visited = new Set<string>();
  const walk = (id: string | null, depth: number) => {
    if (id === null) return;
    if (depth > 100 || visited.has(id) || !Object.hasOwn(tree.nodes, id)) throw new HttpError(400, 'La estructura del árbol no es válida.');
    visited.add(id);
    const node = tree.nodes[id]; walk(node.l, depth + 1); walk(node.r, depth + 1);
  };
  walk(tree.rootId, 0);
  if (visited.size !== Object.keys(tree.nodes).length) throw new HttpError(400, 'El árbol contiene nodos sin conectar.');
}

export function educationalService(store: DataStore) {
  async function local(identity: Identity, db = store) {
    const link = await db.get('identityLinks', identity.id);
    const user = link ? await db.get('users', link.localUid) : null;
    if (!user || user.central_user_id !== identity.id || user.role !== identity.role || user.disabled) {
      throw new HttpError(403, 'Tu identidad no está vinculada a un usuario local habilitado. Contacta al profesor.');
    }
    if (identity.role === 'student' && normalizeControl(user.controlNumber || '') !== normalizeControl(identity.control_number || '')) {
      throw new HttpError(409, 'El número de control cambió. El profesor debe revisar la vinculación local.');
    }
    return user;
  }
  const getActivity = async (db: DataStore, id: string, user: Row, identity: Identity) => {
    const activity = await db.get('activities', id);
    if (!activity) throw new HttpError(404, 'La actividad ya no existe.');
    if (identity.role !== 'teacher' && !(user.groupIds || []).includes(activity.groupId)) throw new HttpError(403, 'La actividad no pertenece a tus grupos.');
    return activity;
  };
  async function execute(identity: Identity, operation: string, input: any = {}): Promise<any> {
    const user = await local(identity);
    const id = () => idSchema.parse(input.id);
    switch (operation) {
      case 'me': return { ...profileDto(user), fullName: identity.full_name };
      case 'groups': {
        if (identity.role === 'teacher') return store.list('groups');
        return (await Promise.all((user.groupIds || []).map((gid: string) => store.get('groups', gid)))).filter(Boolean);
      }
      case 'activities': {
        if (identity.role === 'teacher') return store.list('activities');
        const lists = await Promise.all((user.groupIds || []).map((gid: string) => store.list('activities', [['groupId', '==', gid]])));
        return [...new Map(lists.flat().map((act: Row) => [act.id, act])).values()];
      }
      case 'activity': return getActivity(store, id(), user, identity);
      case 'students': {
        requireTeacher(identity);
        const rows = await store.list('users', input.groupId ? [['groupIds', 'array-contains', idSchema.parse(input.groupId)]] : [['role', '==', 'student']]);
        return rows.filter((item) => item.role === 'student' && !item.disabled).map(profileDto);
      }
      case 'mySubmissions': {
        const rows = await store.list('submissions', [['studentUid', '==', user.id]]);
        if (identity.role === 'teacher') return rows;
        const activities = await execute(identity, 'activities');
        const allowed = new Set(activities.map((item: Row) => item.id));
        return rows.filter((item) => allowed.has(item.activityId));
      }
      case 'submissions': {
        requireTeacher(identity);
        return store.list('submissions', [['activityId', '==', idSchema.parse(input.activityId)]]);
      }
      case 'submission': {
        const activity = await getActivity(store, idSchema.parse(input.activityId), user, identity);
        if (identity.role !== 'teacher' && input.controlNumber !== user.controlNumber) throw new HttpError(403, 'Solo puedes consultar tus entregas.');
        const rows = await store.list('submissions', identity.role === 'teacher'
          ? [['activityId', '==', activity.id]] : [['studentUid', '==', user.id]]);
        return rows.find((row) => row.activityId === activity.id && row.controlNumber === input.controlNumber && (identity.role === 'teacher' || row.studentUid === user.id)) || null;
      }
      case 'createGroup': {
        requireTeacher(identity);
        const groupId = randomUUID();
        await store.put('groups', groupId, { name: z.string().trim().min(1).max(200).parse(input.name), createdAt: Date.now(), teacher_central_id: identity.id, teacherUid: user.id });
        return groupId;
      }
      case 'renameGroup': {
        requireTeacher(identity);
        return store.atomic(async (db) => {
          const group = await db.get('groups', id());
          if (!group) throw new HttpError(404, 'Grupo no encontrado.');
          await db.put('groups', group.id, { ...group, name: z.string().trim().min(1).max(200).parse(input.name) });
        });
      }
      case 'deleteGroup': {
        requireTeacher(identity);
        return store.atomic(async (db) => {
          if ((await db.list('activities', [['groupId', '==', id()]])).length) throw new HttpError(409, 'Mueve o elimina las actividades del grupo antes de eliminarlo.');
          const members = await db.list('users', [['groupIds', 'array-contains', id()]]);
          if (members.length > 400) throw new HttpError(400, 'Retira integrantes antes de eliminar un grupo de más de 400 miembros.');
          for (const member of members) await db.put('users', member.id, { ...member, groupIds: member.groupIds.filter((gid: string) => gid !== id()) });
          await db.remove('groups', id());
        });
      }
      case 'membership': {
        requireTeacher(identity);
        const groupId = idSchema.parse(input.groupId), uid = idSchema.parse(input.uid), member = z.boolean().parse(input.member);
        return store.atomic(async (db) => {
          const group = await db.get('groups', groupId), student = await db.get('users', uid);
          if (!group || !student || student.role !== 'student') throw new HttpError(404, 'Grupo o alumno no encontrado.');
          if (member) throw new HttpError(400, 'Para añadir alumnos utiliza el catálogo central.');
          await db.put('users', uid, { ...student, groupIds: (student.groupIds || []).filter((gid: string) => gid !== groupId) });
        });
      }
      case 'saveActivity': {
        requireTeacher(identity);
        const activity = activitySchema.parse(input.activity);
        await store.atomic(async (db) => {
          const group = await db.get('groups', activity.groupId), previous = await db.get('activities', activity.id);
          if (!group) throw new HttpError(400, 'Selecciona un grupo local existente.');
          await db.put('activities', activity.id, { ...previous, ...activity, createdAt: previous?.createdAt || Date.now(), updatedAt: Date.now(), teacher_central_id: identity.id, teacherUid: user.id });
        });
        return;
      }
      case 'setActivityOpen': {
        requireTeacher(identity);
        return store.atomic(async (db) => {
          const activity = await getActivity(db, id(), user, identity);
          await db.put('activities', activity.id, { ...activity, settings: { ...activity.settings, open: z.boolean().parse(input.open) }, updatedAt: Date.now() });
        });
      }
      case 'deleteActivity': {
        requireTeacher(identity);
        const activityId = id(), remove = z.boolean().parse(input.deleteSubmissions);
        if (!remove) return store.remove('activities', activityId);
        await execute(identity, 'setActivityOpen', { id: activityId, open: false });
        const rows = await store.list('submissions', [['activityId', '==', activityId]]);
        for (let offset = 0; offset < rows.length; offset += 200) {
          await store.atomic(async (db) => { for (const row of rows.slice(offset, offset + 200)) await db.remove('submissions', row.id); });
        }
        await store.remove('activities', activityId);
        return;
      }
      case 'orphanSubmissions': {
        requireTeacher(identity);
        const [activities, submissions] = await Promise.all([store.list('activities'), store.list('submissions')]);
        const ids = new Set(activities.map((activity) => activity.id));
        return submissions.filter((submission) => !ids.has(submission.activityId));
      }
      case 'deleteOrphans': {
        requireTeacher(identity);
        const activityId = idSchema.parse(input.activityId), ids = z.array(idSchema).max(200).parse(input.ids);
        return store.atomic(async (db) => {
          if (await db.get('activities', activityId)) throw new HttpError(409, 'La actividad existe; no se pueden borrar sus entregas desde esta opción.');
          const rows = await Promise.all([...new Set(ids)].map((sid) => db.get('submissions', sid)));
          const targets = rows.filter((row) => row?.activityId === activityId) as Row[];
          for (const row of targets) await db.remove('submissions', row.id);
          return targets.length;
        });
      }
      case 'saveSubmission': {
        if (identity.role !== 'student') throw new HttpError(403, 'Solo los alumnos pueden entregar ejercicios.');
        const activityId = idSchema.parse(input.activityId), exerciseId = idSchema.parse(input.exerciseId);
        const draft = draftSchema.parse(input.data), intent = z.enum(['save', 'evaluate']).parse(input.intent);
        validTree(draft.tree);
        return store.atomic(async (db) => {
          const freshUser = await local(identity, db);
          const activity = await getActivity(db, activityId, freshUser, identity);
          const exercise = (activity as unknown as Activity).exercises.find((item) => item.id === exerciseId);
          if (!exercise || !activity.settings.open) throw new HttpError(403, 'La actividad está cerrada o el ejercicio ya no existe.');
          const sid = `${activityId}_${freshUser.controlNumber}`;
          const previous = await db.get('submissions', sid);
          if (previous && previous.studentUid !== freshUser.id) throw new HttpError(409, 'Revisa la vinculación histórica de esta entrega antes de modificarla.');
          const prev = previous?.exercisesData?.[exerciseId];
          const attempts = prev?.attempts || 0, max = activity.settings.maxAttempts || 0;
          if (max > 0 && attempts >= max) throw new HttpError(403, 'Ya agotaste los intentos de este ejercicio.');
          const evaluation = intent === 'evaluate' ? (isLinearExercise(exercise)
            ? evaluateLinear(exercise, draft.linearAnswers) : evaluateExercise(exercise, activity.settings, draft.tree, draft.answers)) : null;
          const result: ExerciseSubmission = { ...draft, updatedAt: Date.now(), attempts: attempts + (evaluation ? 1 : 0), submitted: !!evaluation || !!prev?.submitted,
            ...(evaluation ? { submittedAt: Date.now(), score: evaluation.total, structureExact: evaluation.structureExact }
              : prev?.score !== undefined ? { score: prev.score, structureExact: prev.structureExact, submittedAt: prev.submittedAt } : {}) };
          const submission = { ...previous, activityId, controlNumber: freshUser.controlNumber, studentUid: freshUser.id, central_user_id: identity.id,
            fullName: identity.full_name, lastUpdated: Date.now(), exercisesData: { ...previous?.exercisesData, [exerciseId]: result } };
          await db.put('submissions', sid, submission);
          return { ...submission, id: sid };
        });
      }
      case 'resetSubmission': {
        requireTeacher(identity);
        const activityId = idSchema.parse(input.activityId), control = z.string().min(1).max(100).parse(input.controlNumber), exerciseId = idSchema.parse(input.exerciseId);
        return store.atomic(async (db) => {
          const sid = `${activityId}_${control}`, submission = await db.get('submissions', sid);
          if (!submission?.exercisesData?.[exerciseId]) return;
          const exercisesData = { ...submission.exercisesData, [exerciseId]: { ...submission.exercisesData[exerciseId], attempts: 0, submitted: false, updatedAt: Date.now() } };
          await db.put('submissions', sid, { ...submission, exercisesData });
        });
      }
      default: throw new HttpError(400, 'Operación no válida.');
    }
  }
  async function importStudent(identity: Identity, student: { id: string; control_number: string; full_name: string; active: boolean }, groupId: string) {
    requireTeacher(identity); await local(identity);
    if (!student.active) throw new HttpError(403, 'No puedes incorporar una cuenta suspendida.');
    idSchema.parse(groupId);
    return store.atomic(async (db) => {
      const group = await db.get('groups', groupId), link = await db.get('identityLinks', student.id);
      if (!group) throw new HttpError(404, 'Grupo no encontrado.');
      let uid = link?.localUid;
      let existing = uid ? await db.get('users', uid) : null;
      if (!link) {
        // No automatic linking of existing academic accounts: migration requires review.
        const candidates = (await db.list('users')).filter((row) => normalizeControl(row.controlNumber || '') === normalizeControl(student.control_number));
        if (candidates.length) throw new HttpError(409, 'Este número de control ya tiene historial local. Revisa su vinculación con la herramienta de migración.');
        uid = randomUUID();
      } else if (!existing || existing.central_user_id !== student.id || existing.role !== 'student' || existing.disabled) {
        throw new HttpError(409, 'La vinculación local requiere revisión.');
      }
      const groups = [...new Set([...(existing?.groupIds || []), groupId])];
      const profile = { ...existing, uid, role: 'student', controlNumber: existing?.controlNumber || normalizeControl(student.control_number), fullName: student.full_name,
        groupIds: groups, central_user_id: student.id, mustChangePassword: false, disabled: false };
      await db.put('identityLinks', student.id, { localUid: uid });
      await db.put('users', uid, profile);
      return profileDto({ ...profile, id: uid });
    });
  }
  return { execute, importStudent };
}
