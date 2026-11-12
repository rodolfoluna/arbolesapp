import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, Timestamp, GeoPoint, DocumentReference } from 'firebase-admin/firestore';
import { z } from 'zod';
import { firestoreStore } from '../server/store.ts';
import { applyLinks, migrationPlan, transferReviewedSubmissions } from './migration.ts';

const [command, ...args] = process.argv.slice(2);
const arg = (name: string) => { const index = args.indexOf(`--${name}`); if (index < 0 || !args[index + 1]) throw new Error(`Falta --${name}.`); return args[index + 1]; };
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId) throw new Error('Define FIREBASE_PROJECT_ID explícitamente; nunca se adivina el proyecto de destino.');
initializeApp({ credential: applicationDefault(), projectId });
const db = getFirestore(), store = firestoreStore(db);
const collections = ['users', 'groups', 'activities', 'submissions', 'identityLinks'];
const encode = (value: any): any => {
  if (value instanceof Timestamp) return { $firestore: 'timestamp', seconds: value.seconds, nanoseconds: value.nanoseconds };
  if (value instanceof GeoPoint) return { $firestore: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  if (value instanceof DocumentReference) return { $firestore: 'reference', path: value.path };
  if (Buffer.isBuffer(value)) return { $firestore: 'bytes', base64: value.toString('base64') };
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encode(item)]));
  return value;
};
const decode = (value: any): any => {
  if (value?.$firestore === 'timestamp') return new Timestamp(value.seconds, value.nanoseconds);
  if (value?.$firestore === 'geopoint') return new GeoPoint(value.latitude, value.longitude);
  if (value?.$firestore === 'reference') return db.doc(value.path);
  if (value?.$firestore === 'bytes') return Buffer.from(value.base64, 'base64');
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, decode(item)]));
  return value;
};
async function json(path: string) { return JSON.parse(await readFile(resolve(path), 'utf8')); }
async function save(path: string, value: unknown) {
  const target = resolve(path); await mkdir(dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
}
const centralSchema = z.array(z.object({ id: z.uuid(), role: z.enum(['teacher', 'student']), control_number: z.string().nullable(), full_name: z.string(), active: z.boolean() }));
const linksSchema = z.array(z.object({ localUid: z.string().min(1).regex(/^[^/]+$/), centralId: z.uuid() }));
if (command === 'backup') {
  const data: Record<string, unknown> = {};
  for (const collection of collections) data[collection] = (await db.collection(collection).get()).docs.map((doc) => ({ id: doc.id, data: encode(doc.data()) }));
  await save(arg('out'), { format: 1, projectId, createdAt: new Date().toISOString(), collections: data });
  console.info('Respaldo académico guardado. No contiene Auth, contraseñas ni las colecciones credentials/logins.');
} else if (command === 'plan' || command === 'apply') {
  const central = centralSchema.parse(await json(arg('central')));
  const teacherLocalUid = arg('teacher-local-uid'), teacherCentralId = z.uuid().parse(arg('teacher-central-id'));
  if (command === 'plan') {
    const plan = migrationPlan(await store.list('users'), central, teacherLocalUid, teacherCentralId);
    const submissions = await store.list('submissions');
    const users = await store.list('users');
    const submissionConflicts = submissions.filter((submission) => {
      const owner = users.find((user) => user.id === submission.studentUid);
      return !owner || !plan.proposals.some((link) => link.localUid === owner.id);
    }).map((submission) => ({ submissionId: submission.id, studentUid: submission.studentUid, controlNumber: submission.controlNumber,
      reason: 'Propietario histórico sin vínculo propuesto; revisar cuentas reemplazadas. No se modificará automáticamente.' }));
    await save(arg('out'), { ...plan, submissionConflicts });
    console.info(`Plan guardado: ${plan.proposals.length} propuestas, ${plan.conflicts.length} conflictos. No se modificó la base.`);
  } else {
    // A valid academic backup is mandatory before applying any identity links.
    const backup = await json(arg('backup'));
    if (backup.format !== 1 || backup.projectId !== projectId || !collections.every((name) => Array.isArray(backup.collections?.[name]))) throw new Error('El respaldo no corresponde al proyecto o está incompleto.');
    const links = linksSchema.parse(await json(arg('links')));
    await applyLinks(store, central, links, { localUid: teacherLocalUid, centralId: teacherCentralId });
    if (args.includes('--transfers')) {
      const transfers = z.array(z.object({ submissionId: z.string().min(1).regex(/^[^/]+$/), fromUid: z.string().min(1).regex(/^[^/]+$/), toUid: z.string().min(1).regex(/^[^/]+$/) })).parse(await json(arg('transfers')));
      await transferReviewedSubmissions(store, transfers);
    }
    console.info(`Vínculos aplicados: ${links.length}. No se borraron ni renumeraron datos académicos.`);
  }
} else if (command === 'rollback-links') {
  const backup = await json(arg('backup'));
  if (backup.format !== 1 || backup.projectId !== projectId) throw new Error('El respaldo no corresponde al proyecto.');
  const reviewedLinks = linksSchema.parse(await json(arg('links')));
  const beforeUsers = new Map<string, any>(backup.collections.users.map((row: any) => [row.id, row.data]));
  const oldLinks = new Map<string, any>(backup.collections.identityLinks.map((row: any) => [row.id, row.data]));
  // Roll back only identity fields: preserve activities, membership and submissions created since backup.
  for (const reviewed of reviewedLinks) {
    const user = await store.get('users', reviewed.localUid);
    const original = user && beforeUsers.get(user.id);
    if (!original) continue;
    const previous = decode(original);
    const { FieldValue } = await import('firebase-admin/firestore');
    await db.collection('users').doc(user.id).update({ central_user_id: previous.central_user_id ?? FieldValue.delete() });
  }
  for (const reviewed of reviewedLinks) {
    const link = await store.get('identityLinks', reviewed.centralId);
    if (!link || link.localUid !== reviewed.localUid) continue;
    if (oldLinks.has(link.id)) await db.collection('identityLinks').doc(link.id).set(decode(oldLinks.get(link.id)));
    else await db.collection('identityLinks').doc(link.id).delete();
  }
  if (args.includes('--transfers')) {
    const transfers = await json(arg('transfers'));
    const originals = new Map<string, any>(backup.collections.submissions.map((row: any) => [row.id, row.data]));
    const { FieldValue } = await import('firebase-admin/firestore');
    for (const transfer of transfers) {
      const before = originals.get(transfer.submissionId);
      if (!before) throw new Error('Falta una entrega histórica en el respaldo.');
      const data = decode(before);
      await db.collection('submissions').doc(transfer.submissionId).update({ studentUid: data.studentUid, central_user_id: data.central_user_id ?? FieldValue.delete(), legacy_student_uid: data.legacy_student_uid ?? FieldValue.delete() });
    }
  }
  console.info('Vínculos revertidos para usuarios existentes en el respaldo. Datos académicos conservados. Revisa usuarios incorporados después y restaura el acceso únicamente según la guía.');
} else {
  throw new Error('Usa backup, plan, apply o rollback-links. Consulta docs/AULA_IDENTIDAD.md.');
}
