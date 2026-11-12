import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const patterns = [/-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/, /SUPABASE_SECRET_KEY/, /SESSION_ENCRYPTION_KEY/, /"type"\s*:\s*"service_account"/, /private_key_id/];
async function scan(directory) {
  let count = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) count += await scan(path);
    else if (/\.(js|html|json|css|webmanifest)$/.test(entry.name)) {
      const text = await readFile(path, 'utf8');
      if (patterns.some((pattern) => pattern.test(text))) throw new Error(`Revisar posible secreto administrativo en ${path}; no se imprime su contenido.`);
      count++;
    }
  }
  return count;
}
console.info(`Archivos públicos revisados: ${await scan('dist')}. Sin patrones de claves administrativas.`);
const html = await readFile('dist/index.html', 'utf8');
if (process.argv.includes('--central')) {
  if (!html.includes('Content-Security-Policy')) throw new Error('Falta CSP en la compilación central.');
  const sw = await readFile('dist/sw.js', 'utf8');
  if (!sw.includes('auth_callback')) throw new Error('Falta exclusión del callback en el service worker.');
  console.info('CSP y exclusión del callback comprobadas. Esto no prueba un login OAuth real.');
}
