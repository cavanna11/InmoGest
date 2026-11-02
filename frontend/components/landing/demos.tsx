// Maquetas animadas de flujos del primer lanzamiento (PRD: CU-04, CU-07, F-12, F-16, F-17, F-18, F-23).
// Datos ficticios; no son capturas del sistema. Se reproducen solas en loop (landing.css) y son
// aria-hidden: la descripción accesible es la lista de pasos que las acompaña.
import type { ReactNode } from 'react';

const PHONE = '+54 9 11 5555-0142';

function Chip({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'brand' | 'highlight'; children: ReactNode }) {
  const tones = {
    neutral: 'border border-border bg-background text-muted-foreground',
    success: 'bg-success text-success-foreground',
    brand: 'bg-primary text-primary-foreground',
    highlight: 'bg-highlight text-highlight-foreground',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Window({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-[0_24px_60px_-28px_color-mix(in_oklab,var(--primary)_45%,transparent)]">
      <div className="flex items-center gap-2 border-b border-border bg-muted px-4 py-2.5">
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="size-2.5 rounded-full bg-border" />
        <span className="ml-2 truncate text-xs font-medium text-muted-foreground">{title}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

/** Paso de una línea de tiempo: punto, contenido y aparición en su turno del loop. */
function TimelineStep({ index, label, children }: { index: 1 | 2 | 3 | 4; label: string; children: ReactNode }) {
  return (
    <li className={`ip-step ip-step-${index} relative min-w-0 pl-9`}>
      <span className="absolute left-0 top-1 flex size-6 items-center justify-center rounded-full border-2 border-primary bg-surface text-[11px] font-bold text-primary">
        {index}
      </span>
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="mt-1.5 min-w-0 rounded-lg border border-border bg-background p-3">{children}</div>
    </li>
  );
}

/**
 * Hero: una propiedad nueva encuentra a su cliente (CU-07). Coincidencia con puntaje y motivo según el
 * ejemplo del PRD §6 (3 deseables, cumple 2 → 67 %), aviso al agente y ficha por WhatsApp.
 */
export function OpportunityFlow() {
  return (
    <div className="ip-flow min-w-0" aria-hidden="true">
      <Window title="InmoPanel · Coincidencias">
        <ol className="relative grid min-w-0 gap-4">
          <span className="ip-track absolute left-3 top-3 bottom-3 w-0.5 -translate-x-1/2 bg-primary/30" />
          <TimelineStep index={1} label="Propiedad nueva">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Departamento 3 amb. · Belgrano</p>
                <p className="text-xs text-muted-foreground">PRO-000123 · Venta · USD 98.000</p>
              </div>
              <Chip>Disponible</Chip>
            </div>
          </TimelineStep>
          <TimelineStep index={2} label="Coincide con una búsqueda">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Ana G. busca depto en Belgrano</p>
                <p className="text-xs text-muted-foreground">Cumple los obligatorios · deseables 2 de 3 (falta cochera)</p>
              </div>
              <span className="ip-ping rounded-full">
                <Chip tone="highlight">67 %</Chip>
              </span>
            </div>
          </TimelineStep>
          <TimelineStep index={3} label="Aviso al agente">
            <p className="text-sm">
              <span className="font-semibold">Laura</span>, nueva coincidencia para la búsqueda de Ana G.
            </p>
          </TimelineStep>
          <TimelineStep index={4} label="Ficha por WhatsApp">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 text-sm">Fotos, descripción y link a la página pública</p>
              <Chip tone="success">Enviada</Chip>
            </div>
          </TimelineStep>
        </ol>
      </Window>
    </div>
  );
}

/** Bandeja compartida: un número nuevo escribe, se crea el contacto y el equipo responde (CU-04). */
export function InboxFlow() {
  return (
    <div className="ip-flow min-w-0" aria-hidden="true">
      <Window title="InmoPanel · Bandeja de WhatsApp">
        <div className="grid min-w-0 gap-3">
          <div className="min-w-0 ip-step ip-step-1 flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{PHONE}</p>
              <p className="truncate text-xs text-muted-foreground">Hola, vi el depto de 2 ambientes en Palermo. ¿Sigue disponible?</p>
            </div>
            <Chip>Número nuevo</Chip>
          </div>
          <div className="min-w-0 ip-step ip-step-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
            <p className="min-w-0 truncate text-sm">
              <span className="font-semibold">Contacto creado</span>
              <span className="text-muted-foreground"> · origen WhatsApp</span>
            </p>
            <Chip tone="success">Nuevo</Chip>
          </div>
          <div className="min-w-0 ip-step ip-step-3 flex items-center justify-between gap-2 rounded-lg border border-border bg-background p-3">
            <p className="min-w-0 truncate text-sm">Laura abrió la conversación</p>
            <Chip tone="brand">Asignada a Laura</Chip>
          </div>
          <div className="min-w-0 ip-step ip-step-4 grid gap-1 rounded-lg border border-border bg-background p-3">
            <p className="ml-auto max-w-[90%] rounded-lg rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">
              ¡Sí! ¿Querés visitarlo el sábado a las 11?
            </p>
            <p className="text-right text-[11px] text-muted-foreground">Respondió Martín · 14:32</p>
          </div>
          <div className="ip-typing flex gap-1 px-1" aria-hidden="true">
            <span className="size-1.5 rounded-full bg-muted-foreground" />
            <span className="size-1.5 rounded-full bg-muted-foreground" />
            <span className="size-1.5 rounded-full bg-muted-foreground" />
          </div>
        </div>
      </Window>
    </div>
  );
}
