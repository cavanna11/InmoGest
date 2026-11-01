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

Dominios: panel y páginas públicas en el dominio definitivo **[A CONFIRMAR]**; mientras tanto, el dominio por defecto de Vercel.

## Checklist antes de la beta

- [ ] Dominio definitivo (PRD §11).
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
