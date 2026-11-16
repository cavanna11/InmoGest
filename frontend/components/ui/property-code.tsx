import { cn } from '@/lib/utils.ts';

/**
 * Código de una propiedad (PRO-000031) con forma de llavero: como las llaves numeradas de una
 * inmobiliaria. Es el elemento propio del panel para reconocer una propiedad de un vistazo.
 */
export function PropertyCode({ code, className }: { code: string | null; className?: string }) {
  if (!code) return null;
  return (
    <span
      translate="no"
      className={cn(
        'relative inline-flex items-center rounded-l-sm rounded-r-full border border-primary/35 bg-primary-soft py-px pr-2 pl-3.5 font-mono text-[11px] leading-4 font-medium whitespace-nowrap text-primary-soft-foreground tabular-nums',
        'before:absolute before:top-1/2 before:left-1 before:size-1.5 before:-translate-y-1/2 before:rounded-full before:border before:border-current before:content-[""]',
        className,
      )}
    >
      {code}
    </span>
  );
}
