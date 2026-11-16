'use client';

import { formatDate, formatTime } from '@inmogest/shared';
import { ArrowDown, Building2, FileText, Loader2, Paperclip, SendHorizontal } from 'lucide-react';
import { useActionState, useEffect, useId, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Attachment, AttachmentContent, AttachmentDescription, AttachmentMedia, AttachmentTitle } from '@/components/ui/attachment.tsx';
import { Bubble, BubbleContent } from '@/components/ui/bubble.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog.tsx';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field.tsx';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupTextarea } from '@/components/ui/input-group.tsx';
import { Marker, MarkerContent } from '@/components/ui/marker.tsx';
import { Message, MessageContent, MessageFooter } from '@/components/ui/message.tsx';
import {
  MessageScroller,
  MessageScrollerButton,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerProvider,
  MessageScrollerViewport,
} from '@/components/ui/message-scroller.tsx';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { idle, type FormState } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/browser.ts';
import { assignConversationAction, sendAttachmentAction, sendMessageAction, sendPropertyAction } from './actions.ts';
import { ATTACHMENT_MAX_BYTES, ATTACHMENT_TYPES, MEDIA_BUCKET, MESSAGE_STATUS } from './labels.ts';
import type { InboxMessage } from './queries.ts';

type Member = { userId: string; name: string };

// Al abrir una conversación, el hilo arranca abajo (lo último) sin parpadeo: el script corre antes de
// pintar, con los mensajes que ya vienen en el HTML.
const scrollToEndScript = `(function(){var v=document.getElementById('mensajes');if(!v)return;v.scrollTop=v.scrollHeight;v.removeAttribute('data-pending-scroll');})()`;

function dayLabel(iso: string, today: string, yesterday: string): string {
  const day = formatDate(iso);
  return day === today ? 'Hoy' : day === yesterday ? 'Ayer' : day;
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
      <a href={href} target="_blank" rel="noreferrer" aria-label="Abrir la foto en otra pestaña">
        {/* eslint-disable-next-line @next/next/no-img-element -- URL firmada de corta duración, no optimizable */}
        <img src={href} alt={message.media_name ?? 'Foto recibida por WhatsApp'} className="max-h-72 rounded-md object-contain" loading="lazy" />
      </a>
    );
  }
  if (message.type === 'audio') return <audio controls preload="none" src={href} className="max-w-full" aria-label="Audio" />;
  if (message.type === 'video') return <video controls preload="none" src={href} className="max-h-72 max-w-full rounded-md" aria-label="Video" />;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="block">
      <Attachment state="done" size="sm">
        <AttachmentMedia variant="icon">
          <FileText aria-hidden="true" />
        </AttachmentMedia>
        <AttachmentContent>
          <AttachmentTitle>{message.media_name ?? 'Documento'}</AttachmentTitle>
          <AttachmentDescription>Tocá para abrirlo</AttachmentDescription>
        </AttachmentContent>
      </Attachment>
    </a>
  );
}

