# Instrucciones generales para agentes

Fuente única de instrucciones del proyecto para Claude Code (vía `CLAUDE.md`) y Codex.

## Identidad del producto

- **Producto:** InmoPanel. **Nombre comercial completo:** InmoPanel by C&C.
- **Empresa desarrolladora:** C&C. InmoPanel es el producto SaaS; C&C es el respaldo corporativo.
- **Categoría:** plataforma SaaS de gestión inmobiliaria para inmobiliarias y profesionales del sector de Latinoamérica. El MVP se enfoca en Argentina (ver `docs/PRD.md`).
- **Descriptor:** "Gestión inmobiliaria inteligente". **Frase complementaria:** "Todo tu negocio inmobiliario, en un solo lugar."
- **Posicionamiento:** centraliza la operación de la inmobiliaria (contactos, conversaciones, propiedades, búsquedas, oportunidades, agenda, seguimiento y automatizaciones). No presentarlo como una simple agenda de propiedades ni como un CRM genérico.
- **Presentación:** "InmoPanel" es la marca protagonista; "by C&C" va en segundo plano, más chico y sin competir visualmente. No hay logotipo ni identidad gráfica definitiva: no inventarlos (`docs/BRAND.md`).
- **Dominio previsto:** `inmopanel.com.ar`, todavía **no comprado ni configurado**. No usarlo en configuraciones ni afirmar que funciona (`docs/DEPLOYMENT.md`, "Al comprar el dominio").
- **Nombres anteriores** (InmoGest, InmoGestión): son históricos y no se vuelven a usar en interfaz, documentación nueva ni material comercial. Se conservan solo como identificadores técnicos internos (paquetes `@inmogest/*`, `project_id` del Supabase local, emails de prueba `@inmogest.test`, nombre del repositorio y de la carpeta) y en registros históricos (commits, migraciones aplicadas).

## Antes de modificar

- Leer `docs/PRD.md`, `docs/ARCHITECTURE.md` y los documentos específicos de la tarea.
- Inspeccionar el código existente antes de proponer una implementación.
- Consultar `docs/DECISIONS/` antes de cambiar una decisión estructural.

## Reglas

- No inventar requisitos ni ampliar alcance silenciosamente.
- No cambiar stack, arquitectura o mecanismos de seguridad sin autorización.
- No introducir secretos en el repositorio.
- No agregar dependencias sin justificar necesidad, mantenimiento, licencia e impacto.
- No desactivar tests o validaciones para obtener un resultado verde.
- Mantener documentación relevante sincronizada con el código.
- Tratar `materials/` como fuentes de referencia, no como especificación oficial automática.
- Toda interfaz, documentación, landing o comunicación nueva usa la identidad InmoPanel by C&C.

## Al finalizar

Informar cambios realizados, verificaciones ejecutadas, verificaciones no realizadas y riesgos o pendientes.
