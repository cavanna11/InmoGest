import { formatDateTime } from '@inmogest/shared';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button.tsx';
import { Alert, Badge, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { readMercadoLibreEnv } from '@/lib/env.server.ts';
import { unlinkMercadoLibreAction } from '@/modules/mercadolibre/actions.ts';
import { MercadoLibreSyncButton } from '@/modules/mercadolibre/components.tsx';
import { CopyPublicLink } from '@/modules/properties/components.tsx';
import { CopyButton, ListingLinkForm } from './components.tsx';
import { CHANNEL_LABELS, SYNC_LABELS, SYNC_TONES, type ListingChannel } from './labels.ts';
import type { PropertyListing } from './queries.ts';

const PLACEHOLDERS: Record<ListingChannel, string> = {
  website: 'https://www.tuinmobiliaria.com.ar/propiedad/…',
  mercadolibre: 'https://casa.mercadolibre.com.ar/MLA-…',
  zonaprop: 'https://www.zonaprop.com.ar/propiedades/…',
  argenprop: 'https://www.argenprop.com/…',
};

function ExternalAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4 sm:min-h-0">
      {children} <ExternalLink aria-hidden="true" className="size-3.5" />
    </a>
  );
}

/**
 * Dónde está publicada la propiedad (F-36): página de InmoPanel, links cargados a mano por canal y la
 * publicación en Mercado Libre gestionada por API (F-37).
 */
export function PublicationsCard({
  propertyId,
  isPublic,
  publicUrl,
  statusLabel,
  listings,
  canWrite,
  mercadoLibreConnected,
}: {
  propertyId: string;
  isPublic: boolean;
  publicUrl: string | null;
  statusLabel: string;
  listings: PropertyListing[];
  canWrite: boolean;
  mercadoLibreConnected: boolean;
}) {
  const byChannel = new Map(listings.map((listing) => [listing.channel, listing]));
  const managed = byChannel.get('mercadolibre');
  const mlManaged = managed?.managed ? managed : null;
  const mlAvailable = Boolean(readMercadoLibreEnv()) && mercadoLibreConnected;
  const manualChannels: ListingChannel[] = ['website', ...(mlManaged ? [] : (['mercadolibre'] as const)), 'zonaprop', 'argenprop'];

  return (
    <Card className="border-primary/30 bg-primary-soft/40">
      <CardTitle>Dónde está publicada</CardTitle>
      <CardDescription>El link de InmoPanel y los de los portales o tu web, para copiarlos y mandarlos.</CardDescription>

      <div className="mt-4 grid gap-6">
        <section aria-labelledby="pub-inmopanel" className="grid gap-2">
          <h3 id="pub-inmopanel" className="text-sm font-semibold">
            Página de InmoPanel
          </h3>
          {isPublic && publicUrl ? (
            <>
              <CopyPublicLink url={publicUrl} />
              <Link href={publicUrl} target="_blank" className="inline-flex items-center gap-1.5 text-sm font-medium text-primary underline underline-offset-4">
                Ver la página pública <ExternalLink aria-hidden="true" className="size-3.5" />
              </Link>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              En {statusLabel.toLowerCase()} no se publica. Pasala a Disponible para compartir su enlace.
            </p>
          )}
        </section>

        <section aria-labelledby="pub-ml" className="grid gap-2">
          <h3 id="pub-ml" className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            Mercado Libre desde InmoPanel
            {mlManaged ? <Badge variant={SYNC_TONES[mlManaged.sync_status]}>{SYNC_LABELS[mlManaged.sync_status]}</Badge> : null}
          </h3>
          {mlManaged ? (
            <div className="grid gap-3">
              {mlManaged.sync_status === 'error' && mlManaged.last_error ? <Alert variant="destructive">{mlManaged.last_error}</Alert> : null}
              {mlManaged.url ? (
                <div className="flex flex-wrap items-center gap-3">
                  <ExternalAnchor href={mlManaged.url}>Ver en Mercado Libre</ExternalAnchor>
                  <CopyButton value={mlManaged.url} label="Copiar link" />
                </div>
              ) : null}
              {mlManaged.synced_at ? (
                <p className="text-xs text-muted-foreground">Última sincronización: {formatDateTime(mlManaged.synced_at)}</p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Se actualiza sola al editar la propiedad o sus fotos. Si la marcás como vendida o alquilada, se finaliza en Mercado Libre.
              </p>
              {canWrite && mlAvailable ? (
                <div className="flex flex-wrap items-start gap-3">
                  <Button asChild variant="secondary">
                    <Link href={`/panel/propiedades/${propertyId}/mercadolibre`}>Editar publicación</Link>
                  </Button>
                  {mlManaged.external_id && mlManaged.sync_status !== 'closed' ? <MercadoLibreSyncButton propertyId={propertyId} /> : null}
                </div>
              ) : null}
              {canWrite && (mlManaged.sync_status === 'closed' || !mlManaged.external_id || mlManaged.sync_status === 'error') ? (
                <form action={unlinkMercadoLibreAction}>
                  <input type="hidden" name="propertyId" value={propertyId} />
                  <Button type="submit" variant="ghost" size="sm">
                    Dejar de publicar desde InmoPanel
                  </Button>
                </form>
              ) : null}
            </div>
          ) : mlAvailable ? (
            canWrite && isPublic ? (
              <div>
                <Button asChild>
                  <Link href={`/panel/propiedades/${propertyId}/mercadolibre`}>Publicar en Mercado Libre</Link>
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Para publicarla en Mercado Libre, pasala a Disponible.</p>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Para publicar desde acá, el dueño tiene que conectar la cuenta en{' '}
              <Link href="/panel/integraciones" className="text-primary underline underline-offset-4">
                Integraciones
              </Link>
              . Mientras tanto, podés pegar el link de la publicación abajo.
            </p>
          )}
        </section>

        <section aria-labelledby="pub-links" className="grid gap-4">
          <h3 id="pub-links" className="text-sm font-semibold">
            Links en otros sitios
          </h3>
          {manualChannels.map((channel) => {
            const listing = byChannel.get(channel);
            const url = listing && !listing.managed ? listing.url : null;
            return canWrite ? (
              <div key={channel} className="grid gap-1">
                <ListingLinkForm propertyId={propertyId} channel={channel} url={url} placeholder={PLACEHOLDERS[channel]} />
                {url ? <ExternalAnchor href={url}>Abrir en {CHANNEL_LABELS[channel]}</ExternalAnchor> : null}
              </div>
            ) : url ? (
              <ExternalAnchor key={channel} href={url}>
                {CHANNEL_LABELS[channel]}
              </ExternalAnchor>
            ) : null;
          })}
        </section>
      </div>
    </Card>
  );
}
