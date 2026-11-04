import { formatDate, formatMoney, fromDbNumeric, isCurrency } from '@inmogest/shared';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmSubmit } from '@/components/ui/confirm-dialog.tsx';
import { Input, Select } from '@/components/ui/form-controls.tsx';
import { Alert, Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { createClient } from '@/lib/supabase/server.ts';
import { PAYMENT_STATUS } from '@/modules/billing/schemas.ts';
import { changePlanAction, enterAsAction, extendTrialAction, reviewPaymentAction, setSuspendedAction } from '@/modules/platform/actions.ts';
import { DeleteForeverForm, OwnerLinkForm } from '@/modules/platform/components.tsx';
import { setDeletedAction } from '@/modules/platform/create-actions.ts';
import { requirePlatformAdmin, STATE_LABELS, STATE_VARIANTS } from '@/modules/platform/guard.ts';

export const metadata = { title: 'Inmobiliaria' };

// Ficha de una inmobiliaria para C&C (CU-13, CU-15, CU-16): pagos, plan, prueba, suspensión e
// «Ingresar como». Las acciones son del superadministrador principal; la base lo verifica.
export default async function PlatformOrganizationPage({ params, searchParams }: PageProps<'/plataforma/[id]'>) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const role = await requirePlatformAdmin(`/plataforma/${id}`);
  const { error } = await searchParams;
  const supabase = await createClient();
  const [{ data: organizations }, { data: plans }, { data: reports }] = await Promise.all([
    supabase.rpc('platform_organizations'),
    supabase.from('plans').select('code, name').order('sort_order'),
    supabase.from('payment_reports').select('id, plan_code, months, amount, currency, reference, receipt_path, status, review_note, created_at').eq('organization_id', id).order('created_at', { ascending: false }).limit(50),
  ]);
  const organization = organizations?.find((item) => item.id === id);
  if (!organization) notFound();

  const receipts = new Map<string, string>();
  for (const report of reports ?? []) {
    if (report.receipt_path) {
      const { data } = await supabase.storage.from('payment-receipts').createSignedUrl(report.receipt_path, 600);
      if (data) receipts.set(report.id, data.signedUrl);
    }
  }
  const can = role.isPrincipal;
  const hidden = <input type="hidden" name="organizationId" value={id} />;
  const suspendFormId = 'suspend-form';
  const enterFormId = 'enter-form';
  const softDeleteFormId = 'soft-delete-form';

  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/plataforma/inmobiliarias" className="text-sm text-muted-foreground hover:text-foreground">
        ← Inmobiliarias
      </Link>
      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {organization.name}
          <Badge variant={organization.deleted_at ? 'destructive' : STATE_VARIANTS[organization.state]}>
            {organization.deleted_at ? 'Dada de baja' : organization.suspended_at ? 'Suspendida' : STATE_LABELS[organization.state]}
          </Badge>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {organization.owner_email ?? 'Sin dueño activo'} · alta el {formatDate(organization.created_at)} · prueba hasta el {formatDate(organization.trial_ends_at)}
          {organization.paid_until ? ` · pagada hasta el ${formatDate(organization.paid_until)}` : ''}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {organization.users_count} usuarios · {organization.properties_count} propiedades · {organization.contacts_count} contactos
        </p>
      </div>
      {error ? <Alert variant="destructive">No se pudo completar la acción. Recargá la página y probá de nuevo.</Alert> : null}
      {!can ? <Alert>Solo el superadministrador principal puede hacer cambios.</Alert> : null}

      <Card>
        <CardTitle>Pagos informados</CardTitle>
        {(reports?.length ?? 0) === 0 ? <CardDescription>Todavía no informó pagos.</CardDescription> : null}
        <ul className="mt-3 grid gap-3">
          {(reports ?? []).map((report) => {
            const status = PAYMENT_STATUS[report.status];
            const receipt = receipts.get(report.id);
            return (
              <li key={report.id} className="grid gap-2 rounded-md border border-border p-3 text-sm">
                <p className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {isCurrency(report.currency) ? formatMoney(fromDbNumeric(report.amount, report.currency)) : report.amount} · plan {report.plan_code} · {report.months} {report.months === 1 ? 'mes' : 'meses'}
                  </span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  Informado el {formatDate(report.created_at)}
                  {report.reference ? ` · ${report.reference}` : ''}
                  {report.review_note ? ` · ${report.review_note}` : ''}
                </p>
                {receipt ? (
                  <a href={receipt} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary underline underline-offset-4">
                    Ver comprobante
                  </a>
                ) : null}
                {can && report.status === 'pending' ? (
                  <form action={reviewPaymentAction} className="flex flex-wrap items-center gap-2">
                    {hidden}
                    <input type="hidden" name="reportId" value={report.id} />
                    <label htmlFor={`note-${report.id}`} className="sr-only">
                      Nota
                    </label>
                    <Input id={`note-${report.id}`} name="note" placeholder="Nota (opcional)" maxLength={500} className="h-9 max-w-xs" />
                    <Button type="submit" name="decision" value="approve" size="sm">
                      Aprobar y activar
                    </Button>
                    <Button type="submit" name="decision" value="reject" variant="outline" size="sm">
                      Rechazar
                    </Button>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {can ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardTitle>Plan</CardTitle>
            <form action={changePlanAction} className="mt-3 flex gap-2">
              {hidden}
              <label htmlFor="planCode" className="sr-only">
                Plan
              </label>
              <Select id="planCode" name="planCode" defaultValue={organization.plan_code}>
                {(plans ?? []).map((plan) => (
                  <option key={plan.code} value={plan.code}>
                    {plan.name}
                  </option>
                ))}
              </Select>
              <Button type="submit" variant="outline">
                Cambiar
              </Button>
            </form>
          </Card>
          <Card>
            <CardTitle>Extender la prueba</CardTitle>
            <form action={extendTrialAction} className="mt-3 flex gap-2">
              {hidden}
              <label htmlFor="days" className="sr-only">
                Días
              </label>
              <Input id="days" name="days" inputMode="numeric" defaultValue="14" />
              <Button type="submit" variant="outline">
                Sumar días
              </Button>
            </form>
          </Card>
          <Card>
            <CardTitle>Suspensión</CardTitle>
            <CardDescription>Una cuenta suspendida no puede ingresar. Sus datos se conservan.</CardDescription>
            <form id={suspendFormId} action={setSuspendedAction} className="mt-3">
              {hidden}
              <input type="hidden" name="suspend" value={organization.suspended_at ? '0' : '1'} />
              <ConfirmSubmit
                formId={suspendFormId}
                title={organization.suspended_at ? '¿Reactivar la cuenta?' : '¿Suspender la cuenta?'}
                description={organization.suspended_at ? 'Sus usuarios vuelven a poder ingresar.' : 'Nadie de la inmobiliaria va a poder ingresar hasta que la reactives.'}
                confirmLabel={organization.suspended_at ? 'Reactivar' : 'Suspender'}
                trigger={organization.suspended_at ? 'Reactivar' : 'Suspender'}
                destructive={!organization.suspended_at}
              />
            </form>
          </Card>
          <Card>
            <CardTitle>Ingresar como</CardTitle>
            <CardDescription>Entrás al panel de esta inmobiliaria con acceso total. Queda registrado y la pantalla lo indica siempre.</CardDescription>
            <form id={enterFormId} action={enterAsAction} className="mt-3">
              {hidden}
              <ConfirmSubmit
                formId={enterFormId}
                title={`¿Ingresar a ${organization.name}?`}
                description="Vas a ver y poder modificar todos sus datos. Cuando termines, salí del contexto desde la franja superior."
                confirmLabel="Ingresar"
                trigger="Ingresar como soporte"
                triggerVariant="default"
              />
            </form>
          </Card>
          <Card>
            <CardTitle>Acceso del dueño</CardTitle>
            <CardDescription>Enlace de un solo uso para el primer ingreso o una contraseña olvidada. Mandáselo por WhatsApp.</CardDescription>
            <div className="mt-3">
              <OwnerLinkForm organizationId={id} />
            </div>
          </Card>
          <Card className="border-destructive/50">
            <CardTitle>Eliminar la cuenta</CardTitle>
            {organization.deleted_at ? (
              <>
                <CardDescription>Dada de baja el {formatDate(organization.deleted_at)}. Podés restaurarla con todos sus datos o eliminarla para siempre: eso no se puede deshacer.</CardDescription>
                <form action={setDeletedAction} className="mt-3">
                  {hidden}
                  <input type="hidden" name="deleted" value="0" />
                  <Button type="submit" variant="outline" size="sm">
                    Restaurar
                  </Button>
                </form>
                <div className="mt-4">
                  <DeleteForeverForm organizationId={id} name={organization.name} />
                </div>
              </>
            ) : (
              <>
                <CardDescription>Primero se da de baja: nadie puede entrar y los datos se conservan. Después podés restaurarla o eliminarla para siempre.</CardDescription>
                <form id={softDeleteFormId} action={setDeletedAction} className="mt-3">
                  {hidden}
                  <input type="hidden" name="deleted" value="1" />
                  <ConfirmSubmit
                    formId={softDeleteFormId}
                    title={`¿Dar de baja ${organization.name}?`}
                    description="Nadie de la inmobiliaria va a poder ingresar y su página pública deja de verse. Los datos se conservan hasta que la restaures o la elimines."
                    confirmLabel="Dar de baja"
                    trigger="Dar de baja"
                    destructive
                  />
                </form>
              </>
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
