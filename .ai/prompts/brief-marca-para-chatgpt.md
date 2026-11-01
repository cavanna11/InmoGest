# Brief para trabajar la marca con ChatGPT

> **Histórico.** Prompt usado antes del 02/11/2026, cuando el producto tenía nombre provisorio. El nombre oficial es **InmoPanel by C&C** (`docs/BRAND.md`); no reutilizar este texto sin actualizarlo.

Copiar desde "Contexto" hasta el final y pegarlo en ChatGPT. Lo que devuelva se vuelca en `docs/BRAND.md` (y los colores funcionales en `docs/DESIGN-SYSTEM.md`).

---

## Contexto

Soy Santiago, dueño de C&C, un estudio de software en Argentina. Estoy creando un CRM inmobiliario SaaS (nombre provisorio "InmoGest") que voy a vender por suscripción mensual a inmobiliarias argentinas chicas y medianas (2 a 10 agentes). Cada inmobiliaria se registra sola, prueba gratis y paga un abono.

Qué hace el producto:
- Centraliza clientes (interesados y propietarios) y propiedades.
- Cruza automáticamente lo que busca cada cliente con las propiedades disponibles y avisa cuando hay coincidencias.
- Conecta el WhatsApp de la inmobiliaria: bandeja de chats compartida, alta automática de contactos, envío de fichas de propiedades y mensajes automáticos de seguimiento.
- Agenda de visitas y tareas por agente.
- Más adelante: web pública por inmobiliaria, cobro de alquileres, IA para responder consultas.

Competencia de referencia: InmoMind, Tokko Broker, planillas + WhatsApp suelto. Queremos diferenciarnos por ser más accesibles, simples de usar desde el celular y con mejor integración de WhatsApp.

Público: dueños de inmobiliarias y agentes, de 25 a 60 años, poco tiempo, mucho uso del celular, desconfían de sistemas complicados. El producto se usa todo el día en la oficina y en la calle.

Restricciones:
- Idioma: español rioplatense (voseo). Posible expansión a otros países de Latinoamérica más adelante.
- El nombre tiene que funcionar como dominio (.com, .com.ar o .app disponibles idealmente) y como marca registrable en INPI; no debe parecerse a marcas existentes del rubro.
- No usar "WhatsApp" ni elementos de su marca en el nombre o logo (es marca de Meta).
- Es un producto de C&C, pero con marca propia.
- La interfaz es una app de trabajo: la paleta tiene que convivir con estados de éxito, advertencia y error, y tener buen contraste (WCAG AA) en modo claro y oscuro.

## Lo que necesito

1. **Nombre:** 10 propuestas con una línea de por qué funciona cada una, y señalando posibles conflictos (marcas parecidas, pronunciación, connotaciones). Indicá cuáles conviene verificar en INPI y en registros de dominio (no afirmes que están libres sin verificarlo).
2. Para las 3 mejores:
   - Bajada / tagline (máx. 8 palabras).
   - Concepto de logotipo e isotipo (descripción, no imagen), y en qué tamaños tiene que funcionar (favicon, ícono de app, encabezado).
   - Paleta corporativa: primario, secundario y neutros con código HEX, y su uso.
   - Tipografía sugerida (gratuita, disponible en Google Fonts) para títulos y para interfaz.
3. **Voz y tono:** cómo le hablamos al usuario (tuteo/voseo, formalidad), 5 ejemplos de mensajes del sistema (bienvenida, error, confirmación de borrado, aviso de WhatsApp desconectado, fin de prueba gratis) y una lista de palabras a usar y a evitar.
4. **Restricciones de marca:** usos prohibidos del logo, combinaciones de colores a evitar, claims que no podemos hacer (por ejemplo, prometer que el número de WhatsApp nunca se va a bloquear).

Devolvé todo en Markdown con estas secciones: Nombre y escritura · Logotipo / isotipo · Paleta corporativa · Tipografía e iconografía · Voz, tono e idiomas · Restricciones.
