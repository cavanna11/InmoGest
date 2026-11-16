/**
 * Cliente de la API de Mercado Libre para inmuebles (Argentina, MLA) y armado de publicaciones (ADR 0012).
 * Contrato tomado de developers.mercadolibre.com.ar (Autenticación, Publica Inmuebles, Actualiza tus
 * publicaciones, Categorías, Atributos, Localizar Inmuebles), consultado el 15/11/2026.
 * Nunca incluye tokens ni el client secret en errores o logs.
 */

export const ML_SITE_ID = 'MLA';
/** Categoría raíz "Inmuebles" de Argentina. */
export const ML_REAL_ESTATE_CATEGORY = 'MLA1459';
export const ML_COUNTRY_ID = 'AR';
export const ML_LISTING_TYPES = ['silver', 'gold', 'gold_premium'] as const;

const DEFAULT_API_URL = 'https://api.mercadolibre.com';
const DEFAULT_AUTH_URL = 'https://auth.mercadolibre.com.ar';
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_PICTURES = 30;

export class MercadoLibreError extends Error {
  constructor(
    readonly code: string,
    readonly httpStatus: number | null = null,
    /** Motivos que devuelve Mercado Libre (por ejemplo, atributos faltantes), sin datos personales. */
    readonly causes: string[] = [],
  ) {
    super(code);
    this.name = 'MercadoLibreError';
  }

  /** Token vencido o revocado: hay que renovar, o volver a conectar si la renovación también falla. */
  get unauthorized(): boolean {
    return this.httpStatus === 401;
  }

  /** Vale la pena reintentar más tarde (red, límite de pedidos, error del servidor). */
  get transient(): boolean {
    return this.httpStatus === null || this.httpStatus === 429 || this.httpStatus >= 500;
  }
}

export type MercadoLibreConfig = {
  clientId: string;
  clientSecret: string;
  /** Exacta a la registrada en la aplicación de Mercado Libre. */
  redirectUri: string;
  /** Solo para pruebas locales contra un servidor falso. */
  apiUrl?: string | undefined;
  authUrl?: string | undefined;
  fetch?: typeof fetch;
};

export type MlTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  userId: number;
};

export type MlNamed = { id: string; name: string };
export type MlCategory = MlNamed & { children: MlNamed[] };
export type MlLocation = MlNamed & { children: MlNamed[] };

export type MlAttributeDefinition = {
  id: string;
  name: string;
  valueType: string;
  required: boolean;
  /** Atributos de solo lectura o que fija la categoría: no se le piden al agente. */
  hidden: boolean;
  values: MlNamed[];
  defaultUnit: string | null;
  units: string[];
};

export type MlItem = { id: string; permalink: string | null; status: string };

type Json = Record<string, unknown>;

const asRecord = (value: unknown): Json | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Json) : null;
const asString = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

function named(value: unknown): MlNamed | null {
  const record = asRecord(value);
  const id = asString(record?.id);
  const name = asString(record?.name);
  return id && name ? { id, name } : null;
}

const namedList = (value: unknown): MlNamed[] => asArray(value).map(named).filter((item) => item !== null);

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** PKCE (S256): el verifier queda en el servidor y el challenge viaja en la URL de autorización. */
export async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const verifier = toBase64Url(crypto.getRandomValues(new Uint8Array(48)));
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: toBase64Url(new Uint8Array(digest)) };
}

function errorCauses(body: unknown): string[] {
  const record = asRecord(body);
  const causes = asArray(record?.cause)
    .map((cause) => asString(asRecord(cause)?.message))
    .filter((message): message is string => message !== null);
  const message = asString(record?.message);
  return (causes.length > 0 ? causes : message ? [message] : []).map((text) => text.slice(0, 300)).slice(0, 5);
}

