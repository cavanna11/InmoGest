'use client';

import { useActionState, useState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Field, Input, Select } from '@/components/ui/form-controls.tsx';
import { idle } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/browser.ts';
import { reportPaymentAction } from './actions.ts';
import { RECEIPT_MAX_BYTES, RECEIPT_TYPES } from './schemas.ts';

type Plan = { code: string; name: string };

// El comprobante se sube directo a Storage desde el navegador (bucket privado, RLS: el dueño).
export function PaymentForm({ organizationId, plans, currentPlan }: { organizationId: string; plans: Plan[]; currentPlan: string }) {
  const [state, action] = useActionState(reportPaymentAction, idle);
  const [receiptPath, setReceiptPath] = useState('');
  const [receiptError, setReceiptError] = useState('');
  const [uploading, setUploading] = useState(false);
  const e = state.fieldErrors ?? {};

  async function upload(file: File | undefined) {
    setReceiptPath('');
    setReceiptError('');
    if (!file) return;
    const extension = RECEIPT_TYPES[file.type];
    if (!extension || file.size > RECEIPT_MAX_BYTES) {
      setReceiptError('Usá una imagen o un PDF de hasta 5 MB.');
      return;
    }
    setUploading(true);
    const path = `${organizationId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await createClient().storage.from('payment-receipts').upload(path, file, { contentType: file.type });
    setUploading(false);
    if (error) setReceiptError('No pudimos subir el comprobante. Probá de nuevo o informá el pago sin él.');
    else setReceiptPath(path);
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="receiptPath" value={receiptPath} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="planCode" label="Plan" error={e.planCode}>
          <Select id="planCode" name="planCode" defaultValue={currentPlan}>
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="months" label="Meses que cubre" error={e.months}>
          <Input id="months" name="months" inputMode="numeric" defaultValue="1" />
        </Field>
        <Field id="amount" label="Monto transferido" error={e.amount}>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="39.000" />
        </Field>
        <Field id="currency" label="Moneda" error={e.currency}>
          <Select id="currency" name="currency" defaultValue="ARS">
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </Select>
        </Field>
      </div>
      <Field id="reference" label="Referencia (opcional)" hint="Número de operación o nombre del titular de la cuenta." error={e.reference}>
        <Input id="reference" name="reference" maxLength={200} aria-describedby="reference-hint" />
      </Field>
      <Field id="receipt" label="Comprobante (opcional)" error={receiptError || undefined}>
        <input
          id="receipt"
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(event) => void upload(event.currentTarget.files?.[0])}
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground"
        />
      </Field>
      <SubmitButton className="justify-self-start" disabled={uploading}>
        {uploading ? 'Subiendo comprobante…' : 'Informar pago'}
      </SubmitButton>
    </form>
  );
}
