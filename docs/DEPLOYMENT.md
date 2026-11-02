# Deploy

- **Versión:** 0.1 — 31/10/2026.
- Regla: **ningún deploy ni migración a producción sin aprobación explícita del dueño de C&C.**

## Ambientes

```text
Local → CI → Staging → Production
```

| Ambiente | App | Base | WhatsApp / worker | Uso |
|---|---|---|---|---|
| Local | `npm run dev` (localhost:3000) | Proyecto Supabase de **desarrollo** (nube) | Evolution local con Docker (opcional) o el del VPS con una instancia de prueba | Desarrollo y tests. |
| CI | GitHub Actions (`.github/workflows/ci.yml`) | Supabase local efímero en el runner (`supabase start`, con Docker), con migraciones y seed; sin secretos en GitHub | `WhatsAppProvider` falso | Compuertas de `docs/TESTING.md`. |
| Staging | Vercel Preview (por rama/PR) | Proyecto Supabase de **staging** **[A CONFIRMAR: proyecto separado o reutilizar desarrollo, por costo]** | Instancia de Evolution de prueba con número de prueba | Validación antes de producción. |
| Production | Vercel Production | Proyecto Supabase de **producción** (región São Paulo) | VPS de producción (Evolution + worker) | Clientes reales. |

Dominios: panel y páginas públicas en `inmopanel.com.ar` (previsto, **todavía no comprado**); mientras tanto, el dominio por defecto de Vercel.

## Vercel (configuración del proyecto)

El repositorio está conectado a Vercel desde el 01/11/2026.

| Ajuste (Settings → Build and Deployment) | Valor |
|---|---|
| Root Directory | `frontend` |
| Framework | Next.js, fijado en `frontend/vercel.json` (`"framework": "nextjs"`). El proyecto se creó con Root Directory en la raíz, donde no hay Next.js, y el preset quedó en "Other": con "Other" el build compila pero falla al buscar una carpeta `public` estática. |
| Node.js Version | 22.x |
| Variables | Ninguna obligatoria hoy. Al agregar las de Supabase: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` por ambiente; `SUPABASE_SECRET_KEY` solo si alguna ruta del servidor la usa. |

**Importante:** con Root Directory `frontend`, Vercel instala **solo las dependencias del workspace `@inmogest/web`** (no las `devDependencies` de la raíz). Por eso todo lo que `next build` necesita (`typescript`, `@types/node`, Tailwind) se declara en `frontend/package.json`, y los tests de la app (`*.test.ts`, que usan `vitest` de la raíz) quedan fuera de `frontend/tsconfig.json` y se chequean con `frontend/tsconfig.test.json` en `npm run typecheck`. Para reproducir el build de Vercel: clon limpio, `cd frontend && npm install && npm run build`.

**[A CONFIRMAR]** Con la integración por defecto, cada push a `main` despliega a **Production**. Mientras no exista el ambiente de producción (base, dominio, textos legales), decidir: desactivar los deploys automáticos de producción, o tratar ese proyecto de Vercel como ambiente de desarrollo sin datos reales.

## Al comprar el dominio `inmopanel.com.ar`

Hoy el dominio **no está comprado ni configurado**: la app usa el dominio por defecto de Vercel y ninguna configuración apunta a `inmopanel.com.ar`. Relevamiento del 02/11/2026: no hay dominios propios cargados en el repo; las únicas URLs son técnicas (`localhost`, `127.0.0.1` del Supabase local, URLs de Supabase en `.env.local`, que no se tocan).

Cambios a hacer cuando se compre (cada uno con aprobación, empezando por desarrollo o staging):

1. **DNS:** apuntar el dominio a Vercel (registros que indique Vercel) y agregarlo en el proyecto (Settings → Domains). Decidir `inmopanel.com.ar` o `www.inmopanel.com.ar` como principal y redirigir el otro.
2. **Vercel:** `NEXT_PUBLIC_APP_URL=https://inmopanel.com.ar` en Production (y la URL de preview en Preview).
3. **SEO / indexación:** en Production, `NEXT_PUBLIC_APP_URL=https://inmopanel.com.ar` (lo usa `metadataBase`, el canonical, `sitemap.xml` y `robots.txt`) y `NEXT_PUBLIC_SITE_INDEXABLE=true`. Sin esa variable el sitio declara `noindex` y `robots.txt` bloquea todo: así no se indexan dominios temporales de Vercel ni previews (`frontend/lib/site.ts`). Después, dar de alta el dominio en Google Search Console y enviar el sitemap.
4. **Supabase Auth (producción):** Site URL `https://inmopanel.com.ar` y Redirect URLs (`/auth/confirm`, `/invitacion/*`), más las de preview si se usan.
5. **Email (ADR 0007):** verificar el dominio en el proveedor transaccional (SPF, DKIM, DMARC), remitente del tipo `no-responder@inmopanel.com.ar`, y configurarlo como SMTP de Supabase Auth.
6. **Páginas públicas:** las URLs `/p/<slug>/<propiedad>` quedan bajo el dominio. Si antes se compartieron links con el dominio de Vercel, mantener ese dominio redirigiendo al nuevo.
7. **Landing:** `frontend/components/landing/config.ts` (destinos de demo y legales cuando existan) y textos legales con el dominio.
8. **Evolution / webhooks:** si el webhook de Evolution apunta a la URL de la app, actualizarlo a `https://inmopanel.com.ar/api/webhooks/evolution/…`.
9. **Monitoreo:** el monitor externo de `/api/health` (docs/OBSERVABILITY.md) sobre el dominio nuevo.
10. **Documentación:** quitar las aclaraciones de "dominio no comprado" (`AGENTS.md`, `docs/BRAND.md`, `docs/PRD.md` §11, `README.md`, `.env.example`).

