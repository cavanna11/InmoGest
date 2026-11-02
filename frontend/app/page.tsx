// Página de inicio: landing comercial de InmoPanel by C&C (frontend/components/landing).
import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page.tsx';
import { faqs } from '@/components/landing/content.ts';
import { brand } from '@/lib/brand.ts';
import { siteUrl } from '@/lib/site.ts';

const title = 'InmoPanel by C&C — Software de gestión para inmobiliarias';
const description =
  'Software de gestión para inmobiliarias: contactos, propiedades, bandeja de WhatsApp compartida y coincidencias automáticas entre propiedades y búsquedas de clientes. En desarrollo.';

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: '/' },
  openGraph: { title, description, url: '/', type: 'website', locale: 'es_AR', siteName: brand.fullName },
  twitter: { card: 'summary_large_image', title, description },
};

/**
 * Datos estructurados (schema.org) para buscadores y sistemas de respuesta: qué es InmoPanel, quién lo
 * desarrolla y las preguntas frecuentes. Solo información verificable: sin calificaciones, clientes ni
 * precios como ofertas (el producto todavía no está a la venta).
 */
function structuredData() {
  const url = siteUrl()?.toString();
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: brand.company,
      brand: { '@type': 'Brand', name: brand.product },
      ...(url ? { url } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: brand.product,
      alternateName: brand.fullName,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Software de gestión inmobiliaria',
      operatingSystem: 'Web (navegador de computadora y celular)',
      inLanguage: 'es-AR',
      description,
      audience: { '@type': 'BusinessAudience', audienceType: 'Inmobiliarias y profesionales del sector inmobiliario' },
      creator: { '@type': 'Organization', name: brand.company },
      featureList: [
        'Bandeja de WhatsApp compartida por el equipo',
        'Alta automática de contactos desde WhatsApp',
        'Gestión de propiedades con página pública',
        'Búsquedas de clientes y coincidencias automáticas con puntaje y motivo',
        'Embudo comercial por etapas',
        'Agenda de visitas y tareas',
        'Importación y exportación CSV',
      ],
      ...(url ? { url } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ];
}

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // JSON generado por la app (sin datos de usuarios); se escapa "<" para no cerrar el script.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, '\\u003c') }}
      />
      <LandingPage />
    </>
  );
}