/** Hilo de la conversación: se abre en lo último y sigue los mensajes nuevos (shadcn MessageScroller). */
export function ConversationThread({ messages, members, today, yesterday }: { messages: InboxMessage[]; members: Member[]; today: string; yesterday: string }) {
  // Separador de día delante del primer mensaje de cada día.
  const days = messages.map((message) => dayLabel(message.sent_at ?? message.created_at, today, yesterday));
  return (
    <MessageScrollerProvider autoScroll defaultScrollPosition="end">
      <MessageScroller className="min-h-0 flex-1">
        <MessageScrollerViewport id="mensajes" suppressHydrationWarning role="log" aria-label="Mensajes" tabIndex={0} className="px-3 sm:px-4">
          <MessageScrollerContent className="gap-2 py-3">
            {messages.length === 0 ? (
              <MessageScrollerItem messageId="vacio">
                <Marker variant="separator">
                  <MarkerContent>Todavía no hay mensajes en esta conversación.</MarkerContent>
                </Marker>
              </MessageScrollerItem>
            ) : null}
            {messages.map((message, index) => {
              const at = message.sent_at ?? message.created_at;
              const day = days[index] ?? '';
              const newDay = index === 0 || day !== days[index - 1];
              const outbound = message.direction === 'outbound';
              const author = message.author_user_id
                ? (members.find((member) => member.userId === message.author_user_id)?.name ?? 'Ex integrante')
                : outbound
                  ? 'Desde el teléfono'
                  : null;
              const failed = message.status === 'failed';
              return (
                <MessageScrollerItem key={message.id} messageId={message.id} scrollAnchor={outbound}>
                  {newDay ? (
                    <Marker variant="separator" className="py-2 text-xs">
                      <MarkerContent>{day}</MarkerContent>
                    </Marker>
                  ) : null}
                  <Message align={outbound ? 'end' : 'start'}>
                    <MessageContent className="gap-1">
                      <Bubble variant={failed ? 'destructive' : outbound ? 'default' : 'muted'} align={outbound ? 'end' : 'start'}>
                        <BubbleContent>
                          <MessageMedia message={message} />
                          {message.body ? <p className="break-words whitespace-pre-wrap">{message.body}</p> : null}
                        </BubbleContent>
                      </Bubble>
                      <MessageFooter className="flex-wrap gap-x-2 font-normal">
                        {message.kind === 'automated' ? <Badge variant="highlight">Automático</Badge> : null}
                        {author ? <span>{author}</span> : null}
                        <time dateTime={at} className="tabular-nums">
                          {formatTime(at)}
                        </time>
                        {outbound && message.status !== 'sent' ? <span className={failed ? 'text-destructive' : undefined}>{MESSAGE_STATUS[message.status] ?? ''}</span> : null}
                      </MessageFooter>
                    </MessageContent>
                  </Message>
                </MessageScrollerItem>
              );
            })}
          </MessageScrollerContent>
        </MessageScrollerViewport>
        <script dangerouslySetInnerHTML={{ __html: scrollToEndScript }} />
        <MessageScrollerButton size="icon" className="size-9 rounded-full shadow-sm">
          <ArrowDown aria-hidden="true" />
          <span className="sr-only">Ir a lo último</span>
        </MessageScrollerButton>
      </MessageScroller>
    </MessageScrollerProvider>
  );
}

/** Cuadro para responder: Enter envía, Mayús+Enter baja de línea; el clip adjunta fotos o archivos. */
export function ReplyBox({ organizationId, conversationId, disabled }: { organizationId: string; conversationId: string; disabled: boolean }) {
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
      setUploadState({ status: 'error', message: `“${file.name}”: se pueden enviar fotos, audios, videos MP4, PDF, Word y Excel de hasta 16 MB.` });
      return;
    }
    setUploading(true);
    setUploadState(idle);
    const path = `${organizationId}/outbound/${crypto.randomUUID()}.${attachment.extension}`;
    const { error } = await createClient().storage.from(MEDIA_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (error) {
      setUploadState({ status: 'error', message: `No pudimos subir “${file.name}”. Revisá la conexión y probá de nuevo.` });
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
      <form ref={formRef} action={action}>
        <input type="hidden" name="conversationId" value={conversationId} />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          accept={Object.keys(ATTACHMENT_TYPES).join(',')}
          disabled={uploading}
          onChange={(event) => attach(event.currentTarget.files?.[0])}
        />
        <label htmlFor="body" className="sr-only">
          Mensaje
        </label>
        <InputGroup>
          <InputGroupTextarea
            ref={bodyRef}
            id="body"
            name="body"
            rows={2}
            maxLength={4000}
            placeholder="Escribí tu respuesta…"
            aria-describedby="body-hint"
            className="max-h-40 min-h-12"
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                formRef.current?.requestSubmit();
              }
            }}
          />
          <InputGroupAddon align="block-end" className="justify-between">
            <InputGroupButton
              size="sm"
              variant="ghost"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              aria-label={uploading ? 'Subiendo archivo' : 'Adjuntar foto o archivo'}
            >
              {uploading ? <Loader2 aria-hidden="true" className="animate-spin" /> : <Paperclip aria-hidden="true" />}
              <span className="hidden sm:inline">{uploading ? 'Subiendo…' : 'Adjuntar'}</span>
            </InputGroupButton>
            <SubmitButton size="sm" pendingLabel="Enviando…" className="h-8">
              <SendHorizontal aria-hidden="true" />
              Enviar
            </SubmitButton>
          </InputGroupAddon>
        </InputGroup>
        <p id="body-hint" className="mt-1 hidden text-xs text-muted-foreground sm:block">
          Enter envía · Mayús + Enter para otra línea
        </p>
      </form>
    </div>
  );
}

