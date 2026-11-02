// Página de inicio: landing comercial de InmoPanel by C&C (frontend/components/landing).
import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page.tsx';

export const metadata: Metadata = {
  title: { absolute: 'InmoPanel by C&C — Gestión inmobiliaria inteligente' },
  description:
    'Contactos, propiedades y WhatsApp de tu inmobiliaria en un solo lugar: bandeja compartida, matching explicado, embudo y agenda.',
};

export default function HomePage() {
  return <LandingPage />;
}
