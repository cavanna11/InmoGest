'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Button } from '@/components/ui/button.tsx';
import { describedBy, Field, Input, Label, Select } from '@/components/ui/form-controls.tsx';
import { idle, type FormState } from '@/lib/action.ts';
import { addActivityAction, addChannelAction, createContactAction, reportDuplicateAction, updateContactAction } from './actions.ts';
import { MAX_CHANNELS } from './schemas.ts';

type Member = { userId: string; name: string };

const textareaClasses =
  'flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm';

function Checkbox({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="size-4 accent-[var(--primary)]" />
      {label}
    </label>
  );
}

/** Aviso de duplicado con enlace al contacto existente (F-06: no se crea otro). */
function ExistingContact({ state }: { state: FormState }) {
  if (state.status !== 'error' || !state.data?.existingId) return <FormMessage state={state} />;
  return (
    <div role="alert" className="rounded-md border border-warning bg-background px-4 py-3 text-sm">
      {state.message}{' '}
      <Link href={`/panel/contactos/${state.data.existingId}`} className="font-medium text-primary underline underline-offset-4">
        Ver el contacto existente
      </Link>
    </div>
  );
}

/** Campos repetibles (teléfonos o emails) con botón para sumar otro. */
function RepeatedInputs({ name, label, type, placeholder, error }: { name: string; label: string; type: string; placeholder: string; error?: string | undefined }) {
  const [count, setCount] = useState(1);
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      {Array.from({ length: count }, (_, index) => (
        <Input
          key={index}
          name={name}
          type={type}
          placeholder={placeholder}
          aria-label={`${label} ${index + 1}`}
          aria-invalid={Boolean(error) || undefined}
          autoComplete="off"
        />
      ))}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {count < MAX_CHANNELS ? (
        <Button type="button" variant="ghost" size="sm" className="justify-self-start" onClick={() => setCount(count + 1)}>
          + Agregar otro
        </Button>
      ) : null}
    </fieldset>
  );
}

function AssigneeSelect({ members, defaultValue, disabled }: { members: Member[]; defaultValue: string; disabled?: boolean }) {
  return (
    <Field id="assignedUserId" label="Asignado a" hint={disabled ? 'Solo el dueño puede cambiar la asignación.' : undefined}>
      <Select
        id="assignedUserId"
        name="assignedUserId"
        defaultValue={defaultValue}
        disabled={disabled}
        aria-describedby={describedBy('assignedUserId', { hint: disabled })}
      >
        <option value="">Sin asignar</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </Select>
      {/* Un select deshabilitado no se envía: se manda el valor actual para no desasignar. */}
      {disabled ? <input type="hidden" name="assignedUserId" value={defaultValue} /> : null}
    </Field>
  );
}

export function NewContactForm({ members, currentUserId, canAssignOthers }: { members: Member[]; currentUserId: string; canAssignOthers: boolean }) {
  const [state, action] = useActionState(createContactAction, idle);
  const e = state.fieldErrors ?? {};
  // Sin capacidad de reasignar, un agente solo puede asignarse a sí mismo o dejarlo sin asignar.
  const assignable = canAssignOthers ? members : members.filter((member) => member.userId === currentUserId);
  return (
    <form action={action} className="grid gap-5" noValidate>
      <ExistingContact state={state} />
      <Field id="fullName" label="Nombre" error={e.fullName}>
        <Input id="fullName" name="fullName" required maxLength={120} aria-invalid={Boolean(e.fullName) || undefined} aria-describedby={describedBy('fullName', { error: e.fullName })} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <RepeatedInputs name="phone" label="Teléfonos" type="tel" placeholder="11 2345-6789" error={e.phones} />
        <RepeatedInputs name="email" label="Emails" type="email" placeholder="nombre@ejemplo.com" error={e.emails} />
      </div>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Tipo</legend>
        <div className="flex flex-wrap gap-4">
          <Checkbox name="isProspect" label="Interesado" defaultChecked />
          <Checkbox name="isOwner" label="Propietario" />
        </div>
        {e.isProspect ? (
          <p className="text-sm text-destructive" role="alert">
            {e.isProspect}
          </p>
        ) : null}
      </fieldset>
      <AssigneeSelect members={assignable} defaultValue={currentUserId} />
      <div className="grid gap-2">
        <Label htmlFor="notes">Notas</Label>
        <textarea id="notes" name="notes" maxLength={5000} className={textareaClasses} placeholder="Qué busca, cómo llegó, cualquier dato útil." />
      </div>
      <SubmitButton className="justify-self-start" pendingLabel="Guardando…">
        Crear contacto
      </SubmitButton>
    </form>
  );
}

