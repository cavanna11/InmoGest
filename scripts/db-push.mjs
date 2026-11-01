// Aplica las migraciones de backend/supabase/migrations al proyecto de DESARROLLO con la CLI de Supabase.
//   npm run db:push                 migraciones pendientes
//   npm run db:push -- --seed       además, backend/supabase/seed.sql (solo desarrollo)
//   npm run db:push -- --dry-run    muestra qué aplicaría
// La CLI se invoca con node (no con el atajo .cmd, que falla porque la ruta contiene "&").
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadEnv, requireDevEnvironment, requireEnv, ROOT } from './lib/env.mjs';

loadEnv();
requireDevEnvironment();
requireEnv(['SUPABASE_DB_URL']);

const args = new Set(process.argv.slice(2));
const unknown = [...args].filter((arg) => !['--seed', '--dry-run'].includes(arg));
if (unknown.length > 0) {
  console.error(`Opciones desconocidas: ${unknown.join(', ')}. Usar --seed o --dry-run.`);
  process.exit(1);
}

const cli = resolve(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');
const cliArgs = [
  cli, 'db', 'push',
  '--workdir', resolve(ROOT, 'backend'),
  '--db-url', process.env.SUPABASE_DB_URL,
  '--yes',
];
if (args.has('--seed')) cliArgs.push('--include-seed');
if (args.has('--dry-run')) cliArgs.push('--dry-run');

console.log(`Aplicando migraciones${args.has('--seed') ? ' y seed' : ''} (APP_ENV=${process.env.APP_ENV})…`);
const result = spawnSync(process.execPath, cliArgs, { stdio: 'inherit', cwd: ROOT });
process.exit(result.status ?? 1);
