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
  conversaciones: {
    slug: 'conversaciones',
    label: 'Conversaciones',
    title: 'Bandeja de WhatsApp',
    summary: 'Todas las conversaciones del número de la inmobiliaria en una bandeja compartida por el equipo.',
    features: [
      'Ver y responder desde el panel: texto, imágenes, audios y documentos.',
      'El primer agente que abre una conversación queda asignado; se puede reasignar.',
      'Cada respuesta muestra qué agente la envió y cuándo.',
      'Un número nuevo crea el contacto automáticamente; uno conocido se vincula a su contacto.',
      'Enviar la ficha de una propiedad con el link a su página pública.',
      'Registro de "no contactar" por contacto.',
    ],
    mock: {
      kind: 'inbox',
      conversations: [
        { name: '+54 9 11 5555-0142', preview: '¿Sigue disponible el 2 ambientes de Palermo?', time: '14:31', chip: { chip: 'Nuevo', tone: 'highlight' } },
        { name: 'Ana G.', preview: 'Perfecto, el sábado a las 11 me queda bien.', time: '13:05', chip: { chip: 'Laura', tone: 'brand' } },
        { name: 'Jorge P. (propietario)', preview: 'Te mando las fotos del PH esta tarde.', time: 'Ayer', chip: { chip: 'Martín', tone: 'brand' } },
        { name: 'Carla M.', preview: 'Gracias, lo charlo con mi pareja.', time: 'Lun', chip: { chip: 'Laura', tone: 'brand' } },
      ],
      messages: [
        { from: 'in', text: 'Hola, vi el depto de 2 ambientes en Palermo. ¿Sigue disponible?', meta: '14:31' },
        { from: 'out', text: '¡Hola! Sí, sigue disponible. ¿Querés que te mande la ficha?', meta: 'Laura · 14:33' },
        { from: 'out', text: 'Departamento 2 amb. · Palermo — fotos, detalles y link a su página', meta: 'Laura · 14:33 · Ficha enviada' },
      ],
    },
  },
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
  whatsapp: {
    slug: 'whatsapp',
    label: 'WhatsApp',
    title: 'Conexión de WhatsApp',
    summary: 'El número de la inmobiliaria, conectado con un código QR.',
    features: [
      'Conexión por QR, con estado y reconexión.',
      'Pautas de uso responsable aceptadas al conectar.',
      'Cantidad de números según el plan.',
      'La conexión por QR no es oficial de WhatsApp: tiene riesgos que se explican antes de conectar.',
    ],
    mock: {
      kind: 'list',
      items: [
        { title: '+54 9 11 5555-0100 · Línea principal', meta: 'Conectado desde el 01/11', chip: { chip: 'Conectado', tone: 'success' } },
        { title: 'Mensajes automáticos de hoy', meta: '12 de 30 permitidos por día' },
      ],
    },
  },
} satisfies Record<string, PreviewSection>;

export type PreviewSlug = keyof typeof PREVIEW_SECTIONS;
