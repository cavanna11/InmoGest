// Maquetas de las demostraciones. Representan flujos P0 del PRD (CU-04, CU-07, F-16/F-17, F-12) con
// datos ficticios; no son capturas del sistema. Si un flujo cambia en el PRD, actualizar acá también.

import type { ReactNode } from 'react';
import { DemoItem, DemoPlayer, DemoSwap } from './demo-player.tsx';

const PHONE = '+54 9 11 5555-0142';

function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'success' | 'warning'; children: ReactNode }) {
  const tones = {
    neutral: 'border border-border bg-background text-muted-foreground',
    success: 'bg-success text-success-foreground',
    warning: 'bg-warning text-warning-foreground',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3 shadow-xs">
      <p className="mb-2 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      {children}
    </div>
  );
}

function Incoming({ children }: { children: ReactNode }) {
  return <p className="max-w-[85%] rounded-lg rounded-tl-sm bg-muted px-3 py-2 text-sm">{children}</p>;
}

function Outgoing({ children, meta }: { children: ReactNode; meta: ReactNode }) {
  return (
    <div className="ml-auto flex max-w-[85%] flex-col items-end gap-1">
      <p className="rounded-lg rounded-tr-sm bg-primary px-3 py-2 text-sm text-primary-foreground">{children}</p>
      <p className="text-[11px] text-muted-foreground">{meta}</p>
    </div>
  );
}

/** CU-04 / F-17: un número nuevo escribe y se crea el contacto. */
export function NewContactDemo({ layout }: { layout?: 'split' | 'stacked' }) {
  return (
    <DemoPlayer
      layout={layout}
      title="Entra una consulta por WhatsApp"
      steps={[
        'Un número nuevo le escribe al WhatsApp de la inmobiliaria.',
        'InmoPanel crea el contacto con el teléfono en formato internacional.',
        'La conversación entra a la bandeja compartida, sin asignar.',
      ]}
      note="Si el número ya está en un contacto, la conversación se vincula a ese contacto y no se crea otro."
    >
      <div className="flex flex-col gap-3">
        <DemoItem at={1}>
          <Panel label="WhatsApp">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-xs font-medium">{PHONE}</span>
              <Badge>Número nuevo</Badge>
            </div>
            <Incoming>Hola, vi el departamento de 2 ambientes en Palermo. ¿Sigue disponible?</Incoming>
          </Panel>
        </DemoItem>
        <DemoItem at={2}>
          <Panel label="Contactos">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{PHONE}</p>
                <p className="text-xs text-muted-foreground">Origen: WhatsApp · Interesado</p>
              </div>
              <Badge tone="success">Contacto creado</Badge>
            </div>
          </Panel>
        </DemoItem>
        <DemoItem at={3}>
          <Panel label="Bandeja">
            <div className="flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-sm">
                <span className="font-medium">{PHONE}</span>
                <span className="text-muted-foreground"> · ¿Sigue disponible?</span>
              </p>
              <Badge>Sin asignar</Badge>
            </div>
          </Panel>
        </DemoItem>
      </div>
    </DemoPlayer>
  );
}

/** CU-04 / F-16: asignación al abrir y registro de quién respondió. */
export function TeamReplyDemo() {
  return (
    <DemoPlayer
      title="El equipo responde"
      steps={[
        'Laura abre la conversación sin asignar y queda asignada.',
        'Martín, otro agente, responde igual: cualquiera del equipo puede hacerlo.',
        'Queda registrado quién respondió, en qué conversación y cuándo.',
      ]}
    >
      <div className="flex flex-col gap-3">
        <Panel label="Conversación">
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs font-medium">{PHONE}</span>
            <DemoSwap at={1} before={<Badge>Sin asignar</Badge>} after={<Badge>Asignada a Laura</Badge>} />
          </div>
          <div className="flex flex-col gap-2">
            <Incoming>¿Puedo visitarlo el sábado a la mañana?</Incoming>
            <DemoItem at={2}>
              <Outgoing meta="Respondió Martín · 14:32">Sí, el sábado a las 11 h está disponible. ¿Te lo agendo?</Outgoing>
            </DemoItem>
          </div>
        </Panel>
        <DemoItem at={3}>
          <Panel label="Historial del contacto">
            <p className="text-sm">
              <span className="font-medium">Martín</span> respondió en la conversación de WhatsApp
            </p>
            <p className="text-xs text-muted-foreground">01/11/2026 14:32</p>
          </Panel>
        </DemoItem>
      </div>
    </DemoPlayer>
  );
}

/** CU-07 / F-12: matching con puntaje, motivo y "superior al presupuesto" (ejemplo del PRD §6). */
export function MatchingDemo() {
  return (
    <DemoPlayer
      title="Una propiedad nueva encuentra a su cliente"
      steps={[
        'Se carga una propiedad disponible.',
        'Se compara con las búsquedas activas: obligatorios, deseables y presupuesto con tolerancia del 10 %.',
        'El agente asignado a la búsqueda recibe una notificación con el motivo.',
      ]}
      note="Puntaje = deseables cumplidos ÷ deseables cargados. Si falla un obligatorio, no hay coincidencia."
    >
      <div className="flex flex-col gap-3">
        <Panel label="Búsqueda de Ana G.">
          <p className="text-sm">Venta · Departamento · Palermo o Belgrano</p>
          <p className="text-xs text-muted-foreground">USD 80.000 a 100.000 · Deseables: balcón, luminoso, cochera</p>
        </Panel>
        <DemoItem at={1}>
          <Panel label="Propiedad nueva · PRO-000123">
            <p className="text-sm">Departamento 3 ambientes · Belgrano</p>
            <p className="text-xs text-muted-foreground">USD 108.000 · Balcón · Luminoso</p>
          </Panel>
        </DemoItem>
        <DemoItem at={2}>
          <Panel label="Coincidencia">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-lg font-semibold tabular-nums">67 %</span>
              <Badge tone="warning">Superior al presupuesto</Badge>
            </div>
            <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full w-2/3 rounded-full bg-primary" />
            </div>
            <p className="text-xs text-muted-foreground">Cumple los obligatorios; deseables: 2 de 3, falta cochera.</p>
          </Panel>
        </DemoItem>
        <DemoItem at={3}>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs">
            <span className="size-2 shrink-0 rounded-full bg-primary" />
            Aviso a Laura: nueva coincidencia para la búsqueda de Ana G.
          </div>
        </DemoItem>
      </div>
    </DemoPlayer>
  );
}
