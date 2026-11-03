'use client';

import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { describedBy, Field, Input } from '@/components/ui/form-controls.tsx';
import { idle } from '@/lib/action.ts';
import { updateProfileAction } from './actions.ts';

export function ProfileForm({ fullName, phone }: { fullName: string; phone: string }) {
  const [state, action] = useActionState(updateProfileAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field id="fullName" label="Nombre" error={e.fullName}>
        <Input id="fullName" name="fullName" defaultValue={fullName} autoComplete="name" required aria-invalid={e.fullName ? true : undefined} aria-describedby={describedBy('fullName', { error: e.fullName })} />
      </Field>
      <Field id="phone" label="Teléfono (opcional)" error={e.phone}>
        <Input id="phone" name="phone" type="tel" defaultValue={phone} autoComplete="tel" aria-invalid={e.phone ? true : undefined} aria-describedby={describedBy('phone', { error: e.phone })} />
      </Field>
      <div>
        <SubmitButton>Guardar</SubmitButton>
      </div>
    </form>
  );
}
