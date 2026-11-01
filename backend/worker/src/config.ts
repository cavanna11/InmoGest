import { hostname } from 'node:os';

export type WorkerConfig = {
  supabaseUrl: string;
  secretKey: string;
  workerId: string;
};

/** Lee la configuración del entorno. Nunca imprime valores, solo nombres de variables faltantes. */
export function readConfig(env: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = env.SUPABASE_SECRET_KEY?.trim();
  const missing = [
    !supabaseUrl && 'NEXT_PUBLIC_SUPABASE_URL',
    !secretKey && 'SUPABASE_SECRET_KEY',
  ].filter(Boolean);
  if (!supabaseUrl || !secretKey) {
    throw new Error(`Faltan variables de entorno del worker: ${missing.join(', ')}`);
  }
  // Solo el origen: supabase-js agrega /rest/v1 y una URL con ruta falla con PGRST125.
  if (new URL(supabaseUrl).pathname !== '/') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL debe ser solo https://<ref>.supabase.co, sin /rest/v1');
  }
  const workerId = env.WORKER_ID?.trim() || `${hostname()}-${process.pid}`;
  return { supabaseUrl, secretKey, workerId: workerId.slice(0, 100) };
}
