import express from 'express';
import { z, ZodError } from 'zod';
import { identityGateway, HttpError } from './identity.ts';
import { educationalService } from './service.ts';
import type { DataStore } from './store.ts';

export function createApp(store: DataStore, clients: Record<string, string>, gateway = identityGateway(clients)) {
  const app = express();
  app.disable('x-powered-by');
  app.get('/health', (_req, res) => res.set('Cache-Control', 'no-store').json({ ok: true }));
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Origin' });
    const origin = req.get('origin') || '';
    if (!clients[origin]) return res.status(403).json({ error: 'Origen no autorizado.' });
    res.set({ 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type' });
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
  app.use(express.json({ limit: '512kb', strict: true }));
  const service = educationalService(store);
  app.use('/api', async (req, res, next) => {
    try {
      const header = req.get('authorization') || '';
      if (!header.startsWith('Bearer ') || header.length > 16000) throw new HttpError(401, 'Falta una credencial válida.');
      const token = header.slice(7), origin = req.get('origin')!;
      const identity = await gateway.authenticate(token, origin);
      res.locals.identity = identity; res.locals.token = token; res.locals.origin = origin;
      next();
    } catch (error) { next(error); }
  });
  app.get('/api/me', async (_req, res) => {
    res.json({ profile: await service.execute(res.locals.identity, 'me') });
  });
  app.post('/api/data', async (req, res) => {
    const body = z.object({ operation: z.string().max(60), input: z.record(z.string(), z.unknown()).default({}) }).strict().parse(req.body);
    const result = await service.execute(res.locals.identity, body.operation, body.input);
    res.json({ result: result ?? null });
  });
  app.get('/api/students', async (req, res) => {
    const identity = res.locals.identity;
    if (identity.role !== 'teacher') throw new HttpError(403, 'Solo el profesor puede consultar el catálogo.');
    await service.execute(identity, 'me');
    const search = z.string().max(100).parse(req.query.search || '');
    const page = z.coerce.number().int().min(1).max(10000).parse(req.query.page || 1);
    res.json(await gateway.students(res.locals.token, res.locals.origin, search, page));
  });
  app.post('/api/import-student', async (req, res) => {
    const identity = res.locals.identity;
    if (identity.role !== 'teacher') throw new HttpError(403, 'Solo el profesor puede modificar grupos.');
    await service.execute(identity, 'me');
    const input = z.object({ centralId: z.uuid(), controlNumber: z.string().min(1).max(100), groupId: z.string().min(1).max(200) }).strict().parse(req.body);
    // Obtain current status from the central directory; never trust the browser's active/name fields.
    for (let page = 1; page <= 1000; page++) {
      const result = await gateway.students(res.locals.token, res.locals.origin, input.controlNumber, page);
      const student = result.students.find((item) => item.id === input.centralId);
      if (student) return res.json({ profile: await service.importStudent(identity, student, input.groupId) });
      if (result.page * result.page_size >= result.total) break;
    }
    throw new HttpError(404, 'El alumno no se encontró en el catálogo central vigente.');
  });
  app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error instanceof HttpError ? error.status : error instanceof ZodError || error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
    // Do not echo provider responses, tokens, payloads, Firebase credentials or stack traces.
    res.status(status).json({ error: error instanceof HttpError ? error.message : status === 400 ? 'Solicitud no válida.' : 'No se pudo completar la operación.' });
  });
  return app;
}
