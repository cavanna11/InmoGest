// Textos de la landing. Todo lo que se afirma sale de docs/PRD.md (la referencia entre paréntesis).
// No agregar funcionalidades que no estén en el PRD ni prometer lo que el PRD marca como riesgo.

export const problems = [
  {
    today: 'Contactos repartidos entre planillas, cuadernos y el celular de cada agente.',
    withUs: 'Una sola base con contactos, propiedades, conversaciones y agenda de toda la inmobiliaria.',
  },
  {
    today: 'Consultas por WhatsApp que se pierden o se responden tarde.',
    withUs: 'Bandeja compartida: cada consulta crea o vincula su contacto y cualquiera del equipo responde.',
  },
  {
    today: 'Cruzar qué busca cada cliente con lo que entra se hace de memoria.',
    withUs: 'Matching automático: cuando entra una propiedad, avisa a quien atiende la búsqueda y explica por qué.',
  },
  {
    today: 'Cuando un agente se va, se lleva los contactos y el historial.',
    withUs: 'El historial queda en la inmobiliaria y lo pendiente se reasigna en un paso.',
  },
  {
    today: 'Cambiar de sistema da miedo por la carga de datos.',
    withUs: 'Importación desde planillas (CSV) con vista previa, errores por fila y control de duplicados.',
  },
] as const;

export const features = [
  {
    title: 'Bandeja de WhatsApp compartida',
    text: 'Conectá el número de la inmobiliaria con un QR. Todo el equipo ve y responde, y cada respuesta registra quién la envió.',
  },
  {
    title: 'Contactos sin duplicados',
    text: 'Varios teléfonos y emails por contacto, alta automática desde WhatsApp y aviso cuando un dato ya existe.',
  },
  {
    title: 'Propiedades con página pública',
    text: 'Fotos, características, propietario y estado. Cada propiedad tiene su código y una página para compartir por link.',
  },
  {
    title: 'Búsquedas y matching explicado',
    text: 'Criterios obligatorios y deseables, presupuesto con tolerancia y un puntaje que dice qué cumple y qué falta.',
  },
  {
    title: 'Fichas por WhatsApp',
    text: 'Enviá una propiedad a uno o varios clientes con fotos, texto y link. Queda en el historial de ambos.',
  },
  {
    title: 'Embudo comercial',
    text: 'Seguí cada búsqueda por etapas, desde el primer contacto hasta el cierre. Las etapas se adaptan a tu forma de trabajar.',
  },
  {
    title: 'Agenda de visitas y tareas',
    text: 'Visitas con cliente y propiedad, tareas y recordatorios dentro del sistema. Tu agenda o la de todo el equipo.',
  },
  {
    title: 'Equipo y roles',
    text: 'Invitá agentes por email. El dueño configura y administra; los agentes trabajan sobre toda la cartera.',
  },
  {
    title: 'Importar y exportar',
    text: 'Traé tus datos desde planillas con una plantilla CSV y exportá contactos y propiedades cuando quieras.',
  },
] as const;

export const startSteps = [
  { title: 'Creá la cuenta', text: 'Registrate con tu email y empezá la prueba gratis de 14 días. No hay nada que instalar.' },
  { title: 'Configurá la inmobiliaria', text: 'Cargá los datos y el logo, e invitá a tu equipo.' },
  { title: 'Conectá WhatsApp', text: 'Leé las pautas de uso responsable y escaneá el QR con el número de la inmobiliaria.' },
  { title: 'Traé tus datos', text: 'Importá propiedades y contactos desde planillas o cargalos a mano.' },
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

export const faqs = [
  {
    q: '¿Tengo que instalar algo?',
    a: 'No. InmoPanel funciona en el navegador, en la computadora y en el celular.',
  },
  {
    q: '¿Cómo se conecta WhatsApp? ¿Es oficial?',
    a: 'Se conecta escaneando un QR con el WhatsApp del número de la inmobiliaria. Esa conexión no es un servicio oficial de WhatsApp: si el número se usa mal puede ser restringido. Por eso, al conectar, te mostramos pautas de uso responsable, y los mensajes enviados y recibidos quedan guardados aunque el número se desconecte. Si preferís la API oficial de Meta, podés solicitarla y la gestiona C&C; sus costos por mensaje los fija Meta.',
  },
  {
    q: '¿Puedo traer los datos que ya tengo?',
    a: 'Sí. Descargás una plantilla CSV, la completás o adaptás un export de tu sistema anterior y antes de confirmar ves una vista previa con los errores por fila y los posibles duplicados.',
  },
  {
    q: '¿Qué pasa cuando un agente deja la inmobiliaria?',
    a: 'Lo desactivás y pierde el acceso en el momento. Sus contactos, conversaciones, tareas y visitas pendientes quedan sin asignar para repartirlos, y el historial se conserva.',
  },
  {
    q: '¿Mis datos están separados de los de otras inmobiliarias?',
    a: 'Sí. Cada inmobiliaria es un espacio aislado y eso se garantiza en la base de datos, no solo en la pantalla. Además podés exportar tus contactos y propiedades cuando quieras.',
  },
  {
    q: '¿Cómo se paga la suscripción?',
    a: 'Elegís un plan y pagás por transferencia bancaria; C&C verifica el pago y activa la suscripción.',
  },
  {
    q: '¿Qué pasa si termina la prueba y no contraté un plan?',
    a: 'La cuenta pasa a solo lectura durante 30 días: podés consultar y exportar, y los mensajes entrantes se siguen guardando. Después se bloquea y los datos se conservan 90 días más. Si activás un plan en ese período, seguís con todo.',
  },
  {
    q: '¿Publica en portales inmobiliarios?',
    a: 'No. La integración con portales no está incluida. Cada propiedad tiene su propia página pública para compartir por link.',
  },
] as const;
