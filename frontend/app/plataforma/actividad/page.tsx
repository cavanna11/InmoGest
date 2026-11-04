import { formatDateTime } from '@inmogest/shared';
import { Suspense } from 'react';
import { Card, CardDescription } from '@/components/ui/surfaces.tsx';
import { createClient } from '@/lib/supabase/server.ts';
import { requirePlatformAdmin } from '@/modules/platform/guard.ts';

export const metadata = { title: 'Actividad' };

const ACTIONS: Record<string, string> = {
  'organization.platform_updated': 'Cambió plan, prueba o estado',
  'organization.created_by_platform': 'Creó la inmobiliaria',
  'organization.deleted_permanently': 'Eliminó una inmobiliaria para siempre',
  'payment.approved': 'Aprobó un pago',
  'payment.rejected': 'Rechazó un pago',
  'platform_admin.added': 'Sumó a alguien al equipo',
  'platform_admin.removed': 'Quitó a alguien del equipo',
};

// Registro de lo que hizo C&C en la plataforma.
export default function ActivityPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <ActivityList />
    </Suspense>
  );
}

async function ActivityList() {
  await requirePlatformAdmin('/plataforma/actividad');
  const supabase = await createClient();
  const { data } = await supabase.rpc('platform_activity', { p_limit: 150 });
  const items = data ?? [];
  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Actividad</h1>
      <Card>
        {items.length === 0 ? <CardDescription>Todavía no hay actividad.</CardDescription> : null}
        <ol className="grid gap-3 border-l-2 border-primary-soft pl-5">
          {items.map((item) => {
            const deletedName = typeof item.metadata === 'object' && item.metadata && 'name' in item.metadata ? String(item.metadata.name) : null;
            return (
              <li key={item.id} className="relative">
                <span aria-hidden="true" className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full bg-primary" />
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(item.created_at)}
                  {item.actor_email ? ` · ${item.actor_email}` : ''}
                </p>
                <p className="text-sm">
                  {ACTIONS[item.action] ?? item.action}
                  {item.organization_name ?? deletedName ? `: ${item.organization_name ?? deletedName}` : ''}
                </p>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
