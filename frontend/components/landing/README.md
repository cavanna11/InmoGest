# Landing comercial

Página pública de promoción de InmoPanel by C&C. Se desarrolló en la rama `feat/landing` (worktree aparte) en paralelo al incremento de auth.

| Archivo | Qué tiene |
|---|---|
| `config.ts` | Destinos de los CTA (plataforma, demo, legales), `SHOW_PRICES` y `PRODUCT_STATUS`. Único lugar con URLs. |
| `content.ts` | Textos: problema/beneficio, funciones, pasos, planes (PRD §6) y preguntas frecuentes. Todo sale del PRD. |
| `landing-page.tsx` | Secciones. Server Component. |
| `demos.tsx` · `demo-player.tsx` | Demostraciones animadas (CU-04, CU-07). El reproductor es el único Client Component. |

## Reglas

- Solo tokens semánticos de `styles/tokens.css` (`bg-primary`, `text-muted-foreground`…). Sin colores sueltos.
- Sin `tailwind-merge` en este módulo: nunca sumar a un elemento dos clases de la misma propiedad (`h-9` + `h-10`, `hidden` + `inline-flex`). Tamaño y variante van por props.
- No afirmar funciones fuera del PRD. Lo P1 se marca "Próximamente"; las demos llevan "Ilustrativo · datos ficticios".
- Motion: transiciones CSS de 300 ms, cada demo se reproduce una vez al entrar en pantalla y tiene "Ver de nuevo". Con `prefers-reduced-motion` o sin JavaScript se ve el estado final. La lista de pasos en texto es la fuente accesible; la maqueta es `aria-hidden`.

## Pendientes (datos que faltan, no se inventan)

- **Canal de demo** (`landingLinks.demo`): formulario, WhatsApp comercial o agenda. Mientras sea `null`, "Solicitar una demo" lleva a `#demo` y esa sección avisa que pronto se podrá coordinar.
- **Ruta de login** (`landingLinks.platform = '/login'`): ruta prevista por `docs/ARCHITECTURE.md`; confirmar al integrar F-02. Hoy el prefetch de `/login` da 404.
- **Legales** (`terms`, `privacy`): según ADR 0009 los textos viven en la base y se publican explícitamente. El pie muestra los enlaces cuando haya una ruta pública que los renderice.
- **Precios**: son valores de referencia en USD (PRD §6); el mecanismo en pesos está [A CONFIRMAR]. `SHOW_PRICES` los oculta si hace falta.
- **Marca**: InmoPanel by C&C (`docs/BRAND.md`). Sin logo definitivo: se muestra como texto, con "InmoPanel" protagonista y "by C&C" en segundo plano. El dominio `inmopanel.com.ar` todavía no está comprado.

## Integración

1. `app/page.tsx` pasa a renderizar `<LandingPage />` con la `metadata` de `app/landing/page.tsx`.
2. Borrar la ruta de vista previa `app/landing/`.
3. Cuando existan, cargar en `config.ts` el canal de demo y las rutas de login y legales.
