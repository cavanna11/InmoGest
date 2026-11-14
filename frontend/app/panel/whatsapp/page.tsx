import type { Metadata } from 'next';
import { Suspense } from 'react';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { readEvolutionEnv } from '@/lib/env.server.ts';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { ConnectForm, ConnectionQr, OfficialApiForm, RemoveConnectionButton } from '@/modules/whatsapp/components.tsx';
import { CONNECTION_STATUS } from '@/modules/whatsapp/labels.ts';
import { getOpenApiRequest, listConnections } from '@/modules/whatsapp/queries.ts';

export const metadata: Metadata = { title: 'WhatsApp' };

// Conexión del número por QR (CU-03, F-14, F-15, F-32).
export default function WhatsAppPage() {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <WhatsApp />
    </Suspense>
  );
}

async function WhatsApp() {
  const { organization } = await requireActiveOrganization('/panel/whatsapp');
  const [connections, apiRequest] = await Promise.all([listConnections(organization.id), getOpenApiRequest(organization.id)]);
  const available = readEvolutionEnv() !== null;
  const canManage = organization.isOwner && organization.canWrite;

  return (
    <div className="grid gap-6">
      <PageHeader section="whatsapp" title="WhatsApp" description="Conectá el número de la inmobiliaria para recibir y responder desde el panel." />

      {!available ? (
        <Alert variant="warning">La conexión de WhatsApp todavía no está habilitada en esta instalación. Las conversaciones guardadas se pueden seguir consultando.</Alert>
      ) : null}

      <Card>
        <CardTitle>Números conectados</CardTitle>
        <ul className="mt-4 grid gap-3">
          {connections.length === 0 ? <li className="text-sm text-muted-foreground">Todavía no hay ningún número conectado.</li> : null}
          {connections.map((connection) => {
            const status = CONNECTION_STATUS[connection.status];
            return (
              <li key={connection.id} className="grid gap-3 rounded-md border border-border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{connection.phone_e164 ?? 'Número sin vincular'}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  {canManage ? <RemoveConnectionButton connectionId={connection.id} /> : null}
                </div>
                <p className="text-sm text-muted-foreground">{status.help}</p>
                {canManage && available && connection.status !== 'connected' ? <ConnectionQr connectionId={connection.id} /> : null}
              </li>
            );
          })}
        </ul>
      </Card>

      {canManage && available ? (
        <Card>
          <CardTitle>Conectar un número</CardTitle>
          <CardDescription>Antes de conectar, leé y aceptá las pautas de uso responsable.</CardDescription>
          <div className="mt-4 grid gap-3 text-sm">
            <p>
              La conexión por QR <strong>no es un servicio oficial de WhatsApp</strong> y el número puede ser restringido si se usa mal. Seguir estas pautas reduce el riesgo, pero no lo elimina.
            </p>
            <ul className="grid list-disc gap-1 pl-5">
              <li>Usá un número con historial de uso real, no uno recién creado.</li>
              <li>Aumentá el volumen de mensajes de forma gradual.</li>
              <li>Escribí solo a personas que contactaron a la inmobiliaria o dieron su consentimiento.</li>
              <li>Ofrecé siempre la opción de no recibir más mensajes: quien escribe BAJA queda marcado como «no contactar».</li>
              <li>Evitá los mensajes masivos idénticos.</li>
            </ul>
            <ConnectForm />
          </div>
        </Card>
      ) : null}

      {organization.isOwner ? (
        <Card>
          <CardTitle>API oficial de WhatsApp</CardTitle>
          <CardDescription>La gestiona C&amp;C. Los costos por mensaje los paga la inmobiliaria, según las tarifas vigentes de Meta.</CardDescription>
          <div className="mt-4">
            {apiRequest ? (
              <Alert>Recibimos tu pedido. C&amp;C se va a poner en contacto.</Alert>
            ) : (
              <OfficialApiForm disabled={!organization.canWrite} />
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
