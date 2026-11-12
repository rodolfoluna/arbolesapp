import { HttpError } from '../server/identity.ts';
import { normalizeControl } from '../server/service.ts';
import type { DataStore, Row } from '../server/store.ts';

export interface CentralProfile { id: string; role: 'teacher' | 'student'; control_number: string | null; full_name: string; active: boolean }
export interface Link { localUid: string; centralId: string }

export function migrationPlan(users: Row[], central: CentralProfile[], teacherLocalUid: string, teacherCentralId: string) {
  const proposals: Link[] = [], conflicts: { localUid: string; reason: string }[] = [];
  const teacher = users.find((user) => user.id === teacherLocalUid);
  const centralTeacher = central.find((user) => user.id === teacherCentralId);
  if (teacher?.role !== 'teacher' || centralTeacher?.role !== 'teacher') throw new Error('Revisa ambos registros de profesor antes de planear la migración.');
  if (new Set(central.map((profile) => profile.id)).size !== central.length) throw new Error('El catálogo contiene UUID centrales duplicados.');
  proposals.push({ localUid: teacherLocalUid, centralId: teacherCentralId });
  for (const user of users.filter((item) => item.role === 'student')) {
    const control = normalizeControl(String(user.controlNumber || ''));
    const matches = central.filter((item) => item.role === 'student' && normalizeControl(item.control_number || '') === control);
    const localMatches = users.filter((item) => item.role === 'student' && normalizeControl(item.controlNumber || '') === control);
    if (!control || localMatches.length !== 1 || matches.length !== 1) {
      conflicts.push({ localUid: user.id, reason: !control ? 'Número de control ausente.' : localMatches.length > 1 ? 'Número de control duplicado localmente; revisar cuentas reemplazadas.' : matches.length === 0 ? 'Sin coincidencia central.' : 'Número de control duplicado en el catálogo central.' });
    } else if (user.central_user_id && user.central_user_id !== matches[0].id) {
      conflicts.push({ localUid: user.id, reason: 'Ya existe una vinculación central diferente.' });
    } else {
      proposals.push({ localUid: user.id, centralId: matches[0].id });
    }
  }
  return { teacherLocalUid, teacherCentralId, proposals, conflicts, note: 'Propuestas sin aplicar. Revisa los UUID, conflictos y propiedad antes de crear el archivo links revisado.' };
}

export async function applyLinks(store: DataStore, central: CentralProfile[], links: Link[], teacher: Link) {
  if (new Set(links.map((link) => link.centralId)).size !== links.length || new Set(links.map((link) => link.localUid)).size !== links.length) throw new Error('Los vínculos revisados contienen duplicados.');
  if (!links.some((link) => link.localUid === teacher.localUid && link.centralId === teacher.centralId)) throw new Error('Incluye el vínculo explícito del profesor existente.');
  const reviewedTeacher = central.find((item) => item.id === teacher.centralId);
  if (reviewedTeacher?.role !== 'teacher') throw new Error('El UUID central del profesor no corresponde a un profesor.');
  // Preflight every link before any mutation; each actual write also checks uniqueness transactionally.
  const current = await store.list('users');
  const indexes = await store.list('identityLinks');
  const validate = (link: Link, user: Row | null) => {
    const identity = central.find((item) => item.id === link.centralId);
    if (!user || !identity || identity.role !== user.role || (user.role === 'teacher' && (link.localUid !== teacher.localUid || link.centralId !== teacher.centralId))) throw new HttpError(409, 'Conflicto de identidad o rol en un vínculo revisado.');
    if (user.role === 'student' && normalizeControl(user.controlNumber || '') !== normalizeControl(identity.control_number || '')) throw new HttpError(409, 'Los números de control no coinciden; no se enlazan por nombre.');
    if (user.central_user_id && user.central_user_id !== link.centralId) throw new HttpError(409, 'El usuario ya tiene otra identidad central.');
  };
  links.forEach((link) => validate(link, current.find((user) => user.id === link.localUid) || null));
  for (const link of links) {
    if (current.some((user) => user.central_user_id === link.centralId && user.id !== link.localUid) || indexes.some((index) => index.id === link.centralId && index.localUid !== link.localUid)) {
      throw new HttpError(409, 'La identidad central ya está vinculada a otro usuario local.');
    }
  }
  for (const link of links) {
    await store.atomic(async (db) => {
      const user = await db.get('users', link.localUid), existing = await db.get('identityLinks', link.centralId);
      const duplicates = await db.list('users', [['central_user_id', '==', link.centralId]]);
      validate(link, user);
      if ((existing && existing.localUid !== link.localUid) || duplicates.some((item) => item.id !== link.localUid)) throw new HttpError(409, 'La identidad central ya está vinculada a otro usuario local.');
      await db.put('users', link.localUid, { ...user!, central_user_id: link.centralId });
      await db.put('identityLinks', link.centralId, { localUid: link.localUid });
    });
  }
}

export interface SubmissionTransfer { submissionId: string; fromUid: string; toUid: string }
export async function transferReviewedSubmissions(store: DataStore, transfers: SubmissionTransfer[]) {
  for (const transfer of transfers) await store.atomic(async (db) => {
    const submission = await db.get('submissions', transfer.submissionId);
    const source = await db.get('users', transfer.fromUid), target = await db.get('users', transfer.toUid);
    if (!submission || !source || !target || target.role !== 'student' || !target.central_user_id || source.role !== 'student' ||
      normalizeControl(source.controlNumber || '') !== normalizeControl(target.controlNumber || '') || normalizeControl(submission.controlNumber || '') !== normalizeControl(target.controlNumber || '') ||
      ![transfer.fromUid, transfer.toUid].includes(submission.studentUid)) throw new HttpError(409, 'La transferencia histórica requiere revisión de sus propietarios y número de control.');
    await db.put('submissions', submission.id, { ...submission, studentUid: target.id, central_user_id: target.central_user_id, legacy_student_uid: submission.legacy_student_uid || transfer.fromUid });
  });
}
