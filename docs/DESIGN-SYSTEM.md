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
| Menú lateral | `sidebar` (+ `-foreground`, `-primary`, `-accent`, `-border`, `-ring`) | Menú del panel (shadcn `Sidebar`): mismo fondo que la página, ítem activo con el tinte de marca |
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

Al agregar con el CLI (`npx shadcn@latest add <componente> -c frontend`):

- **No pisar `components/ui/button.tsx`**: está adaptado a los tokens. Responder "no" cuando el CLI pregunte si lo sobrescribe.
- **Revisar los imports**: el CLI puede escribir `import { cn } from "cn"` e instalar el paquete `cn`. Se corrige a `@/lib/utils.ts` y se desinstala el paquete.
- **Sin `next-themes`**: el modo de color es propio (`components/theme.tsx`). `components/ui/sonner.tsx` usa `useResolvedTheme()`.
- **Variante `dark:`**: sigue a `data-theme='dark'` (definida en `globals.css`), no a la clase `.dark`.
- Las variables CSS que el CLI agregue van a `tokens.css`, en hex, con su par en el test de contraste.

### Estructura del panel

- **Menú lateral** (`modules/panel/app-sidebar.tsx`, shadcn `Sidebar`): pegado a la izquierda y de alto completo. Se puede achicar a solo íconos (botón de la barra superior o Ctrl+B).
  - **Principal:** el trabajo diario; cada navegador puede reordenarlo con "Ordenar menú".
  - **Herramientas y Configuración:** se pliegan. Configuración arranca plegada.
  - Las secciones salen de `modules/panel/navigation.ts`.
- **Preferencias de interfaz** (orden, grupos plegados, menú compacto): en `localStorage` (`modules/panel/local-preference.ts`). No tocan la base.
- **Barra superior fija:** búsqueda global (`Command`, Ctrl+K; propiedades, contactos y conversaciones de la inmobiliaria activa), botón "Nueva", notificaciones y menú de la cuenta (perfil, modo de color, cambio de inmobiliaria, salir).
- **Celular (< 768 px):**
  - Barra inferior con Inicio, WhatsApp, Propiedades y Contactos; "Más" abre el menú completo.
  - El contenido deja lugar abajo (`pb-24`).
- **"Ver cómo funciona":** `PageHeader` muestra los ejemplos de `modules/panel/guides.ts` según la sección. En la compu es un `Dialog`; en el celular, un `Drawer`. Las guías describen solo lo que el sistema hace hoy.
- **Hoy** (`app/panel/page.tsx`, consultas en `modules/panel/today-queries.ts`): bloques de lo que necesita atención en el día, cada uno con su estado vacío y una acción sugerida.
  - Sin responder: WhatsApp con mensajes sin leer.
  - Visitas de hoy, de todo el equipo.
  - Para retomar: búsqueda en etapa abierta, sin actividad ni mensajes hace más de 15 días.
  - Tareas de hoy y vencidas.
  - Sin publicar en Mercado Libre: propiedades disponibles sin link de Mercado Libre.
- **Propiedades:**
  - **Lista:** búsqueda y filtros que se aplican solos y quedan en la URL, orden, vistas guardadas en el navegador (`modules/panel/saved-views.tsx`) y un menú de acciones en cada tarjeta. El cambio de estado se puede deshacer.
  - **Alta en 3 pasos:** datos básicos en `/nueva`; fotos y dónde publicarla en la ficha (`?paso=fotos` y `?paso=publicar`).
  - **Ficha con pestañas** (`?tab=`): Resumen, Datos, Publicación e Historial.
  - **Celular:** barra fija con Enviar, Visita y Publicar.
  - **Formularios:** shadcn `Field`, validación en el campo con el mismo esquema Zod del servidor, aviso por cambios sin guardar. Borrar una foto se puede deshacer durante 6 segundos.
- **WhatsApp** (`app/panel/conversaciones`, `modules/whatsapp/thread.tsx`): bandeja, conversación y datos del contacto al costado. En pantallas chicas los datos van en un panel.
  - **Hilo:** primitivas de chat de shadcn (`MessageScroller`, `Message`, `Bubble`, `Marker` para los días, `Attachment` para documentos). No hay globos hechos a mano.
  - **Respuesta:** `InputGroup`.
  - **Asignación:** se guarda al elegir, con aviso.
  - **Desde la conversación:** llamar, agendar visita y enviar una propiedad.
- **Contactos:**
  - **Lista:** tabla en la compu y tarjetas en el celular, con los controles genéricos de listado (`modules/panel/list-controls.tsx`). Cada fila tiene WhatsApp, llamar y un menú (agendar visita, cargar qué busca).
  - **Vista "Para retomar"** (`?vista=retomar`): misma regla que el bloque de Hoy.
  - **Ficha:** acciones arriba, teléfonos que se tocan para llamar y emails para escribir. Quitar un teléfono o un email se puede deshacer. En el celular, barra fija con Llamar y Agendar visita.
  - **Formularios:** validación en el campo (`hooks/use-field-validation.ts`, compartido con Propiedades). Los datos son del cliente, así que no se autocompletan con los propios.
- **Código de propiedad:** `PropertyCode` (`components/ui/property-code.tsx`) lo muestra con forma de llavero. Es el elemento propio del panel para reconocer una propiedad.
- **Carga:** `PageSkeleton` (`components/ui/page-skeleton.tsx`) con la forma del contenido, en lugar de un "Cargando…" suelto.

## Pendiente

Paleta, tipografía e iconografía definitivas (`docs/BRAND.md`); escala tipográfica y espaciado propios si la marca los requiere.

## Movimiento

- Animaciones solo con CSS (`frontend/components/landing/landing.css`), sin dependencias: opacidad y transform, sin saltos de contenido.
- Las maquetas de la landing se reproducen solas en loop; sin botones para volver a reproducir.
- Aparición al hacer scroll con `animation-timeline: view()` como mejora progresiva (sin soporte, el contenido se ve igual).
- `prefers-reduced-motion: reduce` desactiva todas las animaciones y muestra el estado final completo (verificado en E2E).