export function ContactEditForm({
  contact,
  members,
  canReassign,
}: {
  contact: { id: string; full_name: string; notes: string; is_prospect: boolean; is_owner: boolean; do_not_contact: boolean; assigned_user_id: string | null };
  members: Member[];
  canReassign: boolean;
}) {
  const [state, action] = useActionState(updateContactAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="contactId" value={contact.id} />
      <Field id="fullName" label="Nombre" error={e.fullName}>
        <Input id="fullName" name="fullName" defaultValue={contact.full_name} required maxLength={120} aria-invalid={Boolean(e.fullName) || undefined} />
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Tipo</legend>
        <div className="flex flex-wrap gap-4">
          <Checkbox name="isProspect" label="Interesado" defaultChecked={contact.is_prospect} />
          <Checkbox name="isOwner" label="Propietario" defaultChecked={contact.is_owner} />
        </div>
        {e.isProspect ? (
          <p className="text-sm text-destructive" role="alert">
            {e.isProspect}
          </p>
        ) : null}
      </fieldset>
      <AssigneeSelect members={members} defaultValue={contact.assigned_user_id ?? ''} disabled={!canReassign} />
      <div className="grid gap-2">
        <Label htmlFor="notes">Notas</Label>
        <textarea id="notes" name="notes" defaultValue={contact.notes} maxLength={5000} className={textareaClasses} />
      </div>
      <div className="rounded-md border border-border bg-muted p-3">
        <Checkbox name="doNotContact" label='No contactar (baja): no recibe mensajes automáticos' defaultChecked={contact.do_not_contact} />
      </div>
      <SubmitButton className="justify-self-start">Guardar cambios</SubmitButton>
    </form>
  );
}

export function AddChannelForm({ contactId, kind }: { contactId: string; kind: 'phone' | 'email' }) {
  const [state, action] = useActionState(addChannelAction, idle);
  const error = state.fieldErrors?.value ?? (state.status === 'error' ? state.message : undefined);
  const id = `add-${kind}`;
  return (
    <form action={action} className="grid gap-2" noValidate>
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="kind" value={kind} />
      <label htmlFor={id} className="sr-only">
        {kind === 'phone' ? 'Nuevo teléfono' : 'Nuevo email'}
      </label>
      <div className="flex gap-2">
        <Input
          id={id}
          name="value"
          type={kind === 'phone' ? 'tel' : 'email'}
          placeholder={kind === 'phone' ? 'Agregar teléfono' : 'Agregar email'}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <SubmitButton variant="outline" pendingLabel="…">
          Agregar
        </SubmitButton>
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

export function ActivityForm({ contactId }: { contactId: string }) {
  const [state, action] = useActionState(addActivityAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-3" noValidate key={state.status === 'success' ? state.message : 'form'}>
      <FormMessage state={state} />
      <input type="hidden" name="contactId" value={contactId} />
      <label htmlFor="activity-body" className="sr-only">
        Nota
      </label>
      <textarea
        id="activity-body"
        name="body"
        maxLength={5000}
        className={textareaClasses}
        placeholder="Escribí una nota o lo que hablaron en la llamada…"
        aria-invalid={Boolean(e.body) || undefined}
      />
      {e.body ? (
        <p className="text-sm text-destructive" role="alert">
          {e.body}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Select name="kind" defaultValue="note" aria-label="Tipo" className="w-auto">
          <option value="note">Nota</option>
          <option value="call">Llamada</option>
        </Select>
        <SubmitButton size="sm">Agregar al historial</SubmitButton>
      </div>
    </form>
  );
}

export function ReportDuplicateForm({ contactId, candidates }: { contactId: string; candidates: Array<{ id: string; full_name: string }> }) {
  const [state, action] = useActionState(reportDuplicateAction, idle);
  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay otros contactos con un nombre parecido.</p>;
  }
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="contactId" value={contactId} />
      <Field id="otherId" label="Podría ser la misma persona que" error={state.fieldErrors?.otherId}>
        <Select id="otherId" name="otherId" defaultValue="">
          <option value="" disabled>
            Elegí un contacto
          </option>
          {candidates.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.full_name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="reason" label="Motivo (opcional)">
        <Input id="reason" name="reason" maxLength={500} placeholder="Ej.: mismo apellido y misma propiedad" />
      </Field>
      <SubmitButton variant="outline" size="sm" className="justify-self-start">
        Reportar posible duplicado
      </SubmitButton>
    </form>
  );
}
