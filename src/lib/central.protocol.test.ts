// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { OidcClient, WebStorageStateStore } from 'oidc-client-ts';

const issuer = 'https://identity.example/auth/v1';
function client() {
  return new OidcClient({ authority: issuer, client_id: 'fixture-client', redirect_uri: 'http://localhost:5173/?auth_callback=1', response_type: 'code', scope: 'openid profile',
    loadUserInfo: false, disablePKCE: false, stateStore: new WebStorageStateStore({ store: sessionStorage }),
    metadata: { issuer, authorization_endpoint: `${issuer}/oauth/authorize`, token_endpoint: `${issuer}/oauth/token`, jwks_uri: `${issuer}/jwks` } });
}
const idToken = (nonce: string) => `${btoa(JSON.stringify({ alg: 'ES256' }))}.${btoa(JSON.stringify({ sub: 'fixture-user', nonce, iss: issuer, aud: 'fixture-client', exp: Math.floor(Date.now() / 1000) + 300 }))}.fixture-signature`;
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

it('el flujo real de la biblioteca genera state, nonce y PKCE S256 y envía code_verifier al canjear', async () => {
  const oidc = client();
  const request = await oidc.createSigninRequest({ nonce: 'fixture-nonce' });
  const auth = new URL(request.url);
  expect(auth.pathname).toContain('/oauth/authorize');
  expect(auth.searchParams.get('code_challenge_method')).toBe('S256');
  expect(auth.searchParams.get('code_challenge')).toBeTruthy();
  expect(auth.searchParams.get('state')).toBeTruthy();
  expect(auth.searchParams.get('nonce')).toBe('fixture-nonce');
  expect(auth.searchParams.get('scope')).toBe('openid profile');
  const fetcher = vi.fn().mockResolvedValue(Response.json({ access_token: 'fixture-access', token_type: 'Bearer', expires_in: 300, id_token: idToken('fixture-nonce') }));
  vi.stubGlobal('fetch', fetcher);
  const response = await oidc.processSigninResponse(`http://localhost:5173/?auth_callback=1&code=fixture-code&state=${auth.searchParams.get('state')}`);
  expect(response.access_token).toBe('fixture-access');
  expect(String(fetcher.mock.calls[0][1].body)).toContain('code_verifier=');
});
it('state ajeno y nonce distinto se rechazan antes de aceptar una sesión', async () => {
  const oidc = client();
  const request = await oidc.createSigninRequest({ nonce: 'original' });
  const fetcher = vi.fn().mockResolvedValue(Response.json({ access_token: 'fixture-access', token_type: 'Bearer', expires_in: 300, id_token: idToken('incorrecto') }));
  vi.stubGlobal('fetch', fetcher);
  await expect(oidc.processSigninResponse('http://localhost:5173/?auth_callback=1&code=fixture-code&state=ajeno')).rejects.toThrow();
  expect(fetcher).not.toHaveBeenCalled();
  await expect(oidc.processSigninResponse(`http://localhost:5173/?auth_callback=1&code=fixture-code&state=${new URL(request.url).searchParams.get('state')}`)).rejects.toThrow(/nonce/);
});
