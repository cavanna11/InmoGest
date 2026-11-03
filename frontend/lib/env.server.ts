import 'server-only';
import { connection } from 'next/server';
import { z } from 'zod';
import { requirePublicEnv } from './env.ts';

/** Variables secretas: solo servidor. El import de 'server-only' hace fallar el build si llegan al navegador. */
const serverEnvSchema = z.object({
  supabaseSecretKey: z.string().min(1),
});

/**
 * Registro público de inmobiliarias (/registro). Cerrado salvo REGISTRATION_OPEN=true: durante la beta
 * cerrada (ADR 0010) las cuentas las da de alta C&C con `npm run beta -- access`. CI lo abre para los E2E.
 */
export async function isRegistrationOpen(): Promise<boolean> {
  // Se lee en cada pedido, no al prerenderizar: el valor del build no queda fijo en la página.
  await connection();
  return process.env.REGISTRATION_OPEN === 'true';
}

export function requireServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || undefined,
  });
  if (!parsed.success) throw new Error('Falta SUPABASE_SECRET_KEY (ver .env.example).');
  return { ...requirePublicEnv(), ...parsed.data };
}
