'use client';

import { useActionState, useState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Field, Input, Select } from '@/components/ui/form-controls.tsx';
import { idle, type FormState } from '@/lib/action.ts';
import { addTeamMemberAction, createOrganizationAction, deleteForeverAction, ownerAccessLinkAction } from './create-actions.ts';

/** Enlace de acceso para copiar y mandar por WhatsApp. Es una credencial temporal: se muestra una vez. */
function AccessLink({ state }: { state: FormState }) {
  const [copied, setCopied] = useState(false);
  const link = state.data?.link;
  if (!link) return null;
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="access-link" className="sr-only">
        Enlace de acceso
      </label>
      <Input id="access-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
        }}
      >
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  );
}

export function NewOrganizationForm({ plans }: { plans: Array<{ code: string; name: string }> }) {
  const [state, action] = useActionState(createOrganizationAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <AccessLink state={state} />
      {state.data?.organizationId ? (
        <a href={`/plataforma/${state.data.organizationId}`} className="text-sm font-medium text-primary underline underline-offset-4">
          Abrir la ficha de la inmobiliaria
        </a>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="name" label="Nombre de la inmobiliaria" error={e.name}>
          <Input id="name" name="name" maxLength={120} />
        </Field>
        <Field id="ownerName" label="Nombre del dueño" error={e.ownerName}>
          <Input id="ownerName" name="ownerName" maxLength={120} />
        </Field>
        <Field id="ownerEmail" label="Email del dueño" error={e.ownerEmail}>
          <Input id="ownerEmail" name="ownerEmail" type="email" />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field id="planCode" label="Plan" error={e.planCode}>
            <Select id="planCode" name="planCode" defaultValue="professional">
              {plans.map((plan) => (
                <option key={plan.code} value={plan.code}>
                  {plan.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="trialDays" label="Días de prueba" error={e.trialDays}>
            <Input id="trialDays" name="trialDays" inputMode="numeric" defaultValue="14" />
          </Field>
        </div>
      </div>
      <SubmitButton className="justify-self-start" pendingLabel="Creando…">
        Crear inmobiliaria
      </SubmitButton>
    </form>
  );
}

export function OwnerLinkForm({ organizationId }: { organizationId: string }) {
  const [state, action] = useActionState(ownerAccessLinkAction, idle);
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <AccessLink state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <SubmitButton variant="outline" className="justify-self-start" pendingLabel="Generando…">
        Generar enlace de acceso
      </SubmitButton>
    </form>
  );
}

export function DeleteForeverForm({ organizationId, name }: { organizationId: string; name: string }) {
  const [state, action] = useActionState(deleteForeverAction, idle);
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="organizationId" value={organizationId} />
      <Field id="confirmName" label={`Para confirmar, escribí: ${name}`} error={state.fieldErrors?.confirmName}>
        <Input id="confirmName" name="confirmName" autoComplete="off" />
      </Field>
      <SubmitButton variant="destructive" className="justify-self-start" pendingLabel="Eliminando…">
        Eliminar para siempre
      </SubmitButton>
    </form>
  );
}

export function AddTeamMemberForm() {
  const [state, action] = useActionState(addTeamMemberAction, idle);
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <AccessLink state={state} />
      <Field id="email" label="Email" error={state.fieldErrors?.email}>
        <Input id="email" name="email" type="email" />
      </Field>
      <SubmitButton variant="outline" className="justify-self-start">
        Sumar al equipo
      </SubmitButton>
    </form>
  );
}
