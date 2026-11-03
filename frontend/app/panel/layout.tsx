import type { Metadata } from 'next';
import Link from 'next/link';
import { cache, Suspense } from 'react';
import { BrandMark } from '@/components/brand-mark.tsx';
import { Button } from '@/components/ui/button.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { signOutAction } from '@/modules/auth/actions.ts';
import { AccountBanner } from '@/modules/organization/account-banner.tsx';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { PanelNav } from '@/modules/organization/panel-nav.tsx';

// Pantallas privadas o transaccionales: nunca se indexan (además de robots.txt).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Encabezado y barra lateral leen la misma sesión: una sola consulta por pedido.
const loadPanel = cache(() => requireActiveOrganization('/panel'));

// Panel de la inmobiliaria. La sesión se lee dentro de <Suspense> (requisito de cacheComponents):
// el resto de la estructura se sirve al instante.
export default function PanelLayout({ children }: LayoutProps<'/panel'>) {
  return (
    <div className="min-h-dvh">
      <Suspense fallback={<HeaderFallback />}>
        <PanelHeader />
      </Suspense>
      <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10 lg:py-8">
        <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
          <Suspense fallback={null}>
            <PanelSidebar />
          </Suspense>
        </aside>
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function HeaderFallback() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 max-w-7xl items-center px-4 sm:px-6">
        <BrandMark />
      </div>
    </header>
  );
}

async function PanelHeader() {
  const { organization, organizations } = await loadPanel();
  const details = await getOrganizationDetails(organization.id);

  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex min-h-14 max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/panel" aria-label="InmoPanel by C&C, inicio del panel">
            <BrandMark />
          </Link>
          <span className="truncate text-sm text-muted-foreground" title={organization.name}>
            {organization.name}
          </span>
          {organizations.length > 1 && !organization.viaSupport ? (
            <Link href="/seleccionar-inmobiliaria" className="text-xs underline underline-offset-4">
              Cambiar
            </Link>
          ) : null}
        </div>
        <form action={signOutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Salir
          </Button>
        </form>
      </div>
      <AccountBanner organization={organization} trialEndsAt={details?.trial_ends_at ?? null} paidUntil={details?.paid_until ?? null} />
    </header>
  );
}

async function PanelSidebar() {
  const { organization } = await loadPanel();
  return <PanelNav isOwner={organization.isOwner} />;
}
