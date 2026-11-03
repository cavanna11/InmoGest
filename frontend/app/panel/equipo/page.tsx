import { formatDate } from '@inmogest/shared';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert, Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { InviteForm, MemberActions, RegenerateInvitationForm, RevokeInvitationButton, StatusBadge } from '@/modules/members/components.tsx';
import { ROLE_LABELS } from '@/modules/organization/labels.ts';
import { getTeam } from '@/modules/organization/queries.ts';
import { PageHeader } from '@/components/ui/page-header.tsx';

export const metadata: Metadata = { title: 'Equipo' };

export default function TeamPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Team />
    </Suspense>
  );
}

// Fuera del componente: la hora actual no es parte del render (regla de pureza de React).
function isPast(date: string): boolean {
  return new Date(date).getTime() <= Date.now();
}

async function Team() {
  const { user, organization } = await requireActiveOrganization('/panel/equipo');
  if (!organization.isOwner) {
    return <Alert variant="warning">Solo el dueño de la inmobiliaria puede gestionar el equipo.</Alert>;
  }
  const { members, invitations } = await getTeam(organization.id);
  const disabled = !organization.canWrite;
  return (
    <div className="grid gap-6">
      <PageHeader section="equipo" title="Equipo" description="Sumá agentes y administrá quién tiene acceso." />
      {disabled ? <Alert variant="warning">La cuenta está en solo lectura: no se pueden hacer cambios en el equipo.</Alert> : null}

      <Card>
        <CardTitle>Invitar</CardTitle>
        <CardDescription>
          Le enviamos un email con un enlace para sumarse. También vas a ver el enlace para compartirlo por otro medio.
        </CardDescription>
        <div className="mt-6">
          <InviteForm disabled={disabled} />
        </div>
      </Card>

      <Card>
        <CardTitle>Usuarios</CardTitle>
        <ul className="mt-4 divide-y divide-border">
          {members.map((member) => {
            const name = member.full_name || member.email;
            const isMe = member.user_id === user.id;
            return (
              <li key={member.membership_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    <span className="truncate">{name}</span>
                    {isMe ? <Badge>Vos</Badge> : null}
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <span className="truncate">{member.email}</span>
                    <span>· {ROLE_LABELS[member.role] ?? member.role}</span>
                    <StatusBadge status={member.status} />
                  </p>
                </div>
                <MemberActions
                  membershipId={member.membership_id}
                  name={name}
                  role={member.role}
                  status={member.status}
                  disabled={disabled}
                />
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <CardTitle>Invitaciones abiertas</CardTitle>
        {invitations.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No hay invitaciones pendientes.</p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {invitations.map((invitation) => {
              const expired = isPast(invitation.expires_at);
              return (
                <li key={invitation.id} className="grid gap-3 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{invitation.email}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <span>{ROLE_LABELS[invitation.role] ?? invitation.role}</span>
                        {expired ? <Badge variant="warning">Vencida</Badge> : <span>· vence el {formatDate(invitation.expires_at)}</span>}
                      </p>
                    </div>
                    <RevokeInvitationButton invitationId={invitation.id} email={invitation.email} disabled={disabled} />
                  </div>
                  <RegenerateInvitationForm invitationId={invitation.id} disabled={disabled} />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
