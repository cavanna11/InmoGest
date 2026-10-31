# PRD — InmoGest (nombre provisorio)

- **Producto:** CRM inmobiliario SaaS multi-tenant de C&C.
- **Estado:** borrador v0.3 — 31/10/2026. Lo marcado **[A CONFIRMAR]** necesita decisión del dueño.
- **Alcance de este documento:** MVP (Fase 1) en detalle; fases siguientes en resumen.
- **Nombre:** "InmoGest" es provisional e interno; no es el nombre comercial definitivo (ver §11).

## 1. Objetivo

Que una inmobiliaria argentina chica o mediana pueda **registrarse sola, probar gratis y trabajar a diario** con sus clientes, propiedades y conversaciones de WhatsApp en un solo lugar, sin instalación ni asistencia de C&C.

Objetivos de negocio:

1. Vender el producto como suscripción mensual a muchas inmobiliarias desde una sola aplicación, con tres planes comerciales (§6).
2. Lanzamiento comercial abierto: cualquier inmobiliaria puede registrarse desde el MVP.
3. Ser una alternativa más accesible y con mejor WhatsApp que las soluciones actuales del mercado (referencia: InmoMind, planes de ARS 45.000 a 115.000/mes al 29/10/2026).
4. Que el alta y el uso no requieran soporte humano, salvo la activación de la suscripción por transferencia y la API oficial de WhatsApp.

### Métricas de éxito

Objetivos iniciales para medir el producto. Se revisan con datos reales del piloto y **no** son requisitos absolutos para declarar terminado el MVP.

**Comerciales**

| Métrica | Objetivo |
|---|---:|
| Inmobiliarias que completan el onboarding | ≥ 80% |
| Inmobiliarias que conectan WhatsApp | ≥ 70% |
| Tiempo hasta el primer contacto registrado | < 15 minutos |
| Inmobiliarias activas a 30 días | ≥ 60% |

**Técnicas**

| Métrica | Objetivo |
|---|---:|
| Disponibilidad mensual | ≥ 99,5% |
| Errores de procesamiento de mensajes | < 1% |

## 2. Problema

- La información está dispersa: planillas, cuadernos, el celular de cada agente y varios grupos de WhatsApp.
- Las consultas llegan por WhatsApp, portales y redes, y muchas se pierden o se responden tarde.
- Cruzar "qué busca cada cliente" con "qué propiedades hay" se hace de memoria; se pierden ventas cuando entra una propiedad que le servía a alguien.
- Cuando un agente se va, se lleva los contactos y el historial en su teléfono.
- Las herramientas existentes son caras para una inmobiliaria chica, o su integración con WhatsApp es limitada o poco clara.
- Migrar desde planillas u otro sistema es costoso, y eso frena el cambio de herramienta.

## 3. Usuarios y roles

| Rol | Quién es | Puede |
|---|---|---|
| **Dueño** (owner, administrador de la inmobiliaria) | Titular o responsable de la inmobiliaria. Crea la cuenta. | Todo lo que puede un agente, más: configuración de la inmobiliaria y del embudo, usuarios y permisos, WhatsApp, unificar contactos, fusionar propiedades, importar datos, ver reportes. No puede cambiar su plan ni el estado de la cuenta. |
| **Agente** | Vendedor / productor. | Ver, editar y gestionar **cualquier** contacto, conversación, propiedad, visita y tarea, sin importar a quién estén asignados (ver §6, Asignación y permisos de agentes). Reportar posibles duplicados. |
| **Superadministrador principal** (dueño del sistema, C&C) | Titular de C&C. | Administrar la plataforma desde el panel de superadministrador: inmobiliarias, estados, planes y sus límites, límites globales de WhatsApp, activación de suscripciones. Ingresar a cualquier inmobiliaria con «Ingresar como» y operar sin restricciones (ver §6). |
| **Visitante / cliente final** | Persona que escribe por WhatsApp o abre la página pública de una propiedad. | No usa el sistema; interactúa por WhatsApp y ve páginas públicas de propiedades. |

Roles reservados para más adelante (no en MVP): administrativo, supervisor.

Otros usuarios de C&C con acceso al panel de superadministrador: **[A CONFIRMAR si existen y con qué permisos]**. «Ingresar como» es exclusivo del superadministrador principal.

Una persona puede pertenecer a más de una inmobiliaria con roles distintos y elegir en cuál trabaja.

## 4. Casos de uso

### CU-01 — Registro de una inmobiliaria
1. El dueño entra a la web de InmoGest y elige "Probar gratis".
2. Carga nombre de la inmobiliaria, su nombre, email y contraseña, y acepta los términos y condiciones y la política de privacidad.
3. Confirma el email.
4. El sistema crea la inmobiliaria con **prueba gratis de 14 días** y lo deja como dueño.
5. Un asistente de inicio lo guía: datos de la inmobiliaria y logo → invitar agentes → conectar WhatsApp → importar o cargar primeras propiedades y contactos. Puede saltear pasos y retomarlos después; el asistente muestra qué falta.

### CU-02 — Invitar y desactivar agentes
- El dueño carga el email del agente; el agente recibe un link, crea su contraseña y entra a la inmobiliaria.
- Al desactivar un agente, pierde el acceso de inmediato. Sus contactos, conversaciones, tareas y visitas pendientes quedan sin asignar y aparecen en una lista para reasignarlos.

