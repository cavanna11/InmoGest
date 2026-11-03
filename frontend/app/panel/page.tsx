import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { setOnboardingStepAction } from '@/modules/onboarding/actions.ts';
import { getOnboardingProgress, type OnboardingStep } from '@/modules/organization/queries.ts';
import { PREVIEW_SECTIONS } from '@/modules/panel/sections.ts';

export const metadata: Metadata = { title: 'Inicio' };

// Asistente de configuración (CU-01 paso 5, F-03): muestra qué falta, permite saltear y retomar.
// Los pasos de funciones que todavía no existen se muestran como "Próximamente", sin botón.
// Recorrido por lo que va a incluir el panel (vistas previas de las secciones en desarrollo).
const TOUR = (['conversaciones', 'propiedades', 'busquedas', 'oportunidades', 'agenda', 'importar'] as const).map(
  (slug) => PREVIEW_SECTIONS[slug],
);

const STEPS: Array<{ step: OnboardingStep; title: string; description: string; href: string | null }> = [
  { step: 'organization', title: 'Datos y logo de la inmobiliaria', description: 'Nombre, contacto, moneda y logo.', href: '/panel/configuracion' },
  { step: 'team', title: 'Invitá a tu equipo', description: 'Sumá a los agentes de la inmobiliaria.', href: '/panel/equipo' },
  { step: 'whatsapp', title: 'Conectá WhatsApp', description: 'El número de la inmobiliaria, con un código QR.', href: null },
  { step: 'data', title: 'Cargá o importá propiedades y contactos', description: 'A mano o desde una planilla.', href: null },
];

export default function PanelHomePage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <PanelHome />
    </Suspense>
  );
}

async function PanelHome() {
  const { user, organization } = await requireActiveOrganization('/panel');
  const progress = await getOnboardingProgress(organization.id);
  const completed = STEPS.filter(({ step }) => progress.get(step)?.completed_at).length;
  const firstName = user.fullName.split(' ')[0];

  return (
    <div className="grid gap-6">
      <div className="relative overflow-hidden rounded-2xl bg-primary px-6 py-7 text-primary-foreground sm:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute -top-16 -right-10 size-48 rounded-full border-[24px] border-primary-foreground/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-10 right-24 size-20 rounded-full bg-highlight/80" />
        <p className="relative text-sm font-medium text-primary-foreground/80">{organization.name}</p>
        <h1 className="relative mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Hola{firstName ? `, ${firstName}` : ''}</h1>
        <p className="relative mt-2 max-w-lg text-primary-foreground/85">
          Este es tu panel. Completá la configuración inicial y recorré lo que va a incluir InmoPanel.
        </p>
      </div>

      <Card>
        <CardTitle>Configuración inicial</CardTitle>
        <CardDescription>
          {completed} de {STEPS.length} pasos completados. Podés saltear un paso y retomarlo cuando quieras.
        </CardDescription>
        <div
          className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Progreso de la configuración"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={completed}
        >
          <div className="h-full bg-primary" style={{ width: `${(completed / STEPS.length) * 100}%` }} />
        </div>
        <ol className="mt-6 grid gap-3">
          {STEPS.map(({ step, title, description, href }) => {
            const row = progress.get(step);
            const status = row?.completed_at ? 'done' : row?.skipped_at ? 'skipped' : 'pending';
            return (
              <li key={step} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 font-medium">
                    {title}
                    {status === 'done' ? <Badge variant="success">Listo</Badge> : null}
                    {status === 'skipped' ? <Badge>Salteado</Badge> : null}
                    {!href && status !== 'done' ? <Badge variant="highlight">Próximamente</Badge> : null}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                </div>
                {status !== 'done' && organization.isOwner ? (
                  <div className="flex gap-2">
                    {href ? (
                      <Button asChild size="sm">
                        <Link href={href}>{status === 'skipped' ? 'Retomar' : 'Empezar'}</Link>
                      </Button>
                    ) : null}
                    {href && organization.canWrite ? (
                      <form action={setOnboardingStepAction}>
                        <input type="hidden" name="step" value={step} />
                        <input type="hidden" name="skip" value={status === 'skipped' ? '0' : '1'} />
                        <Button type="submit" size="sm" variant="ghost">
                          {status === 'skipped' ? 'Marcar pendiente' : 'Saltear'}
                        </Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      </Card>

      <section aria-labelledby="tour">
        <h2 id="tour" className="text-lg font-semibold">
          Lo que vas a encontrar en InmoPanel
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Estas secciones están en desarrollo. Entrá a cada una para ver qué va a incluir.
        </p>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {TOUR.map((section) => (
            <li key={section.slug}>
              <Link
                href={`/panel/${section.slug}`}
                className="block h-full rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary"
              >
                <span className="flex items-center justify-between gap-2 font-medium">
                  {section.title}
                  <Badge variant="highlight">Próximamente</Badge>
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">{section.summary}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
