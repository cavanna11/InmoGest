import type { ReactNode } from 'react';
import { SECTION_ICONS } from '@/modules/panel/icons.ts';

/** Encabezado de una página del panel: ícono de la sección sobre tinte de marca, título y descripción. */
export function PageHeader({
  section,
  title,
  description,
  badge,
}: {
  /** Ruta de la sección bajo /panel ('' es el inicio): define el ícono. */
  section: string;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
}) {
  const Icon = SECTION_ICONS[section];
  return (
    <div className="flex items-start gap-4">
      {Icon ? (
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      ) : null}
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight">
          {title}
          {badge}
        </h1>
        {description ? <p className="mt-1 text-muted-foreground">{description}</p> : null}
      </div>
    </div>
  );
}
