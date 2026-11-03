import type { ReactNode } from 'react';
import { Badge, Card } from '@/components/ui/surfaces.tsx';
import { cn } from '@/lib/utils.ts';
import { PREVIEW_SECTIONS, type Cell, type Mock, type PreviewSlug, type Tone } from './sections.ts';

// Vista previa de una sección en desarrollo: qué va a incluir y una maqueta con datos ficticios.
// La maqueta es aria-hidden (la descripción accesible es la lista de funciones) y no tiene controles.

const TONES: Record<Tone, string> = {
  neutral: 'border border-border bg-background text-muted-foreground',
  brand: 'bg-primary text-primary-foreground',
  success: 'bg-success text-success-foreground',
  warning: 'bg-warning text-warning-foreground',
  highlight: 'bg-highlight text-highlight-foreground',
};

function Chip({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', TONES[tone])}>
      {children}
    </span>
  );
}

function CellView({ cell }: { cell: Cell }) {
  return typeof cell === 'string' ? cell : <Chip tone={cell.tone}>{cell.chip}</Chip>;
}

function MockView({ mock }: { mock: Mock }) {
  switch (mock.kind) {
    case 'table':
      return (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                {mock.columns.map((column) => (
                  <th key={column} className="border-b border-border px-3 py-2 font-medium">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {mock.rows.map((row, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  {row.map((cell, cellIndex) => (
                    <td key={cellIndex} className={cn('px-3 py-2.5', cellIndex === 0 && 'font-medium')}>
                      <CellView cell={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'kanban':
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {mock.columns.map((column) => (
            <div key={column.title} className="min-w-0 rounded-md bg-muted p-3">
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{column.title}</p>
              <div className="grid gap-2">
                {column.cards.map((card) => (
                  <div key={card.title} className="rounded-md border border-border bg-surface p-2.5">
                    <p className="truncate text-sm font-medium">{card.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{card.meta}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      );
    case 'inbox':
      return (
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <ul className="grid content-start gap-2">
            {mock.conversations.map((item, index) => (
              <li
                key={item.name}
                className={cn('min-w-0 rounded-md border p-3', index === 0 ? 'border-primary bg-accent' : 'border-border')}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.time}</span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-xs text-muted-foreground">{item.preview}</p>
                  {item.chip ? <Chip tone={item.chip.tone}>{item.chip.chip}</Chip> : null}
                </div>
              </li>
            ))}
          </ul>
          <div className="grid content-start gap-3 rounded-md bg-muted p-3">
            {mock.messages.map((message, index) => (
              <div key={index} className={cn('grid max-w-[85%] gap-1', message.from === 'out' && 'ml-auto text-right')}>
                <p
                  className={cn(
                    'rounded-lg px-3 py-2 text-left text-sm',
                    message.from === 'out' ? 'bg-primary text-primary-foreground' : 'bg-surface',
                  )}
                >
                  {message.text}
                </p>
                <p className="text-[11px] text-muted-foreground">{message.meta}</p>
              </div>
            ))}
          </div>
        </div>
      );
    case 'agenda':
      return (
        <div className="grid gap-4">
          {mock.days.map((day) => (
            <div key={day.day}>
              <p className="mb-2 text-xs font-semibold text-muted-foreground uppercase">{day.day}</p>
              <ul className="grid gap-2">
                {day.items.map((item) => (
                  <li key={item.title} className="flex gap-3 rounded-md border border-border p-3">
                    <span className="w-12 shrink-0 text-sm font-semibold text-primary">{item.time}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.meta}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      );
    case 'matches':
      return (
        <div className="grid gap-4">
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-medium">{mock.search.title}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {mock.search.criteria.map((criterion) => (
                <Chip key={criterion}>{criterion}</Chip>
              ))}
            </div>
          </div>
          <ul className="grid gap-2">
            {mock.results.map((result) => (
              <li key={result.property} className="flex items-start justify-between gap-3 rounded-md border border-border p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{result.property}</p>
                  <p className="text-xs text-muted-foreground">{result.detail}</p>
                  <p className="mt-1 text-xs">{result.reason}</p>
                </div>
                <Chip tone={result.tone}>{result.score}</Chip>
              </li>
            ))}
          </ul>
        </div>
      );
    case 'list':
      return (
        <ul className="grid gap-2">
          {mock.items.map((item) => (
            <li key={item.title} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.title}</p>
                <p className="text-xs text-muted-foreground">{item.meta}</p>
              </div>
              {item.chip ? <Chip tone={item.chip.tone}>{item.chip.chip}</Chip> : null}
            </li>
          ))}
        </ul>
      );
  }
}

export function SectionPreview({ slug }: { slug: PreviewSlug }) {
  const section = PREVIEW_SECTIONS[slug];
  return (
    // grid-cols-1 (minmax(0, 1fr)): la tabla de la maqueta se desplaza dentro de su tarjeta, no la página.
    <div className="grid grid-cols-1 gap-6">
      <div>
        <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
          {section.title}
          <Badge variant="warning">{'later' in section && section.later ? 'Después del lanzamiento' : 'Próximamente'}</Badge>
        </h1>
        <p className="mt-1 text-muted-foreground">{section.summary}</p>
      </div>

      <Card>
        <h2 className="text-sm font-semibold">Qué vas a poder hacer</h2>
        <ul className="mt-3 grid gap-2 text-sm">
          {section.features.map((feature) => (
            <li key={feature} className="flex gap-2">
              <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
              {feature}
            </li>
          ))}
        </ul>
      </Card>

      <Card className="relative">
        <p className="mb-4 text-xs font-medium text-muted-foreground">Vista ilustrativa · datos ficticios</p>
        <div aria-hidden="true" className="pointer-events-none select-none">
          <MockView mock={section.mock} />
        </div>
      </Card>
    </div>
  );
}
