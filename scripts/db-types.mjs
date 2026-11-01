// Genera los tipos TypeScript de la base (esquema public) en backend/shared/src/database.types.ts.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv, requireDevEnvironment, requireEnv, ROOT } from './lib/env.mjs';

loadEnv();
requireDevEnvironment();
requireEnv(['SUPABASE_DB_URL']);

const cli = resolve(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');
const result = spawnSync(
  process.execPath,
  [cli, 'gen', 'types', 'typescript', '--db-url', process.env.SUPABASE_DB_URL, '--schema', 'public'],
  { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 20 * 1024 * 1024 },
);
if (result.status !== 0 || !result.stdout.trim()) {
  console.error('No se pudieron generar los tipos.');
  process.exit(result.status || 1);
}
const target = resolve(ROOT, 'backend', 'shared', 'src', 'database.types.ts');
writeFileSync(target, `// Generado por npm run db:types. No editar a mano.\n${result.stdout.replace(/\r\n/g, '\n')}`);
console.log(`Tipos generados en ${target}`);
