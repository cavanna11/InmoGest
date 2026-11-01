// Destinos de la landing comercial. Único lugar donde se configuran: no repetir URLs en los componentes.
// `null` significa "todavía no definido": la landing oculta el enlace o muestra una alternativa, nunca
// un destino inventado (emails, teléfonos o URLs que nadie aprobó).

export type LandingLinks = {
  /** Ingreso al CRM. Ruta prevista por docs/ARCHITECTURE.md (grupo `(auth)`); llega con el login (F-02). */
  platform: string | null;
  /** Canal para pedir una demo (formulario, WhatsApp comercial o agenda). PENDIENTE: lo define C&C. */
  demo: string | null;
  /** Términos y condiciones (PRD §10). PENDIENTE: requieren revisión profesional. */
  terms: string | null;
  /** Política de privacidad (PRD §10). PENDIENTE: requieren revisión profesional. */
  privacy: string | null;
};

export const landingLinks: LandingLinks = {
  platform: '/login',
  demo: null,
  terms: null,
  privacy: null,
};

/** Ancla de la sección de demo: es el destino de "Solicitar una demo" mientras no haya canal. */
export const DEMO_SECTION_ID = 'demo';

/** Adónde lleva "Solicitar una demo": el canal configurado o, si falta, la sección de demo. */
export function demoHref(links: LandingLinks = landingLinks): string {
  return links.demo ?? `#${DEMO_SECTION_ID}`;
}

/** Mostrar los precios de referencia del PRD §6. Apagar si la estrategia comercial cambia. */
export const SHOW_PRICES = true;

/** Aviso de estado en el hero mientras el producto no esté lanzado. `null` lo oculta. */
export const PRODUCT_STATUS: string | null = 'En desarrollo';
