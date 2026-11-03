import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireUser } from '@/lib/auth.ts';
import { UpdatePasswordForm } from '@/modules/auth/components.tsx';
import { getOwnProfile } from '@/modules/organization/queries.ts';
import { ProfileForm } from '@/modules/profile/components.tsx';

export const metadata: Metadata = { title: 'Mi perfil' };

export default function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Profile />
    </Suspense>
  );
}

async function Profile() {
  const user = await requireUser('/panel/perfil');
  const profile = await getOwnProfile(user.id);
  return (
    <div className="grid gap-6">
      <h1 className="text-2xl font-semibold">Mi perfil</h1>
      <Card>
        <CardTitle>Tus datos</CardTitle>
        <CardDescription>Ingresás con {user.email}.</CardDescription>
        <div className="mt-6">
          <ProfileForm fullName={profile?.full_name ?? user.fullName} phone={profile?.phone ?? ''} />
        </div>
      </Card>
      <Card>
        <CardTitle>Contraseña</CardTitle>
        <div className="mt-6">
          <UpdatePasswordForm submitLabel="Cambiar contraseña" />
        </div>
      </Card>
    </div>
  );
}
