import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { getCurrentUser } from '@/lib/auth.ts';
import { readPublicEnv } from '@/lib/env.ts';
import { isRegistrationOpen } from '@/lib/env.server.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { InvitedSignUpForm } from '@/modules/auth/components.tsx';
import { ROLE_LABELS } from '@/modules/organization/labels.ts';
import { AcceptInvitationForm } from '@/modules/onboarding/components.tsx';

export const metadata: Metadata = { title: 'Invitación', robots: { index: false } };

const UNAVAILABLE: Record<string, string> = {
  accepted: 'Esta invitación ya fue usada.',
  revoked: 'La invitación fue cancelada. Pedile a la inmobiliaria una nueva.',
  expired: 'La invitación venció. Pedile a la inmobiliaria una nueva.',
  organization_unavailable: 'La inmobiliaria no puede sumar usuarios en este momento.',
};

// El token de la URL es una credencial temporal (ADR 0007): no se muestra ni se registra.
export default function InvitationPage({ params }: PageProps<'/invitacion/[token]'>) {
  return (
    <Card>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando invitación…</p>}>
        <Invitation params={params} />
      </Suspense>
    </Card>
  );
}

async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!readPublicEnv()) return <CardTitle>La invitación no está disponible</CardTitle>;

  const supabase = await createClient();
  const { data } = await supabase.rpc('invitation_preview', { p_token: token });
  const invitation = data?.[0];
  if (!invitation) {
    return (
      <>
        <CardTitle>Enlace no válido</CardTitle>
        <CardDescription>Revisá que el enlace esté completo o pedile a la inmobiliaria uno nuevo.</CardDescription>
      </>
    );
  }
  if (invitation.status !== 'pending') {
    return (
      <>
        <CardTitle>Invitación no disponible</CardTitle>
        <CardDescription>{UNAVAILABLE[invitation.status] ?? UNAVAILABLE.expired}</CardDescription>
      </>
    );
  }

  const user = await getCurrentUser();
  const registrationOpen = await isRegistrationOpen();
  const role = ROLE_LABELS[invitation.role] ?? invitation.role;
  return (
    <div className="grid gap-6">
      <div>
        <CardTitle>Te invitaron a {invitation.organization_name}</CardTitle>
        <CardDescription>
          Vas a sumarte como {role.toLowerCase()} con el email {invitation.email}.
        </CardDescription>
      </div>
      {user ? (
        user.email.toLowerCase() === invitation.email.toLowerCase() ? (
          <AcceptInvitationForm token={token} />
        ) : (
          <CardDescription>
            Ingresaste como {user.email}. Para aceptar, salí e ingresá con {invitation.email}.
          </CardDescription>
        )
      ) : (
        <div className="grid gap-6">
          {registrationOpen ? (
            <InvitedSignUpForm token={token} email={invitation.email} />
          ) : (
            <CardDescription>
              Durante la beta cerrada, C&C da de alta las cuentas: pedile a quien te invitó que solicite tu acceso. Cuando
              tengas tu cuenta, volvé a este enlace.
            </CardDescription>
          )}
          <div className="grid gap-2 text-center text-sm text-muted-foreground">
            <span>¿Ya tenés cuenta con ese email?</span>
            <Button asChild variant="outline">
              <Link href={`/ingresar?next=${encodeURIComponent(`/invitacion/${token}`)}`}>Ingresar y aceptar</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
