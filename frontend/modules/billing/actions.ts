'use server';

import { translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { done, fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { paymentSchema } from './schemas.ts';

/** El dueño informa una transferencia (CU-13). C&C la verifica y activa la suscripción. */
export async function reportPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const { active } = await resolveActiveOrganization();
  if (!active?.isOwner) return fail('Solo el dueño de la inmobiliaria puede informar pagos.');
  const parsed = paymentSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));
  const receipt = parsed.data.receiptPath;
  if (receipt && !receipt.startsWith(`${active.id}/`)) return fail('Comprobante no válido.');

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { error } = await supabase.from('payment_reports').insert({
    organization_id: active.id,
    plan_code: parsed.data.planCode,
    months: parsed.data.months,
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    reference: parsed.data.reference,
    receipt_path: receipt || null,
    reported_by: auth.user?.id ?? null,
  });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/panel/plan');
  return done('Recibimos tu informe. C&C lo revisa y activa la suscripción.');
}
