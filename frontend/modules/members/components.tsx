'use client';

import { useActionState, useState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmSubmit } from '@/components/ui/confirm-dialog.tsx';
import { describedBy, Field, Input, Select } from '@/components/ui/form-controls.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { idle, type FormState } from '@/lib/action.ts';
import { changeMemberAction, inviteMemberAction, regenerateInvitationAction, revokeInvitationAction } from './actions.ts';

/** Enlace de invitación para copiar. Es una credencial temporal: se muestra una sola vez. */
function CopyableLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-2">
      <label htmlFor="invitation-link" className="text-sm font-medium">
        Enlace de invitación (vence en 7 días)
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input id="invitation-link" readOnly value={link} onFocus={(event) => event.currentTarget.select()} />
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
      <p className="text-xs text-muted-foreground">Compartilo solo con la persona invitada. Si se pierde, generá uno nuevo.</p>
    </div>
  );
}

function ResultWithLink({ state }: { state: FormState }) {
  return (
    <>
      <FormMessage state={state} />
      {state.status === 'success' && state.data?.link ? <CopyableLink link={state.data.link} /> : null}
    </>
  );
}

export function InviteForm({ disabled }: { disabled: boolean }) {
  const [state, action] = useActionState(inviteMemberAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <div className="grid gap-4">
      <ResultWithLink state={state} />
      <form action={action} className="grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end" noValidate>
        <fieldset disabled={disabled} className="contents">
          <Field id="invite-email" label="Email" error={e.email}>
            <Input id="invite-email" name="email" type="email" autoComplete="off" required aria-invalid={e.email ? true : undefined} aria-describedby={describedBy('invite-email', { error: e.email })} />
          </Field>
          <Field id="invite-role" label="Rol" error={e.role}>
            <Select id="invite-role" name="role" defaultValue="agent">
              <option value="agent">Agente</option>
              <option value="owner">Dueño</option>
            </Select>
          </Field>
          <SubmitButton pendingLabel="Invitando…">Invitar</SubmitButton>
        </fieldset>
      </form>
    </div>
  );
}

export function RegenerateInvitationForm({ invitationId, disabled }: { invitationId: string; disabled: boolean }) {
  const [state, action] = useActionState(regenerateInvitationAction, idle);
  return (
    <div className="grid gap-3">
      <form action={action}>
        <input type="hidden" name="invitationId" value={invitationId} />
        <SubmitButton size="sm" variant="outline" disabled={disabled} pendingLabel="Generando…">
          Nuevo enlace
        </SubmitButton>
      </form>
      <ResultWithLink state={state} />
    </div>
  );
}

export function RevokeInvitationButton({ invitationId, email, disabled }: { invitationId: string; email: string; disabled: boolean }) {
  const formId = `revoke-${invitationId}`;
  return (
    <>
      <form id={formId} action={revokeInvitationAction} hidden>
        <input type="hidden" name="invitationId" value={invitationId} />
      </form>
      <ConfirmSubmit
        formId={formId}
        title="Cancelar invitación"
        description={`El enlace enviado a ${email} deja de funcionar.`}
        confirmLabel="Cancelar invitación"
        trigger="Cancelar"
        triggerVariant="ghost"
        destructive
        disabled={disabled}
      />
    </>
  );
}

type MemberChange = 'make_owner' | 'make_agent' | 'deactivate' | 'reactivate';

const CHANGE_COPY: Record<MemberChange, { trigger: string; title: string; confirm: string; destructive: boolean; description: (name: string) => string }> = {
  make_owner: {
    trigger: 'Hacer dueño',
    title: 'Hacer dueño',
    confirm: 'Hacer dueño',
    destructive: false,
    description: (name) => `${name} va a poder configurar la inmobiliaria, gestionar el equipo y WhatsApp.`,
  },
  make_agent: {
    trigger: 'Pasar a agente',
    title: 'Pasar a agente',
    confirm: 'Pasar a agente',
    destructive: false,
    description: (name) => `${name} deja de poder configurar la inmobiliaria y gestionar el equipo.`,
  },
  deactivate: {
    trigger: 'Desactivar',
    title: 'Desactivar usuario',
    confirm: 'Desactivar',
    destructive: true,
    description: (name) => `${name} pierde el acceso a la inmobiliaria de inmediato. Su historial se conserva y podés reactivarlo después.`,
  },
  reactivate: {
    trigger: 'Reactivar',
    title: 'Reactivar usuario',
    confirm: 'Reactivar',
    destructive: false,
    description: (name) => `${name} vuelve a tener acceso a la inmobiliaria. Ocupa un lugar del límite de usuarios del plan.`,
  },
};

export function MemberActions({
  membershipId,
  name,
  role,
  status,
  disabled,
}: {
  membershipId: string;
  name: string;
  role: string;
  status: string;
  disabled: boolean;
}) {
  const [state, action] = useActionState(changeMemberAction, idle);
  const changes: MemberChange[] =
    status === 'active' ? [role === 'owner' ? 'make_agent' : 'make_owner', 'deactivate'] : ['reactivate'];
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {changes.map((change) => {
          const formId = `member-${membershipId}-${change}`;
          const copy = CHANGE_COPY[change];
          return (
            <span key={change}>
              <form id={formId} action={action} hidden>
                <input type="hidden" name="membershipId" value={membershipId} />
                <input type="hidden" name="change" value={change} />
              </form>
              <ConfirmSubmit
                formId={formId}
                title={copy.title}
                description={copy.description(name)}
                confirmLabel={copy.confirm}
                trigger={copy.trigger}
                destructive={copy.destructive}
                disabled={disabled}
              />
            </span>
          );
        })}
      </div>
      <FormMessage state={state} />
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return status === 'active' ? <Badge variant="success">Activo</Badge> : <Badge>Desactivado</Badge>;
}