### CU-03 — Conectar WhatsApp
1. El dueño va a WhatsApp → Conectar.
2. Lee las **pautas de uso responsable** (límites, buenas prácticas para cuidar el número, qué no hacer) y las acepta.
3. Escanea el QR con el WhatsApp del número de la inmobiliaria.
4. El sistema muestra el estado (conectado / desconectado / requiere volver a escanear) y avisa si se desconecta.
5. Puede conectar tantos números como permita su plan (Inicial y Profesional: 1; Empresa: más de uno).
6. Si quiere la API oficial de Meta, hay un botón "Solicitar API oficial" que genera un pedido a C&C.

### CU-04 — Llega un mensaje nuevo por WhatsApp
1. Un número escribe a la inmobiliaria.
2. Si el número no existe, el sistema crea el contacto; si existe en algún contacto de la inmobiliaria, vincula la conversación a ese contacto.
3. La conversación aparece en la bandeja, sin asignar.
4. El primer agente que la abre queda asignado. La asignación es organizativa: cualquier agente puede responder.
5. El dueño puede reasignarla; los agentes también, si el dueño habilitó ese permiso.
6. Las respuestas salen por el número de WhatsApp por el que entró la conversación, y cada respuesta registra qué agente la envió.

### CU-05 — Cargar una propiedad
- El agente carga operación (venta / alquiler / alquiler temporario), tipo, ubicación, precio y moneda, ambientes, superficie, características, fotos y propietario. La propiedad recibe un código interno (ej. PRO-000123) y una página pública individual con URL para compartir.
- Si el sistema detecta una posible propiedad duplicada, avisa antes de guardar. Solo el dueño puede fusionar dos propiedades; la fusión conserva el historial de ambas.

### CU-06 — Registrar qué busca un cliente
Desde la ficha del cliente, el agente carga una o más búsquedas: operación, tipos de propiedad, zonas, presupuesto mínimo y máximo con moneda, tolerancia sobre el máximo (10% por defecto, modificable), ambientes/dormitorios mínimos, características requeridas y deseadas.

### CU-07 — Matching automático
- Al cargar o modificar una propiedad disponible, el sistema calcula qué búsquedas activas coinciden y notifica a los agentes asignados a esas búsquedas.
- Al cargar o modificar una búsqueda activa, muestra las propiedades que coinciden.
- Cada coincidencia muestra su puntaje y el motivo ("cumple los obligatorios; deseables: 2 de 3, falta cochera"). Si el precio supera el presupuesto máximo dentro de la tolerancia, se identifica como "superior al presupuesto". Cálculo en §6.

### CU-08 — Enviar propiedades por WhatsApp
Desde una coincidencia o desde la ficha de propiedad, el agente elige uno o varios clientes y envía la ficha (fotos + texto + link a la página pública de la propiedad). Es un envío humano: no cuenta para los límites de mensajes automáticos. Queda registrado en el historial del contacto y de la propiedad.

### CU-09 — Mensajes automáticos (P1, planes Profesional y Empresa)
La inmobiliaria activa automatizaciones predefinidas, por ejemplo:
- Aviso al cliente cuando entra una propiedad que coincide con su búsqueda.
- Seguimiento si un cliente no respondió en X días.

Todas pasan por la cola de envíos y respetan los límites globales de WhatsApp y las reglas de consentimiento (ver §6).

### CU-10 — Agenda, tareas y recordatorios
- El agente agenda visitas (cliente + propiedad + fecha/hora) y tareas (llamar, enviar documentación). Ve la agenda del día y la semana, con filtro "mi agenda" o de todo el equipo.
- **P0:** recordatorios y notificaciones dentro del sistema.
- **P1 (planes Profesional y Empresa):** recordatorios por WhatsApp con plantillas editables, anticipación configurable y horarios de envío. El usuario elige qué eventos generan recordatorios.

### CU-11 — Embudo comercial
- Cada búsqueda avanza por las etapas del embudo de la inmobiliaria. Etapas iniciales: Nuevo contacto → Primer contacto → Calificado → Visita coordinada → Negociación → Cerrado ganado / Cerrado perdido.
- El dueño puede renombrar, agregar, reordenar y desactivar etapas.
- El dueño ve cuántas búsquedas hay en cada etapa, por agente.

### CU-12 — Importar contactos y propiedades
El dueño descarga una plantilla CSV, la completa (o adapta un export de su sistema anterior), la sube y ve una vista previa con los errores por fila y los posibles duplicados antes de confirmar. Las filas con error no se importan y se pueden descargar para corregirlas.

### CU-13 — Activación de la suscripción
1. Durante la prueba o al vencer, el dueño elige un plan y ve los datos para pagar por transferencia bancaria.
2. Informa el pago desde el sistema.
3. C&C verifica la transferencia y activa la suscripción desde el panel de superadministrador.

### CU-14 — Vencimiento y baja
1. Si la prueba vence (o la suscripción no se renueva) sin pago activado, la cuenta pasa a **solo lectura durante 30 días** (comportamiento en §6).
2. Pasados los 30 días, la cuenta se bloquea y los datos se conservan **90 días** más; luego se eliminan.
3. Si en ese período se activa una suscripción, la cuenta vuelve a funcionar con sus datos.

### CU-15 — Panel de superadministrador
El superadministrador ve todas las inmobiliarias, su estado, plan, fecha de fin de prueba, pagos informados y uso. Puede activar la suscripción, suspender, extender la prueba, cambiar el plan, administrar los límites de cada plan y los límites globales de WhatsApp.

### CU-16 — «Ingresar como»
1. El superadministrador principal elige una inmobiliaria desde el panel y entra a su contexto.
2. Opera como un miembro de la inmobiliaria con acceso total (§6). La interfaz indica claramente en qué inmobiliaria está.
3. Sale del contexto con una acción explícita y vuelve al panel de superadministrador.

