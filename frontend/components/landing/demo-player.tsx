'use client';

// Reproductor de las demostraciones de la landing. Avanza paso a paso una sola vez, cuando la demo
// entra en pantalla; no hay bucles ni scroll-jacking. La lista de pasos en texto siempre está visible,
// así que la animación no es necesaria para entender el flujo.
// Sin JavaScript o con prefers-reduced-motion se ve directamente el estado final.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

const FIRST_STEP_MS = 400;
const STEP_MS = 1100;

const StepContext = createContext(0);

type DemoPlayerProps = {
  title: string;
  steps: string[];
  note?: string;
  /** `split`: maqueta y pasos lado a lado en pantallas anchas. `stacked`: siempre uno debajo del otro. */
  layout?: 'split' | 'stacked';
  children: ReactNode;
};

export function DemoPlayer({ title, steps, note, layout = 'split', children }: DemoPlayerProps) {
  const total = steps.length;
  const [step, setStep] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const play = useCallback(() => {
    window.clearTimeout(timer.current);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(total);
      return;
    }
    setStep(0);
    const advance = (next: number) => {
      setStep(next);
      if (next < total) timer.current = window.setTimeout(() => advance(next + 1), STEP_MS);
    };
    timer.current = window.setTimeout(() => advance(1), FIRST_STEP_MS);
  }, [total]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          play();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer.current);
    };
  }, [play]);

  const finished = step >= total;

  return (
    <figure ref={rootRef} className="rounded-xl border border-border bg-surface text-surface-foreground shadow-sm">
      {/* Sin JavaScript no hay reproductor: se muestra todo. */}
      <noscript dangerouslySetInnerHTML={{ __html: '<style>[data-demo-item]{opacity:1!important;translate:none!important}[data-demo-before]{opacity:0!important}</style>' }} />
      <figcaption className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <span className="text-sm font-semibold">{title}</span>
        <span className="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
          Ilustrativo · datos ficticios
        </span>
      </figcaption>
      <div className={layout === 'split' ? 'grid grid-cols-1 lg:grid-cols-[1.15fr_1fr]' : 'grid grid-cols-1'}>
        <div
          aria-hidden="true"
          className={`bg-muted/60 p-4 ${layout === 'split' ? 'border-b border-border lg:border-r lg:border-b-0' : 'border-b border-border'}`}
        >
          <StepContext value={step}>{children}</StepContext>
        </div>
        <div className="flex flex-col gap-3 p-4">
          <ol className="flex flex-col gap-2.5 text-sm">
            {steps.map((text, i) => {
              const n = i + 1;
              const done = step >= n;
              return (
                <li key={text} className="flex gap-3" aria-current={step === n ? 'step' : undefined}>
                  <span
                    className={`mt-px flex size-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors duration-300 ${
                      done ? 'border-primary bg-primary text-primary-foreground' : 'border-input text-muted-foreground'
                    }`}
                  >
                    {n}
                  </span>
                  <span className={done ? 'text-foreground' : 'text-muted-foreground'}>{text}</span>
                </li>
              );
            })}
          </ol>
          {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
          <div className="mt-auto pt-1">
            <button
              type="button"
              onClick={play}
              disabled={!finished}
              className="rounded-md text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Ver de nuevo
            </button>
          </div>
        </div>
      </div>
    </figure>
  );
}

const hidden = 'opacity-0 translate-y-2';
const shown = 'opacity-100 translate-y-0';
const motion = 'transition duration-300 ease-out motion-reduce:transition-none motion-reduce:translate-y-0 motion-reduce:opacity-100';

/** Elemento de la maqueta que aparece en el paso `at` y queda visible. Reserva su lugar: no mueve el resto. */
export function DemoItem({ at, className = '', children }: { at: number; className?: string; children: ReactNode }) {
  const step = useContext(StepContext);
  return (
    <div data-demo-item className={`${motion} ${step >= at ? shown : hidden} ${className}`}>
      {children}
    </div>
  );
}

/** Reemplaza `before` por `after` en el paso `at`, en el mismo lugar (por ejemplo, un cambio de estado). */
export function DemoSwap({ at, before, after }: { at: number; before: ReactNode; after: ReactNode }) {
  const step = useContext(StepContext);
  const swapped = step >= at;
  return (
    <span className="inline-grid">
      <span
        data-demo-before
        className={`col-start-1 row-start-1 transition-opacity duration-300 motion-reduce:transition-none motion-reduce:opacity-0 ${swapped ? 'opacity-0' : 'opacity-100'}`}
      >
        {before}
      </span>
      <span
        data-demo-item
        className={`col-start-1 row-start-1 transition-opacity duration-300 motion-reduce:transition-none motion-reduce:opacity-100 ${swapped ? 'opacity-100' : 'opacity-0'}`}
      >
        {after}
      </span>
    </span>
  );
}
