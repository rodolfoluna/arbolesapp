import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  getDocs,
  getDocsFromServer,
  limit,
  runTransaction,
  type Unsubscribe,
} from 'firebase/firestore';
import { getDb, isFirebaseConfigured } from './firebase';
import type { Activity, Credential, ExerciseSubmission, Group, Submission, UserProfile } from './models';
import { submissionId } from './models';
import { fireAndForget, trackWrite } from './syncStore';
import { DEMO_ACTIVITIES, DEMO_GROUPS, DEMO_STUDENTS } from './demoData';

type Cb<T> = (items: T, meta: { fromCache: boolean; hasPendingWrites: boolean }) => void;
type ErrCb = (e: Error) => void;

const logErr = (e: Error) => console.error('[firestore]', e);

/* ----------------- Almacenamiento Local Mock (Demo) ----------------- */

const LS_GROUPS = 'arboles_demo_groups';
const LS_STUDENTS = 'arboles_demo_students';
const LS_ACTIVITIES = 'arboles_demo_activities';
const LS_SUBMISSIONS = 'arboles_demo_submissions';
const LS_CREDENTIALS = 'arboles_demo_credentials';

function loadLs<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveLs<T>(key: string, val: T) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    /* ignore */
  }
}

let localGroups: Group[] = loadLs(LS_GROUPS, DEMO_GROUPS);
let localStudents: UserProfile[] = loadLs(LS_STUDENTS, DEMO_STUDENTS);
let localActivities: Activity[] = loadLs(LS_ACTIVITIES, DEMO_ACTIVITIES);
let localSubmissions: Submission[] = loadLs(LS_SUBMISSIONS, []);
let localCredentials: Credential[] = loadLs(
  LS_CREDENTIALS,
  DEMO_STUDENTS.map((s) => ({
    controlNumber: s.controlNumber,
    fullName: s.fullName,
    tempPassword: 'demo123',
  }))
);

function notifyDbChange() {
  saveLs(LS_GROUPS, localGroups);
  saveLs(LS_STUDENTS, localStudents);
  saveLs(LS_ACTIVITIES, localActivities);
  saveLs(LS_SUBMISSIONS, localSubmissions);
  saveLs(LS_CREDENTIALS, localCredentials);
  // Publicar un solo cambio, después de guardar todas las colecciones. Un aviso
  // intermedio haría que los suscriptores recargaran y borraran cambios pendientes.
  window.dispatchEvent(new Event('arboles_db_change'));
}

/* ----------------------------- Lecturas ---------------------------- */

export function subscribeGroups(cb: Cb<Group[]>, onError: ErrCb = logErr): Unsubscribe {
  if (!isFirebaseConfigured) {
    const handler = () => {
      localGroups = loadLs(LS_GROUPS, DEMO_GROUPS);
      cb([...localGroups], { fromCache: true, hasPendingWrites: false });
    };
    handler();
    window.addEventListener('arboles_db_change', handler);
    return () => window.removeEventListener('arboles_db_change', handler);
  }

  return onSnapshot(
    collection(getDb(), 'groups'),
    { includeMetadataChanges: true },
    (s) => {
      const items = s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) }));
      items.sort((a, b) => a.name.localeCompare(b.name, 'es'));
      cb(items, s.metadata);
    },
    onError,
  );
}

function subscribeStudentRoster(cb: Cb<UserProfile[]>, onError: ErrCb, groupId?: string): Unsubscribe {
  if (!isFirebaseConfigured) {
    const handler = () => {
      localStudents = loadLs(LS_STUDENTS, DEMO_STUDENTS);
      cb(localStudents.filter((s) => s.role === 'student' && !s.disabled &&
        (!groupId || s.groupIds?.includes(groupId))), { fromCache: true, hasPendingWrites: false });
    };
    handler();
    window.addEventListener('arboles_db_change', handler);
    return () => window.removeEventListener('arboles_db_change', handler);
  }

  return onSnapshot(
    // Una sola condición usa el índice automático de arrays; no requiere índice compuesto.
    query(collection(getDb(), 'users'), groupId
      ? where('groupIds', 'array-contains', groupId)
      : where('role', '==', 'student')),
    { includeMetadataChanges: true },
    (s) => {
      const items = s.docs
        .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
        .filter((u) => u.role === 'student' && !u.disabled);
      items.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
      cb(items, s.metadata);
    },
    onError,
  );
}