### CU-17 — Reportar y unificar contactos duplicados
1. Un agente marca dos contactos como posible duplicado.
2. El dueño revisa los reportes y los duplicados detectados por el sistema, compara ambos contactos y confirma la unificación.
3. El contacto resultante conserva todo lo de ambos (§6).

## 5. Funcionalidades

Prioridad: **P0** imprescindible para el MVP · **P1** deseable en el MVP · **P2** fases siguientes.

### MVP (Fase 1)

| # | Funcionalidad | Prioridad |
|---|---|---|
| F-01 | Registro self-service con prueba gratis de 14 días, confirmación de email y aceptación de términos | P0 |
| F-02 | Login, recuperación de contraseña, cambio de inmobiliaria activa | P0 |
| F-03 | Asistente de configuración inicial con progreso | P0 |
| F-04 | Invitación y desactivación de agentes, con reasignación de lo pendiente; roles dueño/agente | P0 |
| F-05 | Datos de la inmobiliaria: nombre, logo, contacto, moneda por defecto | P0 |
| F-06 | Contactos (interesados y propietarios) con varios teléfonos y emails y detección de duplicados | P0 |
| F-07 | Asignación organizativa de contactos, conversaciones, propiedades, visitas y tareas, con filtros por agente | P0 |
| F-08 | Propiedades con fotos, características, propietario y estados (disponible, reservada, vendida, alquilada, pausada) | P0 |
| F-09 | Detección de propiedades duplicadas y fusión por el dueño | P0 |
| F-10 | Página pública individual por propiedad, alojada en la plataforma y compartible por URL | P0 |
| F-11 | Búsquedas de clientes con criterios obligatorios y deseables y tolerancia de presupuesto | P0 |
| F-12 | Matching automático con puntaje, explicación e indicación de "superior al presupuesto" | P0 |
| F-13 | Embudo comercial configurable por inmobiliaria | P0 |
| F-14 | Conexión de WhatsApp por QR, estado y reconexión; cantidad de números según plan | P0 |
| F-15 | Pautas de uso responsable de WhatsApp aceptadas al conectar | P0 |
| F-16 | Bandeja de WhatsApp: ver, responder, asignación al abrir, reasignar, marcar leído; texto, imágenes, audios y documentos; registro del agente que responde | P0 |
| F-17 | Alta / vinculación automática de contactos desde WhatsApp | P0 |
| F-18 | Enviar ficha de propiedad por WhatsApp con link a su página pública | P0 |
| F-19 | Registro de bajas ("no contactar") por contacto | P0 |
| F-20 | Mensajes automáticos predefinidos con cola y límites globales (planes Profesional y Empresa) | P1 |
| F-21 | Agenda de visitas y tareas con recordatorios y notificaciones en el CRM | P0 |
| F-22 | Historial de actividad por contacto y por propiedad | P0 |
| F-23 | Notificaciones dentro del CRM (nuevo mensaje, nueva coincidencia, tarea vencida, WhatsApp desconectado) | P0 |
| F-24 | Importación CSV de contactos y propiedades con vista previa y errores por fila | P0 |
| F-25 | Exportación de contactos y propiedades (CSV) | P0 |
| F-26 | Planes Inicial, Profesional y Empresa con límites administrables y bloqueo al superarlos | P0 |
| F-27 | Estados de cuenta: prueba, activa, solo lectura, bloqueada, eliminada | P0 |
| F-28 | Informe de pago por transferencia y activación manual por C&C | P0 |
| F-29 | Panel de superadministrador (inmobiliarias, estados, planes, límites de plan, límites globales de WhatsApp) | P0 |
| F-30 | «Ingresar como» para el superadministrador principal | P0 |
| F-31 | Cotización manual USD/ARS para matching entre monedas (desactivado por defecto) | P1 |
| F-32 | Pedido de API oficial de WhatsApp (formulario a C&C) | P1 |
| F-33 | API o feed de propiedades para integrar con las webs propias de las inmobiliarias | P1 |
| F-34 | Reporte de posibles contactos duplicados por agentes y unificación por el dueño | P0 |
| F-35 | Recordatorios de agenda por WhatsApp con plantillas, anticipación y horarios configurables (planes Profesional y Empresa) | P1 |

F-33 no bloquea el lanzamiento del MVP. No se desarrollan integraciones particulares por proveedor de web como requisito inicial.

### Fases siguientes (resumen)

| Fase | Contenido |
|---|---|
| 2 | Cobro automático de suscripciones con Mercado Pago; API oficial de WhatsApp (Cloud API) configurable; automatizaciones configurables por la inmobiliaria. |
| 3 | Web institucional completa por inmobiliaria con dominio propio o subdominio; ingesta de consultas de portales (por email); bot con IA para primera respuesta y calificación; descripciones de propiedades con IA. |
| 4 | Administración de alquileres (contratos, ajustes, cobros, liquidaciones); reportes avanzados; app móvil o PWA. |

## 6. Reglas de negocio

### Planes

| Plan | Precio mensual (referencia) | Usuarios | Propiedades | Números de WhatsApp | Automatizaciones |
|---|---:|---:|---:|---|---|
| Inicial | USD 19 | 2 | 100 | 1 | No |
| Profesional | USD 39 | 5 | 500 | 1 | Sí |
| Empresa | USD 69 | 10 | 1.500 | Más de uno (máximo **[A CONFIRMAR]**) | Sí |

