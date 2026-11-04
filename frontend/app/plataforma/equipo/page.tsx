import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { createClient } from '@/lib/supabase/server.ts';
import { AddTeamMemberForm } from '@/modules/platform/components.tsx';
import { removeTeamMemberAction } from '@/modules/platform/create-actions.ts';
import { requirePlatformAdmin } from '@/modules/platform/guard.ts';

export const metadata = { title: 'Equipo' };

// Equipo de plataforma. Los demás administradores ven el panel; solo el principal hace cambios e
// «Ingresar como» (PRD §3).
export default function PlatformTeamPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <Team />
    </Suspense>
  );
}

async function Team() {
  const role = await requirePlatformAdmin('/plataforma/equipo');
  const supabase = await createClient();
  const { data } = await supabase.rpc('platform_team');
  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
      <Card>
        <ul className="grid gap-2">
          {(data ?? []).map((member) => (
            <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-muted px-3 py-2 text-sm">
              <span>
                <span className="font-medium">{member.full_name || member.email}</span>
                {member.full_name ? <span className="text-muted-foreground"> · {member.email}</span> : null}
              </span>
              {member.is_principal ? (
                <Badge variant="highlight">Principal</Badge>
              ) : role.isPrincipal ? (
                <form action={removeTeamMemberAction}>
                  <input type="hidden" name="userId" value={member.user_id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Quitar
                  </Button>
                </form>
              ) : (
                <Badge>Administrador</Badge>
              )}
            </li>
          ))}
        </ul>
      </Card>
      {role.isPrincipal ? (
        <Card>
          <CardTitle>Sumar a alguien</CardTitle>
          <CardDescription>Va a poder ver el súper panel, pero no hacer cambios ni ingresar a las inmobiliarias.</CardDescription>
          <div className="mt-4">
            <AddTeamMemberForm />
          </div>
        </Card>
      ) : null}
    </div>
  );
}
