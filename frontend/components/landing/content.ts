// Textos de la landing. Todo lo que se afirma sale de docs/PRD.md (MVP, Fase 1). InmoPanel está en
// desarrollo: las funciones se presentan como "lo que incluye el primer lanzamiento", nunca como
// disponibles hoy. No agregar funciones fuera del PRD ni prometer lo que el PRD marca como riesgo.

/** Situaciones reales que una inmobiliaria reconoce (PRD §2). */
export const painPoints = [
  {
    title: 'La consulta llegó al celular de un agente y nadie la vio a tiempo.',
    consequence: 'El interesado le escribe a otra inmobiliaria.',
  },
  {
    title: 'Entró la propiedad justa para un cliente y nadie se acordó de avisarle.',
    consequence: 'Una venta que se pierde sin que nadie se entere.',
  },
  {
    title: 'Los datos están repartidos entre planillas, cuadernos y chats personales.',
    consequence: 'Cada seguimiento empieza de cero.',
  },
  {
    title: 'Un agente deja la inmobiliaria y se lleva los contactos en su teléfono.',
    consequence: 'La cartera queda incompleta.',
  },
] as const;

export type Capability = { title: string; text: string; soon?: boolean };

/** Funciones del primer lanzamiento agrupadas por el resultado que buscan (PRD §5, MVP). */
export const pillars: Array<{ id: string; title: string; summary: string; items: Capability[] }> = [
  {
    id: 'responder',
    title: 'Respondé a tiempo',
    summary: 'Todas las consultas de WhatsApp en un mismo lugar, con todo el equipo atento.',
    items: [
      {
        title: 'Bandeja de WhatsApp compartida',
        text: 'Conectás el número de la inmobiliaria con un QR y todo el equipo ve y responde las conversaciones.',
      },
      {
        title: 'Contactos que se crean solos',
        text: 'Si escribe un número nuevo, se crea el contacto; si ya existe, la conversación se vincula a su ficha.',
      },
      {
        title: 'Quién respondió y cuándo',
        text: 'La primera persona que abre una conversación queda asignada y cada respuesta registra quién la envió.',
      },
    ],
  },
  {
    id: 'oportunidades',
    title: 'No pierdas oportunidades',
    summary: 'Cuando entra una propiedad, sabés al momento qué clientes la están buscando.',
    items: [
      {
        title: 'Búsquedas de cada cliente',
        text: 'Operación, zonas, presupuesto con tolerancia y características obligatorias y deseables.',
      },
      {
        title: 'Coincidencias explicadas',
        text: 'Cada coincidencia muestra un puntaje y el motivo: qué cumple, qué le falta y si supera el presupuesto.',
      },
      {
        title: 'Fichas por WhatsApp',
        text: 'Enviás la propiedad con fotos, texto y el link a su página pública. Queda en el historial del cliente.',
      },
    ],
  },
  {
    id: 'organizar',
    title: 'Ordená el trabajo del equipo',
    summary: 'Cada operación con su etapa, cada visita en la agenda y la información en la inmobiliaria.',
    items: [
      {
        title: 'Embudo comercial',
        text: 'Seguís cada búsqueda por etapas, del primer contacto al cierre, con etapas que se adaptan a tu forma de trabajar.',
      },
      {
        title: 'Agenda de visitas y tareas',
        text: 'Visitas con cliente y propiedad, tareas y recordatorios. Tu agenda o la de todo el equipo.',
      },
      {
        title: 'Equipo y datos propios',
        text: 'Invitás agentes, importás tus planillas y exportás contactos y propiedades cuando quieras.',
      },
      {
        title: 'Mensajes automáticos',
        text: 'Avisos predefinidos y recordatorios de visitas por WhatsApp, con límites de envío para cuidar el número.',
        soon: true,
      },
    ],
  },
];

/** Hoy vs. con InmoPanel (PRD §2 y §12). */
export const comparison = [
  {
    today: 'Contactos en planillas, cuadernos y el celular de cada agente.',
    withUs: 'Una sola base con contactos, propiedades, conversaciones y agenda de toda la inmobiliaria.',
  },
  {
    today: 'Consultas por WhatsApp que se pierden o se responden tarde.',
    withUs: 'Bandeja compartida: cada consulta crea o vincula su contacto y cualquiera del equipo responde.',
  },
  {
    today: 'Cruzar qué busca cada cliente con lo que entra, de memoria.',
    withUs: 'Coincidencias automáticas con el motivo, y aviso al agente que atiende la búsqueda.',
  },
  {
    today: 'Cuando un agente se va, se lleva los contactos y el historial.',
    withUs: 'El historial queda en la inmobiliaria y lo pendiente se reasigna.',
  },
  {
    today: 'Cambiar de sistema implica cargar todo a mano.',
    withUs: 'Importación desde planillas con vista previa, errores por fila y control de duplicados.',
  },
] as const;

/** Compromisos verificables: decisiones de diseño del producto, no promesas de resultados. */
export const commitments = [
  {
    title: 'Tus datos, aislados y exportables',
    text: 'Cada inmobiliaria es un espacio separado y eso se garantiza en la base de datos, no solo en la pantalla. Podés exportar tus contactos y propiedades.',
  },
  {
    title: 'WhatsApp sin letra chica',
    text: 'La conexión por QR no es un servicio oficial de WhatsApp. Te lo decimos de entrada, con pautas de uso responsable y límites a los envíos automáticos.',
  },
  {
    title: 'Precios publicados',
    text: 'Tres planes con precio de referencia a la vista, desde USD 19 por mes, y prueba gratis de 14 días.',
  },
  {
    title: 'Pensado para inmobiliarias argentinas',
    text: 'En español, con pesos y dólares, teléfonos en formato argentino y fechas DD/MM/AAAA. Lo desarrolla C&C.',
  },
] as const;