- **Inicial:** funcionalidades esenciales de gestión inmobiliaria. No incluye automatizaciones ni funcionalidades de automatización: ni mensajes automáticos (F-20) ni recordatorios por WhatsApp (F-35).
- **Profesional:** todo lo de Inicial, más automatizaciones según el alcance de este PRD y funcionalidades adicionales **[A CONFIRMAR: cuáles, además de las automatizaciones]**.
- **Empresa:** todo lo de Profesional, con mayor capacidad operativa (usuarios, propiedades y más de un número de WhatsApp).
- Los límites de usuarios, propiedades y números de WhatsApp de cada plan se administran desde el panel de superadministrador. El máximo de números del plan Empresa debe configurarse ahí; su valor inicial está pendiente.
- Los precios son valores de referencia en USD. Mecanismo de facturación y actualización en pesos argentinos: **[A CONFIRMAR]**.
- Al llegar a un límite del plan, el sistema impide crear más elementos de ese tipo y sugiere cambiar de plan; nunca borra datos existentes.
- Plan durante la prueba gratis: **[A CONFIRMAR: qué límites y funcionalidades tiene]**.

### Cuentas y estados
- Cada inmobiliaria es un espacio aislado: ningún usuario ve datos de otra inmobiliaria. Se garantiza en la base de datos, no solo en la pantalla. La única excepción es el superadministrador principal mediante «Ingresar como».
- Toda inmobiliaria tiene siempre al menos un dueño activo.
- Estados de cuenta: **prueba (14 días) → activa → solo lectura (30 días) → bloqueada (datos conservados 90 días) → eliminada**. Desde prueba, solo lectura o bloqueada se puede volver a activa al activarse una suscripción.
- En **solo lectura**:
  - Siguen habilitados: consulta y exportación de datos; recepción y almacenamiento de mensajes entrantes de WhatsApp (mientras la conexión siga activa); actualización del historial y registro de eventos entrantes. Los mensajes entrantes de números nuevos crean el contacto para no perder la información **[A CONFIRMAR]**.
  - Se bloquean: respuestas desde el CRM, envíos automáticos, edición de contactos y propiedades, y modificación de búsquedas, etapas, agenda y demás información comercial.
  - El objetivo es no perder información durante el vencimiento o la suspensión.
- En **bloqueada**: nadie de la inmobiliaria puede ingresar; los datos se conservan y se eliminan al cumplirse los 90 días.
- Solo C&C cambia plan y estado de cuenta. La suscripción se activa manualmente tras verificar la transferencia bancaria.

### «Ingresar como» (superadministrador principal)
- Solo el superadministrador principal (dueño del sistema) tiene este acceso.
- Puede entrar a cualquier inmobiliaria y operar como si fuera parte de ella: consultar, crear, editar y eliminar información, y usar todas las funcionalidades y configuraciones de la inmobiliaria.
- No se le aplican las restricciones de los usuarios de una inmobiliaria ni las del estado de la cuenta, y no hay bloqueos de operaciones. Única regla que se mantiene: la inmobiliaria debe conservar al menos un dueño activo (puede reemplazarlo, designando otro antes de quitar al último).
- La sesión no tiene duración máxima.
- La interfaz muestra en todo momento en qué inmobiliaria está, y entrar y salir del contexto son acciones explícitas.
- El superadministrador principal asume expresamente los riesgos de este nivel de acceso. El acceso de soporte se informa en los términos y condiciones que acepta cada inmobiliaria.

### Asignación y permisos de agentes
- **Todos los agentes pueden hacer exactamente lo mismo con cualquier contacto, conversación, propiedad, visita y tarea, sin importar a quién estén asignados.** Todos pueden ver la ficha completa, notas, historial y búsquedas asociadas; editar contactos y propiedades; responder cualquier conversación; ver y gestionar la agenda y las tareas de todo el equipo; y realizar las acciones comerciales habilitadas para un agente.
- Las únicas acciones reservadas al dueño son las indicadas en §3 (configuración, usuarios, WhatsApp, unificar contactos, fusionar propiedades, importar, reportes).
- La **asignación** es organizativa, no un permiso: identifica qué agente está atendiendo y permite filtrar ("mis contactos", "mis conversaciones", "mis propiedades", "mi agenda", "sin asignar").
  - Una conversación sin asignar queda asignada al primer agente que la abre.
  - El dueño asigna y reasigna; los agentes también, si el dueño habilita esa capacidad.
- Cada respuesta enviada desde el CRM registra qué agente respondió, en qué conversación y la fecha y hora.

### Contactos
- Un contacto puede tener varios teléfonos y varios emails. Cada teléfono y cada email es único dentro de la inmobiliaria: no puede pertenecer a dos contactos.
- Los teléfonos se guardan en formato internacional; los argentinos siempre como móvil (+549…) para detectar duplicados.
- Al cargar un teléfono o email que ya existe (manual, importación o WhatsApp), el sistema muestra o vincula el contacto existente y no crea otro.
- Un contacto puede ser interesado, propietario o ambos.
- Al desactivar un agente, sus contactos, conversaciones, tareas y visitas pendientes quedan sin asignar y disponibles para reasignación. Su historial de actividad se conserva.

### Unificación de contactos
- Nunca se fusionan contactos automáticamente, ni por similitud de nombre ni por ningún otro criterio.
- El sistema puede detectar posibles duplicados por coincidencia de teléfono normalizado o email; los agentes pueden reportar posibles duplicados.
- Solo el dueño de la inmobiliaria (y el superadministrador principal mediante «Ingresar como») puede unificar, con una acción explícita.
- El contacto resultante conserva de ambos: historial de conversaciones, actividades, notas, búsquedas asociadas, operaciones y relaciones (propiedades de las que es propietario, visitas, tareas, coincidencias), teléfonos, emails e información de origen de cada registro.

