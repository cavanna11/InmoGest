import { formatDateTime } from '@inmogest/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Card } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { markAllReadAction, markReadAction } from '@/modules/notifications/actions.ts';
import { listNotifications } from '@/modules/notifications/queries.ts';

export const metadata: Metadata = { title: 'Notificaciones' };

// Notificaciones dentro del panel (F-23).
export default function NotificationsPage() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader section="notificaciones" title="Notificaciones" description="Lo que necesita tu atención, sin salir del panel." />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Notifications />
      </Suspense>
    </div>
  );
}

async function Notifications() {
  const { organization } = await requireActiveOrganization('/panel/notificaciones');
  const notifications = await listNotifications(organization.id);
  const unread = notifications.filter((item) => !item.read_at).length;

  if (notifications.length === 0) {
    return (
      <Card className="text-center">
        <p className="font-medium">No tenés notificaciones.</p>
        <p className="mt-1 text-sm text-muted-foreground">Te avisamos acá cuando haya una coincidencia nueva o una tarea vencida.</p>
      </Card>
    );
  }

  return (
    <>
      {unread > 0 ? (
        <form action={markAllReadAction}>
          <Button type="submit" variant="outline" size="sm">
            Marcar todas como leídas ({unread})
          </Button>
        </form>
      ) : null}
      <ul className="grid gap-2">
        {notifications.map((item) => (
          <li key={item.id}>
            <form action={markReadAction}>
              <input type="hidden" name="id" value={item.id} />
              {item.link ? <input type="hidden" name="link" value={item.link} /> : null}
              <button
                type="submit"
                className={`grid w-full gap-0.5 rounded-lg border p-4 text-left transition-colors hover:border-primary ${item.read_at ? 'border-border bg-surface' : 'border-highlight/50 bg-highlight-soft/50'}`}
              >
                <span className="flex items-center gap-2 font-medium">
                  {!item.read_at ? <span aria-label="Sin leer" className="size-2 rounded-full bg-highlight" /> : null}
                  {item.title}
                </span>
                {item.body ? <span className="text-sm text-muted-foreground">{item.body}</span> : null}
                <span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
              </button>
            </form>
          </li>
        ))}
      </ul>
    </>
  );
}
