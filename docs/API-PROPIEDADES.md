# API de propiedades de InmoPanel

Esta guía es para quien desarrolla la web de una inmobiliaria que usa InmoPanel. La API sirve para mostrar en esa web las propiedades cargadas en InmoPanel sin cargarlas dos veces (F-33, ADR 0012).

## Acceso

- El dueño de la inmobiliaria crea un token en **Integraciones → Tu sitio web**. El token se muestra una sola vez; si se pierde, se revoca y se crea otro.
- Cada pedido manda el token en el header: `Authorization: Bearer ipk_…`.
- Los pedidos se hacen de servidor a servidor, desde el backend de la web, un job programado o la generación estática del sitio. El token no tiene que estar en código que corra en el navegador de los visitantes. Por eso la API no habilita CORS.
- Límite: 120 pedidos por minuto por token.

## `GET /api/v1/propiedades`

Parámetros (todos opcionales):

| Parámetro | Descripción |
|---|---|
| `limite` | Propiedades por página, de 1 a 100. Por defecto, 50. |
| `pagina` | Página, desde 1. |
| `desde` | Fecha ISO 8601. Devuelve solo lo que cambió después de esa fecha, más `removed`. |

Ejemplo:

```bash
curl -H "Authorization: Bearer ipk_..." "https://<dominio-de-inmopanel>/api/v1/propiedades?limite=50&pagina=1"
```

Respuesta:

```json
{
  "organization": { "name": "…", "slug": "…", "website_url": "https://…", "phone": "+549…", "email": "…" },
  "page": 1,
  "limit": 50,
  "total": 12,
  "properties": [
    {
      "code": "PRO-000123",
      "slug": "depto-3-amb-en-belgrano-123",
      "title": "…",
      "description": "…",
      "operation": "sale",
      "property_type": "apartment",
      "status": "available",
      "price": 98000,
      "currency": "USD",
      "expenses": 50000,
      "expenses_currency": "ARS",
      "province": "…",
      "city": "…",
      "neighborhood": "…",
      "address": "",
      "rooms": 3,
      "bedrooms": 2,
      "bathrooms": 1,
      "covered_area_m2": 70,
      "total_area_m2": 75,
      "features": ["balcony", "garage"],
      "images": ["https://…/storage/v1/object/public/property-images/…"],
      "url": "https://<dominio-de-inmopanel>/p/<inmobiliaria>/<propiedad>",
      "published_at": "2026-11-15T12:00:00Z",
      "updated_at": "2026-11-15T12:00:00Z"
    }
  ],
  "removed": []
}
```

- Solo se devuelven propiedades publicadas: disponibles, reservadas, vendidas o alquiladas. Nunca borradores, pausadas, datos del propietario ni notas internas.
- `address` viene vacío si la inmobiliaria eligió no mostrar la dirección exacta.
- `operation` puede ser `sale`, `rent` o `temporary_rent`.
- `property_type` puede ser `apartment`, `house`, `ph`, `land`, `office`, `commercial`, `garage`, `warehouse` o `farm`.
- `status` puede ser `available`, `reserved`, `sold` o `rented`.
- `features` son claves del catálogo de características de InmoPanel.
- `code` identifica la propiedad y no cambia nunca.

## Sincronizar

- **Simple:** pedir todas las páginas cada tanto (por ejemplo, cada hora) y reemplazar lo que haya.
- **Incremental:** guardar la fecha del último pedido y mandarla en `desde`. Las propiedades que vienen en `properties` se crean o se actualizan por `code`. Las de `removed` se sacan de la web porque se pausaron, volvieron a borrador o se fusionaron con otra.
- Borrar una foto no cambia `updated_at`. Conviene hacer una sincronización completa una vez por día.

## Errores

| Estado | `error` | Cuándo |
|---|---|---|
| 400 | `invalid_since` | `desde` no es una fecha válida. |
| 401 | `unauthorized` | Falta el token, no existe, fue revocado o la cuenta de la inmobiliaria no está habilitada. |
| 429 | `rate_limited` | Más de 120 pedidos en un minuto. |
| 500 | `unexpected` | Error de InmoPanel; reintentar más tarde. |