function parseTokens(body: unknown): MlTokens {
  const record = asRecord(body);
  const accessToken = asString(record?.access_token);
  const refreshToken = asString(record?.refresh_token);
  const expiresIn = typeof record?.expires_in === 'number' ? record.expires_in : null;
  const userId = typeof record?.user_id === 'number' ? record.user_id : null;
  if (!accessToken || !refreshToken || expiresIn === null || userId === null) {
    throw new MercadoLibreError('invalid_token_response');
  }
  return { accessToken, refreshToken, expiresAt: new Date(Date.now() + expiresIn * 1000), userId };
}

function parseItem(body: unknown): MlItem {
  const record = asRecord(body);
  const id = asString(record?.id);
  if (!id) throw new MercadoLibreError('invalid_item_response');
  return { id, permalink: asString(record?.permalink), status: asString(record?.status) ?? 'active' };
}

function parseAttribute(value: unknown): MlAttributeDefinition | null {
  const record = asRecord(value);
  const id = asString(record?.id);
  if (!record || !id) return null;
  const tags = asRecord(record.tags) ?? {};
  return {
    id,
    name: asString(record.name) ?? id,
    valueType: asString(record.value_type) ?? 'string',
    required: tags.required === true,
    hidden: tags.read_only === true || tags.hidden === true || tags.fixed === true || CATEGORY_ATTRIBUTES.has(id),
    values: namedList(record.values),
    defaultUnit: asString(record.default_unit),
    units: asArray(record.allowed_units)
      .map((unit) => asString(asRecord(unit)?.id))
      .filter((unit): unit is string => unit !== null),
  };
}

export type MercadoLibreClient = ReturnType<typeof createMercadoLibreClient>;

