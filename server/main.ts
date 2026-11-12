import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { createApp } from './app.ts';
import { firestoreStore } from './store.ts';

export function parseClients(value: string | undefined): Record<string, string> {
  const clients = JSON.parse(value || '{}');
  if (!Object.keys(clients).length) throw new Error('Configura AULA_CLIENTS_JSON con los orígenes y Client IDs reales.');
  for (const [origin, client] of Object.entries(clients)) {
    const url = new URL(origin);
    if (url.origin !== origin || (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))) || typeof client !== 'string' || !client.trim() || client.includes('REEMPLAZAR')) {
      throw new Error('Registro de origen o Client ID no válido.');
    }
  }
  if (new Set(Object.values(clients)).size !== Object.keys(clients).length) throw new Error('Usa un Client ID distinto para cada origen.');
  return clients;
}
const clients = parseClients(process.env.AULA_CLIENTS_JSON);
if (!process.env.FIREBASE_PROJECT_ID) throw new Error('Configura FIREBASE_PROJECT_ID para el backend.');
initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID });
const port = Number(process.env.PORT || 3001);
createApp(firestoreStore(), clients).listen(port, () => console.info(`Backend educativo listo en el puerto ${port}.`));
