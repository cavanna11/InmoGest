import { z } from 'zod';

/**
 * Variables públicas (llegan al navegador). Nunca agregar secretos acá: van en env.server.ts.
 * Next.js solo incrusta process.env.NEXT_PUBLIC_* cuando se nombran literalmente.
 */
const publicEnvSchema = z.object({
  // Solo el origen (https://<ref>.supabase.co): supabase-js agrega /rest/v1, /auth/v1, etc.
  supabaseUrl: z.url().refine((value) => new URL(value).pathname === '/', 'Sin ruta: solo https://<ref>.supabase.co'),
  supabasePublishableKey: z.string().min(1),
  appName: z.string().min(1).default('InmoPanel'),
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;

/** Devuelve null si falta configuración (ej. antes de crear .env.local). */
export function readPublicEnv(): PublicEnv | null {
  const parsed = publicEnvSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    appName: process.env.NEXT_PUBLIC_APP_NAME || undefined,
  });
  return parsed.success ? parsed.data : null;
}

export function requirePublicEnv(): PublicEnv {
  const env = readPublicEnv();
  if (!env) {
    throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL y/o NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (ver .env.example).');
  }
  return env;
}
