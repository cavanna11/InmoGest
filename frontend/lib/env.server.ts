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

/** Conexión con Evolution API. Null si no está configurada: el panel lo informa y no ofrece conectar. */
export function readEvolutionEnv(): { baseUrl: string; apiKey: string } | null {
  const baseUrl = process.env.EVOLUTION_API_URL?.trim();
  const apiKey = process.env.EVOLUTION_API_KEY?.trim();
  return baseUrl && apiKey ? { baseUrl, apiKey } : null;
}

/**
 * Aplicación de Mercado Libre (ADR 0012). Null si falta alguna variable: el panel avisa que no está
 * habilitado. MERCADOLIBRE_API_URL y MERCADOLIBRE_AUTH_URL solo se usan para probar contra un servidor falso.
 */
export function readMercadoLibreEnv(): {
  clientId: string;
  clientSecret: string;
  encryptionKey: string;
  apiUrl: string | undefined;
  authUrl: string | undefined;
} | null {
  const clientId = process.env.MERCADOLIBRE_CLIENT_ID?.trim();
  const clientSecret = process.env.MERCADOLIBRE_CLIENT_SECRET?.trim();
  const encryptionKey = process.env.INTEGRATIONS_ENCRYPTION_KEY?.trim();
  if (!clientId || !clientSecret || !encryptionKey) return null;
  return {
    clientId,
    clientSecret,
    encryptionKey,
    apiUrl: process.env.MERCADOLIBRE_API_URL?.trim() || undefined,
    authUrl: process.env.MERCADOLIBRE_AUTH_URL?.trim() || undefined,
  };
}

export function requireServerEnv() {
  const parsed = serverEnvSchema.safeParse({
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY || undefined,
  });
  if (!parsed.success) throw new Error('Falta SUPABASE_SECRET_KEY (ver .env.example).');
  return { ...requirePublicEnv(), ...parsed.data };
}
