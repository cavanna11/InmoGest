import { formatDate, formatMoney, fromDbNumeric, isCurrency } from '@inmogest/shared';
import Link from 'next/link';
import { Suspense } from 'react';
import { Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { createClient } from '@/lib/supabase/server.ts';
import { PAYMENT_STATUS } from '@/modules/billing/schemas.ts';
import { requirePlatformAdmin } from '@/modules/platform/guard.ts';

export const metadata = { title: 'Cobranzas' };

// Pagos informados por todas las inmobiliarias (CU-13). Se aprueban desde la ficha de cada una.
export default function CollectionsPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Collections />
    </Suspense>
  );
}

async function Collections() {
  await requirePlatformAdmin('/plataforma/cobranzas');
  const supabase = await createClient();
  const { data } = await supabase
    .from('payment_reports')
    .select('id, organization_id, plan_code, months, amount, currency, reference, status, created_at, organizations(name)')
    .order('created_at', { ascending: false })
    .limit(100);
  const reports = data ?? [];
  const pending = reports.filter((report) => report.status === 'pending');
  const reviewed = reports.filter((report) => report.status !== 'pending');

  const row = (report: (typeof reports)[number]) => {
    const status = PAYMENT_STATUS[report.status];
    return (
      <li key={report.id}>
        <Link href={`/plataforma/${report.organization_id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm hover:bg-primary-soft">
          <span>
            <span className="font-medium">{report.organizations?.name ?? 'Inmobiliaria'}</span> ·{' '}
            {isCurrency(report.currency) ? formatMoney(fromDbNumeric(report.amount, report.currency)) : report.amount} · plan {report.plan_code} · {report.months}{' '}
            {report.months === 1 ? 'mes' : 'meses'} · {formatDate(report.created_at)}
          </span>
          <Badge variant={status.variant}>{status.label}</Badge>
        </Link>
      </li>
    );
  };

  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Cobranzas</h1>
      <Card>
        <CardTitle>Por revisar ({pending.length})</CardTitle>
        {pending.length === 0 ? <CardDescription>No hay pagos pendientes.</CardDescription> : <ul className="mt-3 grid gap-2">{pending.map(row)}</ul>}
      </Card>
      <Card>
        <CardTitle>Revisados</CardTitle>
        {reviewed.length === 0 ? <CardDescription>Todavía no hay pagos revisados.</CardDescription> : <ul className="mt-3 grid gap-2">{reviewed.map(row)}</ul>}
      </Card>
    </div>
  );
}
