import { describe, expect, it, vi } from 'vitest';
import {
  buildListing,
  createMercadoLibreClient,
  createPkce,
  findByName,
  MercadoLibreError,
  mlStatusFor,
  resolveCategory,
  splitWhatsapp,
  type ListingProperty,
  type MlAttributeDefinition,
  type MlCategory,
} from './mercadolibre.ts';

const property: ListingProperty = {
  title: 'Casa con jardín',
  description: 'Linda casa.',
  operation: 'sale',
  property_type: 'house',
  status: 'available',
  price: 150000,
  currency: 'USD',
  expenses: 50000,
  expenses_currency: 'ARS',
  address: 'Calle Falsa 123',
  show_address: false,
  neighborhood: 'Fisherton',
  rooms: 4,
  bedrooms: 3,
  bathrooms: 2,
  covered_area_m2: 120.5,
  total_area_m2: 300,
  features: ['garage', 'pool'],
};

const definition = (id: string, extra: Partial<MlAttributeDefinition> = {}): MlAttributeDefinition => ({
  id,
  name: id,
  valueType: 'number',
  required: true,
  hidden: false,
  values: [],
  defaultUnit: null,
  units: [],
  ...extra,
});

const settings = {
  category_id: 'MLA401685',
  listing_type_id: 'silver',
  location: {
    state: { id: 'S1', name: 'Santa Fe' },
    city: { id: 'C1', name: 'Rosario' },
    neighborhood: { id: 'N1', name: 'Fisherton' },
  },
};
const contact = { name: 'Inmobiliaria Uno', email: 'hola@uno.com', whatsappE164: '+5493415550000', website: 'https://uno.com' };

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('buildListing', () => {
  const definitions = [
    definition('ROOMS'),
    definition('BEDROOMS'),
    definition('FULL_BATHROOMS'),
    definition('COVERED_AREA', { valueType: 'number_unit' }),
    definition('TOTAL_AREA', { valueType: 'number_unit' }),
    definition('PARKING_LOTS'),
    definition('MAINTENANCE_FEE'),
    definition('FURNISHED', { valueType: 'boolean', values: [{ id: '242085', name: 'Sí' }, { id: '242084', name: 'No' }] }),
    definition('PROPERTY_TYPE', { hidden: true }),
    definition('HAS_POOL', { required: false }),
  ];

  it('completa los atributos que ya conoce y pide los obligatorios que faltan', () => {
    const built = buildListing({ property, pictures: ['https://img/1.jpg'], contact, settings, definitions });
    expect(built.issues).toEqual([{ kind: 'attribute', id: 'FURNISHED', name: 'FURNISHED' }]);
    const attributes = built.create.attributes as Array<{ id: string; value_name?: string }>;
    expect(attributes).toContainEqual({ id: 'COVERED_AREA', value_name: '120.5 m²' });
    expect(attributes).toContainEqual({ id: 'PARKING_LOTS', value_name: '1' });
    expect(attributes).toContainEqual({ id: 'MAINTENANCE_FEE', value_name: '50000 ARS' });
    expect(attributes.find((attribute) => attribute.id === 'PROPERTY_TYPE')).toBeUndefined();
  });

  it('usa los atributos del agente y arma el cuerpo de alta y de actualización', () => {
    const built = buildListing({
      property,
      pictures: ['https://img/1.jpg', 'https://img/2.jpg'],
      contact,
      settings: { ...settings, attributes: { FURNISHED: { value_id: '242084' }, ROOMS: { value_name: '5' } } },
      definitions,
    });
    expect(built.issues).toEqual([]);
    expect(built.create).toMatchObject({
      title: 'Casa con jardín',
      category_id: 'MLA401685',
      price: 150000,
      currency_id: 'USD',
      listing_type_id: 'silver',
      buying_mode: 'classified',
      pictures: [{ source: 'https://img/1.jpg' }, { source: 'https://img/2.jpg' }],
      location: { address_line: 'Calle Falsa 123', neighborhood: { id: 'N1' }, city: { id: 'C1' }, state: { id: 'S1' } },
      seller_contact: { country_code2: '54', phone2: '93415550000', webpage: 'https://uno.com' },
      description: { plain_text: 'Linda casa.' },
    });
    expect(built.create.attributes).toContainEqual({ id: 'ROOMS', value_name: '5' });
    expect(built.create.attributes).toContainEqual({ id: 'FURNISHED', value_id: '242084' });
    expect(built.update).not.toHaveProperty('listing_type_id');
    expect(built.update).not.toHaveProperty('currency_id');
    expect(built.status).toBe('active');
    expect(built.hideAddress).toBe(true);
  });

  it('avisa lo que falta para publicar', () => {
    const built = buildListing({
      property: { ...property, price: null },
      pictures: [],
      contact: { ...contact, whatsappE164: null },
      settings: {},
      definitions: [],
    });
    expect(built.issues.map((issue) => issue.kind)).toEqual(['price', 'pictures', 'location', 'whatsapp', 'category', 'listing_type']);
  });
});

