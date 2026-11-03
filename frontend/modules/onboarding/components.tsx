'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { describedBy, Field, Input } from '@/components/ui/form-controls.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { idle } from '@/lib/action.ts';
import type { LegalDocumentSummary } from '../auth/queries.ts';
import { acceptInvitationAction, createOrganizationAction } from './actions.ts';

export function CreateOrganizationForm({
  defaultName,
  legal,
  alreadyAccepted,
}: {
  defaultName: string;
  legal: LegalDocumentSummary[];
  /** Aceptó estas mismas versiones al registrarse: no se le vuelve a pedir. */
  alreadyAccepted: boolean;
}) {
  const [state, action] = useActionState(createOrganizationAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <Field id="name" label="Nombre de la inmobiliaria" error={e.name}>
        <Input
          id="name"
          name="name"
          defaultValue={defaultName}
          autoComplete="organization"
          required
          aria-invalid={e.name ? true : undefined}
          aria-describedby={describedBy('name', { error: e.name })}
        />
      </Field>
      {alreadyAccepted ? (
        <input type="hidden" name="acceptLegal" value="on" />
      ) : (
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="acceptLegal" className="mt-0.5 size-4 accent-primary" />
        <span>
          Acepto los{' '}
          <Link href="/legal/terminos" target="_blank" className="underline underline-offset-4">
            términos y condiciones
          </Link>{' '}
          y la{' '}
          <Link href="/legal/privacidad" target="_blank" className="underline underline-offset-4">
            política de privacidad
          </Link>
          {legal.some((doc) => doc.isDraft) ? (
            <>
              {' '}
              <Badge variant="warning">No válido — solo desarrollo</Badge>
            </>
          ) : null}
          .
        </span>
      </label>
      )}
      {e.acceptLegal ? (
        <p className="text-sm text-destructive" role="alert">
          {e.acceptLegal}
        </p>
      ) : null}
      <SubmitButton pendingLabel="Creando…">Crear mi inmobiliaria</SubmitButton>
    </form>
  );
}

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(acceptInvitationAction, idle);
  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton pendingLabel="Sumándote…">Aceptar invitación</SubmitButton>
    </form>
  );
}
