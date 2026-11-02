// Compuerta de seguridad (docs/TESTING.md): ninguna variable secreta puede usar el prefijo NEXT_PUBLIC_,
// porque Next.js incrusta esas variables en el JavaScript del navegador.
// Revisa .env.example y todo el código fuente versionado.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT } from './lib/env.mjs';

const ALLOWED_PUBLIC = new Set([
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_APP_NAME',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'NEXT_PUBLIC_SITE_INDEXABLE',
]);
const SECRET_HINT = /SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|TOKEN|DB_URL|API_KEY/;

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: ROOT,
  encoding: 'utf8',
})
  .split('\n')
  .filter((file) => /\.(ts|tsx|js|mjs|cjs|json|example|yml|yaml|md)$/.test(file) || file === '.env.example')
  .filter((file) => !file.startsWith('node_modules/') && file !== 'package-lock.json');

const problems = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(resolve(ROOT, file), 'utf8');
  } catch {
    continue;
  }
  for (const [name] of text.matchAll(/NEXT_PUBLIC_[A-Z0-9_]+/g)) {
    if (SECRET_HINT.test(name) || !ALLOWED_PUBLIC.has(name)) {
      problems.push(`${file}: ${name}`);
    }
  }
  // Valores de claves reales pegados en el repositorio.
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text)) problems.push(`${file}: contiene una clave sb_secret_`);
}

if (problems.length > 0) {
  console.error('Variables públicas no permitidas o secretos en el código:');
  for (const problem of [...new Set(problems)]) console.error(`  ${problem}`);
  console.error('Si es una variable pública legítima, agregala a ALLOWED_PUBLIC en scripts/check-public-env.mjs.');
  process.exit(1);
}
console.log(`check:env OK (${files.length} archivos revisados).`);
