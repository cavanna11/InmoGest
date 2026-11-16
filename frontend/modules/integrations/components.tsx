'use client';

import { Check, Copy } from 'lucide-react';
import { useActionState, useState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Button } from '@/components/ui/button.tsx';
import { describedBy, Field, Input } from '@/components/ui/form-controls.tsx';
import { Alert } from '@/components/ui/surfaces.tsx';
import { idle } from '@/lib/action.ts';
import { createApiTokenAction, setListingLinkAction } from './actions.ts';
import { CHANNEL_LABELS, type ListingChannel } from './labels.ts';

/** Botón para copiar un texto al portapapeles. */
export function CopyButton({ value, label = 'Copiar' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="min-h-11 sm:min-h-9"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
      {copied ? 'Copiado' : label}
    </Button>
  );
}

/** Link de un canal cargado a mano: se guarda, se reemplaza o se quita dejándolo vacío. */
export function ListingLinkForm({
  propertyId,
  channel,
  url,
  placeholder,
}: {
  propertyId: string;
  channel: ListingChannel;
  url: string | null;
  placeholder: string;
}) {
  const [state, action] = useActionState(setListingLinkAction, idle);
  const id = `link-${channel}`;
  const error = state.fieldErrors?.url;
  return (
    <form action={action} className="grid gap-2" noValidate>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="channel" value={channel} />
      <Field id={id} label={`Link en ${CHANNEL_LABELS[channel]}`} error={error}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            id={id}
            name="url"
            type="url"
            inputMode="url"
            defaultValue={url ?? ''}
            placeholder={placeholder}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, { error })}
          />
          <SubmitButton variant="secondary" pendingLabel="Guardando…">
            Guardar
          </SubmitButton>
        </div>
      </Field>
      {state.status === 'success' ? <p className="text-xs text-muted-foreground" role="status">{state.message}</p> : null}
      {state.status === 'error' && !error ? <FormMessage state={state} /> : null}
    </form>
  );
}

/** Alta de un token de la API: se muestra una sola vez. */
export function ApiTokenForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(createApiTokenAction, idle);
  const token = state.status === 'success' ? state.data?.token : undefined;
  const error = state.fieldErrors?.name;
  return (
    <div className="grid gap-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end" noValidate>
        <Field id="token-name" label="Nombre del token" hint="Para reconocerlo, por ejemplo: Web de la inmobiliaria." error={error}>
          <Input
            id="token-name"
            name="name"
            maxLength={60}
            disabled={disabled}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy('token-name', { hint: true, error })}
          />
        </Field>
        <SubmitButton disabled={disabled} pendingLabel="Creando…">
          Crear token
        </SubmitButton>
      </form>
      {state.status === 'error' && !error ? <FormMessage state={state} /> : null}
      {token ? (
        <Alert variant="success" className="grid gap-2">
          <p className="font-medium">{state.message}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="new-token" className="sr-only">
              Token nuevo
            </label>
            <Input id="new-token" readOnly value={token} className="font-mono text-xs" onFocus={(event) => event.currentTarget.select()} />
            <CopyButton value={token} />
          </div>
        </Alert>
      ) : null}
    </div>
  );
}
