'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils.ts';
import { SECTION_ICONS } from '@/modules/panel/icons.ts';

type NavItem = { href: string; label: string; soon?: boolean };

// Todas las secciones del primer lanzamiento. Las que están en desarrollo llevan a su vista previa
// ("Próximamente"): ningún enlace lleva a una página inexistente.
function navGroups(isOwner: boolean): Array<{ title: string; items: NavItem[] }> {
  return [
    {
      title: 'General',
      items: [
        { href: '/panel', label: 'Inicio' },
        { href: '/panel/notificaciones', label: 'Notificaciones' },
      ],
    },
    {
      title: 'Comercial',
      items: [
        { href: '/panel/conversaciones', label: 'Conversaciones', soon: true },
        { href: '/panel/contactos', label: 'Contactos' },
        { href: '/panel/propiedades', label: 'Propiedades' },
        { href: '/panel/busquedas', label: 'Búsquedas' },
        { href: '/panel/oportunidades', label: 'Oportunidades' },
        { href: '/panel/agenda', label: 'Agenda' },
      ],
    },
    {
      title: 'Herramientas',
      items: [
        ...(isOwner ? [{ href: '/panel/importar', label: 'Importar y exportar' }] : []),
        { href: '/panel/automaticos', label: 'Mensajes automáticos', soon: true },
      ],
    },
    {
      title: 'Configuración',
      items: [
        ...(isOwner
          ? [
              { href: '/panel/configuracion', label: 'Inmobiliaria' },
              { href: '/panel/equipo', label: 'Equipo' },
              { href: '/panel/whatsapp', label: 'WhatsApp', soon: true },
              { href: '/panel/plan', label: 'Plan y pago' },
            ]
          : []),
        { href: '/panel/perfil', label: 'Mi perfil' },
      ],
    },
  ];
}

// En celulares, una fila desplazable; desde lg, barra lateral agrupada.
export function PanelNav({ isOwner, unread = 0 }: { isOwner: boolean; unread?: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Secciones del panel" className="overflow-x-auto lg:overflow-visible">
      <div className="flex gap-1 lg:grid lg:gap-5">
        {navGroups(isOwner).map((group) => (
          <div key={group.title} className="contents lg:block">
            <p className="hidden px-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:block">
              {group.title}
            </p>
            <ul className="contents lg:grid lg:gap-0.5">
              {group.items.map((item) => {
                const current = item.href === '/panel' ? pathname === '/panel' : pathname.startsWith(item.href);
                const Icon = SECTION_ICONS[item.href.replace(/^\/panel\/?/, '')];
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'group flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm whitespace-nowrap transition-colors',
                        current
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground hover:bg-primary-soft hover:text-primary-soft-foreground',
                      )}
                    >
                      {Icon ? (
                        <Icon aria-hidden="true" className={cn('size-4 shrink-0', current ? '' : 'text-primary')} />
                      ) : null}
                      <span className="flex-1">{item.label}</span>
                      {item.href === '/panel/notificaciones' && unread > 0 ? (
                        <span
                          aria-label={`${unread} sin leer`}
                          className="rounded-full bg-highlight px-1.5 py-px text-[10px] font-bold text-highlight-foreground"
                        >
                          {unread > 99 ? '99+' : unread}
                        </span>
                      ) : null}
                      {item.soon ? (
                        <span
                          className={cn(
                            'hidden rounded-full px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase lg:inline',
                            current ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-highlight-soft text-highlight-soft-foreground',
                          )}
                        >
                          Pronto
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
