// Administración de la beta cerrada sobre el proyecto de desarrollo (docs/DECISIONS/0010).
//   npm run beta -- secure                         bloquea los usuarios del seed (@inmogest.test)
//   npm run beta -- access <email> [--name "Nombre"] [--admin] [--url https://…]
//                                                  crea la cuenta (o la recupera) y muestra un enlace
//                                                  de acceso para mandar por WhatsApp; no envía emails
//   npm run beta -- legal <versión>                publica backend/supabase/legal/<versión> como vigente
// Usa la clave secreta de .env.local (nunca la imprime). Solo con APP_ENV=local.
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { loadEnv, requireDevEnvironment, requireEnv, ROOT } from './lib/env.mjs';

loadEnv();
requireDevEnvironment();
requireEnv(['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SECRET_KEY']);

// Dominio de los usuarios del seed, con o sin subdominio (admin@inmogest.test, dueno@demo.inmogest.test).
const SEED_EMAIL = /@([a-z0-9-]+.)*inmogest.test$/i;
const DEFAULT_URL = 'https://inmopanel-beta.vercel.app';
const LEGAL_FILES = { terms: 'terminos.txt', privacy: 'privacidad.txt' };
const LEGAL_TITLES = {
  terms: 'Términos y condiciones de la beta cerrada',
  privacy: 'Política de privacidad de la beta cerrada',
};

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function fail(message) {
  console.error(message);
  process.exit(1);
}

function option(args, name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

async function allUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`No se pudieron listar los usuarios: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

// Los usuarios del seed tienen una contraseña pública (está en el repo): en un proyecto con datos
// reales se les pone una contraseña aleatoria, se los suspende y se les quita el rol de plataforma.
async function secure() {
  const seedUsers = (await allUsers()).filter((user) => SEED_EMAIL.test(user.email ?? ''));
  for (const user of seedUsers) {
    const { error } = await admin.auth.admin.updateUserById(user.id, {
      password: randomBytes(32).toString('base64url'),
      ban_duration: '876000h',
    });
    if (error) fail(`No se pudo bloquear ${user.email}: ${error.message}`);
  }
  const ids = seedUsers.map((user) => user.id);
  if (ids.length > 0) {
    const { error } = await admin.from('platform_admins').delete().in('user_id', ids);
    if (error) fail(`No se pudo quitar el rol de plataforma: ${error.message}`);
  }
  console.log(`Usuarios del seed bloqueados: ${seedUsers.length}.`);
}

async function access(args) {
  const email = args[0]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Indicá un email válido.');
  const name = option(args, '--name')?.trim();
  const appUrl = (option(args, '--url') ?? DEFAULT_URL).replace(/\/+$/, '');

  const existing = (await allUsers()).find((user) => user.email?.toLowerCase() === email);
  // Cuenta nueva: enlace de invitación (crea el usuario). Cuenta existente: enlace de recuperación.
  const type = existing ? 'recovery' : 'invite';
  const { data, error } = await admin.auth.admin.generateLink({
    type,
    email,
    ...(type === 'invite' && name ? { options: { data: { full_name: name } } } : {}),
  });
  if (error) fail(`No se pudo generar el enlace: ${error.message}`);
  const userId = data.user.id;

  if (args.includes('--admin')) {
    // El primer superadministrador es el principal (el único que puede usar "Ingresar como", ADR 0003).
    const { count } = await admin.from('platform_admins').select('user_id', { count: 'exact', head: true }).eq('is_principal', true);
    const { error: adminError } = await admin
      .from('platform_admins')
      .upsert({ user_id: userId, ...(count === 0 ? { is_principal: true } : {}) }, { onConflict: 'user_id' });
    if (adminError) fail(`No se pudo dar el rol de superadministrador: ${adminError.message}`);
  }

  const link = new URL('/auth/confirm', appUrl);
  link.searchParams.set('token_hash', data.properties.hashed_token);
  link.searchParams.set('type', type);
  link.searchParams.set('next', '/restablecer');
  console.log(`${existing ? 'Cuenta existente' : 'Cuenta creada'}: ${email}${args.includes('--admin') ? ' (superadministrador)' : ''}`);
  console.log('Enlace de acceso (un solo uso, vence según la configuración de Auth; no lo publiques):');
  console.log(link.toString());
}

async function publishLegal(args) {
  const version = args[0]?.trim();
  if (!version || !/^[a-z0-9.-]{1,30}$/.test(version)) fail('Indicá la versión, por ejemplo: beta-1.');
  const ids = {};
  for (const [kind, file] of Object.entries(LEGAL_FILES)) {
    const content = readFileSync(resolve(ROOT, 'backend', 'supabase', 'legal', version, file), 'utf8').trim();
    if (content.includes('[COMPLETAR')) fail(`${version}/${file} todavía tiene campos [COMPLETAR].`);
    const { data: found } = await admin.from('legal_documents').select('id, content').eq('kind', kind).eq('version', version).maybeSingle();
    if (found) {
      // Un documento publicado es inmutable (ADR 0009): para cambiarlo, versión nueva.
      if (found.content !== content) fail(`${kind} ${version} ya existe con otro texto. Creá una versión nueva.`);
      ids[kind] = found.id;
      continue;
    }
    const { data: created, error } = await admin
      .from('legal_documents')
      .insert({ kind, version, title: LEGAL_TITLES[kind], content, published_at: new Date().toISOString(), is_draft: false })
      .select('id')
      .single();
    if (error) fail(`No se pudo cargar ${kind} ${version}: ${error.message}`);
    ids[kind] = created.id;
  }
  const { error } = await admin
    .from('platform_settings')
    .update({ current_terms_id: ids.terms, current_privacy_id: ids.privacy })
    .eq('id', true);
  if (error) fail(`No se pudieron configurar como vigentes: ${error.message}`);
  console.log(`Términos y privacidad ${version} publicados y vigentes.`);
}

const [command, ...rest] = process.argv.slice(2);
if (command === 'secure') await secure();
else if (command === 'access') await access(rest);
else if (command === 'legal') await publishLegal(rest);
else fail('Uso: npm run beta -- secure | access <email> [--name "Nombre"] [--admin] [--url …] | legal <versión>');
