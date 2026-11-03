import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { isRegistrationOpen } from '@/lib/env.server.ts';
import { ClosedBetaNotice } from '@/modules/auth/closed-beta.tsx';
import { SignUpForm } from '@/modules/auth/components.tsx';
import { getRegistrationLegalDocuments } from '@/modules/auth/queries.ts';

export const metadata: Metadata = { title: 'Probá gratis' };

export default function SignUpPage() {
  return (
    <Card>
      <CardTitle>Probá InmoPanel gratis 14 días</CardTitle>
      <CardDescription>Creá la cuenta de tu inmobiliaria. No hace falta tarjeta.</CardDescription>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
          <SignUp />
        </Suspense>
      </div>
    </Card>
  );
}

async function SignUp() {
  if (!(await isRegistrationOpen())) return <ClosedBetaNotice />;
  // El registro solo se habilita con términos y privacidad publicados explícitamente (ADR 0009).
  const legal = await getRegistrationLegalDocuments();
  if (!legal) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        El registro de inmobiliarias todavía no está disponible.{' '}
        <Link href="/ingresar" className="text-foreground underline underline-offset-4">
          Ingresar con una cuenta existente
        </Link>
      </p>
    );
  }
  return <SignUpForm legal={legal} />;
}
