# Identidad de marca — InmoPanel by C&C

> **Estado (02/11/2026):** nombre y posicionamiento **definidos**. Identidad gráfica **provisoria** implementada (logo, paleta y tipografía, abajo), a validar o reemplazar por un diseño profesional definitivo. Al definirla, colores y tipografía se cargan en `frontend/styles/tokens.css` y deben pasar el test de contraste WCAG (`frontend/styles/tokens.test.ts`).

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
- Se usa el **logo provisorio** (abajo). No crear variantes nuevas ni ilustraciones de marca sin aprobación.

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

## Logotipo / isotipo (provisorio)

- **Concepto:** un panel (cuadrado redondeado) con una "P" de trazo continuo —el registro ordenado— y un nodo terracota conectado: la coincidencia entre una propiedad y un cliente. Evita la casa genérica de los logos inmobiliarios: identifica un software de gestión.
- **Implementación:** SVG en código, `frontend/components/brand/logo.tsx` (`LogoMark` isotipo, `Logo` isotipo + "InmoPanel" + "by C&C"). Usa los tokens del tema (claro y oscuro).
- **Copias con colores fijos** (mantenerlas sincronizadas con la geometría de `LOGO_PATHS`): favicon `frontend/app/icon.svg`, ícono de aplicación `frontend/app/apple-icon.tsx` (PNG 180×180), imagen para compartir `frontend/app/opengraph-image.tsx` (1200×630).
- Tamaño mínimo legible: 16 px (favicon). Sobre fondo de marca se usa solo el isotipo.

## Paleta (provisoria)

| Rol | Claro | Oscuro | Uso |
|---|---|---|---|
| Marca (primary) | `#0e5550` verde petróleo | `#5ec5b7` | Botones principales, enlaces, isotipo |
| Acento (highlight) | `#d9673a` terracota | `#f08a5d` | Detalles, la "coincidencia" del logo, destacados. Nunca para textos largos |
| Fondo | `#fbfaf7` neutro cálido | `#0b1413` | Página |
| Texto | `#14201f` | `#eef4f2` | Texto principal |

Motivo: los CRM del rubro usan azules corporativos; el verde petróleo transmite confianza y se diferencia, y el terracota remite a lo inmobiliario sin caer en clichés. Valores completos y contraste verificado: `frontend/styles/tokens.css` y `tokens.test.ts`.

## Tipografía e iconografía (provisorias)

- **Plus Jakarta Sans** (Google Fonts, licencia OFL), servida por la propia app con `next/font`: geométrica, moderna y muy legible en pantallas. Titulares en 700–800, texto en 400–500.
- Íconos: trazos simples de 1,75–2 px (check, flechas). Sin set de íconos de marca todavía.

## Voz, tono e idiomas

- Español rioplatense en el MVP (voseo: "registrá", "probá"), claro y profesional, sin tecnicismos innecesarios.
- Para otros países de Latinoamérica: [A CONFIRMAR] (PRD, pregunta abierta 14).

## Restricciones

- No usar los nombres anteriores en nada visible.
- No poner "C&C" por encima o al mismo nivel visual que "InmoPanel".
- No presentar valores de referencia (precios en USD, límites de WhatsApp) como definitivos u oficiales de terceros.