export function subscribeStudents(cb: Cb<UserProfile[]>, onError: ErrCb = logErr): Unsubscribe {
  return subscribeStudentRoster(cb, onError);
}

/** La matriz descarga y escucha únicamente el alumnado de su grupo. */
export function subscribeStudentsInGroup(groupId: string, cb: Cb<UserProfile[]>, onError: ErrCb = logErr): Unsubscribe {
  if (!groupId) {
    cb([], { fromCache: true, hasPendingWrites: false });
    return () => {};
  }
  return subscribeStudentRoster(cb, onError, groupId);
}

export function subscribeActivities(
  groupIds: string[] | 'ALL',
  cb: Cb<Activity[]>,
  onError: ErrCb = logErr,
): Unsubscribe {
  if (!isFirebaseConfigured) {
    const handler = () => {
      localActivities = loadLs(LS_ACTIVITIES, DEMO_ACTIVITIES);
      const filtered =
        groupIds === 'ALL'
          ? localActivities
          : localActivities.filter((a) => groupIds.includes(a.groupId));
      cb([...filtered], { fromCache: true, hasPendingWrites: false });
    };
    handler();
    window.addEventListener('arboles_db_change', handler);
    return () => window.removeEventListener('arboles_db_change', handler);
  }

  const col = collection(getDb(), 'activities');
  if (groupIds !== 'ALL' && groupIds.length === 0) {
    cb([], { fromCache: false, hasPendingWrites: false });
    return () => {};
  }
  const q = groupIds === 'ALL' ? col : query(col, where('groupId', 'in', groupIds.slice(0, 30)));
  return onSnapshot(
    q,
    { includeMetadataChanges: true },
    (s) => {
      const items = s.docs.map((d) => ({ ...(d.data() as Omit<Activity, 'id'>), id: d.id }));
      items.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
      cb(items, s.metadata);
    },
    onError,
  );
}

export function subscribeActivity(id: string, cb: Cb<Activity | null>, onError: ErrCb = logErr): Unsubscribe {
  if (!isFirebaseConfigured) {
    const act = localActivities.find((a) => a.id === id) || null;
    cb(act, { fromCache: true, hasPendingWrites: false });
    return () => {};
  }

  return onSnapshot(
    doc(getDb(), 'activities', id),
    { includeMetadataChanges: true },
    (d) => cb(d.exists() ? { ...(d.data() as Omit<Activity, 'id'>), id: d.id } : null, d.metadata),
    onError,
  );
}

export function subscribeSubmissionsByActivity(
  activityId: string,
  cb: Cb<Submission[]>,
  onError: ErrCb = logErr,
): Unsubscribe {
  if (!isFirebaseConfigured) {
    const handler = () => {
      localSubmissions = loadLs(LS_SUBMISSIONS, []);
      const filtered = localSubmissions.filter((s) => s.activityId === activityId);
      cb([...filtered], { fromCache: true, hasPendingWrites: false });
    };
    handler();
    window.addEventListener('arboles_db_change', handler);
    return () => window.removeEventListener('arboles_db_change', handler);
  }

  return onSnapshot(
    query(collection(getDb(), 'submissions'), where('activityId', '==', activityId)),
    { includeMetadataChanges: true },
    (s) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<Submission, 'id'>), id: d.id })), s.metadata),
    onError,
  );
}

/** Consulta bajo demanda: la matriz no descarga cada edición de todos los alumnos. */
export async function fetchSubmissionsByActivity(activityId: string): Promise<Submission[]> {
  if (!isFirebaseConfigured) {
    return loadLs<Submission[]>(LS_SUBMISSIONS, []).filter((s) => s.activityId === activityId);
  }
  const snapshot = await getDocs(query(collection(getDb(), 'submissions'), where('activityId', '==', activityId)));
  return snapshot.docs.map((d) => ({ ...(d.data() as Omit<Submission, 'id'>), id: d.id }));
}

/** Limpieza manual: nunca se ejecuta al abrir el panel. */
export async function fetchOrphanSubmissions(): Promise<Submission[]> {
  if (!isFirebaseConfigured) {
    const activityIds = new Set(localActivities.map((activity) => activity.id));
    return loadLs<Submission[]>(LS_SUBMISSIONS, []).filter((submission) => !activityIds.has(submission.activityId));
  }
  const db = getDb();
  const [activities, submissions] = await Promise.all([
    getDocsFromServer(collection(db, 'activities')),
    getDocsFromServer(collection(db, 'submissions')),
  ]);
  const activityIds = new Set(activities.docs.map((activity) => activity.id));
  return submissions.docs.map((item) => ({ ...item.data(), id: item.id } as Submission))
    .filter((submission) => !activityIds.has(submission.activityId));
}