### Propiedades
- Precio con moneda explícita (ARS o USD); nunca se suman ni comparan montos de distinta moneda sin una cotización explícita.
- El historial de cambios de precio y estado se conserva.
- Posible duplicado: misma dirección, o mismos propietario, operación y tipo. El sistema avisa; no impide guardar.
- Solo el dueño puede fusionar propiedades. La fusión conserva el historial, las fotos y las coincidencias de ambas en la propiedad resultante.
- Cada propiedad tiene una página pública individual alojada en la plataforma, con URL para compartir, que muestra solo su información pública. No se publican propiedades en borrador ni pausadas; la dirección exacta se muestra solo si la inmobiliaria lo elige.
- Integración con webs propias (P1): mediante una API o feed de propiedades genérico, no integraciones particulares por proveedor. Formato y alcance del feed **[A CONFIRMAR al diseñar F-33]**.

### Matching
- Solo participan propiedades **disponibles o reservadas** y búsquedas **activas** (en una etapa no terminal). Una propiedad vendida, alquilada o pausada, o una búsqueda cerrada (en etapa "ganado" o "perdido"), no genera coincidencias nuevas. Las coincidencias anteriores se conservan como historial.
- Criterios **obligatorios** (por defecto: operación, tipo, zona, presupuesto): si alguno no se cumple, no hay coincidencia.
- Criterios **deseables**: definen el puntaje = deseables cumplidos ÷ deseables cargados × 100. Si la búsqueda no tiene deseables, el puntaje es 100%.
- **Presupuesto:**
  - Tolerancia por defecto: 10% sobre el presupuesto máximo. Se puede modificar en cada búsqueda.
  - No hay tolerancia hacia abajo: una propiedad por debajo del presupuesto mínimo no coincide.
  - Una propiedad con precio entre el máximo y el máximo + tolerancia coincide, identificada claramente como "superior al presupuesto". Ejemplo: máximo USD 100.000 → coinciden propiedades de hasta USD 110.000; las de más de USD 100.000 se marcan como superiores al presupuesto.
- **Monedas:** por defecto solo se comparan propiedad y búsqueda en la misma moneda. La inmobiliaria puede habilitar en la configuración una cotización manual USD/ARS; si está habilitada, se usa para comparar presupuestos en distinta moneda y la explicación lo indica.

### Embudo comercial
- Cada inmobiliaria arranca con el embudo predefinido: Nuevo contacto, Primer contacto, Calificado, Visita coordinada, Negociación, Cerrado ganado, Cerrado perdido.
- El dueño puede renombrar, agregar, reordenar y desactivar etapas.
- Cada etapa tiene un tipo: **abierta**, **ganada** o **perdida**. "Cerrado ganado" y "Cerrado perdido" son terminales; su tipo no cambia aunque se renombren, y las métricas de operaciones ganadas y perdidas se calculan por tipo, no por nombre.
- Siempre debe haber al menos una etapa activa de tipo ganada y una de tipo perdida.
- Qué pasa con las búsquedas que están en una etapa que se desactiva: **[A CONFIRMAR]**.
- El cambio de etapa queda registrado en el historial.

### WhatsApp (conexión por QR)
- La conexión por QR no es un servicio oficial de WhatsApp: el número puede ser restringido si se usa mal. El sistema lo informa con claridad al conectar y en los términos; no lo oculta ni promete que no va a pasar.
- Las pautas de uso responsable que acepta la inmobiliaria incluyen: usar un número con historial de uso real, aumentar el volumen de forma gradual, escribir solo a personas que contactaron a la inmobiliaria o dieron su consentimiento, ofrecer siempre la opción de no recibir más mensajes, evitar mensajes masivos idénticos.
- El sistema **no** implementa mecanismos para engañar o evadir los controles antispam de WhatsApp.
- Los mensajes enviados y recibidos quedan guardados en el CRM aunque el número se desconecte.
- La cantidad de números conectados depende del plan.
- API oficial de Meta: no se configura desde el sistema en el MVP; la inmobiliaria la solicita y C&C la gestiona. Sus costos por mensaje los paga la inmobiliaria según las tarifas vigentes de Meta.

### Mensajes automáticos de WhatsApp
Son automáticos los mensajes de las automatizaciones (F-20) y los recordatorios por WhatsApp (F-35). Las respuestas y envíos hechos por un agente desde el CRM son humanos y no cuentan para estos límites.

**Límites globales**, iguales para todas las inmobiliarias, aplicados **por número conectado** y configurables desde el panel de superadministrador. Valores iniciales:

| Operación | Límite |
|---|---:|
| Mensajes automáticos salientes | 30 por día |
| Mensajes automáticos por hora | 10 |
| Separación entre envíos automáticos | 15 segundos |
| Reintentos ante error | 2 |

Estos valores son una política propia de C&C para reducir riesgos; **no** son límites oficiales de WhatsApp ni garantizan que el número no sea restringido.

Requisitos:
- **Cola de mensajes:** todo mensaje automático entra a una cola y se envía respetando los límites; lo que no puede enviarse dentro del límite queda para la siguiente ventana permitida **[A CONFIRMAR: o se descarta pasado cierto tiempo]**.
- **Prevención de duplicados:** el mismo mensaje automático no se envía dos veces al mismo contacto por el mismo evento (por ejemplo, la misma coincidencia o el mismo recordatorio de visita), aunque haya reintentos.
- **Control de horarios:** solo se envían dentro del horario permitido, en hora de Argentina. Horario inicial: **[A CONFIRMAR]**; configurable desde el panel de superadministrador.
- **Registro de resultados y errores:** cada envío registra estado (en cola, enviado, fallido, cancelado), intentos y error.
- **Pausa automática:** ante errores relevantes de un número (por ejemplo, desconexión o restricción), los envíos automáticos de ese número se pausan y se notifica al dueño. Qué errores disparan la pausa y cómo se reanuda: **[A CONFIRMAR]**.
- **Diferenciación:** en la conversación y en los registros se distingue un mensaje automático de una respuesta humana.
- **Consentimiento:** solo se envían a contactos con conversación previa con la inmobiliaria y que no pidieron la baja. Si un contacto pide no recibir más mensajes (ej. "BAJA"), queda marcado como "no contactar" y no recibe automáticos; los agentes pueden seguir respondiéndole si él escribe.
- Solo funcionan en planes Profesional y Empresa y con la cuenta activa o en prueba.

