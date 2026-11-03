import type { Metadata } from 'next';
import { BrandMark } from '@/components/brand-mark.tsx';
import { ThemeToggle } from '@/components/theme.tsx';

// Pantallas privadas o transaccionales: nunca se indexan (además de robots.txt).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Pantallas de acceso: registro, ingreso, recuperación, invitaciones y alta de la inmobiliaria.
export default function AuthLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center bg-[radial-gradient(ellipse_at_top,var(--primary-soft),transparent_60%)] px-4 py-10 sm:py-16">
      <ThemeToggle className="absolute top-4 right-4" />
      <header className="mb-8">
        <BrandMark size="lg" />
      </header>
      <main className="w-full max-w-md">{children}</main>
    </div>
  );
}