/** Solo elimina documentos revisados; vuelve a comprobar la actividad al confirmar. */
export async function deleteOrphanSubmissions(activityId: string, ids: string[]): Promise<number> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length > 200) throw new Error('Elimina como máximo 200 entregas por operación.');
  const activeMessage = 'La actividad existe. Sus entregas no se pueden eliminar desde esta opción.';
  if (!isFirebaseConfigured) {
    if (localActivities.some((activity) => activity.id === activityId)) throw new Error(activeMessage);
    const before = localSubmissions.length;
    localSubmissions = localSubmissions.filter((submission) =>
      submission.activityId !== activityId || !uniqueIds.includes(submission.id));
    notifyDbChange();
    return before - localSubmissions.length;
  }
  if (!uniqueIds.length) return 0;
  const db = getDb();
  return trackWrite(runTransaction(db, async (transaction) => {
    const activity = await transaction.get(doc(db, 'activities', activityId));
    if (activity.exists()) throw new Error(activeMessage);
    const submissions = await Promise.all(uniqueIds.map((id) => transaction.get(doc(db, 'submissions', id))));
    const targets = submissions.filter((submission) => submission.exists() && submission.data().activityId === activityId);
    targets.forEach((submission) => transaction.delete(submission.ref));
    return targets.length;
  }));
}

export function subscribeMySubmissions(
  controlNumber: string,
  cb: Cb<Submission[]>,
  onError: ErrCb = logErr,
): Unsubscribe {
  if (!isFirebaseConfigured) {
    const handler = () => {
      localSubmissions = loadLs(LS_SUBMISSIONS, []);
      const filtered = localSubmissions.filter((s) => s.controlNumber === controlNumber);
      cb([...filtered], { fromCache: true, hasPendingWrites: false });
    };
    handler();
    window.addEventListener('arboles_db_change', handler);
    return () => window.removeEventListener('arboles_db_change', handler);
  }

  return onSnapshot(
    query(collection(getDb(), 'submissions'), where('controlNumber', '==', controlNumber)),
    { includeMetadataChanges: true },
    (s) => cb(s.docs.map((d) => ({ ...(d.data() as Omit<Submission, 'id'>), id: d.id })), s.metadata),
    onError,
  );
}

export function subscribeSubmission(
  activityId: string,
  controlNumber: string,
  cb: Cb<Submission | null>,
  onError: ErrCb = logErr,
): Unsubscribe {
  if (!isFirebaseConfigured) {
    const handler = () => {
      localSubmissions = loadLs(LS_SUBMISSIONS, []);
      const sub =
        localSubmissions.find(
          (s) => s.activityId === activityId && s.controlNumber === controlNumber
        ) || null;
      cb(sub, { fromCache: true, hasPendingWrites: false });
    };
    handler();
    window.addEventListener('arboles_db_change', handler);
    return () => window.removeEventListener('arboles_db_change', handler);
  }

  return onSnapshot(
    doc(getDb(), 'submissions', submissionId(activityId, controlNumber)),
    { includeMetadataChanges: true },
    (d) => cb(d.exists() ? { ...(d.data() as Omit<Submission, 'id'>), id: d.id } : null, d.metadata),
    onError,
  );
}

export async function fetchCredentials(): Promise<Credential[]> {
  if (!isFirebaseConfigured) {
    return loadLs(LS_CREDENTIALS, localCredentials);
  }
  const s = await getDocs(collection(getDb(), 'credentials'));
  return s.docs.map((d) => d.data() as Credential);
}

/* ----------------------------- Grupos ------------------------------ */

export function createGroup(name: string): Promise<string> {
  if (!isFirebaseConfigured) {
    const id = `gpo-${Date.now()}`;
    localGroups.push({ id, name: name.trim(), createdAt: Date.now() });
    notifyDbChange();
    return Promise.resolve(id);
  }

  const ref = doc(collection(getDb(), 'groups'));
  return trackWrite(setDoc(ref, { name: name.trim(), createdAt: serverTimestamp() })).then(() => ref.id);
}

