'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils.ts';

type NavItem = { href: string; label: string; soon?: boolean };

// Todas las secciones del primer lanzamiento. Las que están en desarrollo llevan a su vista previa
// ("Próximamente"): ningún enlace lleva a una página inexistente.
function navGroups(isOwner: boolean): Array<{ title: string; items: NavItem[] }> {
  return [
    {
      title: 'General',
      items: [
        { href: '/panel', label: 'Inicio' },
        { href: '/panel/notificaciones', label: 'Notificaciones', soon: true },
      ],
    },
    {
      title: 'Comercial',
      items: [
        { href: '/panel/conversaciones', label: 'Conversaciones', soon: true },
        { href: '/panel/contactos', label: 'Contactos', soon: true },
        { href: '/panel/propiedades', label: 'Propiedades', soon: true },
        { href: '/panel/busquedas', label: 'Búsquedas', soon: true },
        { href: '/panel/oportunidades', label: 'Oportunidades', soon: true },
        { href: '/panel/agenda', label: 'Agenda', soon: true },
      ],
    },
    {
      title: 'Herramientas',
      items: [
        { href: '/panel/importar', label: 'Importar y exportar', soon: true },
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
              { href: '/panel/plan', label: 'Plan y pago', soon: true },
            ]
          : []),
        { href: '/panel/perfil', label: 'Mi perfil' },
      ],
    },
  ];
}

// En celulares, una fila desplazable; desde lg, barra lateral agrupada.
export function PanelNav({ isOwner }: { isOwner: boolean }) {
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
                return (
                  <li key={item.href} className="shrink-0">
                    <Link
                      href={item.href}
                      aria-current={current ? 'page' : undefined}
                      className={cn(
                        'flex h-9 items-center justify-between gap-2 rounded-md px-3 text-sm whitespace-nowrap hover:bg-accent',
                        current ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {item.label}
                      {item.soon ? (
                        <span className="hidden text-[10px] font-medium tracking-wide text-muted-foreground uppercase lg:inline">
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
