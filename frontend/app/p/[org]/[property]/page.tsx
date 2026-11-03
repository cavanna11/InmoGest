import { formatPhone } from '@inmogest/shared';
import { BedDouble, Bath, Mail, MapPin, MessageCircle, Ruler, SquareStack } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { cache, Suspense } from 'react';
import { Logo } from '@/components/brand/logo.tsx';
import { createClient } from '@/lib/supabase/server.ts';
import { areaLabel, priceLabel } from '@/modules/properties/format.ts';
import { publicImageUrl } from '@/modules/properties/images.ts';
import { FEATURES, isFeature, OPERATION_LABELS, STATUS_LABELS, TYPE_LABELS } from '@/modules/properties/labels.ts';

// Página pública de una propiedad (F-10): sin sesión, solo información publicable. Nunca borradores
// ni pausadas; la dirección exacta solo si la inmobiliaria lo eligió. Los slugs viejos de la
// inmobiliaria redirigen al actual (ADR 0008).

type Params = Promise<{ org: string; property: string }>;

function count(value: number, singular: string, plural: string): string {
  return `${value} ${value === 1 ? singular : plural}`;
}

const loadProperty = cache(async (org: string, property: string) => {
  const supabase = await createClient();
  const { data } = await supabase.rpc('public_property', { p_organization_slug: org, p_property_slug: property });
  return data?.[0] ?? null;
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { org, property } = await params;
  const data = await loadProperty(org, property);
  if (!data) return { title: 'Propiedad no encontrada', robots: { index: false } };
  const place = [data.neighborhood, data.city].filter(Boolean).join(', ');
  const description = `${OPERATION_LABELS[data.operation]} · ${TYPE_LABELS[data.property_type]}${place ? ` en ${place}` : ''} · ${priceLabel(data.price, data.currency)}. ${data.organization_name}.`;
  const cover = data.images[0];
  return {
    title: `${data.title} · ${data.organization_name}`,
    description,
    openGraph: { title: data.title, description, ...(cover ? { images: [{ url: publicImageUrl(cover) }] } : {}) },
  };
}

export default function PublicPropertyPage({ params }: { params: Params }) {
  return (
    <div className="min-h-dvh bg-background">
      <Suspense fallback={<p className="p-8 text-center text-muted-foreground">Cargando…</p>}>
        <PublicProperty params={params} />
      </Suspense>
    </div>
  );
}

async function PublicProperty({ params }: { params: Params }) {
  const { org, property } = await params;
  const data = await loadProperty(org, property);
  if (!data) {
    const supabase = await createClient();
    const { data: current } = await supabase.rpc('resolve_organization_slug', { p_slug: org });
    if (current && current !== org) redirect(`/p/${current}/${property}`);
    notFound();
  }

  const place = [data.neighborhood, data.city, data.province].filter(Boolean).join(', ');
  const message = `Hola, me interesa la propiedad ${data.code} (${data.title}).`;
  const whatsapp = data.organization_phone
    ? `https://wa.me/${data.organization_phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
    : null;
  const facts = [
    data.rooms ? { Icon: SquareStack, label: count(data.rooms, 'ambiente', 'ambientes') } : null,
    data.bedrooms ? { Icon: BedDouble, label: count(data.bedrooms, 'dormitorio', 'dormitorios') } : null,
    data.bathrooms ? { Icon: Bath, label: count(data.bathrooms, 'baño', 'baños') } : null,
    data.covered_area_m2 ? { Icon: Ruler, label: `${areaLabel(data.covered_area_m2)} cubiertos` } : null,
    data.total_area_m2 ? { Icon: Ruler, label: `${areaLabel(data.total_area_m2)} totales` } : null,
  ].filter((fact) => fact !== null);
  const unavailable = data.status !== 'available';
  const logo = data.organization_logo_path
    ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/logos/${data.organization_logo_path}`
    : null;

  return (
    <>
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3 sm:px-6">
          {/* eslint-disable-next-line @next/next/no-img-element -- logo de Storage */}
          {logo ? <img src={logo} alt="" className="size-10 rounded-md object-contain" /> : null}
          <p className="font-semibold">{data.organization_name}</p>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-8 sm:px-6">
        {data.images.length > 0 ? (
          <section aria-label="Fotos" className="grid gap-2 sm:grid-cols-4 sm:grid-rows-2">
            {data.images.slice(0, 5).map((path, index) => (
              // eslint-disable-next-line @next/next/no-img-element -- fotos de Storage, sin optimizador configurado
              <img
                key={path}
                src={publicImageUrl(path)}
                alt={index === 0 ? data.title : `Foto ${index + 1} de ${data.title}`}
                className={`w-full rounded-lg object-cover ${index === 0 ? 'aspect-[4/3] sm:col-span-2 sm:row-span-2 sm:aspect-auto sm:h-full' : 'hidden aspect-[4/3] sm:block'}`}
                loading={index === 0 ? 'eager' : 'lazy'}
              />
            ))}
          </section>
        ) : null}

        <div className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <article className="grid content-start gap-6">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-primary">
                {OPERATION_LABELS[data.operation]} · {TYPE_LABELS[data.property_type]}
                {unavailable ? (
                  <span className="rounded-full bg-highlight-soft px-2 py-0.5 text-xs font-semibold text-highlight-soft-foreground">
                    {STATUS_LABELS[data.status]}
                  </span>
                ) : null}
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-balance">{data.title}</h1>
              {data.address || place ? (
                <p className="mt-2 flex items-center gap-1.5 text-muted-foreground">
                  <MapPin aria-hidden="true" className="size-4 text-highlight" />
                  {[data.address, place].filter(Boolean).join(' · ')}
                </p>
              ) : null}
            </div>

            {facts.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {facts.map(({ Icon, label }) => (
                  <li key={label} className="flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-sm text-primary-soft-foreground">
                    <Icon aria-hidden="true" className="size-4" />
                    {label}
                  </li>
                ))}
              </ul>
            ) : null}

            {data.description ? (
              <section>
                <h2 className="text-lg font-semibold">Descripción</h2>
                <p className="mt-2 whitespace-pre-line text-foreground/90">{data.description}</p>
              </section>
            ) : null}

            {data.features.length > 0 ? (
              <section>
                <h2 className="text-lg font-semibold">Características</h2>
                <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {data.features.filter(isFeature).map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-highlight" />
                      {FEATURES[feature]}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </article>

          <aside className="grid content-start gap-4 lg:sticky lg:top-6 lg:self-start">
            <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
              <p className="text-sm text-muted-foreground">{data.code}</p>
              <p className="mt-1 text-3xl font-bold text-primary">{priceLabel(data.price, data.currency)}</p>
              {data.expenses ? (
                <p className="mt-1 text-sm text-muted-foreground">+ {priceLabel(data.expenses, data.expenses_currency)} de expensas</p>
              ) : null}
              <div className="mt-5 grid gap-2">
                {whatsapp ? (
                  <a
                    href={whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
                  >
                    <MessageCircle aria-hidden="true" className="size-4" /> Consultar por WhatsApp
                  </a>
                ) : null}
                {data.organization_email ? (
                  <a
                    href={`mailto:${data.organization_email}?subject=${encodeURIComponent(`Consulta por ${data.code}`)}`}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-input px-4 text-sm font-medium hover:bg-accent"
                  >
                    <Mail aria-hidden="true" className="size-4" /> Escribir un email
                  </a>
                ) : null}
                {!whatsapp && !data.organization_email ? (
                  <p className="text-sm text-muted-foreground">Consultá directamente con {data.organization_name}.</p>
                ) : null}
              </div>
              {data.organization_phone ? (
                <p className="mt-3 text-center text-xs text-muted-foreground">{formatPhone(data.organization_phone)}</p>
              ) : null}
            </div>
          </aside>
        </div>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-5 text-xs text-muted-foreground sm:px-6">
          <span>Publicado por {data.organization_name}</span>
          <span className="flex items-center gap-2">
            Hecho con <Logo size="sm" />
          </span>
        </div>
      </footer>
    </>
  );
}
