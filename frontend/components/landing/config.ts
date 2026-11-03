// Destinos de la landing comercial. Único lugar donde se configuran: no repetir URLs en los componentes.
// `null` significa "todavía no definido": la landing oculta el enlace o muestra una alternativa, nunca
// un destino inventado (emails, teléfonos o URLs que nadie aprobó).

export type LandingLinks = {
  /** Ingreso a la plataforma. Ruta prevista por docs/ARCHITECTURE.md (grupo `(auth)`); llega con el login (F-02). */
  platform: string | null;
  /** Canal para pedir una demo. Hoy: WhatsApp comercial de C&C (aprobado el 03/11/2026). */
  demo: string | null;
  /** Términos y condiciones (PRD §10). PENDIENTE: requieren revisión profesional. */
  terms: string | null;
  /** Política de privacidad (PRD §10). PENDIENTE: requieren revisión profesional. */
  privacy: string | null;
};

/** WhatsApp comercial de C&C para coordinar demos, en formato E.164 sin "+" (lo pide wa.me). */
export const DEMO_WHATSAPP_NUMBER = '5492257529684';

/** Enlace de WhatsApp al comercial de C&C con un mensaje precargado. */
export function whatsappHref(message: string): string {
  return `https://wa.me/${DEMO_WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const landingLinks: LandingLinks = {
  platform: '/ingresar',
  demo: whatsappHref('Hola, quiero coordinar una demo de InmoPanel.'),
  terms: null,
  privacy: null,
};

/** Ancla de la sección de demo: es el destino de "Solicitar una demo" si no hay canal configurado. */
export const DEMO_SECTION_ID = 'demo';

/** Adónde lleva "Solicitar una demo": el canal configurado o, si falta, la sección de demo. */
export function demoHref(links: LandingLinks = landingLinks): string {
  return links.demo ?? `#${DEMO_SECTION_ID}`;
}

/** Mostrar los precios de referencia del PRD §6. Apagar si la estrategia comercial cambia. */
export const SHOW_PRICES = true;

/** Aviso de estado en el hero mientras el producto no esté lanzado. `null` lo oculta. */
export const PRODUCT_STATUS: string | null = 'En desarrollo';
