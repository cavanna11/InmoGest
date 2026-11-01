import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'InmoGest',
  description: 'CRM inmobiliario para inmobiliarias argentinas.',
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