export function renameGroup(id: string, name: string): Promise<void> {
  if (!isFirebaseConfigured) {
    localGroups = localGroups.map((g) => (g.id === id ? { ...g, name: name.trim() } : g));
    notifyDbChange();
    return Promise.resolve();
  }

  return trackWrite(updateDoc(doc(getDb(), 'groups', id), { name: name.trim() }));
}

export async function deleteGroup(id: string): Promise<void> {
  const hasActivitiesMessage = 'Este grupo tiene actividades asignadas. Muévelas a otro grupo o elimínalas antes de eliminar el grupo.';
  if (!isFirebaseConfigured) {
    if (localActivities.some((activity) => activity.groupId === id)) {
      throw new Error(hasActivitiesMessage);
    }
    localGroups = localGroups.filter((g) => g.id !== id);
    localStudents = localStudents.map((s) => ({
      ...s,
      groupIds: s.groupIds?.filter((gid) => gid !== id) || [],
    }));
    notifyDbChange();
    return Promise.resolve();
  }

  const db = getDb();
  // Require server results: a cached empty list must never authorize deletion.
  const activities = await getDocsFromServer(query(collection(db, 'activities'), where('groupId', '==', id), limit(1)));
  if (!activities.empty) throw new Error(hasActivitiesMessage);
  // Include disabled accounts too, without depending on the currently displayed roster.
  const members = await getDocsFromServer(query(collection(db, 'users'), where('groupIds', 'array-contains', id)));
  if (members.size > 499) {
    throw new Error('El grupo supera los 499 miembros. Reduce sus integrantes antes de eliminarlo para completar la operación de forma atómica.');
  }
  const batch = writeBatch(db);
  members.docs.forEach((member) => batch.update(member.ref, { groupIds: arrayRemove(id) }));
  batch.delete(doc(db, 'groups', id));
  return trackWrite(batch.commit());
}

export function setGroupMembership(uids: string[], groupId: string, member: boolean): Promise<void> {
  if (!isFirebaseConfigured) {
    localStudents = localStudents.map((s) => {
      if (!uids.includes(s.uid)) return s;
      const set = new Set(s.groupIds || []);
      if (member) set.add(groupId);
      else set.delete(groupId);
      return { ...s, groupIds: Array.from(set) };
    });
    notifyDbChange();
    return Promise.resolve();
  }

  const db = getDb();
  const batch = writeBatch(db);
  uids.forEach((uid) =>
    batch.update(doc(db, 'users', uid), { groupIds: member ? arrayUnion(groupId) : arrayRemove(groupId) }),
  );
  return trackWrite(batch.commit());
}

export function updateStudentName(uid: string, controlNumber: string, fullName: string): Promise<void> {
  if (!isFirebaseConfigured) {
    localStudents = localStudents.map((s) => (s.uid === uid ? { ...s, fullName } : s));
    localCredentials = localCredentials.map((c) =>
      c.controlNumber === controlNumber ? { ...c, fullName } : c
    );
    notifyDbChange();
    return Promise.resolve();
  }

  const db = getDb();
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', uid), { fullName });
  batch.set(doc(db, 'credentials', controlNumber), { fullName }, { merge: true });
  return trackWrite(batch.commit());
}

export function removeStudent(student: UserProfile): Promise<void> {
  if (!isFirebaseConfigured) {
    localStudents = localStudents.map((s) => (s.uid === student.uid ? { ...s, disabled: true } : s));
    notifyDbChange();
    return Promise.resolve();
  }

  const db = getDb();
  const batch = writeBatch(db);
  batch.update(doc(db, 'users', student.uid), { disabled: true, groupIds: [] });
  batch.delete(doc(db, 'logins', student.controlNumber));
  batch.delete(doc(db, 'credentials', student.controlNumber));
  return trackWrite(batch.commit());
}

/* --------------------------- Actividades --------------------------- */

export function newActivityId(): string {
  if (!isFirebaseConfigured) {
    return `act-${Date.now()}`;
  }
  return doc(collection(getDb(), 'activities')).id;
}

