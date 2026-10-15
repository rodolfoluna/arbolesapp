import { deleteApp, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  inMemoryPersistence,
  initializeAuth,
  signOut,
  type Auth,
} from 'firebase/auth';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import Papa from 'papaparse';
import { firebaseConfig, getDb, isFirebaseConfigured, normalizeControlNumber, syntheticEmail } from './firebase';
import type { UserProfile } from './models';

/* ------------------------- Contraseñas ----------------------------- */

// Sin caracteres ambiguos (0/O, 1/l/I) para que sea fácil dictarlas o copiarlas.
const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generatePassword(length = 6): string {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/* ------------------------------ CSV -------------------------------- */

export interface StudentRow {
  controlNumber: string;
  fullName: string;
}

const CN_HEADERS = ['numerocontrol', 'numero_control', 'numerodecontrol', 'nocontrol', 'control', 'matricula', 'nc', 'numero'];
const NAME_HEADERS = ['nombre', 'nombrecompleto', 'nombre_completo', 'alumno', 'name', 'fullname'];
const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z_]/g, '');

/** Lee un CSV (con o sin encabezados) con columnas NumeroControl, Nombre. */
export function parseStudentsCsv(text: string): { rows: StudentRow[]; errors: string[] } {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ''), { skipEmptyLines: 'greedy' });
  const data = parsed.data.filter((r) => r.some((c) => c && c.trim()));
  const errors: string[] = parsed.errors.map((e) => `Fila ${(e.row ?? 0) + 1}: ${e.message}`);
  if (data.length === 0) return { rows: [], errors: ['El archivo está vacío.'] };

  let cnIdx = 0;
  let nameIdx = 1;
  let start = 0;
  const header = data[0].map((h) => norm(h ?? ''));
  const hCn = header.findIndex((h) => CN_HEADERS.includes(h));
  const hName = header.findIndex((h) => NAME_HEADERS.includes(h));
  if (hCn >= 0 || hName >= 0) {
    start = 1;
    if (hCn >= 0) cnIdx = hCn;
    if (hName >= 0) nameIdx = hName;
    if (hCn < 0) cnIdx = nameIdx === 0 ? 1 : 0;
    if (hName < 0) nameIdx = cnIdx === 0 ? 1 : 0;
  }

  const rows: StudentRow[] = [];
  const seen = new Set<string>();
  for (let i = start; i < data.length; i++) {
    const r = data[i];
    const cn = normalizeControlNumber(r[cnIdx] ?? '');
    const name = (r[nameIdx] ?? '').trim().replace(/\s+/g, ' ');
    if (!cn || !name) {
      errors.push(`Fila ${i + 1}: falta número de control o nombre.`);
      continue;
    }
    if (seen.has(cn)) {
      errors.push(`Fila ${i + 1}: número de control ${cn} repetido en el archivo.`);
      continue;
    }
    seen.add(cn);
    rows.push({ controlNumber: cn, fullName: name });
  }
  return { rows, errors };
}

