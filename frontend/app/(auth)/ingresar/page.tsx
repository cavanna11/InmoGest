import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Alert, Card, CardTitle } from '@/components/ui/surfaces.tsx';
import { safeNext } from '@/lib/safe-redirect.ts';
import { ResendConfirmationForm, SignInForm } from '@/modules/auth/components.tsx';

export const metadata: Metadata = { title: 'Ingresar' };

export default function SignInPage({ searchParams }: PageProps<'/ingresar'>) {
  return (
    <div className="grid gap-6">
      <Card>
        <CardTitle>Ingresá a tu cuenta</CardTitle>
        <div className="mt-6">
          <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
            <SignIn searchParams={searchParams} />
          </Suspense>
        </div>
      </Card>
      <details className="rounded-lg border border-border bg-surface p-5 text-sm">
        <summary className="cursor-pointer font-medium">¿No te llegó el email de confirmación?</summary>
        <div className="mt-4">
          <ResendConfirmationForm />
        </div>
      </details>
    </div>
  );
}

async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === 'string' ? params.next : undefined);
  return (
    <div className="grid gap-4">
      {params.error === 'enlace' ? (
        <Alert variant="destructive">El enlace no es válido o ya venció. Pedí uno nuevo.</Alert>
      ) : null}
      <SignInForm next={next} />
    </div>
  );
}