### Recordatorios de agenda por WhatsApp (P1)
- Plantillas editables por la inmobiliaria, anticipación configurable y horarios de envío.
- El usuario elige qué eventos generan recordatorios.
- Son mensajes automáticos: pasan por la cola, respetan los límites globales, el horario y las bajas, previenen duplicados y registran el resultado del envío.

### Importación
- Formato CSV con plantilla descargable para contactos y para propiedades.
- La importación aplica las mismas validaciones y reglas de duplicados que la carga manual y respeta los límites del plan.
- Nada se importa sin que el dueño confirme la vista previa.

### Agenda
- Una visita requiere cliente y propiedad; una tarea puede no tener ninguno.
- Fechas y horas en zona horaria de Argentina; formato DD/MM/AAAA, 24 h.

## 7. Fuera de alcance (MVP)

- Web institucional completa de la inmobiliaria y dominios propios (Fase 3). Sí entra la página pública individual por propiedad (P0) y la API o feed para webs propias (P1).
- Integraciones particulares con cada proveedor de webs inmobiliarias.
- Cobro automático y facturación (Fase 2). En el MVP se cobra por transferencia y C&C activa manualmente.
- API oficial de WhatsApp configurable desde el sistema (Fase 2).
- Automatizaciones configurables por la inmobiliaria (Fase 2); en el MVP solo las predefinidas.
- Bot con IA y descripciones con IA.
- Integración con portales (Zonaprop, Argenprop, Mercado Libre) y publicación automática en ellos.
- Administración de alquileres, contratos y cobros.
- App móvil nativa (el CRM debe usarse bien desde el celular en el navegador).
- Firma digital, tasaciones automáticas, facturación electrónica AFIP/ARCA.
- Fusión automática de contactos.

## 8. Criterios de aceptación

### Objetivos de rendimiento
Objetivos medibles en condiciones normales de operación.

| Criterio | Objetivo | Depende de |
|---|---:|---|
| Aparición de una nueva coincidencia de matching | < 60 s | Plataforma |
| Actualización de cambios del CRM en otras sesiones abiertas | < 3 s | Plataforma |
| Carga inicial del panel | < 3 s | Plataforma (y conexión del usuario) |
| Actualización de una conversación entrante en la bandeja | < 10 s desde que el proveedor de WhatsApp entrega el mensaje | Plataforma + proveedor de WhatsApp |
| Detección y notificación de desconexión de WhatsApp | < 2 min desde que el proveedor informa la desconexión | Plataforma + proveedor de WhatsApp |

En los tiempos que dependen del proveedor de WhatsApp (Evolution API / WhatsApp), la plataforma se compromete solo a su parte: la demora del proveedor se mide y registra, pero queda fuera del objetivo.

### Generales
- Una inmobiliaria nueva puede registrarse, confirmar el email y entrar al panel sin intervención de C&C.
- Un usuario de la inmobiliaria A no puede ver, crear ni modificar datos de la inmobiliaria B, ni siquiera manipulando pedidos al servidor (verificado con tests automáticos sobre la base de datos).
- Toda la interfaz está en español rioplatense, con fechas DD/MM/AAAA y montos con su moneda.
- Las pantallas principales funcionan en un celular de 360 px de ancho sin desplazamiento horizontal.

### Cuentas y planes
- **F-01/F-27:** una cuenta creada hoy figura en prueba con vencimiento a los 14 días; al día 15 pasa a solo lectura; al día 45 a bloqueada; al día 135 sus datos se eliminan (salvo que se haya activado una suscripción).
- **F-27:** en solo lectura, los intentos de responder, editar contactos o propiedades, o modificar información comercial son rechazados por el servidor; la exportación funciona; no sale ningún mensaje de WhatsApp.
- **F-27:** en solo lectura, con la conexión activa, un mensaje entrante se guarda y aparece en el historial de la conversación.
- **F-26:** con el límite de usuarios o propiedades alcanzado, crear uno más (manual, invitación o importación) es rechazado con un mensaje que indica el límite y el plan; los existentes no cambian.
- **F-26:** en el plan Inicial no se pueden activar mensajes automáticos ni recordatorios por WhatsApp, ni desde la interfaz ni mediante pedidos al servidor.
- **F-26/F-14:** en Inicial y Profesional no se puede conectar un segundo número; en Empresa se pueden conectar números hasta el máximo configurado.
- **F-29:** un cambio de límites de un plan hecho desde el panel de superadministrador se aplica a todas las inmobiliarias de ese plan sin desplegar una nueva versión.
- **F-28:** al activar C&C la suscripción, la cuenta pasa a activa y los usuarios pueden volver a crear y modificar datos sin volver a iniciar sesión.
- **F-29:** al suspender C&C una inmobiliaria, sus usuarios no pueden ejecutar ninguna acción a partir del siguiente pedido al servidor.

