import 'server-only';
import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/auth.ts';
import { getPlatformRole } from '@/lib/platform.ts';

/** Exige sesión y rol de plataforma. A los demás, "no encontrada": no se revela que el panel existe. */
export async function requirePlatformAdmin(next: string) {
  await requireUser(next);
  const role = await getPlatformRole();
  if (!role.isAdmin) notFound();
  return role;
}

export const STATE_LABELS: Record<string, string> = {
  trial: 'Prueba',
  active: 'Activa',
  read_only: 'Solo lectura',
  blocked: 'Bloqueada',
  pending_deletion: 'Para eliminar',
};

export const STATE_VARIANTS: Record<string, 'highlight' | 'success' | 'warning' | 'destructive' | 'default'> = {
  trial: 'highlight',
  active: 'success',
  read_only: 'warning',
  blocked: 'destructive',
  pending_deletion: 'destructive',
};
