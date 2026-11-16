import { Skeleton } from './skeleton.tsx';

// Esqueletos de carga con la forma de lo que va a aparecer (en lugar de un "Cargando…" suelto):
// el ojo ya ubica dónde va cada cosa y la pantalla no salta al llegar los datos.

type Variant = 'list' | 'cards' | 'detail' | 'board' | 'inbox' | 'form' | 'split';

export function PageSkeleton({ variant, label = 'Cargando…' }: { variant: Variant; label?: string }) {
  return (
    <div role="status" aria-live="polite" className="grid gap-4">
      <span className="sr-only">{label}</span>
      <Body variant={variant} />
    </div>
  );
}

function Rows({ count, className = 'h-14' }: { count: number; className?: string }) {
  return (
    <div className="grid gap-2">
      {Array.from({ length: count }, (_, index) => (
        <Skeleton key={index} className={className} />
      ))}
    </div>
  );
}

function Body({ variant }: { variant: Variant }) {
  switch (variant) {
    case 'list':
      return (
        <>
          <Skeleton className="h-16 rounded-lg" />
          <Rows count={6} />
        </>
      );
    case 'cards':
      return (
        <>
          <Skeleton className="h-16 rounded-lg" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="grid gap-2">
                <Skeleton className="aspect-[4/3] rounded-lg" />
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
              </div>
            ))}
          </div>
        </>
      );
    case 'detail':
      return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="grid content-start gap-4">
            <Skeleton className="h-48 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
          <div className="grid content-start gap-4">
            <Skeleton className="h-32 rounded-lg" />
            <Skeleton className="h-40 rounded-lg" />
          </div>
        </div>
      );
    case 'split':
      return (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Skeleton className="h-80 rounded-lg" />
          <Skeleton className="h-56 rounded-lg" />
        </div>
      );
    case 'board':
      return (
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="grid w-60 shrink-0 content-start gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ))}
        </div>
      );
    case 'inbox':
      return (
        <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
          <Rows count={7} className="h-16" />
          <Skeleton className="hidden h-[28rem] rounded-lg lg:block" />
        </div>
      );
    case 'form':
      return (
        <div className="grid gap-5 rounded-lg border border-border p-5 sm:p-6">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="grid gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10" />
            </div>
          ))}
          <Skeleton className="h-10 w-36" />
        </div>
      );
  }
}
