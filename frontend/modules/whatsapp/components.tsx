'use client';

import { formatDateTime } from '@inmogest/shared';
import { Paperclip } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useActionState, useEffect, useRef, useState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmSubmit } from '@/components/ui/confirm-dialog.tsx';
import { Select } from '@/components/ui/form-controls.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { idle, type FormState } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/browser.ts';
import {
  assignConversationAction,
  connectionQrAction,
  connectWhatsappAction,
  openConversationAction,
  removeConnectionAction,
  requestOfficialApiAction,
  sendAttachmentAction,
  sendMessageAction,
  sendPropertyAction,
  startConversationAction,
  type QrResult,
} from './actions.ts';
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_TYPES, MEDIA_BUCKET, MESSAGE_STATUS } from './labels.ts';
import type { InboxMessage } from './queries.ts';

type Member = { userId: string; name: string };

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

function MessageMedia({ message }: { message: InboxMessage }) {
  const href = message.mediaHref;
  if (!href) {
    if (message.media_status === 'pending') return <p className="text-sm italic opacity-80">Descargando adjunto…</p>;
    if (message.media_status === 'failed') return <p className="text-sm italic opacity-80">El adjunto no está disponible. Miralo en el teléfono.</p>;
    return null;
  }
  if (message.type === 'image') {
    return (
      <a href={href} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de corta duración, no optimizable */}
        <img src={href} alt={message.media_name ?? 'Foto recibida por WhatsApp'} className="max-h-72 rounded-md object-contain" loading="lazy" />
      </a>
    );
  }
  if (message.type === 'audio') return <audio controls preload="none" src={href} className="max-w-full" />;
  if (message.type === 'video') return <video controls preload="none" src={href} className="max-h-72 max-w-full rounded-md" />;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-4">
      {message.media_name ?? 'Abrir documento'}
    </a>
  );
}

export function MessageList({ messages, members }: { messages: InboxMessage[]; members: Member[] }) {
  const endRef = useRef<HTMLLIElement>(null);
  const lastId = messages.at(-1)?.id;
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [lastId]);

  return (
    <ul aria-label="Mensajes" className="grid max-h-[55dvh] min-h-48 content-start gap-2 overflow-y-auto px-4 py-2">
      {messages.length === 0 ? <li className="text-sm text-muted-foreground">Todavía no hay mensajes en esta conversación.</li> : null}
      {messages.map((message) => {
        const outbound = message.direction === 'outbound';
        const author = message.author_user_id
          ? (members.find((member) => member.userId === message.author_user_id)?.name ?? 'Ex integrante')
          : outbound
            ? 'Desde el teléfono'
            : null;
        return (
          <li key={message.id} className={`flex ${outbound ? 'justify-end' : 'justify-start'}`}>
            <div className={`grid max-w-[85%] min-w-0 gap-1 rounded-lg px-3 py-2 text-sm ${outbound ? 'bg-primary text-primary-foreground' : 'bg-muted'} ${message.status === 'failed' ? 'ring-2 ring-destructive' : ''}`}>
              <MessageMedia message={message} />
              {message.body ? <p className="break-words whitespace-pre-wrap">{message.body}</p> : null}
              <p className="flex flex-wrap items-center gap-x-2 text-xs opacity-80">
                {message.kind === 'automated' ? <Badge variant="highlight">Automático</Badge> : null}
                {author ? <span>{author}</span> : null}
                <time dateTime={message.sent_at ?? message.created_at}>{formatDateTime(message.sent_at ?? message.created_at)}</time>
                {outbound && message.status !== 'sent' ? <span>{MESSAGE_STATUS[message.status] ?? ''}</span> : null}
              </p>
            </div>
          </li>
        );
      })}
      <li ref={endRef} aria-hidden="true" />
    </ul>
  );
}

export function Composer({ organizationId, conversationId, disabled }: { organizationId: string; conversationId: string; disabled: boolean }) {
  const [state, action] = useActionState(sendMessageAction, idle);
  const [uploadState, setUploadState] = useState<FormState>(idle);
  const [uploading, setUploading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // Al enviar bien se limpia el texto; si falla, se conserva para no perderlo.
  useEffect(() => {
    if (state.status === 'success') formRef.current?.reset();
  }, [state]);

  async function attach(file: File | undefined) {
    if (!file) return;
    const attachment = ATTACHMENT_TYPES[file.type];
    if (!attachment || file.size > ATTACHMENT_MAX_BYTES) {
      setUploadState({ status: 'error', message: `"${file.name}": se pueden enviar fotos, audios, videos MP4, PDF, Word y Excel de hasta 16 MB.` });
      return;
    }
    setUploading(true);
    setUploadState(idle);
    const path = `${organizationId}/outbound/${crypto.randomUUID()}.${attachment.extension}`;
    const { error } = await createClient().storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setUploadState({ status: 'error', message: `No pudimos subir "${file.name}". Probá de nuevo.` });
    } else {
      const result = await sendAttachmentAction({ conversationId, path, mime: file.type, name: file.name, caption: bodyRef.current?.value ?? '' });
      setUploadState(result);
      if (result.status === 'success') formRef.current?.reset();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  if (disabled) {
    return <p className="border-t border-border p-4 text-sm text-muted-foreground">El número de esta conversación no está conectado: no se puede responder hasta reconectarlo.</p>;
  }

  return (
    <div className="grid gap-2 border-t border-border p-3">
      {state.status === 'error' ? <FormMessage state={state} /> : null}
      {uploadState.status === 'error' ? <FormMessage state={uploadState} /> : null}
      <form ref={formRef} action={action} className="flex items-end gap-2">
        <input type="hidden" name="conversationId" value={conversationId} />
        <label htmlFor="attachment" className="sr-only">
          Adjuntar archivo
        </label>
        <input ref={fileRef} id="attachment" type="file" className="hidden" accept={Object.keys(ATTACHMENT_TYPES).join(',')} disabled={uploading} onChange={(event) => attach(event.currentTarget.files?.[0])} />
        <Button type="button" variant="outline" size="sm" disabled={uploading} aria-label={uploading ? 'Subiendo archivo' : 'Adjuntar archivo'} onClick={() => fileRef.current?.click()}>
          <Paperclip className="size-4" aria-hidden="true" />
        </Button>
        <label htmlFor="body" className="sr-only">
          Mensaje
        </label>
        <textarea
          ref={bodyRef}
          id="body"
          name="body"
          rows={2}
          maxLength={4000}
          placeholder="Escribí un mensaje"
          className="flex min-h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
        />
        <SubmitButton size="sm" pendingLabel="Enviando…">
          Enviar
        </SubmitButton>
      </form>
    </div>
  );
}

export function AssignForm({ conversationId, assignedUserId, members }: { conversationId: string; assignedUserId: string | null; members: Member[] }) {
  const [state, action] = useActionState(assignConversationAction, idle);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="conversationId" value={conversationId} />
      <label htmlFor="userId" className="sr-only">
        Asignada a
      </label>
      <Select key={assignedUserId ?? 'none'} id="userId" name="userId" defaultValue={assignedUserId ?? ''} className="w-auto">
        <option value="">Sin asignar</option>
        {members.map((member) => (
          <option key={member.userId} value={member.userId}>
            {member.name}
          </option>
        ))}
      </Select>
      <SubmitButton size="sm" variant="outline" pendingLabel="Guardando…">
        Reasignar
      </SubmitButton>
      {state.status === 'error' ? <FormMessage state={state} /> : null}
    </form>
  );
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

export function StartConversationButton({ contactId }: { contactId: string }) {
  const [state, action] = useActionState(startConversationAction, idle);
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
