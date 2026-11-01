// Corre los tests pgTAP de backend/supabase/tests contra SUPABASE_DB_URL, sin Docker.
// Cada archivo NN_*.sql se ejecuta junto con _helpers.sql dentro de una transacción que SIEMPRE
// se revierte: no deja datos ni objetos en la base. La única modificación persistente es
// "create extension if not exists pgtap" (solo en desarrollo/CI; no forma parte de las migraciones).
//   npm run test:db                 todos los archivos
//   npm run test:db -- 02 06        solo los que empiezan con esos prefijos
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';
import { loadEnv, pgSslConfig, requireDevEnvironment, requireEnv, ROOT } from './lib/env.mjs';

loadEnv();
requireDevEnvironment();
requireEnv(['SUPABASE_DB_URL']);

const testsDir = resolve(ROOT, 'backend', 'supabase', 'tests');
const helpers = readFileSync(resolve(testsDir, '_helpers.sql'), 'utf8');
const filters = process.argv.slice(2);
const files = readdirSync(testsDir)
  .filter((name) => /^\d+_.*\.sql$/.test(name))
  .filter((name) => filters.length === 0 || filters.some((prefix) => name.startsWith(prefix)))
  .sort();

if (files.length === 0) {
  console.error('No hay archivos de test que coincidan.');
  process.exit(1);
}

const connectionString = process.env.SUPABASE_DB_URL;
const client = new pg.Client({ connectionString, ssl: await pgSslConfig(connectionString) });

try {
  await client.connect();
} catch (error) {
  console.error(`No se pudo conectar a la base (${error.code ?? error.message}).`);
  if (/certificate/i.test(String(error.message))) {
    console.error('Si es un problema de certificado, descargá el CA de Supabase y apuntá SUPABASE_DB_CA_PATH a ese archivo.');
  }
  process.exit(1);
}

const TAP_LINE = /^(not ok|ok) \d+|^#|^\d+\.\.\d+/;
let totalPassed = 0;
let totalFailed = 0;
const failedFiles = [];

try {
  await client.query('create extension if not exists pgtap with schema extensions');

  for (const file of files) {
    const sql = readFileSync(resolve(testsDir, file), 'utf8');
    const lines = [];
    let error = null;
    try {
      const results = await client.query(
        `begin;\nset local search_path = public, extensions;\n${helpers}\n${sql}`,
      );
      for (const result of [results].flat()) {
        for (const row of result.rows ?? []) {
          for (const value of Object.values(row)) {
            if (typeof value === 'string') {
              for (const line of value.split('\n')) if (TAP_LINE.test(line)) lines.push(line);
            }
          }
        }
      }
    } catch (caught) {
      error = caught;
    } finally {
      await client.query('rollback').catch(() => {});
    }

    const passed = lines.filter((line) => /^ok \d+/.test(line)).length;
    const failed = lines.filter((line) => /^not ok \d+/.test(line)).length;
    const planProblem = lines.some((line) => /^# Looks like/.test(line));
    const ok = !error && failed === 0 && passed > 0 && !planProblem;

    console.log(`\n${ok ? '✔' : '✘'} ${file}  (${passed} ok, ${failed} fallidos)`);
    for (const line of lines) {
      if (!ok || line.startsWith('not ok') || line.startsWith('#')) console.log(`  ${line}`);
    }
    if (error) {
      console.log(`  ERROR ${error.code ?? ''}: ${error.message}`);
      if (error.where) console.log(`  en: ${error.where.split('\n')[0]}`);
    }

    totalPassed += passed;
    totalFailed += failed + (error ? 1 : 0);
    if (!ok) failedFiles.push(file);
  }
} finally {
  await client.end();
}

console.log(`\npgTAP: ${totalPassed} aserciones ok, ${totalFailed} fallas, ${files.length} archivos.`);
if (failedFiles.length > 0) {
  console.log(`Archivos con fallas: ${failedFiles.join(', ')}`);
  process.exit(1);
}
