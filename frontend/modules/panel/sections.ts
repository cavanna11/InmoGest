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
  contactos: {
    slug: 'contactos',
    label: 'Contactos',
    title: 'Contactos',
    summary: 'Interesados y propietarios en un solo lugar, con todo su historial.',
    features: [
      'Varios teléfonos y emails por contacto, con detección de duplicados.',
      'Asignación a un agente y filtros por agente.',
      'Historial de actividad: conversaciones, visitas, fichas enviadas y cambios.',
      'Reporte de posibles duplicados y unificación por el dueño.',
      'Exportación a CSV.',
    ],
    mock: {
      kind: 'table',
      columns: ['Nombre', 'Teléfono', 'Tipo', 'Agente', 'Último contacto'],
      rows: [
        ['Ana G.', '+54 9 11 5555-0188', { chip: 'Interesada', tone: 'brand' }, 'Laura', 'Hoy'],
        ['Jorge P.', '+54 9 11 5555-0123', { chip: 'Propietario', tone: 'highlight' }, 'Martín', 'Ayer'],
        ['Carla M.', '+54 9 11 5555-0177', { chip: 'Interesada', tone: 'brand' }, 'Laura', 'Lunes'],
        ['Diego R.', '+54 9 11 5555-0109', { chip: 'Interesado', tone: 'brand' }, 'Sin asignar', 'Hace 2 semanas'],
      ],
    },
  },
  propiedades: {
    slug: 'propiedades',
    label: 'Propiedades',
    title: 'Propiedades',
    summary: 'La cartera de la inmobiliaria con fotos, características, propietario y estado.',
    features: [
      'Estados: disponible, reservada, vendida, alquilada y pausada.',
      'Página pública por propiedad, para compartir por URL.',
      'Detección de propiedades duplicadas y fusión por el dueño.',
      'Al cargar una propiedad, InmoPanel busca qué clientes la están buscando.',
    ],
    mock: {
      kind: 'table',
      columns: ['Código', 'Propiedad', 'Operación', 'Precio', 'Estado'],
      rows: [
        ['PRO-000123', 'Departamento 3 amb. · Belgrano', 'Venta', 'USD 98.000', { chip: 'Disponible', tone: 'success' }],
        ['PRO-000122', 'Departamento 2 amb. · Palermo', 'Alquiler', '$ 650.000', { chip: 'Reservada', tone: 'warning' }],
        ['PRO-000118', 'PH 4 amb. con patio · Villa Urquiza', 'Venta', 'USD 145.000', { chip: 'Disponible', tone: 'success' }],
        ['PRO-000101', 'Casa 5 amb. · San Isidro', 'Venta', 'USD 320.000', { chip: 'Vendida' }],
      ],
    },
  },
  busquedas: {
    slug: 'busquedas',
    label: 'Búsquedas',
    title: 'Búsquedas y coincidencias',
    summary: 'Qué busca cada cliente y qué propiedades le sirven, con el motivo de cada coincidencia.',
    features: [
      'Criterios obligatorios y deseables, con tolerancia de presupuesto.',
      'Coincidencias automáticas con puntaje y explicación.',
      'Aviso de "superior al presupuesto" cuando corresponde.',
      'Aviso al agente cuando entra una propiedad que coincide.',
    ],
    mock: {
      kind: 'matches',
      search: {
        title: 'Ana G. busca departamento en Belgrano',
        criteria: ['Venta', 'Belgrano', '3 ambientes', 'Hasta USD 100.000', 'Deseables: cochera, balcón, luminoso'],
      },
      results: [
        { property: 'Departamento 3 amb. · Belgrano', detail: 'PRO-000123 · USD 98.000', score: '67 %', reason: 'Cumple los obligatorios · deseables 2 de 3 (falta cochera)', tone: 'highlight' },
        { property: 'Departamento 3 amb. · Colegiales', detail: 'PRO-000119 · USD 104.000', score: '100 %', reason: 'Deseables 3 de 3 · superior al presupuesto (+4 %)', tone: 'warning' },
      ],
    },
  },
  oportunidades: {
    slug: 'oportunidades',
    label: 'Oportunidades',
    title: 'Embudo comercial',
    summary: 'Cada búsqueda avanza por las etapas de venta de la inmobiliaria.',
    features: [
      'Embudo predefinido, que el dueño puede renombrar, reordenar, ampliar o desactivar.',
      'Etapas ganadas y perdidas para medir resultados.',
      'Cada cambio de etapa queda en el historial.',
    ],
    mock: {
      kind: 'kanban',
      columns: [
        { title: 'Nuevo contacto', cards: [{ title: 'Diego R.', meta: 'Alquiler · Caballito' }, { title: '+54 9 11 5555-0142', meta: 'Consulta por Palermo' }] },
        { title: 'Calificado', cards: [{ title: 'Carla M.', meta: 'Compra · hasta USD 120.000' }] },
        { title: 'Visita coordinada', cards: [{ title: 'Ana G.', meta: 'Sábado 11:00 · PRO-000123' }] },
        { title: 'Negociación', cards: [{ title: 'Familia S.', meta: 'Oferta USD 140.000 · PRO-000118' }] },
      ],
    },
  },
  agenda: {
    slug: 'agenda',
    label: 'Agenda',
    title: 'Agenda de visitas y tareas',
    summary: 'Visitas, llamadas y tareas del equipo, con recordatorios.',
    features: [
      'Visitas y tareas asignadas a cada agente.',
      'Recordatorios y aviso de tareas vencidas dentro del panel.',
      'Vista por agente o de todo el equipo.',
    ],
    mock: {
      kind: 'agenda',
      days: [
        { day: 'Hoy', items: [{ time: '10:00', title: 'Llamar a Jorge P. por las fotos del PH', meta: 'Tarea · Martín' }, { time: '17:30', title: 'Visita PRO-000122 con Carla M.', meta: 'Visita · Laura' }] },
        { day: 'Sábado', items: [{ time: '11:00', title: 'Visita PRO-000123 con Ana G.', meta: 'Visita · Laura' }] },
      ],
    },
  },
  notificaciones: {
    slug: 'notificaciones',
    label: 'Notificaciones',
    title: 'Notificaciones',
    summary: 'Lo que necesita tu atención, sin salir del panel.',
    features: ['Mensajes nuevos.', 'Coincidencias nuevas.', 'Tareas vencidas.', 'WhatsApp desconectado.'],
    mock: {
      kind: 'list',
      items: [
        { title: 'Nueva coincidencia para la búsqueda de Ana G.', meta: 'Hace 5 minutos', chip: { chip: 'Coincidencia', tone: 'highlight' } },
        { title: 'Mensaje nuevo de +54 9 11 5555-0142', meta: 'Hace 12 minutos', chip: { chip: 'WhatsApp', tone: 'brand' } },
        { title: 'Tarea vencida: enviar tasación a Jorge P.', meta: 'Ayer', chip: { chip: 'Tarea', tone: 'warning' } },
      ],
    },
  },
  importar: {
    slug: 'importar',
    label: 'Importar y exportar',
    title: 'Importar y exportar',
    summary: 'Traé tus planillas actuales y llevate tus datos cuando quieras.',
    features: [
      'Importación de contactos y propiedades desde CSV.',
      'Vista previa antes de importar y errores explicados fila por fila.',
      'Exportación de contactos y propiedades a CSV.',
    ],
    mock: {
      kind: 'table',
      columns: ['Fila', 'Nombre', 'Teléfono', 'Resultado'],
      rows: [
        ['2', 'Ana G.', '11 5555-0188', { chip: 'Lista para importar', tone: 'success' }],
        ['3', 'Jorge P.', '11 5555-0123', { chip: 'Posible duplicado', tone: 'warning' }],
        ['4', 'Sin nombre', '—', { chip: 'Falta el nombre' }],
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
  plan: {
    slug: 'plan',
    label: 'Plan y pago',
    title: 'Plan y pago',
    summary: 'Tu plan, cuánto usás de cada límite y el informe de pago.',
    features: [
      'Planes Inicial, Profesional y Empresa.',
      'Uso de cada límite del plan.',
      'Informe de pago por transferencia y activación por C&C.',
    ],
    mock: {
      kind: 'list',
      items: [
        { title: 'Plan Profesional · prueba gratis', meta: 'Hasta el fin de la prueba', chip: { chip: 'Prueba', tone: 'brand' } },
        { title: 'Usuarios', meta: '3 de 5' },
        { title: 'Propiedades', meta: '128 de 500' },
        { title: 'Último informe de pago', meta: 'Transferencia · en revisión', chip: { chip: 'En revisión', tone: 'warning' } },
      ],
    },
  },
} satisfies Record<string, PreviewSection>;

export type PreviewSlug = keyof typeof PREVIEW_SECTIONS;
