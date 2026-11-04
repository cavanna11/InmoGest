import { formatDate } from '@inmogest/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Input, Select } from '@/components/ui/form-controls.tsx';
import { Alert, Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { createClient } from '@/lib/supabase/server.ts';
import { NewOrganizationForm } from '@/modules/platform/components.tsx';
import { requirePlatformAdmin, STATE_LABELS, STATE_VARIANTS } from '@/modules/platform/guard.ts';

export const metadata = { title: 'Inmobiliarias' };

// Todas las inmobiliarias: alta, búsqueda y filtros (CU-15, F-29).
export default function PlatformOrganizationsPage({ searchParams }: PageProps<'/plataforma/inmobiliarias'>) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Organizations searchParams={searchParams} />
    </Suspense>
  );
}

async function Organizations({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const role = await requirePlatformAdmin('/plataforma/inmobiliarias');
  const params = await searchParams;
  const q = typeof params.q === 'string' ? params.q.trim().toLowerCase() : '';
  const filter = typeof params.estado === 'string' ? params.estado : '';
  const supabase = await createClient();
  const [{ data }, { data: plans }] = await Promise.all([
    supabase.rpc('platform_organizations'),
    supabase.from('plans').select('code, name').eq('is_active', true).order('sort_order'),
  ]);
  const organizations = (data ?? []).filter((organization) => {
    if (filter === 'baja') return Boolean(organization.deleted_at);
    if (organization.deleted_at) return false;
    if (filter && organization.state !== filter) return false;
    return !q || organization.name.toLowerCase().includes(q) || (organization.owner_email ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Inmobiliarias</h1>
      {params.eliminada === '1' ? <Alert variant="success">Inmobiliaria eliminada para siempre, con sus datos y archivos.</Alert> : null}
      {params.eliminada === 'archivos' ? <Alert variant="warning">Eliminamos la inmobiliaria y sus datos, pero algunos archivos no se pudieron borrar de Storage.</Alert> : null}

      {role.isPrincipal ? (
        <Card>
          <details>
            <summary className="cursor-pointer font-semibold text-primary">+ Nueva inmobiliaria</summary>
            <CardDescription>Si el dueño todavía no tiene cuenta, te damos un enlace para mandarle por WhatsApp: elige su contraseña y acepta los términos al entrar.</CardDescription>
            <div className="mt-4">
              <NewOrganizationForm plans={plans ?? []} />
            </div>
          </details>
        </Card>
      ) : null}

      <Card className="p-4 sm:p-4">
        <form role="search" className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_auto]">
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <Input id="q" name="q" type="search" defaultValue={q} placeholder="Nombre o email del dueño" />
          <Select name="estado" aria-label="Estado" defaultValue={filter}>
            <option value="">Todas</option>
            {Object.entries(STATE_LABELS)
              .filter(([value]) => value !== 'pending_deletion')
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            <option value="baja">Dadas de baja</option>
          </Select>
          <Button type="submit" variant="secondary">
            Filtrar
          </Button>
        </form>
      </Card>

      {organizations.length === 0 ? (
        <Card className="text-center">
          <CardTitle>No hay inmobiliarias con esos filtros.</CardTitle>
        </Card>
      ) : (
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
                      <Badge variant={organization.deleted_at ? 'destructive' : STATE_VARIANTS[organization.state]}>
                        {organization.deleted_at ? 'Dada de baja' : organization.suspended_at ? 'Suspendida' : STATE_LABELS[organization.state]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{organization.plan_code}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(organization.paid_until ?? organization.trial_ends_at)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{organization.users_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{organization.properties_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{organization.contacts_count}</td>
                    <td className="px-4 py-3">{organization.pending_payments > 0 ? <Badge variant="warning">{organization.pending_payments} por revisar</Badge> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
