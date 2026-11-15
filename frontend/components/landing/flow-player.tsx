'use client';

// Reproduce una maqueta animada una sola vez, cuando entra en pantalla, y la deja en su estado final
// (WCAG 2.2.2: nada se mueve solo por más de 5 s). "Ver de nuevo" la repite a pedido.
// Las animaciones viven en landing.css. Sin JavaScript o con prefers-reduced-motion se ve el estado
// final directamente: el ocultamiento previo solo aplica con `@media (scripting: enabled)`.

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function FlowPlayer({ description, children }: { description: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          setRun(1);
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <figure className="min-w-0">
      {/* `key` remonta la maqueta para reiniciar las animaciones CSS. */}
      <div key={run} ref={ref} className="ip-flow min-w-0" data-state={run > 0 ? 'playing' : 'idle'} aria-hidden="true">
        {children}
      </div>
      <figcaption className="mt-3 flex items-center justify-center gap-3 text-xs text-muted-foreground">
        <span className="sr-only">{description} </span>
        <span>Ilustrativo · datos ficticios</span>
        <span aria-hidden="true">·</span>
        <button
          type="button"
          onClick={() => setRun((n) => n + 1)}
          disabled={run === 0}
          className="inline-flex min-h-6 items-center rounded-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
        >
          Ver de nuevo
        </button>
      </figcaption>
    </figure>
  );
}
