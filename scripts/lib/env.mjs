// Carga .env.local (si existe) sin dependencias, con la API nativa de Node (>= 21.7).
// Nunca imprime valores: solo nombres de variables.
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadEnv() {
  const file = resolve(ROOT, '.env.local');
  if (existsSync(file)) process.loadEnvFile(file);
}

export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error(
      `Faltan variables de entorno: ${missing.join(', ')}.\n` +
        'Creá .env.local a partir de .env.example y completalas (ver README.md).',
    );
    process.exit(1);
  }
}

// Las herramientas que escriben en la base solo corren contra desarrollo local o la base efímera de CI.
export function requireDevEnvironment() {
  const env = process.env.APP_ENV;
  if (env !== 'local' && env !== 'ci') {
    console.error(
      `APP_ENV=${env ?? '(vacío)'}: este script solo corre con APP_ENV=local o APP_ENV=ci.\n` +
        'Producción requiere aprobación explícita y un procedimiento aparte (docs/DEPLOYMENT.md).',
    );
    process.exit(1);
  }
}

// Configuración TLS para pg: sin TLS en localhost; con verificación del certificado en el resto.
// Si el certificado de Supabase no está en el almacén del sistema, indicar su ruta en SUPABASE_DB_CA_PATH.
export async function pgSslConfig(connectionString) {
  const host = new URL(connectionString).hostname;
  if (['localhost', '127.0.0.1', '::1'].includes(host)) return false;
  const caPath = process.env.SUPABASE_DB_CA_PATH?.trim();
  if (caPath) {
    const { readFileSync } = await import('node:fs');
    return { ca: readFileSync(resolve(ROOT, caPath), 'utf8'), rejectUnauthorized: true };
  }
  return { rejectUnauthorized: true };
}