### «Ingresar como»
- **F-30:** el superadministrador principal puede entrar a cualquier inmobiliaria y crear, editar y eliminar cualquier dato y configuración, incluso si la cuenta está en solo lectura o bloqueada.
- **F-30:** el superadministrador principal no puede quitar al último dueño activo de una inmobiliaria; sí puede designar otro dueño y después quitar al anterior.
- **F-30:** ningún otro usuario (dueños, agentes ni otros usuarios de C&C) puede usar «Ingresar como».
- **F-30:** durante la sesión la interfaz muestra la inmobiliaria en la que se está operando; al salir, el superadministrador vuelve al panel y ya no ve datos de esa inmobiliaria.

### Usuarios y permisos
- **F-04:** un agente desactivado no puede ejecutar ninguna acción a partir del siguiente pedido al servidor, y todos sus contactos, conversaciones, tareas y visitas pendientes figuran como sin asignar.
- **F-07:** un agente puede ver la ficha completa, notas, historial y búsquedas, editar y responder un contacto o conversación asignado a otro agente.
- **F-07:** un agente puede editar una propiedad asignada a otro agente y ver y modificar visitas y tareas de otros agentes.
- **F-07:** los filtros "mis contactos / mis conversaciones / mis propiedades / mi agenda" muestran solo lo asignado al agente; quitar el filtro muestra todo.
- **F-07:** un agente sin la capacidad de reasignar habilitada no puede cambiar la asignación; con la capacidad habilitada, sí.

### Contactos y propiedades
- **F-06:** cargar un contacto con un teléfono o email ya registrado en la inmobiliaria muestra el contacto existente y no crea otro.
- **F-06:** dos contactos con el mismo nombre y distinto teléfono/email se guardan como contactos distintos y no se fusionan.
- **F-34:** un agente puede reportar un posible duplicado pero no puede unificar; el dueño puede unificar, y el contacto resultante conserva conversaciones, actividades, notas, búsquedas, relaciones, teléfonos, emails e información de origen de ambos.
- **F-09:** un agente no puede fusionar propiedades; el dueño sí, y la propiedad resultante conserva el historial y las fotos de ambas.
- **F-10:** la página pública de una propiedad disponible se abre por su URL sin iniciar sesión y muestra solo información pública; la de una propiedad en borrador o pausada devuelve "no encontrada".
- **F-24:** al importar un CSV con filas inválidas, la vista previa indica fila y motivo de cada error; al confirmar, solo se importan las filas válidas y las inválidas se pueden descargar.

### Matching
- **F-12:** una propiedad disponible que cumple todos los obligatorios de una búsqueda activa genera una coincidencia y el agente asignado a la búsqueda recibe una notificación.
- **F-12:** si falla un solo obligatorio, no hay coincidencia.
- **F-12:** una búsqueda con 3 deseables de los que la propiedad cumple 2 muestra 67%; una búsqueda sin deseables muestra 100%.
- **F-12:** con presupuesto máximo USD 100.000 y tolerancia por defecto, una propiedad de USD 110.000 coincide marcada como "superior al presupuesto"; una de USD 110.001 no coincide; una de USD 100.000 coincide sin marca.
- **F-12:** con presupuesto mínimo USD 80.000, una propiedad de USD 79.999 no coincide.
- **F-12:** al cambiar la tolerancia de una búsqueda, sus coincidencias se recalculan con el nuevo valor.
- **F-12:** al pasar una propiedad a vendida, alquilada o pausada, o al mover una búsqueda a una etapa ganada o perdida, no se generan coincidencias nuevas para ella.
- **F-31:** con la cotización desactivada, una búsqueda en USD no coincide con una propiedad en ARS; al habilitarla, se comparan usando la cotización cargada.

### Embudo
- **F-13:** el dueño puede renombrar, agregar, reordenar y desactivar etapas; al renombrar "Cerrado ganado", las métricas de operaciones ganadas siguen contando las búsquedas de esa etapa.
- **F-13:** no se puede desactivar la última etapa activa de tipo ganada ni la última de tipo perdida.

### WhatsApp
- **F-14:** al escanear el QR la conexión queda "conectada"; si se desconecta, el dueño ve el estado y una notificación.
- **F-16:** el primer agente que abre una conversación sin asignar queda asignado; otro agente puede responderla igual, y cada respuesta muestra qué agente la envió y cuándo.
- **F-16/F-17:** un mensaje de un número nuevo aparece en la bandeja y crea un contacto; un mensaje de un número registrado en un contacto se vincula a ese contacto.
- **F-18:** la ficha enviada llega al cliente con fotos, texto y link a la página pública, y queda en el historial del contacto y de la propiedad.
- **F-19/F-20:** un mensaje automático nunca se envía a un contacto sin conversación previa, marcado como "no contactar" o fuera del horario permitido.
- **F-20:** con los valores iniciales, un número no envía más de 30 mensajes automáticos por día ni más de 10 por hora, y entre dos envíos automáticos pasan al menos 15 segundos; los mensajes que exceden el límite quedan en cola.
- **F-20:** un envío fallido se reintenta como máximo 2 veces y queda registrado con su error; un mismo evento no genera dos mensajes al mismo contacto.
- **F-20:** ante un error relevante del número, los envíos automáticos de ese número se pausan y el dueño recibe una notificación.
- **F-20:** un cambio de los límites globales hecho desde el panel de superadministrador se aplica a los envíos siguientes de todos los números.
- **F-20:** en la conversación, un mensaje automático se distingue visualmente de una respuesta humana.

### Agenda
- **F-21:** una visita aparece en la agenda del agente y genera un recordatorio dentro del CRM.
- **F-35:** un recordatorio por WhatsApp se envía con la anticipación configurada, dentro del horario permitido, una sola vez por visita y evento, y queda registrado su resultado.