A futuro, `inmopanel.com` o `inmopanel.ai` (según disponibilidad) para la expansión regional: mismo procedimiento y redirección al dominio principal que se elija.

## Checklist antes de la beta

- [ ] Comprar y configurar `inmopanel.com.ar` (ver "Al comprar el dominio").
- [ ] Proveedor de email transaccional (por ejemplo Resend) con el dominio verificado (SPF, DKIM, DMARC), configurado como **SMTP de Supabase Auth** en el proyecto de producción (ADR 0007).
- [ ] Plantillas de email de Auth (confirmación, recuperación) en español rioplatense.
- [ ] Authentication: contraseña mínima de 10 con mayúsculas, minúsculas y números; confirmación de email obligatoria; Site URL y Redirect URLs del dominio definitivo.
- [ ] Términos y privacidad revisados profesionalmente, cargados como documentos no borrador y configurados como vigentes (`platform_settings.current_terms_id` / `current_privacy_id`, ADR 0009). Producción nunca corre el seed ni activa `allow_draft_legal_documents`.

## Pipeline

```text
PR abierto
  → CI: install → typecheck → lint → unit → build → check:env → npm audit
        en paralelo: Supabase local → db:push --dry-run → pgTAP → integración
  → Vercel Preview (staging)
  → revisión
Merge a main (o ejecución manual del workflow)
  → CI completo + E2E (incluidos los de autenticación @auth, sobre Supabase local con Mailpit)
  → (con aprobación) migraciones a producción: npm run db:push contra producción
  → (con aprobación) promoción del deploy de Vercel a producción
  → (si cambió) deploy del worker en el VPS: docker compose pull && up -d
  → verificación: /api/health de la app y del worker, estado de conexiones de WhatsApp
```

- Las migraciones se aplican **antes** del deploy de la app y deben ser compatibles con la versión anterior (agregar columnas/tablas primero; eliminar en una migración posterior, una vez que ninguna versión desplegada las use).
- El worker se versiona con la misma etiqueta de commit que la app; imagen Docker construida en CI y publicada en un registro privado **[A CONFIRMAR registro: GitHub Container Registry]**.
- Evolution API se actualiza aparte, solo a versiones estables, después de probar en staging.

## Rollback

| Componente | Procedimiento |
|---|---|
| App (Vercel) | "Instant rollback" al deploy anterior desde Vercel. |
| Worker | `docker compose` con la etiqueta de imagen anterior. |
| Base | No se revierten migraciones automáticamente. Se escribe una migración correctiva hacia adelante. Si hay pérdida o corrupción de datos: restauración desde backup (ver `docs/OPERATIONS.md`). |
| Evolution | Volver a la imagen anterior; las sesiones viven en el volumen y se conservan. Si una sesión se pierde, el dueño vuelve a escanear el QR. |

Por la compatibilidad hacia atrás de las migraciones, revertir la app no requiere revertir la base.

## Secretos

| Ambiente | Cómo se inyectan |
|---|---|
| Local | `.env.local` (ignorado por Git), copiado de `.env.example`. |
| CI | GitHub Actions secrets (solo los necesarios para tests; nunca claves de producción). |
| Vercel | Variables de entorno por ambiente (Preview / Production) en el proyecto de Vercel. |
| VPS | Archivo `.env` fuera del repositorio con permisos 600, leído por `docker compose`. |

- Las variables `NEXT_PUBLIC_*` solo contienen valores públicos (URL de la app, URL y clave publicable de Supabase).
- Cada ambiente usa sus propias claves; una clave de desarrollo nunca sirve en producción.
- Rotación según `docs/OPERATIONS.md`.
