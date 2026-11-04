import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BrandMark } from '@/components/brand-mark.tsx';
import { ThemeToggle } from '@/components/theme.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { signOutAction } from '@/modules/auth/actions.ts';

export const metadata: Metadata = { title: { default: 'Plataforma', template: '%s · Plataforma C&C' }, robots: { index: false, follow: false } };

// Panel de superadministrador de C&C (CU-15). El acceso lo decide la base; cada página verifica el rol.
export default function PlatformLayout({ children }: LayoutProps<'/plataforma'>) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/plataforma" aria-label="Plataforma, inicio">
              <BrandMark />
            </Link>
            <Badge variant="highlight">Plataforma C&amp;C</Badge>
          </div>
          <nav aria-label="Plataforma" className="flex items-center gap-1 text-sm">
            <Button asChild variant="ghost" size="sm">
              <Link href="/plataforma">Inmobiliarias</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/plataforma/ajustes">Planes y ajustes</Link>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/panel">Mi panel</Link>
            </Button>
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Salir
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
