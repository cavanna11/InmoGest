# Landing comercial

Página de inicio pública de InmoPanel by C&C (`app/page.tsx`). Identidad en `docs/BRAND.md`.

| Archivo | Qué tiene |
|---|---|
| `config.ts` | Destinos de los CTA (demo, acceso, legales), `SHOW_PRICES` y `PRODUCT_STATUS`. Único lugar con URLs. |
| `content.ts` | Textos: situaciones, funciones por eje, comparación, compromisos, pasos, planes y preguntas frecuentes. Todo sale del PRD. |
| `landing-page.tsx` | Secciones (Server Component). |
| `demos.tsx` · `landing.css` | Maquetas animadas en loop (CSS), sin JavaScript. |

## Reglas

- Solo tokens semánticos de `styles/tokens.css`. Sin colores sueltos.
- **InmoPanel está en desarrollo:** las funciones se presentan como "lo que incluye el primer lanzamiento" (PRD, MVP). Lo P1 se marca "Próximamente". Nunca se afirma que algo está disponible hoy, ni se agregan testimonios, logos de clientes, cifras o calificaciones que no existen.
- Las maquetas llevan "Ilustrativo · datos ficticios", son `aria-hidden` y tienen al lado su descripción en texto.
- Motion: loops discretos de 13 s solo con opacidad y transform; aparición al hacer scroll como mejora progresiva; con `prefers-reduced-motion` se ve el estado final.

## Estructura y por qué

1. **Hero:** el beneficio principal ("Que ninguna consulta ni oportunidad se te escape") + definición clara de qué es + flujo animado de una coincidencia (la función más diferencial del PRD).
2. **Lo que pasa hoy:** situaciones concretas que una inmobiliaria reconoce (PRD §2).
3. **Cómo te ayuda:** funciones agrupadas por resultado (responder, no perder oportunidades, ordenar el equipo).
4. **Cómo funciona:** la bandeja de WhatsApp compartida, paso a paso, con su maqueta.
5. **Por qué cambiar:** hoy vs. con InmoPanel.
6. **Claro desde el principio:** confianza solo con elementos verificables (datos aislados en la base, transparencia sobre WhatsApp, precios publicados, producto local).
7. **Cómo empezar · Planes · Contacto · Preguntas frecuentes** (también como datos estructurados FAQPage).

## Referencias analizadas (02/11/2026)

- **Tokko Broker** y **KiteProp** (Argentina): apoyan la confianza en testimonios, logos de clientes y cifras; CTA de prueba gratis; muchas funciones listadas (portales, IA). Tomado: prueba gratis visible y beneficios por módulo. Descartado: cifras y testimonios (no tenemos), listados extensos de funciones.
- Tendencias B2B SaaS 2026 (fuentes de la industria, con cautela): claridad del mensaje antes que decoración, mobile first, demos interactivas o animadas del producto.
- Diferenciación elegida: el PRD (§12) — WhatsApp compartido, coincidencias que explican el motivo, alta sin depender de soporte y precio accesible —, con identidad propia (verde petróleo y terracota) en lugar del azul corporativo habitual.
- Palabras clave priorizadas (coinciden con funciones reales del PRD): "software para inmobiliarias", "software de gestión inmobiliaria", "CRM inmobiliario" (como término de búsqueda, no como definición del producto), "WhatsApp para inmobiliarias".

## Pendientes (datos que faltan, no se inventan)

- **Canal de demo** (`landingLinks.demo`): formulario, WhatsApp comercial o agenda. Mientras sea `null`, "Solicitar una demo" lleva a `#demo`, que avisa que pronto se podrá coordinar.
- **Acceso a la plataforma** (`landingLinks.platform`): `null` (oculto) hasta publicar el ingreso del incremento 1.1; entonces `'/ingresar'`.
- **Legales** (`terms`, `privacy`): según ADR 0009 se publican explícitamente. El pie muestra los enlaces cuando haya una ruta pública que los renderice.
- **Precios**: valores de referencia en USD (PRD §6); el mecanismo en pesos está [A CONFIRMAR]. `SHOW_PRICES` los oculta si hace falta.
- **Prueba social** (testimonios, logos, cifras): solo cuando existan clientes reales y su autorización.
