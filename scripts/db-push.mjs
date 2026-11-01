// Aplica las migraciones de backend/supabase/migrations al proyecto de DESARROLLO con la CLI de Supabase.
//   npm run db:push                 migraciones pendientes
//   npm run db:push -- --seed       además, backend/supabase/seed.sql (solo desarrollo)
//   npm run db:push -- --dry-run    muestra qué aplicaría
// La CLI se invoca con node (no con el atajo .cmd, que falla porque la ruta contiene "&").
//
// El seed NO se aplica con --include-seed de la CLI: la CLI registra el seed como aplicado y no lo
// vuelve a ejecutar aunque cambie. Se corre acá, en una transacción; es idempotente.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { loadEnv, pgSslConfig, requireDevEnvironment, requireEnv, ROOT } from './lib/env.mjs';

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
if (args.has('--dry-run')) cliArgs.push('--dry-run');

console.log(`Aplicando migraciones (APP_ENV=${process.env.APP_ENV})…`);
const result = spawnSync(process.execPath, cliArgs, { stdio: 'inherit', cwd: ROOT });
if (result.status !== 0) process.exit(result.status ?? 1);

if (args.has('--seed')) {
  if (args.has('--dry-run')) {
    console.log('Seed omitido en --dry-run.');
  } else {
    const seed = readFileSync(resolve(ROOT, 'backend', 'supabase', 'seed.sql'), 'utf8');
    const connectionString = process.env.SUPABASE_DB_URL;
    const client = new pg.Client({ connectionString, ssl: await pgSslConfig(connectionString) });
    await client.connect();
    try {
      await client.query('begin');
      await client.query(seed);
      await client.query('commit');
      console.log('Seed de desarrollo aplicado.');
    } catch (error) {
      await client.query('rollback').catch(() => {});
      console.error(`El seed falló y se revirtió (${error.code ?? ''}): ${error.message}`);
      process.exitCode = 1;
    } finally {
      await client.end();
    }
  }
}
