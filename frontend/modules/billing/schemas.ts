import { isCurrency, parseAmount, toDbNumeric } from '@inmogest/shared';
import { z } from 'zod';

// Informe de pago por transferencia (CU-13). Monto a la argentina (ADR 0006).

export const RECEIPT_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };
export const RECEIPT_MAX_BYTES = 5 * 1024 * 1024;

export const paymentSchema = z.object({
  planCode: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/, 'Elegí un plan.'),
  months: z.coerce.number().int().min(1, 'Elegí los meses.').max(24, 'Máximo 24 meses.'),
  amount: z
    .string()
    .trim()
    .transform((value, ctx) => {
      const parsed = parseAmount(value, 'ARS');
      if (!parsed.ok || parsed.value.cents === 0n) {
        ctx.addIssue({ code: 'custom', message: 'Ingresá el monto transferido.' });
        return z.NEVER;
      }
      return Number(toDbNumeric(parsed.value));
    }),
  currency: z.string().refine(isCurrency, 'Elegí la moneda.'),
  reference: z.string().trim().max(200, 'Máximo 200 caracteres.'),
  receiptPath: z.string().max(300).optional(),
});

export const PAYMENT_STATUS = {
  pending: { label: 'En revisión', variant: 'warning' },
  approved: { label: 'Aprobado', variant: 'success' },
  rejected: { label: 'Rechazado', variant: 'destructive' },
} as const;
