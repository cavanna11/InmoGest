import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { cache, Suspense } from 'react';
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar.tsx';
import { Skeleton } from '@/components/ui/skeleton.tsx';
import { getPlatformRole } from '@/lib/platform.ts';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { signOutAction } from '@/modules/auth/actions.ts';
import { getPendingLegalDocuments } from '@/modules/auth/queries.ts';
import { countUnread, syncReminders } from '@/modules/notifications/queries.ts';
import { AccountBanner } from '@/modules/organization/account-banner.tsx';
import { getOrganizationDetails } from '@/modules/organization/queries.ts';
import { AppSidebar } from '@/modules/panel/app-sidebar.tsx';
import { MobileTabBar } from '@/modules/panel/mobile-tab-bar.tsx';
import { PanelProvider } from '@/modules/panel/panel-provider.tsx';
import { GlobalSearch, NewMenu, NotificationsLink, UserMenu } from '@/modules/panel/top-bar.tsx';
import { countUnreadConversations } from '@/modules/whatsapp/queries.ts';

// Pantallas privadas o transaccionales: nunca se indexan (además de robots.txt).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Barra superior, menú lateral y barra inferior leen la misma sesión: una sola consulta por pedido.
const loadPanel = cache(() => requireActiveOrganization('/panel'));
const loadUnreadConversations = cache((organizationId: string) => countUnreadConversations(organizationId));
// Recordatorios de agenda: sin worker se generan al abrir el panel (ADR 0011). Una vez por pedido,
// antes de contar las notificaciones sin leer.
const loadReminders = cache((organizationId: string) => syncReminders(organizationId));

// Panel de la inmobiliaria: menú lateral pegado a la izquierda (compacto o completo), barra superior
// fija con búsqueda y altas rápidas, y en el celular una barra inferior con lo más usado.
// La sesión se lee dentro de <Suspense> (requisito de cacheComponents): la estructura se sirve al instante.
export default function PanelLayout({ children }: LayoutProps<'/panel'>) {
  return (
    <PanelProvider>
      <a
        href="#contenido"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Saltar al contenido
      </a>
      <Suspense fallback={<SidebarFallback />}>
        <PanelSidebar />
      </Suspense>
      <SidebarInset className="min-w-0">
        <Suspense fallback={<HeaderFallback />}>
          <PanelHeader />
        </Suspense>
        <main id="contenido" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-24 outline-none sm:px-6 md:pb-10 lg:px-8 lg:pt-8">
          {children}
        </main>
      </SidebarInset>
      <Suspense fallback={null}>
        <PanelTabBar />
      </Suspense>
    </PanelProvider>
  );
}

function SidebarFallback() {
  return <div aria-hidden="true" className="hidden w-(--sidebar-width) shrink-0 border-r border-sidebar-border bg-sidebar md:block" />;
}

function HeaderFallback() {
  return (
    <div className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-border bg-background px-4 sm:px-6 lg:px-8">
      <Skeleton className="size-9" />
      <Skeleton className="h-9 w-full max-w-sm" />
    </div>
  );
}

async function PanelHeader() {
  const { user, organization, organizations } = await loadPanel();
  // El dueño de una inmobiliaria creada por C&C acepta los términos al primer ingreso.
  // Las consultas son independientes: van en paralelo (async-parallel).
  const checkLegal = organization.isOwner && !organization.viaSupport;
  const [pendingLegal, details, platform, unread] = await Promise.all([
    checkLegal ? getPendingLegalDocuments(user.id) : Promise.resolve([]),
    getOrganizationDetails(organization.id),
    getPlatformRole(),
    loadReminders(organization.id).then(() => countUnread(organization.id)),
  ]);
  if (pendingLegal.length > 0) redirect('/aceptar-terminos');

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
      <div className="flex h-14 items-center gap-2 px-4 sm:px-6 lg:px-8">
        <SidebarTrigger className="-ml-1.5 size-9" />
        <div className="flex min-w-0 flex-1 items-center">
          <GlobalSearch isOwner={organization.isOwner} canWrite={organization.canWrite} />
        </div>
        {organization.canWrite ? <NewMenu /> : null}
        <NotificationsLink unread={unread} />
        <UserMenu
          name={user.fullName || user.email}
          email={user.email}
          canSwitch={organizations.length > 1 && !organization.viaSupport}
          isPlatformAdmin={platform.isAdmin}
          signOut={signOutAction}
        />
      </div>
      <AccountBanner organization={organization} trialEndsAt={details?.trial_ends_at ?? null} paidUntil={details?.paid_until ?? null} />
    </header>
  );
}

async function PanelSidebar() {
  const { organization } = await loadPanel();
  const [, unreadConversations] = await Promise.all([loadReminders(organization.id), loadUnreadConversations(organization.id)]);
  return <AppSidebar organizationName={organization.name} isOwner={organization.isOwner} unreadConversations={unreadConversations} />;
}

async function PanelTabBar() {
  const { organization } = await loadPanel();
  return <MobileTabBar unreadConversations={await loadUnreadConversations(organization.id)} />;
}