/** Descarga un CSV (con BOM para que Excel respete acentos). */
export function downloadCsv(filename: string, header: string[], rows: (string | number)[][]) {
  const csv = Papa.unparse({ fields: header, data: rows.map((r) => r.map(String)) });
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ----------------- Alta de cuentas (instancia secundaria) ----------------- */

/**
 * Crear usuarios con createUserWithEmailAndPassword en la instancia principal cerraría la
 * sesión del profesor. Por eso se usa una instancia SECUNDARIA en memoria solo para Auth.
 */
async function withSecondaryAuth<T>(fn: (auth: Auth) => Promise<T>): Promise<T> {
  const app = initializeApp(firebaseConfig, `secondary-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
  const auth = initializeAuth(app, { persistence: inMemoryPersistence });
  try {
    return await fn(auth);
  } finally {
    await signOut(auth).catch(() => {});
    await deleteApp(app).catch(() => {});
  }
}

export type CreateStatus = 'created' | 'exists' | 'error';

export interface CreateResult extends StudentRow {
  status: CreateStatus;
  tempPassword?: string;
  message?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createAuthAccount(auth: Auth, cn: string, password: string, startVersion = 0) {
  // Si el correo ya existe (p. ej. alumno dado de baja antes), se usa un alias .r1, .r2...
  for (let v = startVersion; v < startVersion + 6; v++) {
    const email = syntheticEmail(cn, v);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await signOut(auth);
      return { uid: cred.user.uid, email, version: v };
    } catch (e: unknown) {
      const code = (e as { code?: string }).code;
      if (code === 'auth/email-already-in-use') continue;
      throw e;
    }
  }
  throw new Error('No se pudo generar un correo disponible para este alumno.');
}

/** Da de alta alumnos en lote. Los que ya existen (por número de control) se omiten. */
export async function createStudents(
  rows: StudentRow[],
  existing: UserProfile[],
  groupIds: string[],
  onProgress?: (done: number, total: number, last: CreateResult) => void,
): Promise<CreateResult[]> {
  const existingCn = new Set(existing.map((s) => s.controlNumber));
  const results: CreateResult[] = [];

  if (!isFirebaseConfigured) {
    // Modo local / demo: genera contraseñas y guarda en almacenamiento local
    const lsStudents: UserProfile[] = JSON.parse(localStorage.getItem('arboles_demo_students') || '[]');
    const lsCreds: any[] = JSON.parse(localStorage.getItem('arboles_demo_credentials') || '[]');

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (existingCn.has(row.controlNumber)) {
        results.push({ ...row, status: 'exists', message: 'Ya estaba registrado' });
      } else {
        const tempPassword = generatePassword(6);
        const newStudent: UserProfile = {
          uid: `demo-${row.controlNumber}`,
          role: 'student',
          controlNumber: row.controlNumber,
          fullName: row.fullName,
          email: `${row.controlNumber}@arboles.app`,
          groupIds,
          mustChangePassword: true,
          disabled: false,
        };
        lsStudents.push(newStudent);
        lsCreds.push({
          controlNumber: row.controlNumber,
          fullName: row.fullName,
          tempPassword,
        });
        existingCn.add(row.controlNumber);
        const res: CreateResult = { ...row, status: 'created', tempPassword };
        results.push(res);
        onProgress?.(i + 1, rows.length, res);
      }
    }
    localStorage.setItem('arboles_demo_students', JSON.stringify(lsStudents));
    localStorage.setItem('arboles_demo_credentials', JSON.stringify(lsCreds));
    window.dispatchEvent(new Event('arboles_db_change'));
    return results;
  }

  const db = getDb();
  await withSecondaryAuth(async (auth) => {
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      let result: CreateResult;
      if (existingCn.has(row.controlNumber)) {
        result = { ...row, status: 'exists', message: 'Ya estaba registrado' };
      } else {
        const tempPassword = generatePassword(6);
        try {
          let account;
          try {
            account = await createAuthAccount(auth, row.controlNumber, tempPassword);
          } catch (e: unknown) {
            if ((e as { code?: string }).code === 'auth/too-many-requests') {
              await sleep(4000); // un reintento tras el límite de velocidad
              account = await createAuthAccount(auth, row.controlNumber, tempPassword);
            } else throw e;
          }
          const batch = writeBatch(db);
          const profile: UserProfile = {
            uid: account.uid,
            role: 'student',
            controlNumber: row.controlNumber,
            fullName: row.fullName,
            email: account.email,
            groupIds,
            mustChangePassword: true,
            disabled: false,
            authVersion: account.version,
          };
          batch.set(doc(db, 'users', account.uid), { ...profile, createdAt: serverTimestamp() });
          batch.set(doc(db, 'logins', row.controlNumber), { email: account.email });
          batch.set(doc(db, 'credentials', row.controlNumber), {
            controlNumber: row.controlNumber,
            fullName: row.fullName,
            tempPassword,
            createdAt: serverTimestamp(),
          });
          await batch.commit();
          existingCn.add(row.controlNumber);
          result = { ...row, status: 'created', tempPassword };
        } catch (e: unknown) {
          const code = (e as { code?: string }).code;
          result = {
            ...row,
            status: 'error',
            message:
              code === 'auth/too-many-requests'
                ? 'Límite de Firebase alcanzado; vuelve a subir el CSV más tarde (se omitirán los ya creados).'
                : code === 'auth/network-request-failed'
                  ? 'Sin conexión: el alta de alumnos requiere internet.'
                  : e instanceof Error
                    ? e.message
                    : String(e),
          };
        }
      }
      results.push(result);
      onProgress?.(i + 1, rows.length, result);
    }
  });
  return results;
}

/**
 * Restablece la contraseña de un alumno. Sin Admin SDK no se puede cambiar la contraseña
 * de otra cuenta, así que se crea una cuenta NUEVA (alias .rN), se copia el perfil, se
 * desactiva la anterior y se actualiza el alias de inicio de sesión. Como las entregas se
 * guardan por número de control, el alumno conserva todo su avance.
 */
export async function resetStudentPassword(student: UserProfile): Promise<string> {
  const tempPassword = generatePassword(6);

  if (!isFirebaseConfigured) {
    const lsStudents: UserProfile[] = JSON.parse(localStorage.getItem('arboles_demo_students') || '[]');
    const lsCreds: any[] = JSON.parse(localStorage.getItem('arboles_demo_credentials') || '[]');
    
    const idx = lsStudents.findIndex((s) => s.uid === student.uid);
    if (idx >= 0) {
      lsStudents[idx].mustChangePassword = true;
      localStorage.setItem('arboles_demo_students', JSON.stringify(lsStudents));
    }
    const cIdx = lsCreds.findIndex((c) => c.controlNumber === student.controlNumber);
    if (cIdx >= 0) {
      lsCreds[cIdx].tempPassword = tempPassword;
    } else {
      lsCreds.push({
        controlNumber: student.controlNumber,
        fullName: student.fullName,
        tempPassword,
      });
    }
    localStorage.setItem('arboles_demo_credentials', JSON.stringify(lsCreds));
    window.dispatchEvent(new Event('arboles_db_change'));
    return tempPassword;
  }

  const db = getDb();
  const account = await withSecondaryAuth((auth) =>
    createAuthAccount(auth, student.controlNumber, tempPassword, (student.authVersion ?? 0) + 1),
  );
  const batch = writeBatch(db);
  const profile: UserProfile = {
    uid: account.uid,
    role: 'student',
    controlNumber: student.controlNumber,
    fullName: student.fullName,
    email: account.email,
    groupIds: student.groupIds ?? [],
    mustChangePassword: true,
    disabled: false,
    authVersion: account.version,
  };
  batch.set(doc(db, 'users', account.uid), { ...profile, createdAt: serverTimestamp() });
  batch.update(doc(db, 'users', student.uid), { disabled: true, replacedBy: account.uid, groupIds: [] });
  batch.set(doc(db, 'logins', student.controlNumber), { email: account.email });
  batch.set(doc(db, 'credentials', student.controlNumber), {
    controlNumber: student.controlNumber,
    fullName: student.fullName,
    tempPassword,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return tempPassword;
}