/** A quién está asignada: se guarda al elegir, sin botón aparte. */
export function AssignSelect({ conversationId, assignedUserId, members }: { conversationId: string; assignedUserId: string | null; members: Member[] }) {
  const [value, setValue] = useState(assignedUserId ?? 'none');
  const [pending, startTransition] = useTransition();
  function change(next: string) {
    const previous = value;
    setValue(next);
    startTransition(async () => {
      const data = new FormData();
      data.set('conversationId', conversationId);
      data.set('userId', next === 'none' ? '' : next);
      const result = await assignConversationAction(idle, data);
      if (result.status === 'error') {
        setValue(previous);
        toast.error(result.message ?? 'No se pudo reasignar.');
      } else {
        toast.success(next === 'none' ? 'Conversación sin asignar.' : `Asignada a ${members.find((member) => member.userId === next)?.name ?? 'otra persona'}.`);
      }
    });
  }
  return (
    <Select value={value} onValueChange={change} disabled={pending}>
      <SelectTrigger size="sm" className="w-44" aria-label="Asignada a">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
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
  );
}

/** Mandar la ficha de una propiedad a este contacto sin salir de la conversación. */
export function SendPropertyPicker({ contactId, properties }: { contactId: string; properties: Array<{ id: string; code: string | null; title: string }> }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(sendPropertyAction, idle);
  const [propertyId, setPropertyId] = useState('');
  const [error, setError] = useState('');
  // El panel del contacto puede estar dos veces en la página (al costado y en el panel deslizable).
  const fieldId = useId();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="w-full justify-start">
          <Building2 aria-hidden="true" />
          Enviar una propiedad
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar una propiedad</DialogTitle>
          <DialogDescription>Sale por WhatsApp con hasta 3 fotos y el link a su página.</DialogDescription>
        </DialogHeader>
        {properties.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay propiedades disponibles o reservadas para enviar.</p>
        ) : (
          <form
            action={action}
            noValidate
            className="grid gap-4"
            onSubmit={(event) => {
              if (!propertyId) {
                event.preventDefault();
                setError('Elegí qué propiedad mandarle.');
              }
            }}
          >
            {state.status === 'error' ? <FormMessage state={state} /> : null}
            <input type="hidden" name="contactId" value={contactId} />
            <input type="hidden" name="propertyId" value={propertyId} />
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor={fieldId}>Propiedad</FieldLabel>
              <Select
                value={propertyId}
                onValueChange={(value) => {
                  setPropertyId(value);
                  setError('');
                }}
              >
                <SelectTrigger id={fieldId} className="w-full" aria-invalid={error ? true : undefined} aria-describedby={error ? `${fieldId}-error` : `${fieldId}-hint`}>
                  <SelectValue placeholder="Elegí una propiedad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.code ? `${property.code} · ` : ''}
                        {property.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {error ? <FieldError id={`${fieldId}-error`}>{error}</FieldError> : <FieldDescription id={`${fieldId}-hint`}>Solo las disponibles o reservadas.</FieldDescription>}
            </Field>
            <SubmitButton pendingLabel="Enviando…" className="justify-self-end">
              Enviar por WhatsApp
            </SubmitButton>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
