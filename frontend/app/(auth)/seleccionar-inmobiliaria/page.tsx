import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireUser } from '@/lib/auth.ts';
import { listMyOrganizations } from '@/lib/tenant.ts';
import { ACCOUNT_STATE_LABELS } from '@/modules/organization/labels.ts';
import { selectOrganizationAction } from '@/modules/onboarding/actions.ts';

export const metadata: Metadata = { title: 'Elegir inmobiliaria' };

export default function SelectOrganizationPage() {
  return (
    <Card>
      <CardTitle>¿En qué inmobiliaria vas a trabajar?</CardTitle>
      <CardDescription>Podés cambiarla cuando quieras desde el panel.</CardDescription>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
          <OrganizationList />
        </Suspense>
      </div>
    </Card>
  );
}

async function OrganizationList() {
  await requireUser('/seleccionar-inmobiliaria');
  const organizations = await listMyOrganizations();
  if (organizations.length === 0) redirect('/crear-inmobiliaria');

  return (
    <ul className="grid gap-3">
      {organizations.map((org) => (
        <li key={org.id}>
          <form action={selectOrganizationAction} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
            <input type="hidden" name="organizationId" value={org.id} />
            <div className="min-w-0">
              <p className="truncate font-medium">{org.name}</p>
              <p className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{org.role === 'owner' ? 'Dueño' : 'Agente'}</span>
                <Badge variant={org.state === 'blocked' ? 'destructive' : org.state === 'read_only' ? 'warning' : 'default'}>
                  {ACCOUNT_STATE_LABELS[org.state]}
                </Badge>
              </p>
            </div>
            <Button type="submit" size="sm" variant="outline" disabled={org.state === 'blocked' || org.state === 'pending_deletion'}>
              Entrar
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
