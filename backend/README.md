# Backend

Implementación backend según `docs/ARCHITECTURE.md` y ADR 0001/0002.

```text
backend/
├── supabase/   config.toml · migrations/ · seed.sql (solo desarrollo) · tests/ (pgTAP)
├── worker/     consumidor de jobs y de la outbox de WhatsApp (Node, corre en el VPS)
└── shared/     @inmogest/shared: esquemas Zod, tipos de la base, WhatsAppProvider, utilidades
```

La base es la fuente de verdad de los permisos (RLS). El worker usa la clave secreta: toda consulta filtra por `organization_id` explícitamente.
