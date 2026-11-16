# ADR 0012 — Publicaciones externas, Mercado Libre y API de propiedades

- Estado: accepted
- Fecha: 2026-11-15

## Contexto

Las inmobiliarias publican la misma propiedad en su web, en Mercado Libre, en Zonaprop y en Argenprop. El PRD dejaba fuera del MVP la integración con portales (§7) y preveía un feed para webs propias (F-33, P1). Santiago aprobó el 15/11/2026:

1. Registrar en cada propiedad dónde está publicada (links).
2. Dejar lista la publicación en Mercado Libre por su API, para que solo falte crear la aplicación en Mercado Libre y cargar sus credenciales.
3. Una forma de que la web propia de una inmobiliaria muestre las propiedades cargadas en InmoPanel.

Contexto relevado (15/11/2026):

- **Mercado Libre:** tiene una API pública y documentada para inmuebles. Se autoriza con OAuth 2.0 (Authorization Code, con PKCE opcional). El access token dura 6 horas y el refresh token es de un solo uso. Las publicaciones se hacen con `POST /items`, la categoría se elige recorriendo el árbol de Inmuebles (`MLA1459`) y los atributos obligatorios dependen de cada categoría. La ubicación usa los IDs de `classified_locations`. Desde el 01/10/2026 es obligatorio `seller_contact` con un WhatsApp (`country_code2` y `phone2`). Además, el vendedor necesita un paquete de publicación contratado.
- **Zonaprop y Argenprop (Navent):** no tienen documentación pública abierta. La integración se hace a través de integradores habilitados y con credenciales que entrega el portal. Dependen de un acuerdo comercial que todavía no existe.

## Decisión

- **Links por canal (`property_listings`):** una fila por propiedad y canal (`website`, `mercadolibre`, `zonaprop`, `argenprop`). La fila puede ser manual, con un link que pega el agente, o gestionada, porque InmoPanel publicó la propiedad por API. Solo Mercado Libre puede ser gestionado. Una fila gestionada no se edita a mano.
- **Sitio web de la inmobiliaria:** se guarda en `organizations.website_url` y se muestra en la página pública de cada propiedad.
- **Mercado Libre:**
  - **Conexión:** una cuenta de Mercado Libre por inmobiliaria, y la conecta solo el dueño.
  - **Credenciales:** los tokens se guardan cifrados con AES-256-GCM, con la clave `INTEGRATIONS_ENCRYPTION_KEY`, en columnas que ningún usuario puede leer. Solo el servidor los descifra.
  - **Dónde corren las llamadas:** en el servidor web (Server Actions y `after()`), no en el worker. Así funciona sin el VPS, con el mismo criterio que el ADR 0011.
  - **Renovación del token:** como el refresh token es de un solo uso, se renueva con una reserva corta en la base (`mercadolibre_token_lease`) para que dos pedidos no lo gasten a la vez.
  - **Publicar:** cualquier miembro que puede editar la propiedad. Usa el cupo del paquete de la inmobiliaria.
  - **Categoría:** sale de la operación y el tipo, recorriendo el árbol de categorías por nombre.
  - **Atributos:** se completan solos los que InmoPanel ya tiene. Los obligatorios que faltan los carga el agente en un formulario que se arma con la definición de la categoría.
  - **Ubicación:** el agente la elige de las listas de Mercado Libre, con una sugerencia por nombre.
  - **Sincronización:** al editar la propiedad o sus fotos se sincroniza sola, y también hay un botón para hacerlo a mano. Los estados se traducen así:
    - Disponible → activa.
    - Reservada, pausada o borrador → pausada.
    - Vendida o alquilada → finalizada. En Mercado Libre no se puede reactivar: si la propiedad vuelve a estar disponible, se crea una publicación nueva.
  - **Consultas:** las de Mercado Libre (leads) quedan fuera de este incremento. Se pueden leer con `/vis/users/{id}/leads/buyers` en un incremento posterior.
- **API de propiedades para webs propias (F-33):**
  - **Endpoint:** `GET /api/v1/propiedades`, de solo lectura y sin acceso desde el navegador del visitante. Se autentica con `Authorization: Bearer <token>`.
  - **Token:** lo genera el dueño, se muestra una sola vez y se guarda como hash SHA-256.
  - **Qué devuelve:** solo campos publicables, los mismos de la página pública, más su URL. Con `desde`, devuelve los cambios desde una fecha y los códigos retirados.
  - **Integraciones a medida:** no hay una por proveedor de web; la web de la inmobiliaria consume esta API. No se pide acceso a la web del cliente ni se guardan sus contraseñas.
- **Zonaprop y Argenprop:** solo links manuales hasta tener acceso como integrador.

## Alternativas consideradas

- **Que InmoPanel escriba en la web del cliente:** exige una integración por cada plataforma y guardar accesos ajenos. Se descarta.
- **Llamadas a Mercado Libre desde el worker:** el worker todavía no tiene dónde correr (ADR 0010 y 0011). Se puede mover cuando exista el VPS, sin cambiar el modelo de datos.
- **Guardar los tokens en Supabase Vault:** agrega una dependencia de configuración por ambiente. El cifrado en la app con una clave del servidor alcanza para separar la base de la clave.
- **Automatizar el navegador o hacer scraping de los portales:** viola los términos de los portales y se rompe con cualquier cambio.

## Consecuencias

- Nuevas variables de servidor: `MERCADOLIBRE_CLIENT_ID`, `MERCADOLIBRE_CLIENT_SECRET` e `INTEGRATIONS_ENCRYPTION_KEY`. Sin ellas, el panel avisa que Mercado Libre no está habilitado.
- La URL de retorno que hay que registrar en Mercado Libre es exacta: `<NEXT_PUBLIC_APP_URL>/api/integraciones/mercadolibre/callback`.
- Si se pierde o se cambia `INTEGRATIONS_ENCRYPTION_KEY`, cada inmobiliaria tiene que volver a conectar Mercado Libre.
- No se probó contra Mercado Libre real: se verificó contra un servidor de prueba local con el contrato documentado. La primera publicación real es también su prueba.

## Referencias

- https://developers.mercadolibre.com.ar/autenticacion-y-autorizacion
- https://developers.mercadolibre.com.ar/publica-inmueble
- https://developers.mercadolibre.com.ar/actualiza-tus-publicaciones
- https://developers.mercadolibre.com.ar/categorias-inmuebles
- https://developers.mercadolibre.com.ar/localizar-inmuebles
- https://developers.mercadolibre.com.ar/leads-inmuebles
