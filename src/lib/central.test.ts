// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ callback: vi.fn(), get: vi.fn(), remove: vi.fn(), clear: vi.fn(), store: vi.fn(), signin: vi.fn(), signature: vi.fn(), settings: {} as any }));
vi.mock('oidc-client-ts', () => ({
  UserManager: class {
    settings: any;
    events = { addAccessTokenExpired: vi.fn() };
    constructor(settings: any) { this.settings = settings; mocks.settings = settings; }
    signinRedirectCallback = mocks.callback; getUser = mocks.get; removeUser = mocks.remove;
    clearStaleState = mocks.clear; storeUser = mocks.store; signinRedirect = mocks.signin;
  },
  WebStorageStateStore: class { options: any; constructor(options: any) { this.options = options; } },
}));
vi.mock('jose', () => ({ createRemoteJWKSet: () => ({}), jwtVerify: mocks.signature }));
const uuid = '00000000-0000-4000-8000-000000000001';
const user = () => ({ access_token: 'fixture-access', id_token: 'fixture-id', refresh_token: 'never-persist', expired: false, expires_at: Math.floor(Date.now() / 1000) + 300, profile: { sub: uuid }, state: { returnTo: '/' } });
beforeEach(() => {
  vi.resetModules(); vi.clearAllMocks(); sessionStorage.clear();
  vi.stubEnv('VITE_AULA_CLIENT_ID', 'fixture-client'); vi.stubEnv('VITE_EDUCATIONAL_API_URL', 'http://localhost:3001');
  window.history.replaceState({}, '', '/');
  mocks.signature.mockResolvedValue({ payload: { sub: uuid } });
  mocks.get.mockResolvedValue(user()); mocks.callback.mockResolvedValue(user());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it('configura code/PKCE y nonce aleatorio, sin client secret ni renovación silenciosa', async () => {
  const central = await import('./central');
  await central.startCentralLogin();
  expect(mocks.settings).toMatchObject({ response_type: 'code', scope: 'openid profile', disablePKCE: false, automaticSilentRenew: false });
  expect(mocks.settings.client_secret).toBeUndefined();
  expect(mocks.signin.mock.calls[0][0].nonce).toHaveLength(64);
});
it('procesa callback directo, limpia code/state y usa access token, no ID token, en la API', async () => {
  window.history.replaceState({}, '', '/?auth_callback=1&code=fixture-code&state=fixture-state');
  const fetcher = vi.fn().mockResolvedValue(Response.json({ profile: { uid: 'old-teacher', central_user_id: uuid } }));
  vi.stubGlobal('fetch', fetcher);
  const central = await import('./central');
  expect((await central.initializeCentralSession())?.uid).toBe('old-teacher');
  expect(mocks.callback).toHaveBeenCalledTimes(1);
  expect(window.location.search).toBe('');
  expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer fixture-access');
  expect(mocks.store.mock.calls[0][0].refresh_token).toBeUndefined();
});
it('un callback fallido limpia la URL y no muestra el error crudo del proveedor', async () => {
  mocks.callback.mockRejectedValueOnce(new Error('raw-provider-code-and-token'));
  window.history.replaceState({}, '', '/?auth_callback=1&code=fixture-code&state=incorrect-state');
  const central = await import('./central');
  await expect(central.initializeCentralSession()).rejects.toThrow('No se pudo validar el retorno');
  expect(location.search).toBe('');
  expect(mocks.remove).toHaveBeenCalled();
});
it('rechaza firma/issuer/audience del ID token no verificado antes de consultar datos', async () => {
  mocks.signature.mockRejectedValueOnce(new Error('signature'));
  const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
  const central = await import('./central');
  await expect(central.initializeCentralSession()).rejects.toThrow('No se pudo verificar');
  expect(fetcher).not.toHaveBeenCalled();
});
it.each([401, 403, 503])('invalida y limpia sesión ante %s sin bucles automáticos', async (status) => {
  const fetcher = vi.fn().mockResolvedValueOnce(Response.json({ profile: { uid: 'old', central_user_id: uuid } })).mockResolvedValueOnce(Response.json({ error: 'Acceso rechazado' }, { status }));
  vi.stubGlobal('fetch', fetcher);
  const central = await import('./central');
  await central.initializeCentralSession();
  sessionStorage.setItem('arboles.aula.user.fixture', 'sensitive-fixture');
  await expect(central.centralData('groups')).rejects.toThrow('Acceso rechazado');
  expect(sessionStorage.getItem('arboles.aula.user.fixture')).toBeNull();
  expect(mocks.signin).not.toHaveBeenCalled();
});
it('recarga exige /me de nuevo y logout limpia datos sin cerrar otras apps', async () => {
  const fetcher = vi.fn().mockImplementation(() => Promise.resolve(Response.json({ profile: { uid: 'old', central_user_id: uuid } })));
  vi.stubGlobal('fetch', fetcher);
  const central = await import('./central');
  await central.initializeCentralSession(); await central.initializeCentralSession();
  expect(fetcher).toHaveBeenCalledTimes(2);
  await central.endCentralSession();
  await expect(central.centralData('groups')).rejects.toThrow('sesión venció');
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it('rechaza rutas externas, fuera de la base y parámetros OAuth como retorno interno', async () => {
  const { internalReturn } = await import('./central');
  for (const value of ['https://evil.example', '//evil.example', '/otra/', '/arbolesapp/?access_token=x', '/arbolesapp/\\evil']) {
    expect(internalReturn(value, 'https://rodolfoluna.github.io', '/arbolesapp/')).toBe('/arbolesapp/');
  }
  expect(internalReturn('/arbolesapp/?vista=grupos', 'https://rodolfoluna.github.io', '/arbolesapp/')).toBe('/arbolesapp/?vista=grupos');
});
