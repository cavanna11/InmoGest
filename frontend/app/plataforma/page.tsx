import { formatDate } from '@inmogest/shared';
import Link from 'next/link';
import { Badge, Card } from '@/components/ui/surfaces.tsx';
import { createClient } from '@/lib/supabase/server.ts';
import { requirePlatformAdmin, STATE_LABELS, STATE_VARIANTS } from '@/modules/platform/guard.ts';

export const metadata = { title: 'Inmobiliarias' };

// Todas las inmobiliarias con su estado, plan, uso y pagos pendientes (CU-15, F-29).
export default async function PlatformPage() {
  await requirePlatformAdmin('/plataforma');
  const supabase = await createClient();
  const { data } = await supabase.rpc('platform_organizations');
  const organizations = data ?? [];
  const pending = organizations.reduce((sum, organization) => sum + organization.pending_payments, 0);

  return (
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inmobiliarias</h1>
        <p className="mt-1 text-muted-foreground">
          {organizations.length} en total{pending > 0 ? ` · ${pending} ${pending === 1 ? 'pago pendiente' : 'pagos pendientes'} de revisar` : ''}.
        </p>
      </div>
      <Card className="overflow-hidden p-0 sm:p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <caption className="sr-only">Inmobiliarias de la plataforma</caption>
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Inmobiliaria</th>
                <th scope="col" className="px-4 py-3 font-medium">Estado</th>
                <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                <th scope="col" className="px-4 py-3 font-medium">Vence</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Usuarios</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Propiedades</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Contactos</th>
                <th scope="col" className="px-4 py-3 font-medium">Pagos</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((organization) => (
                <tr key={organization.id} className="border-t border-border hover:bg-primary-soft/40">
                  <td className="px-4 py-3">
                    <Link href={`/plataforma/${organization.id}`} className="font-medium hover:text-primary hover:underline">
                      {organization.name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">{organization.owner_email ?? 'Sin dueño activo'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={STATE_VARIANTS[organization.state]}>{STATE_LABELS[organization.state]}</Badge>
                  </td>
                  <td className="px-4 py-3">{organization.plan_code}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(organization.paid_until ?? organization.trial_ends_at)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{organization.users_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{organization.properties_count}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{organization.contacts_count}</td>
                  <td className="px-4 py-3">{organization.pending_payments > 0 ? <Badge variant="warning">{organization.pending_payments} pendiente</Badge> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
