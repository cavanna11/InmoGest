import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { getCurrentUser } from '@/lib/auth.ts';
import { UpdatePasswordForm } from '@/modules/auth/components.tsx';

export const metadata: Metadata = { title: 'Nueva contraseña' };

// Se llega desde el enlace de recuperación: /auth/confirm abre la sesión y redirige acá.
export default function ResetPasswordPage() {
  return (
    <Card>
      <CardTitle>Elegí una contraseña nueva</CardTitle>
      <div className="mt-6">
        <Suspense fallback={<p className="text-sm text-muted-foreground">Cargando…</p>}>
          <ResetPassword />
        </Suspense>
      </div>
    </Card>
  );
}

async function ResetPassword() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="grid gap-4">
        <CardDescription>El enlace venció o ya se usó.</CardDescription>
        <Button asChild variant="outline">
          <Link href="/recuperar">Pedir un enlace nuevo</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      <UpdatePasswordForm />
      <Button asChild variant="link">
        <Link href="/panel">Ir al panel</Link>
      </Button>
    </div>
  );
}
