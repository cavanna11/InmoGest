import type { Metadata } from 'next';
import { BrandMark } from '@/components/brand-mark.tsx';

// Pantallas privadas o transaccionales: nunca se indexan (además de robots.txt).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Pantallas de acceso: registro, ingreso, recuperación, invitaciones y alta de la inmobiliaria.
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      <header className="mb-8">
        <BrandMark size="lg" />
      </header>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
