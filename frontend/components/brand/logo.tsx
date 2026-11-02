import { brand } from '@/lib/brand.ts';
import { cn } from '@/lib/utils.ts';

/**
 * Logo provisorio de InmoPanel (docs/BRAND.md).
 * Concepto: un panel (cuadrado redondeado) con una "P" de trazo continuo —el registro ordenado— y un
 * nodo terracota que se conecta: la coincidencia entre una propiedad y un cliente.
 * Usa los tokens del tema (bg-primary / primary-foreground / highlight), así funciona en claro y oscuro.
 * Las copias estáticas para favicon e íconos (app/icon.svg, app/apple-icon.tsx) repiten la geometría
 * con colores fijos: mantenerlas sincronizadas si cambia.
 */
export const LOGO_PATHS = {
  stem: 'M11 7.5v17',
  bowl: 'M11 7.5h5.75a5.75 5.75 0 0 1 0 11.5H11',
  link: 'M17.25 19l3.4 3.4',
  node: { cx: 22.4, cy: 23.6, r: 2.9 },
} as const;

export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn('size-8 shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path d={LOGO_PATHS.stem} className="stroke-primary-foreground" strokeWidth="3.2" strokeLinecap="round" fill="none" />
      <path d={LOGO_PATHS.bowl} className="stroke-primary-foreground" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d={LOGO_PATHS.link} className="stroke-highlight" strokeWidth="2.2" strokeLinecap="round" fill="none" />
      <circle {...LOGO_PATHS.node} className="fill-highlight" />
    </svg>
  );
}

/** Logo completo: isotipo + "InmoPanel" protagonista + "by C&C" en segundo plano. */
export function Logo({ className, size = 'md', showCompany = true }: { className?: string; size?: 'sm' | 'md' | 'lg'; showCompany?: boolean }) {
  const mark = { sm: 'size-6', md: 'size-8', lg: 'size-10' }[size];
  const word = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }[size];
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={mark} />
      <span className="flex items-baseline gap-1.5">
        <span className={cn('font-bold tracking-tight', word)}>{brand.product}</span>
        {showCompany ? <span className="text-xs font-medium text-muted-foreground">by {brand.company}</span> : null}
      </span>
    </span>
  );
}
