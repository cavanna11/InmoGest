# Pendientes de Santiago

Lo que solo podés hacer vos. Lo demás lo avanza el desarrollo. Última actualización: 04/11/2026.

## Para seguir ahora

- [ ] **Probar el súper panel con tu cuenta.** Entrá a `https://inmopanel-beta.vercel.app`, tocá **Ingresar** y usá tu email y contraseña. Tenés que caer en `/plataforma`. Es la primera vez que estas pantallas se usan con tu rol.
  1. Creá una inmobiliaria de prueba en **Inmobiliarias → Nueva inmobiliaria**, con un email tuyo alternativo como dueño.
  2. Abrí el enlace de acceso en una ventana de incógnito, elegí la contraseña y aceptá los términos.
  3. Volvé a tu sesión y probá **Ingresar como soporte** y **Salir del contexto**.
  4. Probá suspender, reactivar, dar de baja y eliminar esa inmobiliaria de prueba.
- [ ] **Cargar tus datos de transferencia** en **Plataforma → Planes y ajustes**. Sin esto, las inmobiliarias ven que te los tienen que pedir por WhatsApp.
- [ ] **Decidir si eliminás la inmobiliaria "Cavanna"**, si ya no la querés. Se hace desde el súper panel.

## Para que funcione WhatsApp

La conexión por QR, la bandeja y el worker ya están programados y probados contra un Evolution de prueba, no contra WhatsApp real. Hasta que hagas esto, la pantalla de WhatsApp avisa que no está habilitado.

- [ ] **Contratar el VPS** con Docker y al menos 2 GB de RAM. Es lo que más traba el producto: sin esto no hay conexión por QR real.
- [ ] **Conseguir un subdominio que apunte al VPS.** Hace falta para el certificado TLS: puede salir del dominio nuevo o de otro que ya tengas.
- [ ] **Instalar siguiendo `infrastructure/evolution/README.md`.** Esos archivos todavía no se probaron en un VPS real. Si preferís, dame acceso y lo hacemos juntos.
- [ ] **Cargar las variables** en Vercel y en el VPS, sin pasármelas por el chat: `EVOLUTION_API_URL` y `EVOLUTION_API_KEY`.
- [ ] **Confirmar en Vercel que `NEXT_PUBLIC_APP_URL` tenga la URL pública de la app.** Con esa URL se arman los avisos de Evolution y los links de las fichas.
- [ ] **Conseguir un número de WhatsApp de prueba** con historial de uso real. La conexión por QR no es oficial y el número puede ser restringido, así que no uses tu número principal para probar.

## Para publicar en Mercado Libre

La conexión, la publicación y la sincronización ya están programadas (ADR 0012). Se probaron contra un servidor falso con el contrato de la documentación oficial, no contra Mercado Libre real.

- [ ] **Aprobar que se aplique la migración `20261115120000_listings_integrations.sql`** al proyecto de desarrollo, que aloja la beta. Sin ella no funcionan los links, el sitio web ni Mercado Libre.
- [ ] **Crear la aplicación** en `https://developers.mercadolibre.com.ar` → Mis aplicaciones, con tu cuenta.
  - URL de retorno, exacta: `<URL pública de la app>/api/integraciones/mercadolibre/callback`. Hoy sería `https://inmopanel-beta.vercel.app/api/integraciones/mercadolibre/callback`.
  - Permisos: lectura y escritura, con acceso sin conexión (`offline_access`) para que se renueve sola. Si la pantalla ofrece PKCE, activalo: InmoPanel ya lo usa.
- [ ] **Cargar en Vercel** `MERCADOLIBRE_CLIENT_ID`, `MERCADOLIBRE_CLIENT_SECRET` e `INTEGRATIONS_ENCRYPTION_KEY`, sin pasármelas por el chat. Para generar la última, el comando está en `.env.example`. Guardá una copia segura de esa clave: si se pierde, cada inmobiliaria tiene que volver a conectar. Después volvé a desplegar.
- [ ] **Hacer la primera prueba real** con una cuenta de Mercado Libre habilitada para inmuebles y un paquete de publicación contratado.
  1. Conectá la cuenta en **Integraciones**.
  2. Publicá una propiedad disponible y con fotos.
  3. Cambiale el precio y revisá que se actualice en Mercado Libre.
  4. Pasala a Reservada, que la pausa, y después a Vendida, que la finaliza.
- [ ] **Decidir quién publica.** Hoy publica cualquier miembro que puede editar la propiedad, y eso usa el cupo de paquetes de la inmobiliaria. Si preferís que publique solo el dueño, es un cambio chico.
- [ ] **Pedirle a Navent acceso como integrador** si querés publicar también en Zonaprop y Argenprop. Mientras tanto, se pueden pegar los links a mano.

## Legal y comercial

- [ ] **Hacer revisar los términos y la privacidad por un profesional.** La versión `beta-1` está publicada, pero nadie con matrícula la revisó.
- [ ] **Definir el plazo de conservación frente a "Eliminar para siempre".** Los términos dicen que los datos se conservan un año, y el súper panel permite borrarlos antes. Tenés que definir si eso es aceptable o si hay que ajustar el texto.
- [ ] **Comprar el dominio `inmopanel.com.ar`.** Después seguí la sección "Al comprar el dominio" de `docs/DEPLOYMENT.md`. Sin dominio no hay email transaccional y el registro público sigue cerrado.

## Decisiones del PRD que siguen abiertas

- [ ] **Segundo factor (MFA) para tu cuenta.** `docs/SECURITY.md` lo recomienda porque tu cuenta accede a todas las inmobiliarias.
- [ ] **Horario permitido de los mensajes automáticos.** Mientras no esté definido, no se envía ningún automático.
- [ ] **Máximo de números de WhatsApp del plan Empresa.** Hoy, sin definir, se permite 1.
- [ ] **Número nuevo en una cuenta en solo lectura.** Hay que definir si crea el contacto. El PRD lo propone para no perder información, y así queda implementado hasta que decidas.
