import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { RequestResetForm } from '@/modules/auth/components.tsx';

export const metadata: Metadata = { title: 'Recuperar contraseña' };

export default function RequestResetPage() {
  return (
    <Card>
      <CardTitle>Recuperá tu contraseña</CardTitle>
      <CardDescription>Te enviamos un enlace para elegir una contraseña nueva.</CardDescription>
      <div className="mt-6 grid gap-4">
        <RequestResetForm />
        <Link href="/ingresar" className="text-center text-sm underline underline-offset-4">
          Volver a ingresar
        </Link>
      </div>
    </Card>
  );
}
