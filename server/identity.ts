import { createRemoteJWKSet, jwtVerify } from 'jose';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const identitySchema = z.object({
  id: z.uuid(), role: z.enum(['teacher', 'student']), active: z.literal(true),
  must_change_password: z.literal(false), full_name: z.string(),
  control_number: z.string().nullable(), auth_version: z.number().int(),
});
export type Identity = z.infer<typeof identitySchema>;
export const authority = 'https://vtriyoxcumuygluqqstd.supabase.co/auth/v1';
export const centralUrl = 'https://aula-identidad.onrender.com';

export function identityGateway(clients: Record<string, string>, options: {
  fetcher?: typeof fetch;
  verify?: (token: string) => Promise<Record<string, unknown>>;
} = {}) {
  const fetcher = options.fetcher || fetch;
  const keys = createRemoteJWKSet(new URL(`${authority}/.well-known/jwks.json`));
  const verify = options.verify || (async (token: string) => (await jwtVerify(token, keys, {
    issuer: authority, audience: 'authenticated', algorithms: ['ES256', 'RS256'],
  })).payload);
  async function request(path: string, token: string, origin: string): Promise<any> {
    let response: Response;
    try {
      response = await fetcher(`${centralUrl}/api/v1${path}`, {
        headers: { Authorization: `Bearer ${token}`, Origin: origin },
        credentials: 'omit', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(45000),
      });
    } catch { throw new HttpError(503, 'Aula Identidad no responde. Espera un momento y vuelve a intentar.'); }
    if (!response.ok) {
      const status = [400, 401, 403].includes(response.status) ? response.status : 503;
      throw new HttpError(status, status === 401 || status === 403
        ? 'Tu acceso central no está vigente o no tienes permiso. Vuelve a ingresar.'
        : 'No se pudo consultar Aula Identidad. Intenta de nuevo.');
    }
    try { return await response.json(); }
    catch { throw new HttpError(502, 'Aula Identidad devolvió una respuesta no válida.'); }
  }
  return {
    async authenticate(token: string, origin: string): Promise<Identity> {
      if (!clients[origin]) throw new HttpError(403, 'Origen no autorizado.');
      let claims: Record<string, unknown>;
      try { claims = await verify(token); }
      catch { throw new HttpError(401, 'La sesión venció o la credencial no es válida.'); }
      if (claims.client_id !== clients[origin]) throw new HttpError(403, 'Cliente OAuth no autorizado para este origen.');
      // No identity/profile cache: suspension, password reset and app disablement apply on each request.
      const result = await request('/me', token, origin);
      const parsed = identitySchema.safeParse(result.user);
      if (!parsed.success || parsed.data.id !== claims.sub || claims.identity_version !== parsed.data.auth_version || claims.account_ready !== true) {
        throw new HttpError(403, 'La cuenta requiere actualizar su acceso en Aula Identidad.');
      }
      return parsed.data;
    },
    async students(token: string, origin: string, search: string, page: number) {
      const data = await request(`/students?search=${encodeURIComponent(search)}&page=${page}`, token, origin);
      const student = z.object({ id: z.uuid(), control_number: z.string(), full_name: z.string(), active: z.boolean() });
      return z.object({ students: z.array(student), total: z.number(), page: z.number(), page_size: z.number().int().min(1).max(50) }).parse(data);
    },
  };
}
