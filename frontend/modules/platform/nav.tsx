'use client';

import { Activity, Building2, LayoutDashboard, Settings, ShieldCheck, Wallet } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils.ts';

const TABS = [
  { href: '/plataforma', label: 'Resumen', Icon: LayoutDashboard },
  { href: '/plataforma/inmobiliarias', label: 'Inmobiliarias', Icon: Building2 },
  { href: '/plataforma/cobranzas', label: 'Cobranzas', Icon: Wallet },
  { href: '/plataforma/actividad', label: 'Actividad', Icon: Activity },
  { href: '/plataforma/equipo', label: 'Equipo', Icon: ShieldCheck },
  { href: '/plataforma/ajustes', label: 'Planes y ajustes', Icon: Settings },
];

export function PlatformTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones de la plataforma" className="overflow-x-auto">
      <ul className="flex gap-1">
        {TABS.map(({ href, label, Icon }) => {
          const current = href === '/plataforma' ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'flex h-9 items-center gap-2 rounded-lg px-3 text-sm whitespace-nowrap transition-colors',
                  current ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-primary-soft hover:text-primary-soft-foreground',
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
