'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Check, ChevronDown, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { LogoMark } from '@/components/brand/logo.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible.tsx';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar.tsx';
import { brand } from '@/lib/brand.ts';
import { cn } from '@/lib/utils.ts';
import { applyOrder, isCurrent, navigationGroups, type NavGroup, type NavGroupId, type NavItem } from './navigation.ts';
import { useLocalPreference } from './local-preference.ts';

const ORDER_KEY = 'inmopanel-menu-order';
const FOLDED_KEY = 'inmopanel-menu-folded';

// Plegados por defecto: lo que se usa al configurar la cuenta y después casi nunca.
const DEFAULT_FOLDED: Partial<Record<NavGroupId, boolean>> = { configuracion: true };

/** Menú lateral del panel: grupos plegables, orden propio del trabajo diario y modo compacto (íconos). */
export function AppSidebar({
  organizationName,
  isOwner,
  unreadConversations,
}: {
  organizationName: string;
  isOwner: boolean;
  unreadConversations: number;
}) {
  const pathname = usePathname();
  const { setOpen, setOpenMobile, isMobile } = useSidebar();
  const [order, setOrder] = useLocalPreference<string[]>(ORDER_KEY, []);
  const [folded, setFolded] = useLocalPreference<Partial<Record<NavGroupId, boolean>>>(FOLDED_KEY, DEFAULT_FOLDED);
  const [editing, setEditing] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  const groups = navigationGroups(isOwner).map((group): NavGroup =>
    group.id === 'principal' ? { ...group, items: applyOrder(group.items, order) } : group,
  );
  const principal = groups.find((group) => group.id === 'principal')?.items ?? [];

  function move(index: number, delta: -1 | 1) {
    const next = principal.map((navItem) => navItem.id);
    const target = index + delta;
    const [moved] = next.splice(index, 1);
    if (moved === undefined || target < 0 || target > next.length) return;
    next.splice(target, 0, moved);
    setOrder(next);
    const label = principal[index]?.label ?? '';
    setAnnouncement(`${label}: posición ${target + 1} de ${next.length}.`);
  }

  function startEditing() {
    setOpen(true);
    setEditing(true);
  }

  function closeOnMobile() {
    if (isMobile) setOpenMobile(false);
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip={organizationName}>
              <Link href="/panel" onClick={closeOnMobile}>
                {/* Envuelto: el botón del menú fuerza 16 px a los íconos que son hijos directos. */}
                <span className="grid size-8 shrink-0 place-items-center">
                  <LogoMark className="size-8" />
                </span>
                <span className="grid min-w-0 leading-tight">
                  <span className="truncate font-bold tracking-tight">
                    {brand.product} <span className="ml-0.5 text-xs font-medium text-muted-foreground">by {brand.company}</span>
                  </span>
                  <span className="truncate text-xs text-muted-foreground">{organizationName}</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent role="navigation" aria-label="Secciones del panel">
        {groups.map((group) => {
          if (group.id === 'principal') {
            return (
              <SidebarGroup key={group.id}>
                <SidebarGroupLabel>{editing ? 'Ordená tu menú' : group.title}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((navItem, index) =>
                      editing ? (
                        <ReorderRow
                          key={navItem.id}
                          item={navItem}
                          first={index === 0}
                          last={index === group.items.length - 1}
                          onUp={() => move(index, -1)}
                          onDown={() => move(index, 1)}
                        />
                      ) : (
                        <NavLink
                          key={navItem.id}
                          item={navItem}
                          pathname={pathname}
                          badge={navItem.id === 'conversaciones' ? unreadConversations : 0}
                          onNavigate={closeOnMobile}
                        />
                      ),
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }
          // Un grupo plegado se abre solo si estás en una de sus secciones.
          const containsCurrent = group.items.some((navItem) => isCurrent(navItem.href, pathname));
          const open = containsCurrent || !(folded[group.id] ?? false);
          return (
            <Collapsible
              key={group.id}
              open={open}
              onOpenChange={(value) => setFolded({ ...folded, [group.id]: !value })}
              className="group/collapsible"
            >
              <SidebarGroup>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="w-full">
                    {group.title}
                    <ChevronDown aria-hidden="true" className="ml-auto transition-transform group-data-[state=closed]/collapsible:-rotate-90" />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((navItem) => (
                        <NavLink key={navItem.id} item={navItem} pathname={pathname} badge={0} onNavigate={closeOnMobile} />
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>

      <SidebarFooter>
        <p aria-live="polite" className="sr-only">
          {announcement}
        </p>
        <SidebarMenu>
          {editing ? (
            <>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => setEditing(false)} className="font-medium text-primary">
                  <Check aria-hidden="true" />
                  <span>Listo</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    setOrder(null);
                    setAnnouncement('Se restableció el orden original.');
                  }}
                >
                  <RotateCcw aria-hidden="true" />
                  <span>Restablecer orden</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </>
          ) : (
            <SidebarMenuItem>
              <SidebarMenuButton onClick={startEditing} tooltip="Ordenar menú" className="text-muted-foreground">
                <ArrowUpDown aria-hidden="true" />
                <span>Ordenar menú</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function NavLink({ item, pathname, badge, onNavigate }: { item: NavItem; pathname: string; badge: number; onNavigate: () => void }) {
  const current = isCurrent(item.href, pathname);
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={current} tooltip={item.label}>
        <Link href={item.href} aria-current={current ? 'page' : undefined} onClick={onNavigate}>
          <Icon aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      </SidebarMenuButton>
      {badge > 0 ? (
        <SidebarMenuBadge className="rounded-full bg-highlight text-highlight-foreground">
          {badge > 99 ? '99+' : badge}
          <span className="sr-only"> sin leer</span>
        </SidebarMenuBadge>
      ) : null}
      {item.soon ? <SidebarMenuBadge className="text-[11px] font-semibold text-highlight-soft-foreground">Pronto</SidebarMenuBadge> : null}
    </SidebarMenuItem>
  );
}

function ReorderRow({ item, first, last, onUp, onDown }: { item: NavItem; first: boolean; last: boolean; onUp: () => void; onDown: () => void }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem className="flex items-center gap-1 rounded-md border border-dashed border-sidebar-border px-2 py-1 text-sm">
      <Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      <Button type="button" variant="ghost" size="icon" className={cn('size-10 md:size-8', first && 'opacity-40')} onClick={onUp} aria-disabled={first} aria-label={`Subir ${item.label}`}>
        <ArrowUp aria-hidden="true" />
      </Button>
      <Button type="button" variant="ghost" size="icon" className={cn('size-10 md:size-8', last && 'opacity-40')} onClick={onDown} aria-disabled={last} aria-label={`Bajar ${item.label}`}>
        <ArrowDown aria-hidden="true" />
      </Button>
    </SidebarMenuItem>
  );
}