export function createMercadoLibreClient(config: MercadoLibreConfig) {
  const apiUrl = (config.apiUrl ?? DEFAULT_API_URL).replace(/\/+$/, '');
  const authUrl = (config.authUrl ?? DEFAULT_AUTH_URL).replace(/\/+$/, '');
  const doFetch = config.fetch ?? fetch;

  async function send(url: string, init: RequestInit): Promise<unknown> {
    let response: Response;
    try {
      response = await doFetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch {
      throw new MercadoLibreError('unreachable');
    }
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (!response.ok) {
      const code = asString(asRecord(body)?.error) ?? `http_${response.status}`;
      throw new MercadoLibreError(code.slice(0, 80), response.status, errorCauses(body));
    }
    return body;
  }

  function api(token: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown) {
    return send(`${apiUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  function oauth(params: Record<string, string>) {
    return send(`${apiUrl}/oauth/token`, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }).toString(),
    });
  }

  return {
    authorizationUrl({ state, codeChallenge }: { state: string; codeChallenge: string }): string {
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });
      return `${authUrl}/authorization?${params.toString()}`;
    },

    async exchangeCode({ code, codeVerifier }: { code: string; codeVerifier: string }): Promise<MlTokens> {
      return parseTokens(
        await oauth({ grant_type: 'authorization_code', code, redirect_uri: config.redirectUri, code_verifier: codeVerifier }),
      );
    },

    async refresh(refreshToken: string): Promise<MlTokens> {
      return parseTokens(await oauth({ grant_type: 'refresh_token', refresh_token: refreshToken }));
    },

    async me(token: string): Promise<{ id: number; nickname: string }> {
      const record = asRecord(await api(token, 'GET', '/users/me'));
      if (typeof record?.id !== 'number') throw new MercadoLibreError('invalid_user_response');
      return { id: record.id, nickname: asString(record.nickname) ?? '' };
    },

    async category(token: string, categoryId: string): Promise<MlCategory> {
      const record = asRecord(await api(token, 'GET', `/categories/${encodeURIComponent(categoryId)}`));
      const base = named(record);
      if (!base) throw new MercadoLibreError('invalid_category_response');
      return { ...base, children: namedList(record?.children_categories) };
    },

    async categoryAttributes(token: string, categoryId: string): Promise<MlAttributeDefinition[]> {
      const body = await api(token, 'GET', `/categories/${encodeURIComponent(categoryId)}/attributes`);
      return asArray(body).map(parseAttribute).filter((item) => item !== null);
    },

    /** Tipos de publicación que el vendedor puede usar en la categoría (según sus paquetes). */
    async availableListingTypes(token: string, userId: number, categoryId: string): Promise<MlNamed[]> {
      const body = await api(
        token,
        'GET',
        `/users/${userId}/available_listing_types?category_id=${encodeURIComponent(categoryId)}`,
      );
      const record = asRecord(body);
      return namedList(record ? record.available : body);
    },

    /** País (AR) → provincias, provincia → ciudades, ciudad → barrios. */
    async location(token: string, kind: 'country' | 'state' | 'city', id: string): Promise<MlLocation> {
      const path = { country: 'countries', state: 'states', city: 'cities' }[kind];
      const childrenKey = { country: 'states', state: 'cities', city: 'neighborhoods' }[kind];
      const record = asRecord(await api(token, 'GET', `/classified_locations/${path}/${encodeURIComponent(id)}`));
      const base = named(record);
      if (!base) throw new MercadoLibreError('invalid_location_response');
      return { ...base, children: namedList(record?.[childrenKey]) };
    },

    async createItem(token: string, body: Json): Promise<MlItem> {
      return parseItem(await api(token, 'POST', '/items', body));
    },

    async updateItem(token: string, itemId: string, body: Json): Promise<MlItem> {
      return parseItem(await api(token, 'PUT', `/items/${encodeURIComponent(itemId)}`, body));
    },

    async updateDescription(token: string, itemId: string, plainText: string): Promise<void> {
      await api(token, 'PUT', `/items/${encodeURIComponent(itemId)}/description`, { plain_text: plainText });
    },

    /** Oculta (o vuelve a mostrar) la dirección exacta; la publicación conserva la zona. */
    async setAddressHidden(token: string, itemId: string, hidden: boolean): Promise<void> {
      try {
        await api(token, hidden ? 'PUT' : 'DELETE', `/items/${encodeURIComponent(itemId)}/address_line_by_reference`);
      } catch (error) {
        // Ya estaba en ese estado.
        if (!(error instanceof MercadoLibreError) || (error.httpStatus !== 404 && error.httpStatus !== 409)) throw error;
      }
    },
  };
}

// -----------------------------------------------------------------------------
// Armado de la publicación a partir de la propiedad (funciones puras, con tests).
// -----------------------------------------------------------------------------

/** Atributos que define la categoría elegida: no se cargan a mano. */
const CATEGORY_ATTRIBUTES = new Set(['PROPERTY_TYPE', 'OPERATION', 'OPERATION_SUBTYPE']);

export type PropertyOperation = 'sale' | 'rent' | 'temporary_rent';
export type PropertyKind = 'apartment' | 'house' | 'ph' | 'land' | 'office' | 'commercial' | 'garage' | 'warehouse' | 'farm';
export type PropertyStatusValue = 'draft' | 'available' | 'reserved' | 'sold' | 'rented' | 'paused';

/** Nombres de las categorías de Mercado Libre para cada tipo y operación de InmoPanel. */
export const ML_TYPE_CATEGORY: Record<PropertyKind, string> = {
  apartment: 'Departamentos',
  house: 'Casas',
  ph: 'PH',
  land: 'Terrenos y Lotes',
  office: 'Oficinas',
  commercial: 'Locales',
  garage: 'Cocheras',
  warehouse: 'Depósitos y Galpones',
  farm: 'Campos',
};
export const ML_OPERATION_CATEGORY: Record<PropertyOperation, string> = {
  sale: 'Venta',
  rent: 'Alquiler',
  temporary_rent: 'Alquiler Temporario',
};
const INDIVIDUAL_PROPERTY = 'Propiedades Individuales';

export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function findByName<T extends MlNamed>(items: T[], name: string): T | null {
  const target = normalizeName(name);
  if (!target) return null;
  return items.find((item) => normalizeName(item.name) === target) ?? null;
}

/**
 * Categoría final: Inmuebles → tipo → operación → "Propiedades Individuales" (si existe ese nivel).
 * Null si Mercado Libre no tiene esa combinación (por ejemplo, alquiler temporario de un galpón).
 */
export async function resolveCategory(
  getCategory: (id: string) => Promise<MlCategory>,
  operation: PropertyOperation,
  kind: PropertyKind,
): Promise<string | null> {
  const root = await getCategory(ML_REAL_ESTATE_CATEGORY);
  const type = findByName(root.children, ML_TYPE_CATEGORY[kind]);
  if (!type) return null;
  const operationCategory = findByName((await getCategory(type.id)).children, ML_OPERATION_CATEGORY[operation]);
  if (!operationCategory) return null;
  const leaf = await getCategory(operationCategory.id);
  if (leaf.children.length === 0) return leaf.id;
  return findByName(leaf.children, INDIVIDUAL_PROPERTY)?.id ?? null;
}

/** Estado de la publicación en Mercado Libre según el estado de la propiedad. */
export function mlStatusFor(status: PropertyStatusValue): 'active' | 'paused' | 'closed' {
  if (status === 'available') return 'active';
  if (status === 'sold' || status === 'rented') return 'closed';
  return 'paused';
}

/** WhatsApp para seller_contact: código de país y el resto, solo dígitos (obligatorio desde 01/10/2026). */
export function splitWhatsapp(phoneE164: string | null): { countryCode: string; number: string } | null {
  if (!phoneE164 || !/^\+[1-9]\d{6,14}$/.test(phoneE164)) return null;
  const digits = phoneE164.slice(1);
  // Argentina (+54) es el caso del MVP; para otros países se toma un código de 1 a 3 dígitos conocido.
  const countryCode = digits.startsWith('54') ? '54' : digits.startsWith('1') ? '1' : digits.slice(0, 2);
  return { countryCode, number: digits.slice(countryCode.length) };
}

export type AttributeValue = { value_id?: string; value_name?: string };
export type MlListingSettings = {
  category_id?: string;
  listing_type_id?: string;
  location?: { state?: MlNamed; city?: MlNamed; neighborhood?: MlNamed };
  attributes?: Record<string, AttributeValue>;
};

export type ListingProperty = {
  title: string;
  description: string;
  operation: PropertyOperation;
  property_type: PropertyKind;
  status: PropertyStatusValue;
  price: number | null;
  currency: string;
  expenses: number | null;
  expenses_currency: string;
  address: string;
  show_address: boolean;
  neighborhood: string;
  rooms: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  covered_area_m2: number | null;
  total_area_m2: number | null;
  features: string[];
};

export type ListingContact = {
  name: string;
  email: string | null;
  whatsappE164: string | null;
  website: string | null;
};

const area = (value: number) => `${Number(value.toFixed(2))} m²`;

/** Atributos que InmoPanel ya conoce. Solo se mandan los que la categoría define. */
export function automaticAttributes(property: ListingProperty): Record<string, AttributeValue> {
  const values: Record<string, AttributeValue> = {};
  if (property.rooms !== null) values.ROOMS = { value_name: String(property.rooms) };
  if (property.bedrooms !== null) values.BEDROOMS = { value_name: String(property.bedrooms) };
  if (property.bathrooms !== null) values.FULL_BATHROOMS = { value_name: String(property.bathrooms) };
  if (property.covered_area_m2 !== null) values.COVERED_AREA = { value_name: area(property.covered_area_m2) };
  if (property.total_area_m2 !== null) values.TOTAL_AREA = { value_name: area(property.total_area_m2) };
  values.MAINTENANCE_FEE = { value_name: `${property.expenses ?? 0} ${property.expenses_currency}` };
  values.PARKING_LOTS = { value_name: property.features.includes('garage') ? '1' : '0' };
  return values;
}

export type ListingIssue =
  | { kind: 'attribute'; id: string; name: string }
  | { kind: 'price' | 'pictures' | 'location' | 'whatsapp' | 'category' | 'listing_type' };

export type BuiltListing = {
  /** Cuerpo para POST /items. */
  create: Json;
  /** Cuerpo para PUT /items/{id}: solo los campos que Mercado Libre deja modificar. */
  update: Json;
  /** Estado que corresponde en Mercado Libre; se manda aparte del contenido. */
  status: 'active' | 'paused' | 'closed';
  description: string;
  hideAddress: boolean;
  issues: ListingIssue[];
};

/**
 * Arma la publicación. Los atributos cargados por el agente pisan a los automáticos. `issues` lista lo
 * que falta para que Mercado Libre la acepte; si no está vacío, no se publica.
 */
export function buildListing(input: {
  property: ListingProperty;
  pictures: string[];
  contact: ListingContact;
  settings: MlListingSettings;
  definitions: MlAttributeDefinition[];
}): BuiltListing {
  const { property, contact, settings, definitions } = input;
  const issues: ListingIssue[] = [];
  const defined = new Map(definitions.map((definition) => [definition.id, definition]));

  const merged: Record<string, AttributeValue> = { ...automaticAttributes(property), ...(settings.attributes ?? {}) };
  const attributes = Object.entries(merged)
    .filter(([id, value]) => defined.has(id) && !defined.get(id)?.hidden && (value.value_id || value.value_name))
    .map(([id, value]) => ({ id, ...(value.value_id ? { value_id: value.value_id } : { value_name: value.value_name }) }));
  const sent = new Set(attributes.map((attribute) => attribute.id));
  for (const definition of definitions) {
    if (definition.required && !definition.hidden && !sent.has(definition.id)) {
      issues.push({ kind: 'attribute', id: definition.id, name: definition.name });
    }
  }

  if (property.price === null) issues.push({ kind: 'price' });
  const pictures = input.pictures.slice(0, MAX_PICTURES).map((source) => ({ source }));
  if (pictures.length === 0) issues.push({ kind: 'pictures' });
  const location = settings.location;
  if (!location?.neighborhood?.id || !location.city?.id || !location.state?.id) issues.push({ kind: 'location' });
  const whatsapp = splitWhatsapp(contact.whatsappE164);
  if (!whatsapp) issues.push({ kind: 'whatsapp' });
  if (!settings.category_id) issues.push({ kind: 'category' });
  if (!settings.listing_type_id) issues.push({ kind: 'listing_type' });

  const addressLine = property.address.trim() || location?.neighborhood?.name || property.neighborhood;
  const locationBody = {
    address_line: addressLine,
    ...(location?.neighborhood ? { neighborhood: { id: location.neighborhood.id } } : {}),
    ...(location?.city ? { city: { id: location.city.id } } : {}),
    ...(location?.state ? { state: { id: location.state.id } } : {}),
  };
  const sellerContact = {
    contact: contact.name.slice(0, 100),
    email: contact.email ?? '',
    webpage: contact.website ?? '',
    other_info: '',
    country_code: whatsapp?.countryCode ?? '',
    area_code: '',
    phone: whatsapp?.number ?? '',
    country_code2: whatsapp?.countryCode ?? '',
    phone2: whatsapp?.number ?? '',
  };
  const title = property.title.trim().slice(0, 200);
  const description = property.description.trim() || title;

  const common = {
    title,
    category_id: settings.category_id ?? '',
    price: property.price ?? 0,
    pictures,
    location: locationBody,
    attributes,
    seller_contact: sellerContact,
  };
  return {
    create: {
      ...common,
      currency_id: property.currency,
      available_quantity: 1,
      buying_mode: 'classified',
      condition: 'not_specified',
      channels: ['marketplace'],
      listing_type_id: settings.listing_type_id ?? '',
      description: { plain_text: description },
    },
    update: common,
    status: mlStatusFor(property.status),
    description,
    hideAddress: !property.show_address,
    issues,
  };
}
