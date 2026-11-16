import { formatDateTime } from '@inmogest/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { ConfirmSubmit } from '@/components/ui/confirm-dialog.tsx';
import { PageHeader } from '@/components/ui/page-header.tsx';
import { Alert, Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { readMercadoLibreEnv } from '@/lib/env.server.ts';
import { appOrigin } from '@/lib/request.ts';
import { requireActiveOrganization } from '@/lib/tenant.ts';
import { revokeApiTokenAction } from '@/modules/integrations/actions.ts';
import { ApiTokenForm } from '@/modules/integrations/components.tsx';
import { getApiTokens, getMercadoLibreConnection } from '@/modules/integrations/queries.ts';
import { connectMercadoLibreAction, disconnectMercadoLibreAction } from '@/modules/mercadolibre/actions.ts';
import { PageSkeleton } from '@/components/ui/page-skeleton.tsx';

export const metadata: Metadata = { title: 'Integraciones' };

const ML_MESSAGES: Record<string, { variant: 'success' | 'warning' | 'destructive'; text: string }> = {
  conectado: { variant: 'success', text: 'Conectamos tu cuenta de Mercado Libre. Ya podés publicar desde cada propiedad.' },
  desconectado: { variant: 'success', text: 'Desconectamos Mercado Libre. Las publicaciones siguen en Mercado Libre, pero ya no se actualizan desde InmoPanel.' },
  cancelado: { variant: 'warning', text: 'No se conectó: la autorización se canceló en Mercado Libre.' },
  vencido: { variant: 'warning', text: 'La autorización tardó demasiado. Probá conectar de nuevo.' },
  en_uso: { variant: 'destructive', text: 'Esa cuenta de Mercado Libre ya está conectada a otra inmobiliaria en InmoPanel.' },
  sin_permiso: { variant: 'destructive', text: 'Solo el dueño de la inmobiliaria puede conectar o desconectar Mercado Libre.' },
  no_habilitado: { variant: 'warning', text: 'Mercado Libre todavía no está habilitado en esta instalación.' },
  error: { variant: 'destructive', text: 'No pudimos conectar Mercado Libre. Probá de nuevo; si sigue fallando, avisanos.' },
};

export default function IntegrationsPage({ searchParams }: PageProps<'/panel/integraciones'>) {
  return (
    <Suspense fallback={<PageSkeleton variant="form" label="Cargando…" />}>
      <Integrations searchParams={searchParams} />
    </Suspense>
  );
}

async function Integrations({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { organization } = await requireActiveOrganization('/panel/integraciones');
  if (!organization.isOwner) {
    return <Alert variant="warning">Solo el dueño de la inmobiliaria puede ver y cambiar las integraciones.</Alert>;
  }
  const query = await searchParams;
  const message = typeof query.ml === 'string' ? ML_MESSAGES[query.ml] : undefined;
  const [connection, tokens, origin] = await Promise.all([
    getMercadoLibreConnection(organization.id),
    getApiTokens(organization.id),
    appOrigin(),
  ]);
  const mlEnabled = Boolean(readMercadoLibreEnv());
  const disabled = !organization.canWrite;
  const endpoint = `${origin}/api/v1/propiedades`;

  return (
    <div className="grid gap-6">
      <PageHeader section="integraciones" title="Integraciones" description="Mercado Libre y la web de tu inmobiliaria." />
      {disabled ? <Alert variant="warning">La cuenta está en solo lectura: no se pueden hacer cambios.</Alert> : null}
      {message ? <Alert variant={message.variant}>{message.text}</Alert> : null}

      <Card>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Mercado Libre
          {connection?.status === 'connected' ? <Badge variant="success">Conectado</Badge> : null}
          {connection?.status === 'needs_reauth' ? <Badge variant="warning">Hay que volver a conectar</Badge> : null}
        </CardTitle>
        <CardDescription>
          Publicá tus propiedades en Mercado Libre desde cada ficha. Se actualizan solas cuando cambiás precio, fotos o estado.
        </CardDescription>
        <div className="mt-4 grid gap-4">
          {!mlEnabled ? (
            <Alert variant="warning">Mercado Libre todavía no está habilitado en esta instalación.</Alert>
          ) : connection ? (
            <>
              <p className="text-sm">
                Cuenta <span className="font-medium">{connection.nickname || connection.ml_user_id}</span>, conectada el{' '}
                {formatDateTime(connection.connected_at)}.
              </p>
              {connection.status === 'needs_reauth' ? (
                <Alert variant="warning">
                  Mercado Libre cortó el acceso (por ejemplo, por un cambio de contraseña o porque se quitó el permiso). Volvé a conectar para
                  seguir sincronizando.
                </Alert>
              ) : null}
              <div className="flex flex-wrap gap-3">
                {connection.status === 'needs_reauth' ? (
                  <form action={connectMercadoLibreAction}>
                    <Button type="submit" disabled={disabled}>
                      Volver a conectar
                    </Button>
                  </form>
                ) : null}
                <form id="ml-disconnect" action={disconnectMercadoLibreAction}>
                  <ConfirmSubmit
                    formId="ml-disconnect"
                    title="¿Desconectar Mercado Libre?"
                    description="Las publicaciones siguen activas en Mercado Libre, pero InmoPanel deja de actualizarlas. Podés volver a conectar cuando quieras."
                    confirmLabel="Desconectar"
                    trigger="Desconectar"
                  />
                </form>
              </div>
            </>
          ) : (
            <>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Necesitás una cuenta de Mercado Libre habilitada para publicar inmuebles y un paquete de publicación contratado.</li>
                <li>Entrá con la cuenta principal (no con un usuario colaborador).</li>
                <li>Mercado Libre pide un WhatsApp de contacto: se usa el número conectado o el teléfono de la inmobiliaria.</li>
              </ul>
              <form action={connectMercadoLibreAction}>
                <Button type="submit" disabled={disabled}>
                  Conectar Mercado Libre
                </Button>
              </form>
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardTitle>Tu sitio web</CardTitle>
        <CardDescription>
          Si tu inmobiliaria tiene web propia, quien la mantiene puede mostrar automáticamente las propiedades que cargás en InmoPanel
          usando un token. InmoPanel no entra a tu web ni necesita sus contraseñas.
        </CardDescription>
        <div className="mt-4 grid gap-4 text-sm">
          <p>
            El sitio web aparece en la página pública de cada propiedad. Lo cargás en{' '}
            <Link href="/panel/configuracion" className="text-primary underline underline-offset-4">
              Configuración → Inmobiliaria
            </Link>
            .
          </p>
          <div className="grid gap-2 rounded-md bg-muted p-3">
            <p className="font-medium">Para quien hace tu web</p>
            <p className="text-muted-foreground">
              Pedido de servidor a servidor, con el token en el header. Devuelve las propiedades publicadas con fotos, datos y el link de su página.
            </p>
            <pre className="overflow-x-auto rounded bg-background p-3 font-mono text-xs">{`curl -H "Authorization: Bearer <token>" \\\n  "${endpoint}?limite=50&pagina=1"`}</pre>
            <p className="text-muted-foreground">
              Con <code>desde=2026-11-15T10:00:00Z</code> devuelve solo lo que cambió y, en <code>removed</code>, los códigos que dejaron de
              publicarse. El token no se tiene que poner en el código que corre en el navegador de los visitantes.
            </p>
          </div>
          <ApiTokenForm disabled={disabled} />
          {tokens.length > 0 ? (
            <ul className="grid gap-2">
              {tokens.map((token) => (
                <li key={token.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                  <span>
                    <span className="font-medium">{token.name}</span>{' '}
                    <span className="font-mono text-xs text-muted-foreground">{token.token_prefix}…</span>
                    <span className="block text-xs text-muted-foreground">
                      Creado el {formatDateTime(token.created_at)}
                      {token.last_used_at ? ` · Último uso: ${formatDateTime(token.last_used_at)}` : ' · Sin uso todavía'}
                    </span>
                  </span>
                  <form id={`revoke-${token.id}`} action={revokeApiTokenAction}>
                    <input type="hidden" name="tokenId" value={token.id} />
                    <ConfirmSubmit
                      formId={`revoke-${token.id}`}
                      title={`¿Revocar "${token.name}"?`}
                      description="La web que lo use deja de recibir las propiedades al instante. No se puede deshacer."
                      confirmLabel="Revocar"
                      trigger="Revocar"
                    />
                  </form>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
