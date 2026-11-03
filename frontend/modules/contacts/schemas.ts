import { normalizePhone } from '@inmogest/shared';
import { z } from 'zod';
// Import relativo: lo usan también los tests unitarios (Vitest no resuelve el alias @/).
import { emailSchema } from '../../lib/schemas.ts';

// Entradas de los formularios de contactos (F-06). Teléfonos normalizados a E.164 (+549 para
// Argentina, PRD §6) antes de llegar a la base, que vuelve a validar el formato.

export const MAX_CHANNELS = 5;

export const contactNameSchema = z.string().trim().min(1, 'Ingresá el nombre.').max(120, 'El nombre es demasiado largo.');
export const notesSchema = z.string().max(5000, 'Las notas son demasiado largas (máximo 5000 caracteres).');

export const phoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const result = normalizePhone(value);
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', message: result.error.message });
      return z.NEVER;
    }
    return result.value.e164;
  });

const checkbox = z
  .string()
  .optional()
  .transform((value) => value === 'on');

const assignee = z
  .string()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.uuid().nullable());

/** Lee los campos repetidos (phone, email) del formulario, sin los vacíos. */
export function repeated(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean);
}

export const newContactSchema = z
  .object({
    fullName: contactNameSchema,
    phones: z.array(phoneSchema).max(MAX_CHANNELS, `Hasta ${MAX_CHANNELS} teléfonos.`),
    emails: z.array(emailSchema).max(MAX_CHANNELS, `Hasta ${MAX_CHANNELS} emails.`),
    notes: notesSchema,
    isProspect: checkbox,
    isOwner: checkbox,
    assignedUserId: assignee,
  })
  .refine((value) => value.isProspect || value.isOwner, {
    message: 'Marcá si es interesado, propietario o ambos.',
    path: ['isProspect'],
  });

export const contactUpdateSchema = z
  .object({
    fullName: contactNameSchema,
    notes: notesSchema,
    isProspect: checkbox,
    isOwner: checkbox,
    doNotContact: checkbox,
    assignedUserId: assignee,
  })
  .refine((value) => value.isProspect || value.isOwner, {
    message: 'Marcá si es interesado, propietario o ambos.',
    path: ['isProspect'],
  });

export const activitySchema = z.object({
  kind: z.enum(['note', 'call'], { message: 'Elegí el tipo.' }),
  body: z.string().trim().min(1, 'Escribí la nota.').max(5000, 'La nota es demasiado larga.'),
});
