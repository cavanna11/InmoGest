'use client';

import { formatPhone } from '@inmogest/shared';
import { Mail, Phone, Plus, X } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import { useFieldValidation } from '@/hooks/use-field-validation.ts';
import { formValues, idle, type FormState } from '@/lib/action.ts';
import { addActivityAction, addChannelAction, createContactAction, removeChannelAction, reportDuplicateAction, updateContactAction } from './actions.ts';
import { activitySchema, contactUpdateSchema, MAX_CHANNELS, newContactSchema, repeated } from './schemas.ts';

type Member = { userId: string; name: string };

// Los datos son de otra persona (el cliente): el navegador no tiene que autocompletarlos con los propios.
const NO_AUTOFILL = 'off';

// "Interesado" y "Propietario" se validan juntos (al menos uno): el error se muestra en el grupo.
const KIND_ALIASES = { isOwner: 'isProspect' };

function parseNew(data: FormData) {
  return newContactSchema.safeParse({ ...formValues(data), phones: repeated(data, 'phone'), emails: repeated(data, 'email') });
}

function parseUpdate(data: FormData) {
  return contactUpdateSchema.safeParse(formValues(data));
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

function FormField({ id, label, hint, error, children }: { id: string; label: string; hint?: string | undefined; error?: string | undefined; children: ReactNode }) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint ? <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription> : null}
    </Field>
  );
}

