'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSidebar } from '@/components/ui/sidebar.tsx';
import { cn } from '@/lib/utils.ts';
import { SECTION_ICONS } from './icons.ts';
import { isCurrent } from './navigation.ts';

// En el celular, lo más usado queda siempre a mano en la barra inferior; "Más" abre el menú completo.
const TABS = [
  { id: '', label: 'Hoy' },
  { id: 'conversaciones', label: 'WhatsApp' },
  { id: 'propiedades', label: 'Propiedades' },
  { id: 'contactos', label: 'Contactos' },
] as const;

export function MobileTabBar({ unreadConversations }: { unreadConversations: number }) {
  const pathname = usePathname();
  const { setOpenMobile, openMobile } = useSidebar();
  return (
    <nav
      aria-label="Accesos rápidos"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ id, label }) => {
          const href = id ? `/panel/${id}` : '/panel';
          const current = isCurrent(href, pathname);
          const Icon = SECTION_ICONS[id] ?? Menu;
          const badge = id === 'conversaciones' ? unreadConversations : 0;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  current ? 'text-primary' : 'text-muted-foreground',
                )}
              >
                <span className="relative">
                  <Icon aria-hidden="true" className="size-5" />
                  {badge > 0 ? (
                    <span aria-hidden="true" className="absolute -top-1.5 -right-2.5 grid h-4 min-w-4 place-items-center rounded-full bg-highlight px-1 text-[10px] leading-none font-bold text-highlight-foreground">
                      {badge > 99 ? '99+' : badge}
                    </span>
                  ) : null}
                </span>
                {label}
                {badge > 0 ? <span className="sr-only">, {badge} sin leer</span> : null}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => setOpenMobile(true)}
            aria-expanded={openMobile}
            className="flex h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-muted-foreground"
          >
            <Menu aria-hidden="true" className="size-5" />
            Más
          </button>
        </li>
      </ul>
    </nav>
  );
}
