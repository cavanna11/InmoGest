'use client';

import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { ConfirmSubmit } from '@/components/ui/confirm-dialog.tsx';
import { Select } from '@/components/ui/form-controls.tsx';
import { idle } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/browser.ts';
import {
  connectionQrAction,
  connectWhatsappAction,
  openConversationAction,
  removeConnectionAction,
  requestOfficialApiAction,
  sendPropertyAction,
  startConversationAction,
  type QrResult,
} from './actions.ts';

const FALLBACK_REFRESH_MS = 20_000;
const REFRESH_DEBOUNCE_MS = 300;
const STATE_POLL_MS = 5_000;

/** Refresca la bandeja cuando cambia algo (Realtime, filtrado por RLS), con un refresco lento de respaldo. */
export function InboxLive({ organizationId }: { organizationId: string }) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), REFRESH_DEBOUNCE_MS);
    };
    const supabase = createClient();
    const filter = `organization_id=eq.${organizationId}`;
    const channel = supabase
      .channel(`inbox:${organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter }, refresh)
      .subscribe();
    const fallback = setInterval(refresh, FALLBACK_REFRESH_MS);
    return () => {
      clearTimeout(timer);
      clearInterval(fallback);
      void supabase.removeChannel(channel);
    };
  }, [organizationId, router]);
  return null;
}

/** Marca como leída al abrir y con cada mensaje nuevo mientras está abierta. */
export function OpenConversation({ conversationId, lastMessageId }: { conversationId: string; lastMessageId: string }) {
  useEffect(() => {
    void openConversationAction(conversationId);
  }, [conversationId, lastMessageId]);
  return null;
}

export function ConnectForm() {
  const [state, action] = useActionState(connectWhatsappAction, idle);
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <label className="flex items-start gap-2">
        <input type="checkbox" name="guidelines" className="mt-1 size-4" />
        <span>Leí las pautas y entiendo que la conexión por QR no es oficial y que el número puede ser restringido.</span>
      </label>
      {state.fieldErrors?.guidelines ? <p className="text-destructive">{state.fieldErrors.guidelines}</p> : null}
      <SubmitButton className="justify-self-start" pendingLabel="Conectando…">
        Aceptar y conectar
      </SubmitButton>
    </form>
  );
}

/** Muestra el QR y se actualiza sola hasta que el número queda conectado. */
export function ConnectionQr({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [result, setResult] = useState<QrResult | null>(null);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function check() {
      const next = await connectionQrAction(connectionId).catch(() => null);
      if (!active) return;
      if (next) setResult(next);
      if (next?.status === 'connected') {
        router.refresh();
        return;
      }
      timer = setTimeout(check, STATE_POLL_MS);
    }
    void check();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [connectionId, router]);

  if (!result) return <p className="text-sm text-muted-foreground">Buscando el código…</p>;
  if (result.error) return <p className="text-sm text-destructive">{result.error}</p>;
  if (result.status === 'connected') return <p className="text-sm font-medium">¡Conectado!</p>;
  return (
    <div className="grid justify-items-start gap-2">
      {result.qr ? (
        // eslint-disable-next-line @next/next/no-img-element -- imagen en base64 que se renueva sola
        <img src={result.qr} alt="Código QR para vincular el número de WhatsApp" className="size-64 rounded-md bg-white p-2" />
      ) : (
        <p className="text-sm text-muted-foreground">Generando el código…</p>
      )}
      {result.pairingCode ? <p className="text-sm">Código de vinculación: <strong>{result.pairingCode}</strong></p> : null}
    </div>
  );
}

export function RemoveConnectionButton({ connectionId }: { connectionId: string }) {
  const formId = `remove-connection-${connectionId}`;
  return (
    <form id={formId} action={removeConnectionAction}>
      <input type="hidden" name="connectionId" value={connectionId} />
      <ConfirmSubmit
        formId={formId}
        title="Quitar este número"
        description="Se cierra la sesión de WhatsApp en el panel. Las conversaciones y los mensajes se conservan."
        confirmLabel="Quitar número"
        trigger="Quitar número"
        triggerVariant="ghost"
        destructive
      />
    </form>
  );
}

export function OfficialApiForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(requestOfficialApiAction, idle);
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <label htmlFor="notes" className="text-sm font-medium">
        Comentario (opcional)
      </label>
      <textarea
        id="notes"
        name="notes"
        maxLength={1000}
        disabled={disabled}
        className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
      />
      <SubmitButton variant="outline" className="justify-self-start" disabled={disabled} pendingLabel="Enviando…">
        Solicitar API oficial
      </SubmitButton>
    </form>
  );
}

export function StartConversationButton({ contactId, contactName }: { contactId: string; contactName?: string }) {
  const [state, action] = useActionState(startConversationAction, idle);
  // Con nombre: versión compacta para listas (ícono con nombre accesible); el error se muestra igual.
  if (contactName) {
    return (
      <form action={action} className="grid justify-items-end gap-1">
        <input type="hidden" name="contactId" value={contactId} />
        <SubmitButton size="icon" variant="outline" pendingLabel="…" className="size-10 sm:size-9" aria-label={`Escribir por WhatsApp a ${contactName}`} title="Escribir por WhatsApp">
          <MessageCircle aria-hidden="true" />
        </SubmitButton>
        {state.status === 'error' ? (
          <p role="alert" className="max-w-48 text-right text-xs text-destructive">
            {state.message}
          </p>
        ) : null}
      </form>
    );
  }
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      <SubmitButton size="sm" variant="outline" pendingLabel="Abriendo…">
        Escribir por WhatsApp
      </SubmitButton>
      {state.status === 'error' ? <FormMessage state={state} /> : null}
    </form>
  );
}

export function SendPropertyForm({ propertyId, contacts }: { propertyId: string; contacts: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState(sendPropertyAction, idle);
  if (contacts.length === 0) return <p className="text-sm text-muted-foreground">No hay contactos con teléfono de WhatsApp a quienes enviarla.</p>;
  return (
    <form action={action} className="grid gap-2">
      <FormMessage state={state} />
      <input type="hidden" name="propertyId" value={propertyId} />
      <label htmlFor="contactId" className="text-sm font-medium">
        Enviar a
      </label>
      <Select id="contactId" name="contactId" defaultValue="" required>
        <option value="" disabled>
          Elegí un contacto
        </option>
        {contacts.map((contact) => (
          <option key={contact.id} value={contact.id}>
            {contact.name}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" className="justify-self-start" pendingLabel="Enviando…">
        Enviar ficha
      </SubmitButton>
    </form>
  );
}
