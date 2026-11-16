import type { LucideIcon } from 'lucide-react';
import { SECTION_ICONS } from './icons.ts';

// Secciones del panel agrupadas por uso. "Principal" es el trabajo diario (reordenable por cada
// navegador); "Herramientas" y "Configuración" se pliegan. Las secciones en desarrollo llevan a su
// vista previa ("Pronto"): ningún enlace lleva a una página inexistente.

export type NavItem = {
  /** Ruta bajo /panel ('' es el inicio); identifica la sección en el orden guardado. */
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
};

export type NavGroupId = 'principal' | 'herramientas' | 'configuracion';

export type NavGroup = { id: NavGroupId; title: string; items: NavItem[] };

function item(id: string, label: string, soon = false): NavItem {
  return { id, href: id ? `/panel/${id}` : '/panel', label, icon: SECTION_ICONS[id] ?? SECTION_ICONS['']!, soon };
}

export function navigationGroups(isOwner: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      id: 'principal',
      title: 'Principal',
      items: [
        item('', 'Hoy'),
        item('conversaciones', 'WhatsApp'),
        item('propiedades', 'Propiedades'),
        item('contactos', 'Contactos'),
        item('oportunidades', 'Oportunidades'),
        item('agenda', 'Agenda'),
        item('busquedas', 'Búsquedas'),
      ],
    },
    {
      id: 'herramientas',
      title: 'Herramientas',
      items: [...(isOwner ? [item('importar', 'Importar y exportar')] : []), item('automaticos', 'Mensajes automáticos', true)],
    },
    {
      id: 'configuracion',
      title: 'Configuración',
      items: [
        ...(isOwner
          ? [
              item('configuracion', 'Inmobiliaria'),
              item('equipo', 'Equipo'),
              item('whatsapp', 'Conectar WhatsApp'),
              item('integraciones', 'Integraciones'),
              item('plan', 'Plan y pago'),
            ]
          : []),
        item('perfil', 'Mi perfil'),
      ],
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

/** ¿La ruta actual está dentro de esta sección? El inicio solo coincide exacto. */
export function isCurrent(href: string, pathname: string): boolean {
  return href === '/panel' ? pathname === '/panel' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Aplica el orden guardado; las secciones nuevas o desconocidas quedan al final en su orden original. */
export function applyOrder(items: NavItem[], order: string[]): NavItem[] {
  const position = new Map(order.map((id, index) => [id, index]));
  const rank = (navItem: NavItem, index: number) => position.get(navItem.id) ?? order.length + index;
  return items
    .map((navItem, index) => ({ navItem, rank: rank(navItem, index) }))
    .sort((a, b) => a.rank - b.rank)
    .map(({ navItem }) => navItem);
}
