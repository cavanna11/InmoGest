# Revisión del PRD con ChatGPT

**Adjuntar:** `docs/PRD.md` (obligatorio). Opcional para contexto técnico: `docs/STACK.md` y `docs/DECISIONS/0001-estructura-frontend-backend.md`.

Copiar desde "Prompt" hasta el final.

---

## Prompt

Te adjunto el PRD (borrador v0.1) de un CRM inmobiliario SaaS que estoy construyendo con mi estudio de software, C&C, en Argentina. Lo vamos a vender por suscripción mensual a inmobiliarias chicas y medianas (2 a 10 agentes), que se registran solas y prueban gratis. El desarrollo lo hace un agente de IA (Claude Code) siguiendo este PRD, así que tiene que ser preciso: lo que no esté escrito no se construye, y lo ambiguo genera errores.

Actuá como product manager senior con experiencia en SaaS B2B y en el mercado inmobiliario argentino. Revisá el PRD y devolveme:

### 1. Preguntas abiertas
El documento tiene puntos marcados [A CONFIRMAR] y una lista de "Preguntas abiertas" al final. Para cada uno:
- Qué opciones razonables hay.
- Cuál recomendás para un MVP y por qué (pensando en una inmobiliaria argentina real y en que somos un equipo chico).
- Qué impacto tiene en el producto o en el desarrollo.
Hacé una pregunta concreta para que yo decida; no decidas por mí lo que es de negocio (precios, plazos, políticas).

### 2. Huecos y contradicciones
- Casos de uso o reglas que falten para que una inmobiliaria pueda trabajar a diario (por ejemplo: qué pasa con una conversación de WhatsApp de un contacto que ya es de otro agente, propiedades duplicadas, bajas de agentes, etc.).
- Contradicciones entre secciones (casos de uso vs. funcionalidades vs. reglas vs. criterios de aceptación).
- Criterios de aceptación que no se puedan verificar objetivamente, con una propuesta de redacción verificable.

### 3. Alcance del MVP
- ¿Está bien dimensionado para lanzar? Marcá qué sacarías o pasarías de P0 a P1 (o al revés), justificando.
- ¿La prioridad de la web pública (Fase 3) y del cobro (Fase 2) tiene sentido para un producto self-service?

### 4. Riesgos
- Riesgos de producto, comerciales y legales (por ejemplo: WhatsApp conectado por QR no oficial, Ley 25.326 de Protección de Datos Personales de Argentina, consentimiento para mensajes automáticos, términos y condiciones).
- Para cada riesgo, una mitigación concreta que se pueda escribir en el PRD.
- Importante: no propongas técnicas para evadir los controles antispam de WhatsApp. Las mitigaciones tienen que ser de uso responsable y transparencia con el cliente.

### 5. Competencia
Si conocés InmoMind, Tokko Broker u otros CRM inmobiliarios usados en Argentina, decime qué funcionalidades básicas del rubro faltan en el MVP y cuáles nos pueden diferenciar. Si no estás seguro de un dato, aclaralo; no inventes precios ni funcionalidades.

### Reglas para tu respuesta
- Español rioplatense.
- No reescribas el PRD entero. Dame los cambios como lista numerada, cada uno con: sección afectada, texto actual (si aplica), texto propuesto y motivo.
- No cambies el stack técnico ni la arquitectura; están fuera de esta revisión.
- Al final, un resumen con las 5 decisiones más urgentes que tengo que tomar.
