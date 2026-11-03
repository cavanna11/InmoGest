import { formatDate, formatPhone } from '@inmogest/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmSubmit } from '@/components/ui/confirm-dialog.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Card } from '@/components/ui/surfaces.tsx';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { dismissDuplicateAction, mergeContactsAction } from '@/modules/contacts/actions.ts';
import { getOpenDuplicateReports } from '@/modules/contacts/queries.ts';

export const metadata: Metadata = { title: 'Posibles duplicados' };

// Revisión de duplicados reportados (CU-17, F-34). Solo el dueño unifica, con confirmación.
export default function DuplicatesPage({ searchParams }: PageProps<'/panel/contactos/duplicados'>) {
  return (
    <div className="grid grid-cols-1 gap-6">
      <Link href="/panel/contactos" className="text-sm text-muted-foreground hover:text-foreground">
        ← Contactos
      </Link>
      <PageHeader
        section="contactos"
        title="Posibles duplicados"
        description="Compará los dos contactos y elegí cuál queda. El resultado conserva teléfonos, emails, notas e historial de ambos."
      />
      <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
        <Duplicates searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

type Side = { id: string; full_name: string; created_at: string; contact_phones: Array<{ phone_e164: string }>; contact_emails: Array<{ email: string }> };

function ContactSummary({ contact }: { contact: Side }) {
  return (
    <div className="min-w-0 rounded-md bg-muted p-3 text-sm">
      <Link href={`/panel/contactos/${contact.id}`} className="font-medium text-primary hover:underline">
        {contact.full_name}
      </Link>
      <p className="text-xs text-muted-foreground">Creado el {formatDate(contact.created_at)}</p>
      <ul className="mt-2 grid gap-0.5 text-xs">
        {contact.contact_phones.map((phone) => (
          <li key={phone.phone_e164}>{formatPhone(phone.phone_e164)}</li>
        ))}
        {contact.contact_emails.map((email) => (
          <li key={email.email} className="truncate">
            {email.email}
          </li>
        ))}
      </ul>
    </div>
  );
}

async function Duplicates({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { organization } = await requireActiveOrganization('/panel/contactos/duplicados');
  if (!organization.isOwner) {
    return <Alert variant="warning">Solo el dueño de la inmobiliaria puede revisar y unificar duplicados.</Alert>;
  }
  const { error } = await searchParams;
  const reports = await getOpenDuplicateReports(organization.id);
  const disabled = !organization.canWrite;

  return (
    <>
      {error ? <Alert variant="destructive">No se pudo unificar: alguno de los contactos ya fue unificado o no está disponible.</Alert> : null}
      {reports.length === 0 ? (
        <Card className="text-center">
          <p className="font-medium">No hay duplicados pendientes.</p>
          <p className="mt-1 text-sm text-muted-foreground">Cuando alguien del equipo reporte uno, aparece acá.</p>
        </Card>
      ) : null}
      <ul className="grid gap-4">
        {reports.map((report) => {
          const a = report.a as unknown as Side | null;
          const b = report.b as unknown as Side | null;
          if (!a || !b) return null;
          return (
            <li key={report.id}>
              <Card>
                <p className="text-sm text-muted-foreground">
                  Reportado el {formatDate(report.created_at)}
                  {report.reason ? ` · ${report.reason}` : ''}
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ContactSummary contact={a} />
                  <ContactSummary contact={b} />
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    [a, b],
                    [b, a],
                  ].map(([keep, merge]) => {
                    const formId = `merge-${report.id}-${keep!.id}`;
                    return (
                      <form key={formId} id={formId} action={mergeContactsAction}>
                        <input type="hidden" name="keepId" value={keep!.id} />
                        <input type="hidden" name="mergeId" value={merge!.id} />
                        <ConfirmSubmit
                          formId={formId}
                          title={`¿Unificar en "${keep!.full_name}"?`}
                          description={`"${merge!.full_name}" deja de aparecer y todo lo suyo pasa a "${keep!.full_name}". No se puede deshacer.`}
                          confirmLabel="Unificar"
                          trigger={`Conservar "${keep!.full_name}"`}
                          triggerVariant="default"
                          disabled={disabled}
                        />
                      </form>
                    );
                  })}
                  <form action={dismissDuplicateAction}>
                    <input type="hidden" name="reportId" value={report.id} />
                    <Button type="submit" variant="ghost" size="sm" disabled={disabled}>
                      No son la misma persona
                    </Button>
                  </form>
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </>
  );
}