describe('mapeos', () => {
  it('traduce el estado de la propiedad', () => {
    expect(mlStatusFor('available')).toBe('active');
    expect(mlStatusFor('reserved')).toBe('paused');
    expect(mlStatusFor('paused')).toBe('paused');
    expect(mlStatusFor('sold')).toBe('closed');
    expect(mlStatusFor('rented')).toBe('closed');
  });

  it('separa el WhatsApp en código de país y número', () => {
    expect(splitWhatsapp('+5491123456789')).toEqual({ countryCode: '54', number: '91123456789' });
    expect(splitWhatsapp(null)).toBeNull();
    expect(splitWhatsapp('11 2345')).toBeNull();
  });

  it('compara nombres sin acentos ni mayúsculas', () => {
    expect(findByName([{ id: '1', name: 'Depósitos y Galpones' }], 'depositos y galpones')?.id).toBe('1');
    expect(findByName([{ id: '1', name: 'Casas' }], '')).toBeNull();
  });
});

describe('resolveCategory', () => {
  const tree: Record<string, MlCategory> = {
    MLA1459: { id: 'MLA1459', name: 'Inmuebles', children: [{ id: 'MLA1466', name: 'Casas' }, { id: 'MLA79242', name: 'Locales' }] },
    MLA1466: { id: 'MLA1466', name: 'Casas', children: [{ id: 'MLA1468', name: 'Venta' }, { id: 'MLA1467', name: 'Alquiler' }] },
    MLA1468: {
      id: 'MLA1468',
      name: 'Venta',
      children: [{ id: 'MLA401805', name: 'Emprendimientos' }, { id: 'MLA401685', name: 'Propiedades Individuales' }],
    },
    MLA1467: { id: 'MLA1467', name: 'Alquiler', children: [] },
    MLA79242: { id: 'MLA79242', name: 'Locales', children: [] },
  };
  const getCategory = async (id: string) => tree[id] ?? { id, name: id, children: [] };

  it('baja hasta "Propiedades Individuales"', async () => {
    expect(await resolveCategory(getCategory, 'sale', 'house')).toBe('MLA401685');
  });
  it('usa la operación si ya es la categoría final', async () => {
    expect(await resolveCategory(getCategory, 'rent', 'house')).toBe('MLA1467');
  });
  it('devuelve null si Mercado Libre no tiene la combinación', async () => {
    expect(await resolveCategory(getCategory, 'temporary_rent', 'house')).toBeNull();
    expect(await resolveCategory(getCategory, 'sale', 'farm')).toBeNull();
  });
});

