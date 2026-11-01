import type { Metadata, Viewport } from 'next';
import { brand } from '@/lib/brand.ts';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: brand.fullName,
    template: `%s · ${brand.product}`,
  },
  description: `${brand.descriptor}. ${brand.tagline}`,
  applicationName: brand.product,
  // Sin dominio definitivo todavía (inmopanel.com.ar no está comprado): no se fija metadataBase.
  openGraph: {
    siteName: brand.fullName,
    title: brand.fullName,
    description: `${brand.descriptor}. ${brand.tagline}`,
    locale: 'es_AR',
    type: 'website',
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-AR">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
