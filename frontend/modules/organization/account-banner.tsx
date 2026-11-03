import { formatDate } from '@inmogest/shared';
import type { ActiveOrganization } from '@/lib/tenant.ts';
import { endSupportSessionAction } from './support-actions.ts';

/**
 * Aviso permanente del estado de la cuenta (F-27) y de la sesión de soporte (ADR 0003: la interfaz
 * muestra siempre en qué inmobiliaria se está operando).
 */
export function AccountBanner({
  organization,
  trialEndsAt,
  paidUntil,
}: {
  organization: ActiveOrganization;
  trialEndsAt: string | null;
  paidUntil: string | null;
}) {
  if (organization.viaSupport) {
    return (
      <Banner tone="warning">
        <span>
          Estás operando como soporte de C&amp;C en <strong>{organization.name}</strong>.
        </span>
        <form action={endSupportSessionAction}>
          <button type="submit" className="font-medium underline underline-offset-4">
            Salir del contexto
          </button>
        </form>
      </Banner>
    );
  }
  switch (organization.state) {
    case 'trial': {
      if (!trialEndsAt) return null;
      const days = daysUntil(trialEndsAt);
      return (
        <Banner tone="info">
          Prueba gratis: {days === 1 ? 'queda 1 día' : `quedan ${days} días`} (hasta el {formatDate(trialEndsAt)}).
        </Banner>
      );
    }
    case 'read_only':
      return (
        <Banner tone="warning">
          La cuenta está en <strong>solo lectura</strong>
          {paidUntil ? ` (la suscripción venció el ${formatDate(paidUntil)})` : trialEndsAt ? ` (la prueba venció el ${formatDate(trialEndsAt)})` : ''}:
          podés consultar tus datos, pero no modificarlos. Para volver a operar hay que activar una suscripción.
        </Banner>
      );
    case 'blocked':
    case 'pending_deletion':
      return (
        <Banner tone="destructive">
          La cuenta está <strong>bloqueada</strong>. Los datos se conservan; comunicate con C&amp;C para reactivarla.
        </Banner>
      );
    default:
      return null;
  }
}

// Fuera del componente: la hora actual no es parte del render (regla de pureza de React).
function daysUntil(date: string): number {
  return Math.max(0, Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000));
}

function Banner({ tone, children }: { tone: 'info' | 'warning' | 'destructive'; children: React.ReactNode }) {
  const toneClass = {
    info: 'border-border bg-muted',
    warning: 'border-warning bg-background',
    destructive: 'border-destructive bg-background',
  }[tone];
  return (
    <div role={tone === 'info' ? 'status' : 'alert'} className={`border-t ${toneClass}`}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-sm sm:px-6">
        {children}
      </div>
    </div>
  );
}
