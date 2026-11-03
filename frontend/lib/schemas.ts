import { isValidSlug, normalizePhone } from '@inmogest/shared';
import { z } from 'zod';

// Esquemas de entrada compartidos por los formularios del incremento 1.1 (docs/SECURITY.md:
// contraseña ≥ 10 con mayúsculas, minúsculas y números).

export const passwordSchema = z
  .string()
  .min(10, 'La contraseña tiene que tener al menos 10 caracteres.')
  .max(72, 'La contraseña es demasiado larga.')
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), {
    message: 'Usá mayúsculas, minúsculas y números.',
  });

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, 'El email es demasiado largo.')
  .pipe(z.email('Ingresá un email válido.'));

export const personNameSchema = z
  .string()
  .trim()
  .min(1, 'Ingresá tu nombre.')
  .max(120, 'El nombre es demasiado largo.');

export const organizationNameSchema = z
  .string()
  .trim()
  .min(1, 'Ingresá el nombre de la inmobiliaria.')
  .max(120, 'El nombre es demasiado largo.');

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidSlug, 'Usá solo letras minúsculas, números y guiones (máximo 60).');

/** Teléfono opcional: vacío → null; si hay valor, E.164 (+549 para Argentina). */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === '') return null;
    const result = normalizePhone(value);
    if (!result.ok) {
      ctx.addIssue({ code: 'custom', message: result.error.message });
      return z.NEVER;
    }
    return result.value.e164;
  });

export const signUpSchema = z.object({
  organizationName: organizationNameSchema,
  fullName: personNameSchema,
  email: emailSchema,
  password: passwordSchema,
  acceptLegal: z.literal('on', { message: 'Tenés que aceptar los términos y la política de privacidad.' }),
});

export const invitedSignUpSchema = z.object({
  fullName: personNameSchema,
  password: passwordSchema,
  token: z.string().min(20).max(200),
});

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresá tu contraseña.').max(200),
});

export const organizationSettingsSchema = z.object({
  name: organizationNameSchema,
  slug: slugSchema,
  contactEmail: z.union([z.literal(''), emailSchema]).transform((v) => (v === '' ? null : v)),
  contactPhone: optionalPhoneSchema,
  defaultCurrency: z.enum(['ARS', 'USD'], { message: 'Elegí una moneda.' }),
  agentsCanReassign: z.literal('on').optional().transform((v) => v === 'on'),
});

export const invitationSchema = z.object({
  email: emailSchema,
  role: z.enum(['agent', 'owner'], { message: 'Elegí un rol.' }),
});

export const profileSchema = z.object({
  fullName: personNameSchema,
  phone: optionalPhoneSchema,
});

export const newPasswordSchema = z
  .object({ password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { message: 'Las contraseñas no coinciden.', path: ['confirm'] });
