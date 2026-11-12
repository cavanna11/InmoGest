# Workflows

Pipelines CI/CD del repositorio.

- `ci.yml`: compuertas de `docs/TESTING.md` en cada PR y push a `main`.
- `keep-alive.yml`: llamada diaria a `/api/health` para que Supabase (plan gratuito) no pause el proyecto de la beta.
