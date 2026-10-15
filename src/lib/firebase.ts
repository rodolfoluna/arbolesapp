import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

const env = import.meta.env;

export const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

/** Correo del profesor (único). Debe coincidir con el definido en firestore.rules. */
export const TEACHER_EMAIL = String(env.VITE_TEACHER_EMAIL || '').trim().toLowerCase();

/** Dominio de los correos sintéticos de los alumnos: 22010456@arboles.app */
export const EMAIL_DOMAIN = String(env.VITE_EMAIL_DOMAIN || 'arboles.app').trim().toLowerCase();

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;
let _db: Firestore | null = null;

if (isFirebaseConfigured) {
  _app = initializeApp(firebaseConfig);
  _auth = getAuth(_app); // persistencia en IndexedDB: la sesión sobrevive sin conexión
  // Caché persistente en IndexedDB compartida entre pestañas: lecturas y escrituras offline.
  _db = initializeFirestore(_app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
}

export function getFirebaseAuth(): Auth {
  if (!_auth) throw new Error('Firebase no está configurado (revisa .env.local).');
  return _auth;
}

export function getDb(): Firestore {
  if (!_db) throw new Error('Firebase no está configurado (revisa .env.local).');
  return _db;
}

/** Normaliza un número de control para usarlo como ID y en el correo sintético. */
export function normalizeControlNumber(cn: string): string {
  return cn.trim().replace(/\s+/g, '').toUpperCase();
}

export function syntheticEmail(controlNumber: string, version = 0): string {
  const local = normalizeControlNumber(controlNumber)
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '_');
  return version > 0 ? `${local}.r${version}@${EMAIL_DOMAIN}` : `${local}@${EMAIL_DOMAIN}`;
}
