import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { SubmitButton } from '@/components/form-feedback.tsx';
import { Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireUser } from '@/lib/auth.ts';
import { acceptLegalAction } from '@/modules/auth/actions.ts';
import { getPendingLegalDocuments } from '@/modules/auth/queries.ts';

export const metadata: Metadata = { title: 'Términos y privacidad' };

// Aceptación al primer ingreso del dueño de una inmobiliaria creada por C&C (ADR 0009: la aceptación
// es de esa persona, C&C no la hace en su nombre).
export default function AcceptTermsPage() {
  return (
    <Card>
      <CardTitle>Antes de empezar</CardTitle>
      <CardDescription>Para usar InmoPanel necesitamos que aceptes los términos y la política de privacidad vigentes.</CardDescription>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
          <AcceptTerms />
        </Suspense>
      </div>
    </Card>
  );
}

async function AcceptTerms() {
  const user = await requireUser('/aceptar-terminos');
  if ((await getPendingLegalDocuments(user.id)).length === 0) redirect('/panel');
  return (
    <form action={acceptLegalAction} className="grid gap-4">
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="accept" required className="mt-0.5 size-4 accent-[var(--primary)]" />
        <span>
          Acepto los{' '}
          <Link href="/legal/terminos" target="_blank" className="underline underline-offset-4">
            términos y condiciones
          </Link>{' '}
          y la{' '}
          <Link href="/legal/privacidad" target="_blank" className="underline underline-offset-4">
            política de privacidad
          </Link>
          .
        </span>
      </label>
      <SubmitButton>Aceptar y continuar</SubmitButton>
    </form>
  );
}
