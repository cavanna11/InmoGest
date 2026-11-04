import { Building2, CircleCheck, Clock, Hourglass, PauseCircle, TrendingUp, Wallet } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { Badge, Card, CardTitle } from '@/components/ui/surfaces.tsx';
import { createClient } from '@/lib/supabase/server.ts';
import { requirePlatformAdmin, STATE_LABELS, STATE_VARIANTS } from '@/modules/platform/guard.ts';

export const metadata = { title: 'Resumen' };

const TONES = {
  brand: 'bg-primary-soft text-primary-soft-foreground',
  warm: 'bg-highlight-soft text-highlight-soft-foreground',
  muted: 'bg-muted text-muted-foreground',
};

function Kpi({ Icon, value, label, hint, tone = 'brand' }: { Icon: LucideIcon; value: string | number; label: string; hint?: string; tone?: keyof typeof TONES }) {
  return (
    <li className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </li>
  );
}

// Resumen del negocio: cuentas por estado, abono de referencia y lo que necesita atención (CU-15).
export default function PlatformSummaryPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Summary />
    </Suspense>
  );
}

async function Summary() {
  await requirePlatformAdmin('/plataforma');
  const supabase = await createClient();
  const [{ data }, { data: plans }] = await Promise.all([
    supabase.rpc('platform_organizations'),
    supabase.from('plans').select('code, reference_price_usd'),
  ]);
  const all = data ?? [];
  const live = all.filter((organization) => !organization.deleted_at);
  const count = (state: string) => live.filter((organization) => organization.state === state).length;
  const prices = new Map((plans ?? []).map((plan) => [plan.code, plan.reference_price_usd]));
  const monthly = live.filter((organization) => organization.state === 'active').reduce((sum, organization) => sum + (prices.get(organization.plan_code) ?? 0), 0);
  const pending = live.reduce((sum, organization) => sum + organization.pending_payments, 0);
  const attention = live.filter((organization) => organization.pending_payments > 0 || organization.state === 'read_only').slice(0, 8);

  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Resumen</h1>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi Icon={Building2} value={live.length} label="Inmobiliarias" />
        <Kpi Icon={CircleCheck} value={count('active')} label="Activas" />
        <Kpi Icon={Hourglass} value={count('trial')} label="En prueba" tone="warm" />
        <Kpi Icon={Clock} value={count('read_only')} label="Solo lectura" tone="warm" />
        <Kpi Icon={PauseCircle} value={count('blocked')} label="Bloqueadas o suspendidas" tone="muted" />
        <Kpi Icon={TrendingUp} value={`USD ${monthly}`} label="Abono mensual" hint="Precio de referencia de las activas" />
        <Kpi Icon={Wallet} value={pending} label="Pagos por revisar" tone={pending > 0 ? 'warm' : 'muted'} />
      </ul>

      <Card>
        <CardTitle>Necesitan atención</CardTitle>
        {attention.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nada pendiente.</p> : null}
        <ul className="mt-3 grid gap-2">
          {attention.map((organization) => (
            <li key={organization.id}>
              <Link href={`/plataforma/${organization.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm hover:bg-primary-soft">
                <span className="font-medium">{organization.name}</span>
                <span className="flex items-center gap-1">
                  {organization.pending_payments > 0 ? <Badge variant="warning">{organization.pending_payments} pago por revisar</Badge> : null}
                  <Badge variant={STATE_VARIANTS[organization.state]}>{STATE_LABELS[organization.state]}</Badge>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
