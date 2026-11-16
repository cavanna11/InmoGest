import type { ReactNode } from 'react';
import { GUIDES } from '@/modules/panel/guides.ts';
import { HowItWorks } from '@/modules/panel/how-it-works.tsx';
import { SECTION_ICONS } from '@/modules/panel/icons.ts';

/**
 * Encabezado de una página del panel: ícono de la sección, título, descripción y, si la sección tiene
 * guía, el botón "Ver cómo funciona" con ejemplos de uso.
 */
export function PageHeader({
  section,
  title,
  description,
  badge,
  guide = true,
}: {
  /** Ruta de la sección bajo /panel ('' es el inicio): define el ícono y la guía. */
  section: string;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  /** false para no mostrar "Ver cómo funciona" (por ejemplo, en una ficha). */
  guide?: boolean;
}) {
  const Icon = SECTION_ICONS[section];
  const sectionGuide = guide ? GUIDES[section] : undefined;
  return (
    <div className="flex items-start gap-4">
      {Icon ? (
        <span className="hidden size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-soft-foreground sm:flex">
          <Icon aria-hidden="true" className="size-5" />
        </span>
      ) : null}
      <div className="min-w-0">
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-tight text-balance">
          {title}
          {badge}
        </h1>
        {description ? <p className="mt-1 text-pretty text-muted-foreground">{description}</p> : null}
        {sectionGuide ? <HowItWorks guide={sectionGuide} /> : null}
      </div>
    </div>
  );
}
