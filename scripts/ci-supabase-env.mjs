// Solo CI: exporta a $GITHUB_ENV las credenciales del Supabase local efímero (`supabase start`) y las
// enmascara en los logs. No se usa en desarrollo ni con proyectos en la nube.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/env.mjs';

if (!process.env.GITHUB_ENV) {
  console.error('Este script solo corre en GitHub Actions.');
  process.exit(1);
}

const cli = resolve(ROOT, 'node_modules', 'supabase', 'dist', 'supabase.js');
const status = JSON.parse(
  execFileSync(process.execPath, [cli, 'status', '--workdir', resolve(ROOT, 'backend'), '-o', 'json'], {
    cwd: ROOT,
    encoding: 'utf8',
  }),
);
const pick = (...keys) => keys.map((key) => status[key]).find(Boolean);
const vars = {
  SUPABASE_DB_URL: pick('DB_URL'),
  NEXT_PUBLIC_SUPABASE_URL: pick('API_URL'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: pick('PUBLISHABLE_KEY', 'ANON_KEY'),
  SUPABASE_SECRET_KEY: pick('SECRET_KEY', 'SERVICE_ROLE_KEY'),
  E2E_MAILPIT_URL: pick('MAILPIT_URL', 'INBUCKET_URL'),
};

const lines = [];
for (const [name, value] of Object.entries(vars)) {
  if (!value) {
    console.error(`Falta ${name} en supabase status`);
    process.exit(1);
  }
  if (name !== 'NEXT_PUBLIC_SUPABASE_URL' && name !== 'E2E_MAILPIT_URL') console.log(`::add-mask::${value}`);
  lines.push(`${name}=${value}`);
}
appendFileSync(process.env.GITHUB_ENV, `${lines.join('\n')}\n`);
console.log(`Exportadas: ${Object.keys(vars).join(', ')}`);