describe('createMercadoLibreClient', () => {
  const config = { clientId: '123', clientSecret: 'secreto', redirectUri: 'https://app.test/api/integraciones/mercadolibre/callback' };

  it('arma la URL de autorización con PKCE y state', async () => {
    const { challenge, verifier } = await createPkce();
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    const url = new URL(createMercadoLibreClient(config).authorizationUrl({ state: 'abc', codeChallenge: challenge }));
    expect(url.origin + url.pathname).toBe('https://auth.mercadolibre.com.ar/authorization');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: '123',
      redirect_uri: config.redirectUri,
      state: 'abc',
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });
  });

  it('cambia el código por tokens', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ access_token: 'APP_USR-1', refresh_token: 'TG-1', expires_in: 21600, user_id: 99, token_type: 'bearer' }),
    );
    const client = createMercadoLibreClient({ ...config, fetch: fetchMock as unknown as typeof fetch });
    const tokens = await client.exchangeCode({ code: 'TG-code', codeVerifier: 'v' });
    expect(tokens).toMatchObject({ accessToken: 'APP_USR-1', refreshToken: 'TG-1', userId: 99 });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.mercadolibre.com/oauth/token');
    expect(Object.fromEntries(new URLSearchParams(String(init.body)))).toEqual({
      client_id: '123',
      client_secret: 'secreto',
      grant_type: 'authorization_code',
      code: 'TG-code',
      redirect_uri: config.redirectUri,
      code_verifier: 'v',
    });
  });

  it('manda el token por header y traduce los errores con sus motivos', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ message: 'Validation error', error: 'validation_error', status: 400, cause: [{ code: 'x', message: 'Falta FURNISHED' }] }, 400),
    );
    const client = createMercadoLibreClient({ ...config, fetch: fetchMock as unknown as typeof fetch });
    const error = await client.createItem('APP_USR-1', { title: 'x' }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MercadoLibreError);
    expect(error).toMatchObject({ code: 'validation_error', httpStatus: 400, causes: ['Falta FURNISHED'] });
    expect((error as MercadoLibreError).transient).toBe(false);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer APP_USR-1');
    expect(String(error)).not.toContain('APP_USR');
  });

  it('lee atributos, ubicaciones y publicaciones', async () => {
    const responses: Record<string, unknown> = {
      '/categories/MLA401685/attributes': [
        { id: 'FURNISHED', name: 'Amoblado', value_type: 'boolean', tags: { required: true }, values: [{ id: '1', name: 'Sí' }] },
        { id: 'OPERATION', name: 'Operación', tags: { required: true } },
      ],
      '/classified_locations/states/S1': { id: 'S1', name: 'Santa Fe', cities: [{ id: 'C1', name: 'Rosario' }] },
      '/items/MLA1': { id: 'MLA1', permalink: 'https://casa.mercadolibre.com.ar/MLA-1', status: 'paused' },
    };
    const fetchMock = vi.fn(async (url: string) => jsonResponse(responses[new URL(url).pathname]));
    const client = createMercadoLibreClient({ ...config, fetch: fetchMock as unknown as typeof fetch });
    const attributes = await client.categoryAttributes('t', 'MLA401685');
    expect(attributes.map((attribute) => [attribute.id, attribute.required, attribute.hidden])).toEqual([
      ['FURNISHED', true, false],
      ['OPERATION', true, true],
    ]);
    expect(await client.location('t', 'state', 'S1')).toEqual({ id: 'S1', name: 'Santa Fe', children: [{ id: 'C1', name: 'Rosario' }] });
    expect(await client.updateItem('t', 'MLA1', { status: 'paused' })).toEqual({
      id: 'MLA1',
      permalink: 'https://casa.mercadolibre.com.ar/MLA-1',
      status: 'paused',
    });
  });

  it('distingue errores para reintentar', async () => {
    const client = createMercadoLibreClient({ ...config, fetch: (async () => jsonResponse({}, 503)) as unknown as typeof fetch });
    const error = (await client.me('t').catch((caught: unknown) => caught)) as MercadoLibreError;
    expect(error.transient).toBe(true);
    const offline = createMercadoLibreClient({ ...config, fetch: (async () => { throw new Error('red'); }) as unknown as typeof fetch });
    expect(await offline.me('t').catch((caught: unknown) => (caught as MercadoLibreError).code)).toBe('unreachable');
  });
});
