# Operación y mantenimiento

- **Versión:** 0.1 — 31/10/2026.
- Responsable de operación: C&C (superadministrador principal) **[A CONFIRMAR si se suma el socio]**.

## Backups y restauración

| Qué | Cómo | Frecuencia / retención |
|---|---|---|
| Base de producción | Backups automáticos de Supabase | Según el plan de Supabase contratado **[A CONFIRMAR plan; Point-in-Time Recovery es opcional y pago]**. |
| Base de producción (copia propia) | `pg_dump` cifrado desde el VPS a un almacenamiento externo | Diario, 30 días **[A CONFIRMAR destino]**. |
| Storage (fotos, adjuntos) | Copia periódica de los buckets | Semanal **[A CONFIRMAR]**. |
| Sesiones de WhatsApp | Volumen Docker de Evolution | No se respalda: ante pérdida se vuelve a escanear el QR. Los mensajes ya están en la base. |

Pruebas de restauración: restaurar el backup propio en el proyecto de staging una vez por trimestre y verificar con los tests pgTAP y un conteo de registros por inmobiliaria.

Restauración en producción: solo con aprobación del dueño de C&C, con la app en modo mantenimiento y comunicando a las inmobiliarias afectadas.

## Tareas programadas

| Tarea | Frecuencia | Qué hace |
|---|---|---|
| Retención de cuentas | Diaria | Elimina datos (filas y archivos) de inmobiliarias en `pending_deletion` (más de 30 + 90 días desde el vencimiento). |
| Avisos de vencimiento | Diaria | Notifica al dueño antes del fin de la prueba o del período pago **[A CONFIRMAR anticipación]**. |
| Limpieza técnica | Diaria | Borra jobs terminados, webhook_events y archivos CSV temporales vencidos (retención en `docs/DATABASE.md`). |
| Estado de conexiones de WhatsApp | Cada minuto | Consulta el estado de cada instancia en Evolution y actualiza `whatsapp_connections`. |

## Actualizaciones

| Componente | Política |
|---|---|
| Dependencias npm | Revisión mensual; parches de seguridad apenas se publican. Mayores en rama aparte con todas las compuertas en verde (`docs/STACK.md`). |
| Next.js / React | Leer notas de versión y guías de migración antes de actualizar. |
| Node.js | Mantener la versión LTS vigente en Vercel, CI y worker. |
| Evolution API | Solo versiones estables; probar en staging con número de prueba; revisar cambios de variables de entorno. |
| VPS (sistema operativo, Docker) | Actualizaciones de seguridad automáticas; reinicio planificado en horario de baja actividad (madrugada, hora de Argentina). |
| Supabase | Gestionado por Supabase; seguir los avisos de cambios incompatibles en el panel. |

## Incidentes

1. **Detectar:** alerta (ver `docs/OBSERVABILITY.md`) o reporte de una inmobiliaria.
2. **Clasificar:**
   - **Crítico:** acceso entre inmobiliarias, filtración de datos, plataforma caída, pérdida de datos.
   - **Alto:** WhatsApp caído para todas las inmobiliarias, worker detenido, envíos automáticos fuera de límites.
   - **Medio/bajo:** fallas de una inmobiliaria o funcionalidad puntual.
3. **Contener:** desactivar la funcionalidad afectada (por ejemplo, pausar todos los automáticos desde la configuración global), revertir el deploy, rotar claves si hubo exposición.
4. **Comunicar:** a las inmobiliarias afectadas, con lo que se sabe y lo que se está haciendo. En incidentes con datos personales, evaluar las obligaciones de la Ley 25.326 **[A CONFIRMAR con asesoría legal]**.
5. **Resolver y verificar** con las compuertas de testing.
6. **Postmortem** breve en `docs/DECISIONS/` o en un registro de incidentes **[A CONFIRMAR ubicación]**: causa, impacto, acciones.

Rotación de secretos ante sospecha de exposición: generar la nueva clave en Supabase o Evolution → actualizar Vercel, VPS y `.env.local` → redeploy → revocar la clave anterior → verificar health checks.

## Deprecaciones

- Una funcionalidad o campo se retira en dos pasos: primero se oculta en la interfaz y se deja de escribir; después de al menos un ciclo de deploy, se elimina de la base con una migración.
- Feed/API de propiedades (P1): versión en la URL (`/v1/`); una versión se mantiene al menos 90 días después de publicar la siguiente y se avisa a las inmobiliarias que la usan **[A CONFIRMAR plazo]**.
- Cambios que afecten a todas las inmobiliarias (planes, límites, términos) se comunican con anticipación **[A CONFIRMAR plazo]**.