export const startSteps = [
  { title: 'Creá la cuenta', text: 'Te registrás con tu email y empezás la prueba gratis de 14 días. No hay nada que instalar.' },
  { title: 'Configurá la inmobiliaria', text: 'Cargás los datos y el logo, e invitás a tu equipo.' },
  { title: 'Conectá WhatsApp', text: 'Leés las pautas de uso responsable y escaneás el QR con el número de la inmobiliaria.' },
  { title: 'Traé tus datos', text: 'Importás propiedades y contactos desde planillas o los cargás a mano.' },
] as const;

export type Plan = {
  name: string;
  price: number;
  summary: string;
  limits: string[];
  extras: { text: string; soon?: boolean }[];
  highlighted?: boolean;
};

// PRD §6. Precios mensuales de referencia en USD. Los extras del plan Profesional además de las
// automatizaciones y el máximo de números de Empresa están [A CONFIRMAR]: no se listan.
export const plans: Plan[] = [
  {
    name: 'Inicial',
    price: 19,
    summary: 'Todo lo esencial para ordenar la gestión diaria.',
    limits: ['2 usuarios', '100 propiedades', '1 número de WhatsApp'],
    extras: [{ text: 'Sin mensajes automáticos ni recordatorios por WhatsApp' }],
  },
  {
    name: 'Profesional',
    price: 39,
    summary: 'Para equipos que quieren automatizar el seguimiento.',
    limits: ['5 usuarios', '500 propiedades', '1 número de WhatsApp'],
    extras: [
      { text: 'Mensajes automáticos predefinidos', soon: true },
      { text: 'Recordatorios de visitas por WhatsApp', soon: true },
    ],
    highlighted: true,
  },
  {
    name: 'Empresa',
    price: 69,
    summary: 'Más capacidad para inmobiliarias con varios equipos.',
    limits: ['10 usuarios', '1.500 propiedades', 'Más de un número de WhatsApp'],
    extras: [
      { text: 'Mensajes automáticos predefinidos', soon: true },
      { text: 'Recordatorios de visitas por WhatsApp', soon: true },
    ],
  },
];

/** Preguntas frecuentes. También se publican como datos estructurados FAQPage (SEO/GEO). */
export const faqs = [
  {
    q: '¿Qué es InmoPanel?',
    a: 'InmoPanel es un software de gestión para inmobiliarias desarrollado por C&C. Reúne en un solo lugar los contactos, las propiedades, las conversaciones de WhatsApp, las búsquedas de los clientes, el embudo comercial y la agenda del equipo.',
  },
  {
    q: '¿Para qué inmobiliarias es?',
    a: 'Para inmobiliarias chicas y medianas, con dueño y agentes, que hoy trabajan con planillas y el WhatsApp de cada celular y quieren ordenar la operación comercial sin depender de soporte técnico.',
  },
  {
    q: '¿Ya está disponible?',
    a: 'Todavía no. InmoPanel está en desarrollo y el registro no está abierto. Esta página describe lo que incluye el primer lanzamiento; lo marcado como "Próximamente" llega después.',
  },
  {
    q: '¿En qué se diferencia de un CRM genérico?',
    a: 'Está pensado para el trabajo de una inmobiliaria: búsquedas de clientes con presupuesto y zonas, coincidencias automáticas con propiedades que explican el motivo, bandeja de WhatsApp compartida por el equipo y página pública para cada propiedad.',
  },
  {
    q: '¿Tengo que instalar algo?',
    a: 'No. InmoPanel funciona en el navegador, en la computadora y en el celular.',
  },
  {
    q: '¿Cómo se conecta WhatsApp? ¿Es oficial?',
    a: 'Se conecta escaneando un QR con el WhatsApp del número de la inmobiliaria. Esa conexión no es un servicio oficial de WhatsApp: si el número se usa mal puede ser restringido. Por eso, al conectar, mostramos pautas de uso responsable, y los mensajes enviados y recibidos quedan guardados aunque el número se desconecte. Si preferís la API oficial de Meta, podés solicitarla y la gestiona C&C; sus costos por mensaje los fija Meta.',
  },
  {
    q: '¿Puedo traer los datos que ya tengo?',
    a: 'Sí. Descargás una plantilla CSV, la completás o adaptás un export de tu sistema anterior y, antes de confirmar, ves una vista previa con los errores por fila y los posibles duplicados.',
  },
  {
    q: '¿Qué pasa cuando un agente deja la inmobiliaria?',
    a: 'Lo desactivás y pierde el acceso en el momento. Sus contactos, conversaciones, tareas y visitas pendientes quedan sin asignar para repartirlos, y el historial se conserva.',
  },
  {
    q: '¿Cómo se paga la suscripción?',
    a: 'Elegís un plan y pagás por transferencia bancaria; C&C verifica el pago y activa la suscripción.',
  },
  {
    q: '¿Publica en portales inmobiliarios?',
    a: 'No. La integración con portales no está incluida. Cada propiedad tiene su propia página pública para compartir por link.',
  },
] as const;
