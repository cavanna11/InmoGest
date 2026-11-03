# Design System

- **Estado:** identidad **provisoria de InmoPanel** (03/11/2026): verde petróleo luminoso, acento terracota vivo y neutros claros; logo y tipografía en `docs/BRAND.md`.
- **Base:** Tailwind CSS 4 + componentes de shadcn/ui (`frontend/components.json`), que se agregan a medida que se usan.

## Regla principal

Toda la identidad visual vive en **un solo archivo**: `frontend/styles/tokens.css`. Los componentes usan solo nombres semánticos (`bg-primary`, `text-muted-foreground`, `border-input`, `rounded-md`, `font-sans`) y nunca colores, fuentes o radios sueltos (`bg-zinc-900`, `#18181b`, `rounded-[7px]`). Cambiar la marca = editar `tokens.css`, sin tocar componentes.

`frontend/app/globals.css` solo mapea esos tokens a utilidades de Tailwind (`@theme inline`) y define estilos base (foco visible, movimiento reducido).

## Tokens

| Grupo | Tokens | Uso |
|---|---|---|
| Superficies | `background`, `surface`, `popover`, `muted` (+ `-foreground`) | Fondo de página, tarjetas y paneles, menús, zonas atenuadas |
| Acciones | `primary`, `secondary`, `accent` (+ `-foreground`) | Botón principal, secundario, hover/selección |
| Acento de marca | `highlight` (+ `-foreground`) | Detalles cálidos, la "coincidencia" del logo, destacados (no para textos largos) |
| Tintes | `primary-soft`, `highlight-soft` (+ `-foreground`) | Fondos de íconos de sección, etiquetas ("Próximamente", tipos de contacto), hover del menú y avisos de la prueba |
| Estados | `destructive`, `success`, `warning` (+ `-foreground`) | Errores y acciones destructivas, confirmaciones, advertencias |
| Bordes y foco | `border`, `input`, `ring` | Separadores decorativos, borde de campos, anillo de foco |
| Geometría | `radius` (→ `rounded-sm/md/lg/xl`) | Radios derivados de un solo valor |
| Tipografía | `font-sans`, `font-mono` | Plus Jakarta Sans (next/font) con respaldo del sistema |

Tema **claro por defecto** y oscuro con los mismos nombres; los valores van en hex. El modo lo elige cada persona con el selector (claro, oscuro o según el sistema, `components/theme.tsx`): se guarda en el navegador y un script en el `<head>` lo aplica como `data-theme` en `<html>` antes de pintar (sin parpadeo).

## Accesibilidad

- `frontend/styles/tokens.test.ts` verifica en cada `npm test`, para ambos temas: texto sobre su fondo ≥ 4,5:1 y bordes de campos y anillo de foco ≥ 3:1 (WCAG 2.2 AA, criterio 1.4.11). Una marca nueva que no cumpla hace fallar el test.
- Foco visible en todo elemento enfocable (`:focus-visible` con `--ring`).
- `prefers-reduced-motion` desactiva animaciones y transiciones.
- Componentes de shadcn/ui sobre Radix: teclado, roles ARIA y manejo de foco incluidos.
- Pantallas usables a 360 px sin desplazamiento horizontal (verificado en E2E).

## Componentes

Se agregan desde shadcn/ui cuando una pantalla los necesita, siempre usando los tokens. Al agregar uno, revisar que no traiga colores fijos ni variables CSS propias fuera de `tokens.css`.

## Pendiente

Paleta, tipografía e iconografía definitivas (`docs/BRAND.md`); escala tipográfica y espaciado propios si la marca los requiere.

## Movimiento

- Animaciones solo con CSS (`frontend/components/landing/landing.css`), sin dependencias: opacidad y transform, sin saltos de contenido.
- Las maquetas de la landing se reproducen solas en loop; sin botones para volver a reproducir.
- Aparición al hacer scroll con `animation-timeline: view()` como mejora progresiva (sin soporte, el contenido se ve igual).
- `prefers-reduced-motion: reduce` desactiva todas las animaciones y muestra el estado final completo (verificado en E2E).
