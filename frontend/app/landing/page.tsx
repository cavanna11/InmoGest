// Vista previa de la landing comercial mientras app/page.tsx sigue siendo la página provisoria.
// Al integrar: app/page.tsx renderiza <LandingPage /> con esta metadata y se borra esta ruta.
import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/landing-page.tsx';

export const metadata: Metadata = {
  title: 'InmoGest — CRM para inmobiliarias',
  description:
    'Contactos, propiedades y WhatsApp de tu inmobiliaria en un solo lugar: bandeja compartida, matching explicado, embudo y agenda.',
};

export default function LandingPreviewPage() {
  return <LandingPage />;
}
