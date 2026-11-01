# Identidad de marca — InmoPanel by C&C

> **Estado (02/11/2026):** nombre y posicionamiento **definidos**. Identidad gráfica (logo, paleta, tipografía) **sin definir**: la app usa una identidad visual **provisoria** neutra (`docs/DESIGN-SYSTEM.md`). Al definirla, colores y tipografía se cargan en `frontend/styles/tokens.css` y deben pasar el test de contraste WCAG (`frontend/styles/tokens.test.ts`).

## Nombre y escritura

| Elemento | Valor |
|---|---|
| Producto | **InmoPanel** |
| Nombre comercial completo | **InmoPanel by C&C** |
| Empresa desarrolladora | **C&C** |
| Categoría | Plataforma SaaS de gestión inmobiliaria |
| Mercado | Inmobiliarias y profesionales del sector de Latinoamérica (el MVP se enfoca en Argentina) |
| Idioma | Español (rioplatense en el MVP) |

- Se escribe **InmoPanel**: una sola palabra, con I y P mayúsculas. Nunca "Inmopanel", "Inmo Panel" ni "INMOPANEL" en texto corrido.
- "by" va en minúscula: **InmoPanel by C&C**. "C&C" siempre con el ampersand.
- Primera mención o contexto comercial (landing, título del sitio, emails, pie): "InmoPanel by C&C". Dentro de la app y en textos donde ya quedó claro: "InmoPanel".

## Presentación

- **InmoPanel es la marca protagonista; C&C es el respaldo corporativo.** En encabezados, "InmoPanel" en el peso y tamaño principales y "by C&C" debajo o al costado, más chico y en color atenuado (`text-muted-foreground`), sin competir visualmente.
- Mientras no exista logotipo, el nombre se muestra como **texto** con la tipografía de la app. No inventar isotipos, logos ni ilustraciones de marca.

## Descriptor y mensajes

- **Descriptor principal:** "Gestión inmobiliaria inteligente."
- **Frase complementaria:** "Todo tu negocio inmobiliario, en un solo lugar."
- Pueden adaptarse al contexto conservando el posicionamiento.

## Posicionamiento

InmoPanel centraliza y organiza la operación comercial de una inmobiliaria: contactos, conversaciones, propiedades, búsquedas, oportunidades, agenda, seguimiento de clientes y automatizaciones, con toda la información en un solo lugar.

- **No** presentarlo como una agenda de propiedades ni como un "CRM genérico". "CRM" puede aparecer como término funcional (por ejemplo, para describir una función), no como definición del producto.
- No prometer lo que el PRD marca como riesgo (por ejemplo, que el número de WhatsApp no se bloquee) ni funciones fuera del PRD.

## Nombres anteriores

"InmoGest" (y variantes como "InmoGestión") fueron nombres provisionales. Son **históricos** y no se usan en interfaz, documentación nueva ni material comercial. Persisten solo donde cambiarlos rompería algo sin beneficio para el usuario:

| Identificador | Dónde | Motivo para conservarlo |
|---|---|---|
| Carpeta `InmoGest/` y repositorio `cavanna11/InmoGest` | Disco, GitHub | Renombrarlos afecta el remoto, worktrees, la integración con Vercel y rutas locales. Decisión de C&C. |
| Paquetes `@inmogest/web`, `@inmogest/shared`, `@inmogest/worker` y raíz `inmogest` | `package.json`, imports | Internos, no publicados ni visibles. Cambiarlos toca imports, lockfile y configuración sin beneficio. |
| `project_id = "inmogest"` | `backend/supabase/config.toml` | Solo nombra los contenedores del Supabase local de CI. |
| Emails de prueba `@inmogest.test` | Seed y tests | Usuarios ficticios ya creados en la base de desarrollo; dominio reservado `.test`. |
| Comentarios en migraciones aplicadas, commits | Historial | No se editan registros históricos. |

## Dominio

- Previsto: `inmopanel.com.ar` — **todavía no comprado ni configurado**. A futuro, `inmopanel.com` o `inmopanel.ai` según disponibilidad.
- No usarlo en configuraciones ni enlaces hasta que esté comprado y verificado. Cambios a hacer al comprarlo: `docs/DEPLOYMENT.md`, "Al comprar el dominio".

## Logotipo / isotipo
[Pendiente. Variantes, tamaños, fondos.]

## Paleta corporativa
[Pendiente. Colores de marca, distintos de los tokens funcionales.]

## Tipografía e iconografía
[Pendiente.]

## Voz, tono e idiomas

- Español rioplatense en el MVP (voseo: "registrá", "probá"), claro y profesional, sin tecnicismos innecesarios.
- Para otros países de Latinoamérica: [A CONFIRMAR] (PRD, pregunta abierta 14).

## Restricciones

- No usar los nombres anteriores en nada visible.
- No poner "C&C" por encima o al mismo nivel visual que "InmoPanel".
- No presentar valores de referencia (precios en USD, límites de WhatsApp) como definitivos u oficiales de terceros.
