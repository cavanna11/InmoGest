import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils.ts';

// Controles de formulario (estilo shadcn/ui) con tokens semánticos. Los campos usan border-input
// (contraste ≥ 3:1 verificado en styles/tokens.test.ts) y foco visible con el anillo del tema.

const fieldClasses =
  'flex w-full rounded-md border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive sm:text-sm';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" className={cn(fieldClasses, 'h-10 py-2 file:border-0 file:bg-transparent file:text-sm file:font-medium', className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="select" className={cn(fieldClasses, 'h-10 py-2', className)} {...props} />;
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return <label data-slot="label" className={cn('text-sm font-medium leading-none', className)} {...props} />;
}

/** Campo con etiqueta, ayuda y error asociados por aria-describedby. */
export function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** aria-describedby para un campo según tenga ayuda y/o error. */
export function describedBy(id: string, { hint, error }: { hint?: unknown; error?: unknown }) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length > 0 ? ids.join(' ') : undefined;
}
