import { isCurrency, parseAmount, toDbNumeric } from '@inmogest/shared';
import { z } from 'zod';
import { isFeature, OPERATION_LABELS, STATUS_LABELS, TYPE_LABELS } from './labels.ts';

// Entrada del formulario de propiedades (CU-05, F-08). Los montos se interpretan a la argentina
// (punto de miles, coma decimal, ADR 0006) y llegan a la base como numeric(14,2) con su moneda.

const text = (max: number) => z.string().trim().max(max, `Máximo ${max} caracteres.`);

const optionalAmount = (label: string) =>
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
      if (parsed.value.cents === 0n) return null;
      // numeric(14,2) cabe exacto en un double (hasta 15 dígitos).
      return Number(toDbNumeric(parsed.value));
    });

const optionalInteger = (max: number) =>
  z
    .string()
    .trim()
    .transform((value, ctx) => {
      if (value === '') return null;
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) {
        ctx.addIssue({ code: 'custom', message: `Ingresá un número entre 0 y ${max}.` });
        return z.NEVER;
      }
      return parsed;
    });

const optionalArea = z
  .string()
  .trim()
  .transform((value, ctx) => {
    if (value === '') return null;
    const parsed = Number(value.replace(/\./g, '').replace(',', '.'));
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 99_999_999) {
      ctx.addIssue({ code: 'custom', message: 'Ingresá una superficie válida en m².' });
      return z.NEVER;
    }
    return Math.round(parsed * 100) / 100;
  });

const currency = z.string().refine(isCurrency, 'Elegí la moneda.');

export const propertySchema = z
  .object({
    title: text(120).min(1, 'Ingresá un título.'),
    description: text(8000),
    operation: z.enum(Object.keys(OPERATION_LABELS) as [keyof typeof OPERATION_LABELS], { message: 'Elegí la operación.' }),
    propertyType: z.enum(Object.keys(TYPE_LABELS) as [keyof typeof TYPE_LABELS], { message: 'Elegí el tipo.' }),
    status: z.enum(Object.keys(STATUS_LABELS) as [keyof typeof STATUS_LABELS], { message: 'Elegí el estado.' }),
    price: optionalAmount('Precio'),
    currency,
    expenses: optionalAmount('Expensas'),
    expensesCurrency: currency,
    province: text(80),
    city: text(80),
    neighborhood: text(80),
    address: text(160),
    showAddress: z.string().optional().transform((value) => value === 'on'),
    rooms: optionalInteger(99),
    bedrooms: optionalInteger(99),
    bathrooms: optionalInteger(99),
    coveredArea: optionalArea,
    totalArea: optionalArea,
    features: z.array(z.string()).transform((values) => [...new Set(values.filter(isFeature))]),
    assignedUserId: z
      .string()
      .optional()
      .transform((value) => (value ? value : null))
      .pipe(z.uuid().nullable()),
  })
  .refine((value) => value.status === 'draft' || value.status === 'paused' || value.price !== null, {
    message: 'Para publicarla, cargá el precio (o dejala en borrador).',
    path: ['price'],
  });

export type PropertyInput = z.infer<typeof propertySchema>;

/** Columnas de la base a partir de la entrada validada. */
export function toPropertyRow(input: PropertyInput) {
  return {
    title: input.title,
    description: input.description,
    operation: input.operation,
    property_type: input.propertyType,
    status: input.status,
    price: input.price,
    currency: input.currency,
    expenses: input.expenses,
    expenses_currency: input.expensesCurrency,
    province: input.province,
    city: input.city,
    neighborhood: input.neighborhood,
    address: input.address,
    show_address: input.showAddress,
    rooms: input.rooms,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    covered_area_m2: input.coveredArea,
    total_area_m2: input.totalArea,
    features: input.features,
    assigned_user_id: input.assignedUserId,
  };
}
