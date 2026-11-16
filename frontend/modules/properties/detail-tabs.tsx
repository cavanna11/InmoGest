'use client';

import { useState, type ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';

export const PROPERTY_TABS = { resumen: 'Resumen', datos: 'Datos', publicacion: 'Publicación', historial: 'Historial' } as const;
export type PropertyTab = keyof typeof PROPERTY_TABS;

/**
 * Pestañas de la ficha. Cambiar de pestaña no vuelve a pedir la página al servidor: el contenido ya
 * llegó y la pestaña queda en la URL (?tab=…) para compartirla o volver con "Atrás".
 */
export function PropertyDetailTabs({ initial, panels }: { initial: PropertyTab; panels: Record<PropertyTab, ReactNode> }) {
  const [tab, setTab] = useState<PropertyTab>(initial);
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        setTab(value as PropertyTab);
        const url = new URL(window.location.href);
        if (value === 'resumen') url.searchParams.delete('tab');
        else url.searchParams.set('tab', value);
        url.hash = '';
        window.history.replaceState(null, '', url);
      }}
      className="gap-5"
    >
      <TabsList className="grid h-10 w-full grid-cols-4 sm:inline-flex sm:w-fit">
        {(Object.keys(PROPERTY_TABS) as PropertyTab[]).map((key) => (
          <TabsTrigger key={key} value={key} className="px-3">
            {PROPERTY_TABS[key]}
          </TabsTrigger>
        ))}
      </TabsList>
      {(Object.keys(PROPERTY_TABS) as PropertyTab[]).map((key) => (
        <TabsContent key={key} value={key} className="grid gap-6">
          {panels[key]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
