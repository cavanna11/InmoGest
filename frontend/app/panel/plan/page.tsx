import { formatDate, formatMoney, fromDbNumeric, isCurrency } from '@inmogest/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { createClient } from '@/lib/supabase/server.ts';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { PaymentForm } from '@/modules/billing/components.tsx';
import { PAYMENT_STATUS } from '@/modules/billing/schemas.ts';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { whatsappHref } from '@/components/landing/config.ts';

export const metadata: Metadata = { title: 'Plan y pago' };

const STATE_LABELS: Record<string, string> = {
  trial: 'Prueba gratis',
  active: 'Activa',
  read_only: 'Solo lectura',
  blocked: 'Bloqueada',
  pending_deletion: 'Bloqueada',
};

// Plan, uso de los límites e informe de pago por transferencia (F-26, F-27, F-28, CU-13).
export default function PlanPage() {
  return (
    <div className="grid grid-cols-1 gap-6">
      <PageHeader section="plan" title="Plan y pago" description="Tu plan, cuánto usás de cada límite y el informe de pago." />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Plan />
      </Suspense>
    </div>
  );
}

function Usage({ label, used, limit }: { label: string; used: number; limit: number }) {
  const ratio = limit > 0 ? Math.min(used / limit, 1) : 0;
  return (
    <div className="grid gap-1.5">
      <p className="flex items-center justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-muted-foreground">
          {used} de {limit}
        </span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
        <div className={`h-full ${ratio >= 1 ? 'bg-destructive' : ratio >= 0.8 ? 'bg-highlight' : 'bg-primary'}`} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

async function Plan() {
  const { organization } = await requireActiveOrganization('/panel/plan');
  if (!organization.isOwner) {
    return <Alert variant="warning">Solo el dueño de la inmobiliaria puede ver el plan y los pagos.</Alert>;
  }
  const supabase = await createClient();
  const [details, usage, plans, reports, instructions] = await Promise.all([
    getOrganizationDetails(organization.id),
    supabase.rpc('organization_usage', { p_organization_id: organization.id }),
    supabase.from('plans').select('code, name, reference_price_usd, max_users, max_properties, includes_automations').eq('is_active', true).order('sort_order'),
    supabase.from('payment_reports').select('id, plan_code, months, amount, currency, status, review_note, created_at').eq('organization_id', organization.id).order('created_at', { ascending: false }).limit(20),
    supabase.rpc('payment_instructions'),
  ]);
  const { data: planRow } = await supabase.from('organizations').select('plan_code').eq('id', organization.id).maybeSingle();
  const planCode = planRow?.plan_code ?? 'professional';
  const planList = plans.data ?? [];
  const current = planList.find((plan) => plan.code === planCode);
  const use = usage.data?.[0];
  const planName = new Map(planList.map((plan) => [plan.code, plan.name]));

  return (
    <>
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Plan {current?.name ?? planCode}</CardTitle>
          <Badge variant={organization.state === 'active' ? 'success' : organization.state === 'trial' ? 'highlight' : 'warning'}>{STATE_LABELS[organization.state]}</Badge>
        </div>
        <CardDescription>
          {organization.state === 'trial' && details?.trial_ends_at ? `La prueba gratis termina el ${formatDate(details.trial_ends_at)}.` : null}
          {organization.state === 'active' && details?.paid_until ? `La suscripción está paga hasta el ${formatDate(details.paid_until)}.` : null}
          {organization.state === 'read_only' ? 'La cuenta está en solo lectura: informá un pago para volver a operar. No se pierde ningún dato.' : null}
        </CardDescription>
        {use ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Usage label="Usuarios" used={use.users_used} limit={use.users_limit} />
            <Usage label="Propiedades" used={use.properties_used} limit={use.properties_limit} />
          </div>
        ) : null}
      </Card>

      <section aria-label="Planes">
        <ul className="grid gap-3 sm:grid-cols-3">
          {planList.map((plan) => (
            <li key={plan.code} className={`rounded-lg border p-4 ${plan.code === planCode ? 'border-primary bg-primary-soft/40' : 'border-border bg-surface'}`}>
              <p className="font-semibold">{plan.name}</p>
              <p className="mt-1 text-2xl font-bold text-primary">USD {plan.reference_price_usd}</p>
              <p className="text-xs text-muted-foreground">por mes, precio de referencia</p>
              <ul className="mt-3 grid gap-1 text-sm">
                <li>{plan.max_users} usuarios</li>
                <li>{plan.max_properties} propiedades</li>
                <li>{plan.includes_automations ? 'Con automatizaciones' : 'Sin automatizaciones'}</li>
              </ul>
            </li>
          ))}
        </ul>
      </section>

      <Card>
        <CardTitle>Pagar por transferencia</CardTitle>
        {instructions.data ? (
          <p className="mt-2 rounded-md bg-muted p-3 text-sm whitespace-pre-line">{instructions.data}</p>
        ) : (
          <CardDescription>
            Pedinos los datos para transferir por{' '}
            <a href={whatsappHref('Hola, quiero pagar mi suscripción de InmoPanel. ¿Me pasan los datos para transferir?')} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-4">
              WhatsApp
            </a>
            .
          </CardDescription>
        )}
        <div className="mt-4">
          <PaymentForm organizationId={organization.id} plans={planList} currentPlan={planCode} />
        </div>
      </Card>

      {(reports.data?.length ?? 0) > 0 ? (
        <Card>
          <CardTitle>Pagos informados</CardTitle>
          <ul className="mt-3 grid gap-2">
            {(reports.data ?? []).map((report) => {
              const status = PAYMENT_STATUS[report.status];
              return (
                <li key={report.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                  <span>
                    {formatDate(report.created_at)} · {planName.get(report.plan_code) ?? report.plan_code} · {report.months} {report.months === 1 ? 'mes' : 'meses'} ·{' '}
                    {isCurrency(report.currency) ? formatMoney(fromDbNumeric(report.amount, report.currency)) : report.amount}
                    {report.review_note ? ` · ${report.review_note}` : ''}
                  </span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}
    </>
  );
}
