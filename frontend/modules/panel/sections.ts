// Secciones del panel que todavía no están desarrolladas (PRD §5, MVP). Cada una tiene su página con
// "Próximamente", qué va a incluir y una maqueta ilustrativa con datos ficticios: muestran la
// estructura del producto sin simular que funcionan (sin botones ni formularios).

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'highlight';
export type Cell = string | { chip: string; tone?: Tone };

export type Mock =
  | { kind: 'table'; columns: string[]; rows: Cell[][] }
  | { kind: 'kanban'; columns: Array<{ title: string; cards: Array<{ title: string; meta: string }> }> }
  | {
      kind: 'inbox';
      conversations: Array<{ name: string; preview: string; time: string; chip?: { chip: string; tone?: Tone } }>;
      messages: Array<{ from: 'in' | 'out'; text: string; meta: string }>;
    }
  | { kind: 'agenda'; days: Array<{ day: string; items: Array<{ time: string; title: string; meta: string }> }> }
  | {
      kind: 'matches';
      search: { title: string; criteria: string[] };
      results: Array<{ property: string; detail: string; score: string; reason: string; tone?: Tone }>;
    }
  | { kind: 'list'; items: Array<{ title: string; meta: string; chip?: { chip: string; tone?: Tone } }> };

export type PreviewSection = {
  slug: string;
  label: string;
  title: string;
  summary: string;
  features: string[];
  /** Funciones posteriores al primer lanzamiento (P1 del PRD). */
  later?: boolean;
  mock: Mock;
};

export const PREVIEW_SECTIONS = {
  automaticos: {
    slug: 'automaticos',
    label: 'Mensajes automáticos',
    title: 'Mensajes automáticos',
    summary: 'Mensajes predefinidos que salen solos, con límites para cuidar el número.',
    later: true,
    features: [
      'Mensajes predefinidos (planes Profesional y Empresa).',
      'Cola de envío con límites diarios, por hora e intervalo mínimo.',
      'Recordatorios de visitas por WhatsApp con anticipación configurable.',
    ],
    mock: {
      kind: 'list',
      items: [
        { title: 'Bienvenida a un contacto nuevo', meta: 'Al primer mensaje de un número nuevo', chip: { chip: 'Activo', tone: 'success' } },
        { title: 'Recordatorio de visita', meta: '24 horas antes de la visita', chip: { chip: 'Activo', tone: 'success' } },
        { title: 'Seguimiento sin respuesta', meta: '3 días después del último mensaje', chip: { chip: 'Pausado' } },
      ],
    },
  },
} satisfies Record<string, PreviewSection>;

export type PreviewSlug = keyof typeof PREVIEW_SECTIONS;