/** Campos repetibles (teléfonos o emails) con botón para sumar otro. */
function RepeatedInputs({
  name,
  label,
  type,
  placeholder,
  hint,
  error,
}: {
  name: 'phone' | 'email';
  label: string;
  type: string;
  placeholder: string;
  hint: string;
  error?: string | undefined;
}) {
  const [count, setCount] = useState(1);
  const describedBy = error ? `${name}-error` : `${name}-hint`;
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{label}</FieldLegend>
      <div className="grid gap-2">
        {Array.from({ length: count }, (_, index) => (
          <Input
            key={index}
            id={index === 0 ? name : undefined}
            name={name}
            type={type}
            inputMode={type === 'tel' ? 'tel' : 'email'}
            placeholder={placeholder}
            aria-label={`${label} ${index + 1}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            autoComplete={NO_AUTOFILL}
          />
        ))}
      </div>
      {error ? <FieldError id={`${name}-error`}>{error}</FieldError> : <FieldDescription id={`${name}-hint`}>{hint}</FieldDescription>}
      {count < MAX_CHANNELS ? (
        <Button type="button" variant="ghost" size="sm" className="w-auto self-start" onClick={() => setCount(count + 1)}>
          <Plus aria-hidden="true" />
          Agregar otro
        </Button>
      ) : null}
    </FieldSet>
  );
}

function KindFields({ prospect, owner, error }: { prospect: boolean; owner: boolean; error?: string | undefined }) {
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">Es…</FieldLegend>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <Field orientation="horizontal" className="w-auto">
          <Checkbox id="isProspect" name="isProspect" defaultChecked={prospect} aria-invalid={error ? true : undefined} />
          <FieldLabel htmlFor="isProspect" className="font-normal">
            Interesado (busca comprar o alquilar)
          </FieldLabel>
        </Field>
        <Field orientation="horizontal" className="w-auto">
          <Checkbox id="isOwner" name="isOwner" defaultChecked={owner} aria-invalid={error ? true : undefined} />
          <FieldLabel htmlFor="isOwner" className="font-normal">
            Propietario (ofrece una propiedad)
          </FieldLabel>
        </Field>
      </div>
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  );
}

/** El selector no admite un valor vacío: "Sin asignar" viaja como "" en un campo oculto. */
function AssigneeField({ members, defaultValue, disabled }: { members: Member[]; defaultValue: string; disabled?: boolean }) {
  const [value, setValue] = useState(defaultValue || 'none');
  const hint = disabled ? 'Solo el dueño puede cambiar la asignación.' : undefined;
  return (
    <FormField id="assignedUser" label="A cargo de" hint={hint}>
      <input type="hidden" name="assignedUserId" value={value === 'none' ? '' : value} />
      <Select value={value} onValueChange={setValue} disabled={disabled}>
        <SelectTrigger id="assignedUser" className="w-full sm:max-w-xs" aria-describedby={hint ? 'assignedUser-hint' : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="none">Sin asignar</SelectItem>
            {members.map((member) => (
              <SelectItem key={member.userId} value={member.userId}>
                {member.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormField>
  );
}

export function NewContactForm({ members, currentUserId, canAssignOthers }: { members: Member[]; currentUserId: string; canAssignOthers: boolean }) {
  const [state, action] = useActionState(createContactAction, idle);
  const { formRef, onChange, onBlur, onSubmitCapture, error: e } = useFieldValidation(parseNew, state.fieldErrors, {
    aliases: { phone: 'phones', email: 'emails', ...KIND_ALIASES },
    warnUnsaved: true,
  });
  // Sin capacidad de reasignar, un agente solo puede asignarse a sí mismo o dejarlo sin asignar.
  const assignable = canAssignOthers ? members : members.filter((member) => member.userId === currentUserId);
  return (
    <form ref={formRef} action={action} onChange={onChange} onBlur={onBlur} onSubmitCapture={onSubmitCapture} className="grid gap-6" noValidate>
      <ExistingContact state={state} />
      <FieldGroup>
        <FormField id="fullName" label="Nombre" error={e('fullName')}>
          <Input id="fullName" name="fullName" required maxLength={120} autoComplete={NO_AUTOFILL} placeholder="Laura Gómez" aria-invalid={e('fullName') ? true : undefined} aria-describedby={e('fullName') ? 'fullName-error' : undefined} />
        </FormField>
        <div className="grid gap-6 sm:grid-cols-2">
          <RepeatedInputs name="phone" label="Teléfonos" type="tel" placeholder="11 2345-6789" hint="Con característica, sin 0 ni 15." error={e('phones')} />
          <RepeatedInputs name="email" label="Emails" type="email" placeholder="nombre@ejemplo.com" hint="Opcional." error={e('emails')} />
        </div>
        <KindFields prospect owner={false} error={e('isProspect')} />
        <AssigneeField members={assignable} defaultValue={currentUserId} />
        <FormField id="notes" label="Notas (opcional)" error={e('notes')}>
          <Textarea id="notes" name="notes" maxLength={5000} className="min-h-24" placeholder="Qué busca, cómo llegó, cualquier dato útil." />
        </FormField>
      </FieldGroup>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Guardando…">Crear contacto</SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/panel/contactos">Cancelar</Link>
        </Button>
      </div>
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
  const { formRef, onChange, onBlur, onSubmitCapture, error: e } = useFieldValidation(parseUpdate, state.fieldErrors, { aliases: KIND_ALIASES, warnUnsaved: true });
  useEffect(() => {
    if (state.status === 'success' && state.message) toast.success(state.message);
  }, [state]);
  return (
    <form ref={formRef} action={action} onChange={onChange} onBlur={onBlur} onSubmitCapture={onSubmitCapture} className="grid gap-6" noValidate>
      {state.status === 'error' ? <FormMessage state={state} /> : null}
      <input type="hidden" name="contactId" value={contact.id} />
      <FieldGroup>
        <FormField id="fullName" label="Nombre" error={e('fullName')}>
          <Input id="fullName" name="fullName" defaultValue={contact.full_name} required maxLength={120} autoComplete={NO_AUTOFILL} aria-invalid={e('fullName') ? true : undefined} aria-describedby={e('fullName') ? 'fullName-error' : undefined} />
        </FormField>
        <KindFields prospect={contact.is_prospect} owner={contact.is_owner} error={e('isProspect')} />
        <AssigneeField members={members} defaultValue={contact.assigned_user_id ?? ''} disabled={!canReassign} />
        <FormField id="notes" label="Notas" error={e('notes')}>
          <Textarea id="notes" name="notes" defaultValue={contact.notes} maxLength={5000} className="min-h-24" />
        </FormField>
        <Field orientation="horizontal" className="rounded-md border border-border bg-muted p-3">
          <Checkbox id="doNotContact" name="doNotContact" defaultChecked={contact.do_not_contact} />
          <FieldLabel htmlFor="doNotContact" className="font-normal">
            No contactar (pidió la baja): no recibe mensajes automáticos ni se ofrece escribirle
          </FieldLabel>
        </Field>
      </FieldGroup>
      <SubmitButton className="justify-self-start" pendingLabel="Guardando…">
        Guardar cambios
      </SubmitButton>
    </form>
  );
}

const UNDO_MS = 6000;

/**
 * Teléfonos o emails de la ficha. Los teléfonos se tocan para llamar. Quitar uno no pide confirmación:
 * desaparece y durante unos segundos se puede deshacer; recién después se quita de verdad.
 */
export function ChannelList({
  contactId,
  kind,
  items,
  canWrite,
}: {
  contactId: string;
  kind: 'phone' | 'email';
  items: Array<{ id: string; value: string }>;
  canWrite: boolean;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  function commit(channelId: string) {
    const data = new FormData();
    data.set('channelId', channelId);
    data.set('contactId', contactId);
    data.set('kind', kind);
    return removeChannelAction(data);
  }

  // Al salir de la página se confirman los que quedaron pendientes.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const [channelId, timer] of pending) {
        clearTimeout(timer);
        void commit(channelId);
      }
      pending.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al desmontar
  }, []);

  function remove(item: { id: string; value: string }, label: string) {
    setHidden((current) => new Set(current).add(item.id));
    timers.current.set(
      item.id,
      setTimeout(() => {
        timers.current.delete(item.id);
        startTransition(() => commit(item.id));
      }, UNDO_MS),
    );
    toast(`${label} quitado.`, {
      duration: UNDO_MS,
      action: {
        label: 'Deshacer',
        onClick: () => {
          clearTimeout(timers.current.get(item.id));
          timers.current.delete(item.id);
          setHidden((current) => {
            const next = new Set(current);
            next.delete(item.id);
            return next;
          });
        },
      },
    });
  }

  const visible = items.filter((item) => !hidden.has(item.id));
  if (visible.length === 0) return <p className="text-sm text-muted-foreground">{kind === 'phone' ? 'Sin teléfonos.' : 'Sin emails.'}</p>;
  return (
    <ul className="grid gap-2">
      {visible.map((item) => {
        const label = kind === 'phone' ? formatPhone(item.value) : item.value;
        return (
          <li key={item.id} className="flex items-center gap-1 rounded-md bg-muted pr-1 text-sm">
            <a
              href={kind === 'phone' ? `tel:${item.value}` : `mailto:${item.value}`}
              className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-md px-3 hover:text-primary"
            >
              {kind === 'phone' ? <Phone aria-hidden="true" className="size-4 shrink-0 text-primary" /> : <Mail aria-hidden="true" className="size-4 shrink-0 text-primary" />}
              <span className="truncate tabular-nums">{label}</span>
              <span className="sr-only">{kind === 'phone' ? '(llamar)' : '(escribir un email)'}</span>
            </a>
            {canWrite ? (
              <Button type="button" variant="ghost" size="icon" className="size-10 sm:size-8" aria-label={`Quitar ${label}`} onClick={() => remove(item, kind === 'phone' ? 'Teléfono' : 'Email')}>
                <X aria-hidden="true" />
              </Button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

export function AddChannelForm({ contactId, kind }: { contactId: string; kind: 'phone' | 'email' }) {
  const [state, action] = useActionState(addChannelAction, idle);
  const error = state.fieldErrors?.value ?? (state.status === 'error' ? state.message : undefined);
  const id = `add-${kind}`;
  return (
    <form action={action} className="grid gap-2" noValidate key={state.status === 'success' ? state.message : 'form'}>
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
          inputMode={kind === 'phone' ? 'tel' : 'email'}
          autoComplete={NO_AUTOFILL}
          placeholder={kind === 'phone' ? '11 2345-6789' : 'nombre@ejemplo.com'}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <SubmitButton variant="outline" pendingLabel="Agregando…">
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

function parseActivity(data: FormData) {
  return activitySchema.safeParse(formValues(data));
}

/** Anotar en el historial: una nota o lo que se habló en una llamada. */
export function ActivityForm({ contactId }: { contactId: string }) {
  const [state, action] = useActionState(addActivityAction, idle);
  const [kind, setKind] = useState<'note' | 'call'>('note');
  const { formRef, onBlur, onSubmitCapture, error: e } = useFieldValidation(parseActivity, state.fieldErrors);
  useEffect(() => {
    if (state.status === 'success' && state.message) {
      toast.success(state.message);
      formRef.current?.reset();
    }
  }, [state, formRef]);
  return (
    <form ref={formRef} action={action} onBlur={onBlur} onSubmitCapture={onSubmitCapture} className="grid gap-3" noValidate>
      {state.status === 'error' && !state.fieldErrors ? <FormMessage state={state} /> : null}
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="kind" value={kind} />
      <ToggleGroup type="single" variant="outline" size="sm" value={kind} onValueChange={(value) => value && setKind(value as 'note' | 'call')} aria-label="Qué querés anotar">
        <ToggleGroupItem value="note" className="px-3">
          Nota
        </ToggleGroupItem>
        <ToggleGroupItem value="call" className="px-3">
          <Phone aria-hidden="true" />
          Llamada
        </ToggleGroupItem>
      </ToggleGroup>
      <Field data-invalid={e('body') ? true : undefined}>
        <FieldLabel htmlFor="activity-body" className="sr-only">
          {kind === 'call' ? 'Qué hablaron' : 'Nota'}
        </FieldLabel>
        <Textarea
          id="activity-body"
          name="body"
          maxLength={5000}
          className="min-h-20"
          placeholder={kind === 'call' ? 'Qué hablaron: “Quiere ver casas en Ramos, hasta USD 120.000”.' : 'Escribí una nota…'}
          aria-invalid={e('body') ? true : undefined}
          aria-describedby={e('body') ? 'activity-body-error' : undefined}
        />
        {e('body') ? <FieldError id="activity-body-error">{e('body')}</FieldError> : null}
      </Field>
      <SubmitButton size="sm" className="justify-self-start" pendingLabel="Guardando…">
        Agregar al historial
      </SubmitButton>
    </form>
  );
}

export function ReportDuplicateForm({ contactId, candidates }: { contactId: string; candidates: Array<{ id: string; full_name: string }> }) {
  const [state, action] = useActionState(reportDuplicateAction, idle);
  const [otherId, setOtherId] = useState('');
  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay otros contactos con un nombre parecido.</p>;
  }
  const error = state.fieldErrors?.otherId;
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="otherId" value={otherId} />
      <FormField id="otherId" label="Podría ser la misma persona que" error={error}>
        <Select value={otherId} onValueChange={setOtherId}>
          <SelectTrigger id="otherId" className="w-full" aria-invalid={error ? true : undefined}>
            <SelectValue placeholder="Elegí un contacto" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {candidates.map((candidate) => (
                <SelectItem key={candidate.id} value={candidate.id}>
                  {candidate.full_name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </FormField>
      <FormField id="reason" label="Motivo (opcional)">
        <Input id="reason" name="reason" maxLength={500} placeholder="Mismo apellido y misma propiedad" autoComplete="off" />
      </FormField>
      <SubmitButton variant="outline" size="sm" className="justify-self-start">
        Reportar posible duplicado
      </SubmitButton>
    </form>
  );
}
