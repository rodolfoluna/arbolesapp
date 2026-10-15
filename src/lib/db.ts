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
    window.dispatchEvent(new Event('arboles_db_change'));
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

export function subscribeStudents(cb: Cb<UserProfile[]>, onError: ErrCb = logErr): Unsubscribe {
  if (!isFirebaseConfigured) {
    const handler = () => {
      localStudents = loadLs(LS_STUDENTS, DEMO_STUDENTS);
      cb(localStudents.filter((s) => !s.disabled), { fromCache: true, hasPendingWrites: false });
    };
    handler();
    window.addEventListener('arboles_db_change', handler);
    return () => window.removeEventListener('arboles_db_change', handler);
  }

  return onSnapshot(
    query(collection(getDb(), 'users'), where('role', '==', 'student')),
    { includeMetadataChanges: true },
    (s) => {
      const items = s.docs
        .map((d) => ({ ...(d.data() as UserProfile), uid: d.id }))
        .filter((u) => !u.disabled);
      items.sort((a, b) => a.fullName.localeCompare(b.fullName, 'es'));
      cb(items, s.metadata);
    },
    onError,
  );
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

export async function deleteGroup(id: string, memberUids: string[]): Promise<void> {
  if (!isFirebaseConfigured) {
    localGroups = localGroups.filter((g) => g.id !== id);
    localStudents = localStudents.map((s) => ({
      ...s,
      groupIds: s.groupIds?.filter((gid) => gid !== id) || [],
    }));
    notifyDbChange();
    return Promise.resolve();
  }

  const db = getDb();
  const batch = writeBatch(db);
  memberUids.forEach((uid) => batch.update(doc(db, 'users', uid), { groupIds: arrayRemove(id) }));
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
    setDoc(doc(getDb(), 'activities', id), { ...data, createdAt: a.createdAt ?? now, updatedAt: now }),
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

export function deleteActivity(id: string): Promise<void> {
  if (!isFirebaseConfigured) {
    localActivities = localActivities.filter((a) => a.id !== id);
    notifyDbChange();
    return Promise.resolve();
  }

  return trackWrite(deleteDoc(doc(getDb(), 'activities', id)));
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
      notifyDbChange();
    }
    return Promise.resolve();
  }

  const ref = doc(getDb(), 'submissions', submissionId(activityId, controlNumber));
  return trackWrite(updateDoc(ref, { [`exercisesData.${exerciseId}.submitted`]: false }));
}
