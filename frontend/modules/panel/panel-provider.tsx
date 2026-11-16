'use client';

import type { ReactNode } from 'react';
import { SidebarProvider } from '@/components/ui/sidebar.tsx';
import { Toaster } from '@/components/ui/sonner.tsx';
import { useLocalPreference } from './local-preference.ts';

/**
 * Estado del menú lateral (completo o compacto, solo íconos) recordado en este navegador. Envuelve
 * todo el panel para que el botón de la barra superior y el menú compartan el estado.
 */
export function PanelProvider({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useLocalPreference<boolean>('inmopanel-menu-expanded', true);
  return (
    <SidebarProvider open={expanded} onOpenChange={setExpanded}>
      {children}
      <Toaster position="bottom-center" />
    </SidebarProvider>
  );
}
