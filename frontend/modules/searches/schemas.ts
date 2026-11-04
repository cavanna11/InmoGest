import { isCurrency, parseAmount, toDbNumeric } from '@inmogest/shared';
import { z } from 'zod';
import { isFeature, OPERATION_LABELS, TYPE_LABELS } from '../properties/labels.ts';

// Entrada del formulario de búsquedas (CU-06, F-11). Montos a la argentina (ADR 0006).

const amount = (label: string) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === '') return null;
      const parsed = parseAmount(value, 'ARS');
      if (!parsed.ok) {
        ctx.addIssue({ code: 'custom', message: `${label}: ${parsed.error.message}` });
        return z.NEVER;
      }
      return Number(toDbNumeric(parsed.value));
    });

const minimum = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === '') return null;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 99) {
      ctx.addIssue({ code: 'custom', message: 'Ingresá un número entre 0 y 99.' });
      return z.NEVER;
    }
    return parsed;
  });

const features = z.array(z.string()).transform((values) => [...new Set(values.filter(isFeature))]);

export const searchSchema = z
  .object({
    contactId: z.uuid('Elegí un contacto.'),
    operation: z.enum(Object.keys(OPERATION_LABELS) as [keyof typeof OPERATION_LABELS], { message: 'Elegí la operación.' }),
    propertyTypes: z
      .array(z.enum(Object.keys(TYPE_LABELS) as [keyof typeof TYPE_LABELS]))
      .min(1, 'Elegí al menos un tipo de propiedad.'),
    budgetMin: amount('Mínimo'),
    budgetMax: amount('Máximo'),
    currency: z.string().refine(isCurrency, 'Elegí la moneda.'),
    tolerance: z
      .string()
      .trim()
      .transform((value, ctx) => {
        if (value === '') return 10;
        const parsed = Number(value.replace(',', '.'));
        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
          ctx.addIssue({ code: 'custom', message: 'Ingresá un porcentaje entre 0 y 100.' });
          return z.NEVER;
        }
        return parsed;
      }),
    minRooms: minimum,
    minBedrooms: minimum,
    locations: z
      .string()
      .max(500, 'Demasiadas zonas.')
      .transform((value) => [...new Set(value.split(',').map((zone) => zone.trim()).filter(Boolean))]),
    required: features,
    desired: features,
    notes: z.string().trim().max(2000, 'Máximo 2000 caracteres.'),
    assignedUserId: z
      .string()
      .optional()
      .transform((value) => (value ? value : null))
      .pipe(z.uuid().nullable()),
  })
  .refine((value) => value.budgetMin === null || value.budgetMax === null || value.budgetMin <= value.budgetMax, {
    message: 'El mínimo no puede superar al máximo.',
    path: ['budgetMin'],
  })
  // Una característica requerida no se cuenta además como deseada (no sumaría al puntaje).
  .transform((value) => ({ ...value, desired: value.desired.filter((feature) => !value.required.includes(feature)) }));

export type SearchInput = z.infer<typeof searchSchema>;
