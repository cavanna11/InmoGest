import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BrandMark } from '@/components/brand-mark.tsx';
import { ThemeToggle } from '@/components/theme.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { signOutAction } from '@/modules/auth/actions.ts';
import { PlatformTabs } from '@/modules/platform/nav.tsx';

export const metadata: Metadata = { title: { default: 'Súper panel', template: '%s · Súper panel C&C' }, robots: { index: false, follow: false } };

// Súper panel de C&C (CU-15). El acceso lo decide la base; cada página verifica el rol y responde
// "no encontrada" a quien no lo tiene, sin mostrar este encabezado con datos.
export default function PlatformLayout({ children }: LayoutProps<'/plataforma'>) {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex min-h-14 max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/plataforma" aria-label="Súper panel, inicio">
              <BrandMark />
            </Link>
            <Badge variant="highlight">Súper panel</Badge>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <form action={signOutAction}>
              <Button type="submit" variant="ghost" size="sm">
                Salir
              </Button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-4 pb-2 sm:px-6">
          <Suspense fallback={<div className="h-9" />}>
            <PlatformTabs />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>{children}</Suspense>
      </main>
    </div>
  );
}