## 9. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| **WhatsApp no oficial (QR):** restricción o bloqueo del número; cambios de WhatsApp que rompan la conexión. | Advertencia clara al conectar y en los términos; pautas de uso responsable aceptadas; límites globales de envío por número con cola, control de horario y pausa automática ante errores; automáticos solo a contactos con conversación previa y sin baja; historial guardado en el CRM aunque el número se pierda; camino a la API oficial gestionado por C&C. Nunca prometer que el número no se va a bloquear ni presentar los límites como oficiales. |
| **Protección de datos personales (Ley 25.326):** la inmobiliaria carga datos de terceros (clientes, propietarios). | La inmobiliaria es responsable de los datos que carga y administra; C&C es proveedor del servicio, según los términos. Política de privacidad publicada; aislamiento por inmobiliaria en la base de datos; exportación disponible; eliminación al cumplirse la retención. |
| **Consentimiento para mensajes:** envíos no deseados, reclamos de clientes finales. | Automáticos solo a quien ya conversó con la inmobiliaria; opción de baja ("no contactar") respetada por el sistema; horario permitido; plan Inicial sin automatizaciones. |
| **Términos y condiciones:** responsabilidades poco claras ante bloqueos, pérdida de datos o accesos de soporte. | Aceptación obligatoria al registrarse, con versión registrada. Contenido mínimo en §10. Revisión profesional antes del lanzamiento comercial. |
| **Acceso total del superadministrador principal («Ingresar como»):** errores o modificaciones indebidas dentro de una cuenta, sin restricciones técnicas. | Acceso exclusivo del superadministrador principal; indicación permanente de la inmobiliaria en la que opera; entrada y salida explícitas; acceso informado en los términos. El superadministrador principal asume expresamente este riesgo. |
| **Dependencia de proveedores** (Supabase, Vercel, Evolution API / WhatsApp, hosting del VPS). | Integración de WhatsApp detrás de una interfaz propia para poder cambiar de proveedor (QR ↔ API oficial); backups de la base; exportación de datos para las inmobiliarias; monitoreo del estado de cada conexión; objetivos de rendimiento que separan la parte del proveedor. |
| **Abandono durante el onboarding** (registro sin uso real). | Asistente de configuración con progreso; importación CSV con plantilla; posibilidad de saltear y retomar pasos; notificación de pasos pendientes. |
| **Carga manual de pagos:** demoras en la activación tras la transferencia. | Informe de pago desde el sistema; lista de pagos informados en el panel de superadministrador; la cuenta en solo lectura no pierde datos ni mensajes entrantes mientras se verifica. |
| **Precios en USD con cobro en pesos:** desfase por tipo de cambio. | Precios publicados como referencia en USD; mecanismo de facturación y actualización en ARS a definir antes del lanzamiento. |

## 10. Requisitos legales (términos y condiciones y política de privacidad)

Los documentos legales deben contemplar, como mínimo:

- Rol de C&C como proveedor del servicio.
- Responsabilidades de las inmobiliarias sobre los datos que cargan y administran.
- Finalidades y bases del tratamiento de datos.
- Datos almacenados y proveedores involucrados.
- Uso e integración de WhatsApp, incluido que la conexión por QR no es oficial y sus riesgos.
- Acceso de soporte de C&C mediante «Ingresar como».
- Seguridad de la información.
- Conservación y eliminación de datos (solo lectura 30 días, bloqueo y conservación 90 días, eliminación).
- Exportación de información.
- Baja del servicio.
- Responsabilidades de las partes.

Esta lista es un requisito funcional del producto, **no** asesoramiento legal. Los documentos legales definitivos requieren revisión profesional antes del lanzamiento comercial.

## 11. Nombre, marca y dominio

- **InmoGest** es el nombre provisional e interno del proyecto; no es definitivo como nombre comercial.
- La identidad visual no está cerrada.
- Pendiente de validación: disponibilidad de dominio, disponibilidad de marca (INPI), posibles conflictos comerciales o marcarios, identidad visual definitiva.

## 12. Diferenciación

- **Self-service:** registro, prueba y configuración sin depender de C&C.
- **WhatsApp centralizado:** bandeja compartida del número de la inmobiliaria, contactos creados solos, todo el equipo puede responder e historial que queda en la empresa.
- **Matching comprensible:** cada coincidencia explica qué cumple, qué le falta y si supera el presupuesto.
- **Migración sencilla:** importación CSV con vista previa y control de duplicados.
- **Precio accesible** frente a las alternativas del mercado, con un plan de entrada sin automatizaciones.

## Preguntas abiertas

1. Máximo de números de WhatsApp del plan Empresa.
2. Funcionalidades adicionales del plan Profesional, además de las automatizaciones.
3. Límites y funcionalidades durante la prueba gratis (¿equivale a algún plan?).
4. Mecanismo de facturación y actualización en pesos argentinos de los precios en USD.
5. Horario permitido inicial para mensajes automáticos.
6. Qué errores disparan la pausa automática de envíos y cómo se reanudan.
7. Qué pasa con los mensajes automáticos que no entran en el límite: si esperan indefinidamente en la cola o se descartan pasado un tiempo.
8. Formato y alcance del feed o API de propiedades para webs propias (F-33).
9. Qué pasa con las búsquedas que están en una etapa del embudo que se desactiva.
10. En solo lectura, si un mensaje entrante de un número nuevo crea el contacto.
11. Si existen otros usuarios de C&C con acceso al panel de superadministrador y con qué permisos.
12. Redacción legal definitiva de términos y condiciones y política de privacidad (revisión profesional).
13. Nombre comercial, marca, dominio e identidad visual definitivos.
