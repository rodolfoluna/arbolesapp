import { UserManager, WebStorageStateStore } from 'oidc-client-ts';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { UserProfile } from './models';

export const centralEnabled = import.meta.env.VITE_AUTH_MODE === 'central';
export const centralUrl = 'https://aula-identidad.onrender.com';
export const centralAuthority = 'https://vtriyoxcumuygluqqstd.supabase.co/auth/v1';
const backend = String(import.meta.env.VITE_EDUCATIONAL_API_URL || '').replace(/\/$/, '');
const base = import.meta.env.BASE_URL;
export const callbackUrl = () => `${location.origin}${base}?auth_callback=1`;
export const isCallback = () => new URL(location.href).searchParams.get('auth_callback') === '1';
export function internalReturn(value: unknown, origin = location.origin, root = base): string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return root;
  const url = new URL(value, origin);
  if (url.origin !== origin || !url.pathname.startsWith(root) || /(?:code|state|access_token|id_token|refresh_token|auth_callback)/i.test(url.search + url.hash)) return root;
  return url.pathname + url.search + url.hash;
}
let manager: UserManager | undefined;
let accessToken: string | null = null;
let expiresAt = 0;
let generation = 0;
const signingKeys = createRemoteJWKSet(new URL(`${centralAuthority}/.well-known/jwks.json`));
export function getCentralManager() {
  if (!manager) {
    const client = String(import.meta.env.VITE_AULA_CLIENT_ID || '').trim();
    if (!client || client.includes('REEMPLAZAR') || !backend) throw new Error('El acceso con Aula Identidad está pendiente de configuración.');
    const api = new URL(backend);
    if (api.protocol !== 'https:' && !(api.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(api.hostname))) throw new Error('La dirección del servicio educativo no es válida.');
    manager = new UserManager({
      authority: centralAuthority, client_id: client, redirect_uri: callbackUrl(),
      response_type: 'code', scope: 'openid profile', disablePKCE: false,
      automaticSilentRenew: false, monitorSession: false, loadUserInfo: false,
      userStore: new WebStorageStateStore({ store: sessionStorage, prefix: 'arboles.aula.user.' }),
      stateStore: new WebStorageStateStore({ store: sessionStorage, prefix: 'arboles.aula.state.' }),
      requestTimeoutInSeconds: 50, fetchRequestCredentials: 'omit',
    });
    manager.events.addAccessTokenExpired(() => { void endCentralSession(); });
  }
  return manager;
}
export async function startCentralLogin() {
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), (byte) => byte.toString(16).padStart(2, '0')).join('');
  await getCentralManager().clearStaleState();
  await getCentralManager().signinRedirect({ nonce, state: { returnTo: internalReturn(location.pathname + location.search) } });
}
let initialization: Promise<UserProfile | null> | null = null;
export function initializeCentralSession(): Promise<UserProfile | null> {
  if (initialization) return initialization;
  const job = (async () => {
    const oidc = getCentralManager();
    const callback = isCallback();
    let user;
    try {
      user = callback ? await oidc.signinRedirectCallback() : await oidc.getUser();
    } catch {
      await endCentralSession(false);
      throw new Error('No se pudo validar el retorno de Aula Identidad. Inicia sesión de nuevo.');
    } finally {
      if (callback) history.replaceState({}, '', base);
    }
    if (!user || user.expired || !user.access_token) { await endCentralSession(false); return null; }
    try {
      await jwtVerify(user.id_token || '', signingKeys, {
        issuer: centralAuthority, audience: getCentralManager().settings.client_id,
        algorithms: ['ES256', 'RS256'], requiredClaims: ['exp', 'iat', 'sub', 'iss', 'aud'],
      });
    } catch {
      await endCentralSession(false);
      throw new Error('No se pudo verificar la identidad recibida. Vuelve a ingresar.');
    }
    accessToken = user.access_token;
    expiresAt = user.expires_at || 0;
    // Refresh tokens are not requested, used, or persisted by this application.
    user.refresh_token = undefined;
    await oidc.storeUser(user);
    const result = await centralFetch<{ profile: UserProfile }>('/api/me');
    if (result.profile.central_user_id !== user.profile.sub) {
      await endCentralSession(); throw new Error('La identidad recibida no coincide. Vuelve a ingresar.');
    }
    if (callback) history.replaceState({}, '', internalReturn((user.state as { returnTo?: string })?.returnTo));
    return result.profile;
  })();
  initialization = job;
  void job.finally(() => { if (initialization === job) initialization = null; }).catch(() => {});
  return job;
}
export async function endCentralSession(notify = true) {
  accessToken = null; expiresAt = 0; generation++;
  try { if (manager) { await manager.removeUser(); await manager.clearStaleState(); } } catch { /* In-memory access is invalid even if browser storage is unavailable. */ }
  // Clear pending OAuth state as well as tokens on explicit local logout.
  try { for (const key of Object.keys(sessionStorage)) if (key.startsWith('arboles.aula.')) sessionStorage.removeItem(key); } catch { /* Private browsing can disable storage. */ }
  if (notify) window.dispatchEvent(new Event('aula:invalid'));
}
export async function centralFetch<T>(path: string, body?: unknown): Promise<T> {
  if (!accessToken || expiresAt <= Date.now() / 1000) {
    await endCentralSession();
    throw new Error('Tu sesión venció. Vuelve a ingresar con Aula Identidad.');
  }
  const current = generation;
  let response: Response;
  try {
    response = await fetch(`${backend}${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(60000),
    });
  } catch {
    await endCentralSession();
    throw new Error('No se pudo verificar tu acceso. Comprueba la conexión y vuelve a ingresar.');
  }
  if (current !== generation) throw new Error('La sesión cambió. Vuelve a ingresar.');
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if ([401, 403].includes(response.status) || response.status >= 500) await endCentralSession();
    throw new Error(typeof data.error === 'string' ? data.error : 'No se pudo completar la operación.');
  }
  return data as T;
}
export async function centralData<T>(operation: string, input: Record<string, unknown> = {}): Promise<T> {
  const response = await centralFetch<{ result: T }>('/api/data', { operation, input });
  return response.result;
}
export function refreshCentralData() { window.dispatchEvent(new Event('aula:datachange')); }
export function centralSubscribe<T>(operation: string, input: Record<string, unknown>, cb: (value: T, meta: { fromCache: boolean; hasPendingWrites: boolean }) => void, onError: (error: Error) => void) {
  let active = true, pending = false;
  const load = async () => {
    if (!active || pending || document.visibilityState === 'hidden') return;
    pending = true;
    try { const result = await centralData<T>(operation, input); if (active) cb(result, { fromCache: false, hasPendingWrites: false }); }
    catch (error) { if (active) onError(error instanceof Error ? error : new Error('No se pudo actualizar.')); }
    finally { pending = false; }
  };
  void load();
  const interval = window.setInterval(load, 60000);
  window.addEventListener('focus', load); window.addEventListener('aula:datachange', load);
  document.addEventListener('visibilitychange', load);
  return () => { active = false; clearInterval(interval); window.removeEventListener('focus', load); window.removeEventListener('aula:datachange', load); document.removeEventListener('visibilitychange', load); };
}
export async function centralWrite<T>(operation: string, input: Record<string, unknown> = {}) {
  const result = await centralData<T>(operation, input);
  refreshCentralData();
  return result;
}
