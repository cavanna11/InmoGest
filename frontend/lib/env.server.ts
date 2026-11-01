import 'server-only';
import { z } from 'zod';
import { requirePublicEnv } from './env.ts';

/** Variables secretas: solo servidor. El import de 'server-only' hace fallar el build si llegan al navegador. */
const serverEnvSchema = z.object({
  supabaseSecretKey: z.string().min(1),
});

export function requireServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || undefined,
  });
  if (!parsed.success) throw new Error('Falta SUPABASE_SECRET_KEY (ver .env.example).');
  return { ...requirePublicEnv(), ...parsed.data };
}
