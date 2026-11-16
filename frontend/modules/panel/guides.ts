// "Ver cómo funciona": ejemplos concretos de cada sección del panel, para personas no técnicas.
// Describen SOLO lo que el sistema hace hoy. Si una función cambia, actualizar su guía.

export type Guide = {
  title: string;
  intro: string;
  examples: Array<{ title: string; body: string }>;
};

/** Guía por sección, con la clave de la ruta bajo /panel ('' es el inicio). */
export const GUIDES: Record<string, Guide> = {
  '': {
    title: 'Hoy',
    intro: 'Lo que necesita atención hoy, junto en una sola pantalla. Se arma solo con lo que pasa en el resto del panel.',
    examples: [
      {
        title: 'Empezar el día',
        body: 'Mirás “Sin responder” y contestás los WhatsApp pendientes. Tocás una conversación y se abre lista para responder.',
      },
      {
        title: 'Repescar clientes',
        body: 'En “Para retomar” aparecen los clientes con una búsqueda abierta que hace más de 15 días no tienen novedades. Con el botón de WhatsApp les escribís al toque.',
      },
      {
        title: 'Organizar la salida',
        body: 'En “Visitas de hoy” ves horario, cliente y propiedad. Las tareas vencidas o de hoy aparecen al lado.',
      },
      {
        title: 'Publicar lo que falta',
        body: 'En “Sin publicar en Mercado Libre” están las propiedades disponibles que todavía no tienen publicación ahí.',
      },
    ],
  },
  conversaciones: {
    title: 'WhatsApp',
    intro: 'Todos los mensajes que llegan al número de la inmobiliaria, en una sola bandeja que comparte el equipo.',
    examples: [
      {
        title: 'Responder una consulta',
        body: 'Llega “¿Sigue disponible el depto de Belgrano?”. Abrís la conversación, respondés desde acá y el mensaje sale por el WhatsApp de la inmobiliaria.',
      },
      {
        title: 'Que nadie quede sin respuesta',
        body: 'Con el filtro “Sin leer” ves solo lo pendiente. Con “Sin asignar”, las consultas que todavía no tomó nadie.',
      },
      {
        title: 'Repartir el trabajo',
        body: 'Asignás la conversación a un compañero y le aparece en “Mías”. Si trabajan con una sola cuenta, podés ignorar las asignaciones.',
      },
      {
        title: 'Mandar fotos o archivos',
        body: 'Adjuntás una foto o un PDF desde la conversación. Para mandar la ficha de una propiedad, usá “Enviar por WhatsApp” en la propiedad.',
      },
    ],
  },
  propiedades: {
    title: 'Propiedades',
    intro: 'La cartera de la inmobiliaria: cada propiedad con sus fotos, propietarios, su página para compartir y dónde está publicada.',
    examples: [
      {
        title: 'Cargar una propiedad nueva',
        body: 'Completás título, operación, tipo y precio. Recibe un código (por ejemplo PRO-000031) y una página pública. Después le sumás fotos y el propietario.',
      },
      {
        title: 'Mandársela a un interesado',
        body: 'Desde la propiedad, “Enviar por WhatsApp” le manda hasta 3 fotos y el link a su página, sin copiar ni pegar nada.',
      },
      {
        title: 'Publicarla en Mercado Libre',
        body: 'Si la inmobiliaria conectó su cuenta en Integraciones, la publicás desde la propiedad. Cuando cambiás el precio o el estado, se actualiza sola.',
      },
      {
        title: 'Saber quién la está buscando',
        body: 'En “Clientes que la buscan” ves las búsquedas activas que coinciden con esta propiedad, para avisarles primero.',
      },
    ],
  },
  contactos: {
    title: 'Contactos',
    intro: 'Interesados y propietarios, con su teléfono, sus búsquedas y todo lo que hablaron con la inmobiliaria.',
    examples: [
      {
        title: 'Cargar a alguien que llamó',
        body: 'Creás el contacto con su nombre y teléfono. Si ese teléfono o email ya estaba cargado, te mostramos el contacto existente para no duplicarlo.',
      },
      {
        title: 'Anotar una llamada',
        body: 'En la ficha escribís “Quiere ver casas en Ramos, hasta USD 120.000” y elegís Llamada. Queda en el historial con fecha y hora.',
      },
      {
        title: 'Retomar un contacto frío',
        body: 'Buscás por nombre, teléfono o email, revisás el historial para ver de qué hablaron la última vez y le escribís por WhatsApp desde la ficha.',
      },
      {
        title: 'Respetar a quien no quiere mensajes',
        body: 'Marcás “No contactar” y no recibe mensajes automáticos.',
      },
    ],
  },
  busquedas: {
    title: 'Búsquedas',
    intro: 'Qué está buscando cada cliente. InmoPanel te muestra qué propiedades de la cartera le sirven y por qué.',
    examples: [
      {
        title: 'Cargar lo que pide un cliente',
        body: 'Un cliente pide un 3 ambientes en Palermo o Belgrano, hasta USD 150.000, con cochera. Lo cargás una vez como búsqueda.',
      },
      {
        title: 'Ver las propiedades que le sirven',
        body: 'Al guardar ves las coincidencias con el motivo: “mismo barrio, dentro del presupuesto, tiene cochera”. Las que no van, las descartás.',
      },
      {
        title: 'Enterarte de las nuevas',
        body: 'Cuando entra una propiedad que coincide, te llega una notificación para avisarle al cliente antes que nadie.',
      },
    ],
  },
  oportunidades: {
    title: 'Oportunidades',
    intro: 'Un tablero con las búsquedas de los clientes ordenadas por etapa de venta, para ver de un vistazo cómo viene cada una.',
    examples: [
      {
        title: 'Avanzar una oportunidad',
        body: 'Después de la primera visita, pasás la búsqueda de “Primer contacto” a “Visita coordinada” con “Mover”.',
      },
      {
        title: 'Ver solo lo tuyo',
        body: 'Con “Mis búsquedas” ves las que tenés a cargo. Con “Todo el equipo”, las de toda la inmobiliaria.',
      },
      {
        title: 'Ajustar las etapas',
        body: 'El dueño puede renombrar, agregar o desactivar etapas en “Configurar etapas” para que se parezcan a cómo trabaja la inmobiliaria.',
      },
    ],
  },
  agenda: {
    title: 'Agenda',
    intro: 'Las visitas a propiedades y las tareas pendientes, tuyas o de todo el equipo.',
    examples: [
      {
        title: 'Agendar una visita',
        body: 'Elegís el cliente, la propiedad, el día y la hora. Te avisamos con una notificación cuando falten menos de 24 horas.',
      },
      {
        title: 'Cerrar la visita',
        body: 'Después de la visita la marcás como Realizada o No asistió. Queda en el historial del contacto. Si cambia el horario, usás Reprogramar.',
      },
      {
        title: 'No olvidarte de un llamado',
        body: 'Creás la tarea “Llamar a Jorge por las fotos” con fecha y hora. Si vence sin hacerse, te avisamos.',
      },
    ],
  },
  notificaciones: {
    title: 'Notificaciones',
    intro: 'Los avisos que necesitan tu atención, sin salir del panel.',
    examples: [
      {
        title: 'Una propiedad que le sirve a un cliente',
        body: 'Cuando una propiedad coincide con una búsqueda, te avisamos. Al tocar el aviso vas directo a la búsqueda.',
      },
      {
        title: 'Visitas y tareas',
        body: 'Te avisamos de las visitas de las próximas 24 horas y de las tareas vencidas.',
      },
    ],
  },
  importar: {
    title: 'Importar y exportar',
    intro: 'Para traer los datos que ya tenés en planillas y para llevarte una copia cuando quieras.',
    examples: [
      {
        title: 'Pasar tu planilla de Excel',
        body: 'Bajás la plantilla, pegás tus contactos o propiedades, la guardás como CSV y la subís. Antes de importar, ves las filas que se van a cargar.',
      },
      {
        title: 'Tener una copia',
        body: 'Exportás tus datos en CSV para abrirlos en Excel o Google Sheets.',
      },
    ],
  },
  configuracion: {
    title: 'Datos de la inmobiliaria',
    intro: 'Lo que ven tus clientes en las páginas de cada propiedad.',
    examples: [
      {
        title: 'Tu marca en las fichas',
        body: 'Cargás el logo, el teléfono y el sitio web. Aparecen en la página pública de cada propiedad que compartís.',
      },
      {
        title: 'La moneda habitual',
        body: 'Elegís si trabajás más en dólares o en pesos. Las propiedades nuevas arrancan con esa moneda.',
      },
    ],
  },
  equipo: {
    title: 'Equipo',
    intro: 'Quién entra al panel de la inmobiliaria y qué puede hacer.',
    examples: [
      {
        title: 'Sumar a un agente',
        body: 'Lo invitás con su email y le llega un enlace para crear su acceso. Si el email no le llega, copiás el enlace y se lo mandás vos.',
      },
      {
        title: 'Una cuenta compartida también sirve',
        body: 'Si en la oficina usan todos el mismo usuario, no hace falta invitar a nadie.',
      },
      {
        title: 'Cuando alguien se va',
        body: 'Lo desactivás y deja de entrar. Sus contactos y propiedades quedan en la inmobiliaria.',
      },
    ],
  },
  whatsapp: {
    title: 'Conectar WhatsApp',
    intro: 'Vinculás el número de la inmobiliaria para recibir y responder los mensajes desde el panel.',
    examples: [
      {
        title: 'Vincular el número',
        body: 'Desde el celular de la inmobiliaria, en WhatsApp, vas a Dispositivos vinculados y escaneás el código QR que aparece acá.',
      },
      {
        title: 'Después',
        body: 'Los mensajes nuevos llegan a la sección WhatsApp del panel y se pueden responder desde la compu.',
      },
    ],
  },
  integraciones: {
    title: 'Integraciones',
    intro: 'Mercado Libre y la web de tu inmobiliaria.',
    examples: [
      {
        title: 'Conectar Mercado Libre',
        body: 'El dueño conecta la cuenta de Mercado Libre de la inmobiliaria una sola vez. Después, cada propiedad se publica desde su ficha. Usa el paquete de publicaciones que tengas contratado.',
      },
      {
        title: 'Mostrar tus propiedades en tu web',
        body: 'Generás una clave y se la pasás a quien hace tu web. Así tu web muestra las propiedades cargadas en InmoPanel, siempre actualizadas.',
      },
    ],
  },
  plan: {
    title: 'Plan y pago',
    intro: 'Tu plan, cuánto usás de cada límite y cómo pagar.',
    examples: [
      {
        title: 'Pagar el mes',
        body: 'Hacés la transferencia con los datos que figuran acá e informás el pago para que lo acreditemos.',
      },
    ],
  },
  perfil: {
    title: 'Mi perfil',
    intro: 'Tus datos de acceso.',
    examples: [{ title: 'Cambiar la contraseña', body: 'La cambiás desde acá cuando quieras.' }],
  },
};