export function saveActivity(a: Activity): Promise<void> {
  if (!isFirebaseConfigured) {
    const idx = localActivities.findIndex((it) => it.id === a.id);
    if (idx >= 0) localActivities[idx] = a;
    else localActivities.unshift(a);
    notifyDbChange();
    return Promise.resolve();
  }

  const { id, ...data } = a;
  const now = Date.now();
  return trackWrite(
    setDoc(doc(getDb(), 'activities', id), { ...stripUndefined(data), createdAt: a.createdAt ?? now, updatedAt: now }),
  );
}

export function setActivityOpen(id: string, open: boolean): Promise<void> {
  if (!isFirebaseConfigured) {
    localActivities = localActivities.map((a) =>
      a.id === id ? { ...a, settings: { ...a.settings, open } } : a
    );
    notifyDbChange();
    return Promise.resolve();
  }

  return trackWrite(updateDoc(doc(getDb(), 'activities', id), { 'settings.open': open, updatedAt: Date.now() }));
}

export function deleteActivity(id: string, deleteSubmissions = false): Promise<void> {
  if (!isFirebaseConfigured) {
    localActivities = localActivities.filter((a) => a.id !== id);
    if (deleteSubmissions) localSubmissions = localSubmissions.filter((submission) => submission.activityId !== id);
    notifyDbChange();
    return Promise.resolve();
  }

  const db = getDb();
  const activityRef = doc(db, 'activities', id);
  if (!deleteSubmissions) return trackWrite(deleteDoc(activityRef));

  return trackWrite((async () => {
    // Keep the activity visible and closed until cleanup succeeds, so failures can be retried.
    await updateDoc(activityRef, { 'settings.open': false, updatedAt: Date.now() });
    while (true) {
      const submissions = await getDocsFromServer(query(collection(db, 'submissions'), where('activityId', '==', id), limit(400)));
      const batch = writeBatch(db);
      submissions.docs.forEach((submission) => batch.delete(submission.ref));
      const done = submissions.size < 400;
      if (done) batch.delete(activityRef);
      await batch.commit();
      if (done) return;
    }
  })());
}

function stripUndefined<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (val !== undefined) {
      clean[key] = stripUndefined(val);
    }
  }
  return clean as T;
}

export function saveExerciseSubmission(
  student: Pick<UserProfile, 'uid' | 'controlNumber' | 'fullName'>,
  activityId: string,
  exerciseId: string,
  data: ExerciseSubmission,
) {
  if (!isFirebaseConfigured) {
    const subId = submissionId(activityId, student.controlNumber);
    let sub = localSubmissions.find((s) => s.id === subId);
    if (!sub) {
      sub = {
        id: subId,
        activityId,
        controlNumber: student.controlNumber,
        studentUid: student.uid,
        fullName: student.fullName,
        lastUpdated: Date.now(),
        exercisesData: {},
      };
      localSubmissions.push(sub);
    }
    sub.exercisesData[exerciseId] = data;
    sub.lastUpdated = Date.now();
    notifyDbChange();
    return;
  }

  const cleanData = stripUndefined(data);
  const ref = doc(getDb(), 'submissions', submissionId(activityId, student.controlNumber));
  const payload = {
    activityId,
    controlNumber: student.controlNumber,
    studentUid: student.uid,
    fullName: student.fullName,
    lastUpdated: serverTimestamp(),
    exercisesData: { [exerciseId]: cleanData },
  };
  try {
    fireAndForget(
      setDoc(ref, payload, {
        mergeFields: ['activityId', 'controlNumber', 'studentUid', 'fullName', 'lastUpdated', `exercisesData.${exerciseId}`],
      }),
    );
  } catch (err) {
    console.warn('[firestore] Error al guardar entrega:', err);
  }
}

export function resetExerciseSubmission(activityId: string, controlNumber: string, exerciseId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const sub = localSubmissions.find(
      (s) => s.activityId === activityId && s.controlNumber === controlNumber
    );
    if (sub && sub.exercisesData[exerciseId]) {
      sub.exercisesData[exerciseId].submitted = false;
      sub.exercisesData[exerciseId].attempts = 0;
      sub.exercisesData[exerciseId].updatedAt = Date.now();
      notifyDbChange();
    }
    return Promise.resolve();
  }

  const ref = doc(getDb(), 'submissions', submissionId(activityId, controlNumber));
  return trackWrite(
    updateDoc(ref, {
      [`exercisesData.${exerciseId}.submitted`]: false,
      [`exercisesData.${exerciseId}.attempts`]: 0,
      [`exercisesData.${exerciseId}.updatedAt`]: Date.now(),
    })
  );
}
