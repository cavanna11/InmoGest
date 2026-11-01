import { err, type Err } from './result.ts';

/**
 * Traducción de errores de Postgres / PostgREST a errores tipados en español
 * (docs/ARCHITECTURE.md, "Errores"). Nunca expone SQL, nombres de tablas ni datos de otra inmobiliaria.
 *
 * Códigos propios (SQLSTATE clase "IG") lanzados por funciones y triggers de backend/supabase:
 *   IG001 límite del plan alcanzado   (detail: JSON { resource, limit, plan })
 *   IG003 último dueño activo
 *   IG004 operación reservada a la plataforma
 *   IG005 slug no disponible (en uso o reservado por el historial, ADR 0008)
 *   IG006 documento legal no vigente, borrador no habilitado o ya aceptado (ADR 0009)
 */

export type DbErrorCode =
  | 'duplicate'
  | 'invalid_reference'
  | 'invalid_data'
  | 'forbidden'
  | 'not_found'
  | 'plan_limit_reached'
  | 'last_owner'
  | 'platform_only'
  | 'slug_unavailable'
  | 'legal_document_invalid'
  | 'unexpected';

/** Forma común de PostgrestError (supabase-js) y de DatabaseError (pg). */
export type DbErrorLike = { code?: string | undefined; detail?: string | undefined; details?: string | null | undefined };

const PLAN_RESOURCES: Record<string, { singular: string; plural: string }> = {
  users: { singular: 'usuario', plural: 'usuarios' },
  properties: { singular: 'propiedad', plural: 'propiedades' },
  whatsapp_numbers: { singular: 'número de WhatsApp', plural: 'números de WhatsApp' },
};

export function translateDbError(error: DbErrorLike | null | undefined): Err<DbErrorCode> {
  switch (error?.code) {
    case '23505':
      return err('duplicate', 'Ya existe un registro con esos datos.');
    case '23503':
      return err('invalid_reference', 'Uno de los datos relacionados no existe o no está disponible.');
    case '23502':
    case '23514':
    case '22P02':
    case '22001':
    case '22003':
      return err('invalid_data', 'Algunos datos no son válidos. Revisalos e intentá de nuevo.');
    case '42501':
      return err(
        'forbidden',
        'No tenés permiso para hacer esto, o la cuenta está en solo lectura.',
      );
    case 'PGRST116':
    case 'P0002':
      return err('not_found', 'No encontramos lo que buscabas.');
    case 'IG001':
      return planLimit(error.detail ?? error.details ?? undefined);
    case 'IG003':
      return err(
        'last_owner',
        'La inmobiliaria tiene que conservar al menos un dueño activo. Designá otro dueño antes de quitar a este.',
      );
    case 'IG004':
      return err('platform_only', 'Solo C&C puede hacer este cambio.');
    case 'IG005':
      return err('slug_unavailable', 'Esa dirección ya está en uso o la usó otra inmobiliaria. Probá con otra.');
    case 'IG006':
      return err(
        'legal_document_invalid',
        'Los términos y condiciones cambiaron o no están disponibles. Recargá la página para ver la versión vigente.',
      );
    default:
      return err('unexpected', 'Ocurrió un error inesperado. Intentá de nuevo en unos minutos.');
  }
}

function planLimit(detail: string | undefined): Err<DbErrorCode> {
  const fallback = 'Llegaste al límite de tu plan. Cambiá de plan para agregar más.';
  if (!detail) return err('plan_limit_reached', fallback);
  try {
    const parsed: unknown = JSON.parse(detail);
    if (typeof parsed !== 'object' || parsed === null) return err('plan_limit_reached', fallback);
    const { resource, limit, plan } = parsed as Record<string, unknown>;
    const names = typeof resource === 'string' ? PLAN_RESOURCES[resource] : undefined;
    if (!names || typeof limit !== 'number' || typeof plan !== 'string') {
      return err('plan_limit_reached', fallback);
    }
    const noun = limit === 1 ? names.singular : names.plural;
    return err(
      'plan_limit_reached',
      `Llegaste al límite de ${limit} ${noun} del plan ${plan}. Cambiá de plan para agregar más.`,
    );
  } catch {
    return err('plan_limit_reached', fallback);
  }
}
