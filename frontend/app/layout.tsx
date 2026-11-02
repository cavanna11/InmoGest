import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { brand } from '@/lib/brand.ts';
import { isIndexable, siteUrl } from '@/lib/site.ts';
import './globals.css';

// Tipografía de la marca: se descarga en el build y la sirve la propia app (sin pedidos a Google
// desde el navegador). La usa --font-sans en styles/tokens.css.
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-jakarta', display: 'swap' });

const description =
  'InmoPanel es un software de gestión para inmobiliarias: contactos, propiedades, conversaciones de WhatsApp, búsquedas de clientes y agenda en un solo lugar.';

export const metadata: Metadata = {
  ...(siteUrl() ? { metadataBase: siteUrl() } : {}),
  title: {
    default: brand.fullName,
    template: `%s · ${brand.product}`,
  },
  description,
  applicationName: brand.product,
  authors: [{ name: brand.company }],
  creator: brand.company,
  publisher: brand.company,
  openGraph: {
    siteName: brand.fullName,
    title: brand.fullName,
    description,
    locale: 'es_AR',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  // Indexación controlada por NEXT_PUBLIC_SITE_INDEXABLE (lib/site.ts). Las páginas privadas además
  // declaran noindex en su propio layout.
  robots: isIndexable() ? { index: true, follow: true } : { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1413' },
  ],
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es-AR" className={jakarta.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
