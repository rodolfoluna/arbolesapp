import { expect, it, vi } from 'vitest';
import { generateKeyPair, SignJWT, jwtVerify } from 'jose';
import { identityGateway, authority } from './identity.ts';
const identity = { id: '00000000-0000-4000-8000-000000000002', role: 'student', active: true, must_change_password: false, full_name: 'Alumno', control_number: '001A', auth_version: 2 };
const claims = { sub: identity.id, client_id: 'client-local', identity_version: 2, account_ready: true };
const origin = 'http://localhost:5173';
it('consulta /me en cada operación, sin caché ni cookies, y rechaza una suspensión posterior', async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ user: identity })).mockResolvedValueOnce(new Response('{}', { status: 403 }));
  const gateway = identityGateway({ [origin]: 'client-local' }, { verify: async () => claims, fetcher });
  expect((await gateway.authenticate('access-token', origin)).role).toBe('student');
  await expect(gateway.authenticate('access-token', origin)).rejects.toMatchObject({ status: 403 });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'omit', cache: 'no-store', headers: { Authorization: 'Bearer access-token', Origin: origin } });
});
it.each([
  { ...identity, active: false }, { ...identity, must_change_password: true }, { ...identity, auth_version: 3 }, { ...identity, role: 'authenticated' },
])('rechaza estado, versión o rol central no válido (%j)', async (user) => {
  const gateway = identityGateway({ [origin]: 'client-local' }, { verify: async () => claims, fetcher: vi.fn().mockResolvedValue(Response.json({ user })) });
  await expect(gateway.authenticate('token', origin)).rejects.toMatchObject({ status: 403 });
});
it('rechaza cliente de otra app, origen no registrado y caída de red sin acceder a datos', async () => {
  const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
  const gateway = identityGateway({ [origin]: 'different-client' }, { verify: async () => claims, fetcher });
  await expect(gateway.authenticate('token', origin)).rejects.toMatchObject({ status: 403 });
  await expect(gateway.authenticate('token', 'https://attacker.example')).rejects.toMatchObject({ status: 403 });
  expect(fetcher).not.toHaveBeenCalled();
  const valid = identityGateway({ [origin]: 'client-local' }, { verify: async () => claims, fetcher });
  await expect(valid.authenticate('token', origin)).rejects.toMatchObject({ status: 503 });
});
it('verifica firma ES256, issuer, audience y expiración; un ID token no sirve como access token', async () => {
  const keys = await generateKeyPair('ES256');
  const fetcher = vi.fn().mockResolvedValue(Response.json({ user: identity }));
  const gateway = identityGateway({ [origin]: 'client-local' }, {
    fetcher, verify: async (token) => (await jwtVerify(token, keys.publicKey, { issuer: authority, audience: 'authenticated', algorithms: ['ES256', 'RS256'] })).payload,
  });
  const token = (audience: string, expires: string) => new SignJWT(claims).setProtectedHeader({ alg: 'ES256' }).setIssuer(authority).setAudience(audience).setIssuedAt().setExpirationTime(expires).sign(keys.privateKey);
  expect((await gateway.authenticate(await token('authenticated', '5m'), origin)).id).toBe(identity.id);
  await expect(gateway.authenticate(await token('client-local', '5m'), origin)).rejects.toMatchObject({ status: 401 });
  await expect(gateway.authenticate(await token('authenticated', '-5m'), origin)).rejects.toMatchObject({ status: 401 });
  await expect(gateway.authenticate('modified.invalid.token', origin)).rejects.toMatchObject({ status: 401 });
});
