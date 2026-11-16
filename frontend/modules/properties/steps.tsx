import { Check } from 'lucide-react';
import { cn } from '@/lib/utils.ts';

export const NEW_PROPERTY_STEPS = ['Datos básicos', 'Fotos', 'Dónde publicarla'] as const;

/** Indicador de los pasos del alta de una propiedad (paso actual: 1, 2 o 3). */
export function PropertySteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label={`Paso ${current} de ${NEW_PROPERTY_STEPS.length}`} className="grid grid-cols-3 gap-2">
      {NEW_PROPERTY_STEPS.map((label, index) => {
        const step = index + 1;
        const done = step < current;
        const active = step === current;
        return (
          <li key={label} aria-current={active ? 'step' : undefined} className="grid gap-1.5">
            <span className={cn('h-1 rounded-full', done || active ? 'bg-primary' : 'bg-muted')} />
            <span className={cn('flex items-center gap-1.5 text-xs font-medium sm:text-sm', active ? 'text-foreground' : 'text-muted-foreground')}>
              {done ? <Check aria-hidden="true" className="size-3.5 text-primary" /> : <span className="tabular-nums">{step}.</span>}
              {label}
              {done ? <span className="sr-only"> (listo)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
