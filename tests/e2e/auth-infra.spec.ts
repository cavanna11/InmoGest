// @auth: verifica la infraestructura de autenticación de los E2E (Supabase local + Mailpit) antes de
// que existan las pantallas de registro (incremento 1.1). Solo corre con E2E_AUTH=1 contra Supabase local.
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { expect, test } from '@playwright/test';
import { extractAuthLink, uniqueTestEmail, waitForEmail } from './support/mailpit.ts';

test.describe('infraestructura de autenticación @auth', () => {
  // Un solo navegador alcanza: no depende del viewport.
  test.skip(({ isMobile }) => isMobile, 'solo escritorio');

  test('confirmación de email por Mailpit e ingreso con contraseña', async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const email = uniqueTestEmail('infra');
    // Contraseña aleatoria por corrida: cumple la política (≥ 10, mayúsculas, minúsculas, números).
    const password = `Aa1${randomBytes(12).toString('hex')}`;

    const signUp = await supabase.auth.signUp({ email, password });
    expect(signUp.error).toBeNull();

    // Sin confirmar, no puede ingresar (confirmación obligatoria, docs/SECURITY.md).
    const early = await supabase.auth.signInWithPassword({ email, password });
    expect(early.error?.code).toBe('email_not_confirmed');

    const mail = await waitForEmail(email);
    const link = extractAuthLink(mail.text);
    const verify = await fetch(link, { redirect: 'manual' });
    expect([302, 303]).toContain(verify.status);
    expect(verify.headers.get('location') ?? '').not.toContain('error=');

    const signIn = await supabase.auth.signInWithPassword({ email, password });
    expect(signIn.error).toBeNull();
    expect(signIn.data.user?.email).toBe(email);
  });

  test('la política de contraseñas rechaza claves débiles', async () => {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const weak = await supabase.auth.signUp({ email: uniqueTestEmail('weak'), password: 'corta1' });
    expect(weak.error).not.toBeNull();
  });
});
