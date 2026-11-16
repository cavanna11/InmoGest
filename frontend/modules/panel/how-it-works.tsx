'use client';

import { CircleHelp } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import { Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer.tsx';
import { useIsMobile } from '@/hooks/use-mobile.ts';
import type { Guide } from './guides.ts';

/**
 * "Ver cómo funciona": ejemplos de uso de la sección. En la compu se abre como ventana; en el celular,
 * como panel que sube desde abajo (más cómodo con el pulgar). El botón es el mismo en los dos casos (el
 * HTML no depende del ancho de pantalla) y recibe el foco al cerrar.
 */
export function HowItWorks({ guide }: { guide: Guide }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const returnFocus = (event: Event) => {
    event.preventDefault();
    trigger.current?.focus();
  };

  return (
    <>
      <Button
        ref={trigger}
        type="button"
        variant="link"
        size="sm"
        className="h-auto gap-1.5 px-0 py-1 text-primary"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <CircleHelp aria-hidden="true" />
        Ver cómo funciona
      </Button>
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent onCloseAutoFocus={returnFocus}>
            <DrawerHeader className="text-left">
              <DrawerTitle>Cómo se usa: {guide.title}</DrawerTitle>
              <DrawerDescription>{guide.intro}</DrawerDescription>
            </DrawerHeader>
            <div className="overflow-y-auto overscroll-contain px-4">
              <Examples guide={guide} />
            </div>
            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="outline">Entendido</Button>
              </DrawerClose>
            </DrawerFooter>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent onCloseAutoFocus={returnFocus} className="max-h-[85dvh] overflow-y-auto overscroll-contain sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Cómo se usa: {guide.title}</DialogTitle>
              <DialogDescription>{guide.intro}</DialogDescription>
            </DialogHeader>
            <Examples guide={guide} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function Examples({ guide }: { guide: Guide }) {
  return (
    <ol className="grid gap-3">
      {guide.examples.map((example, index) => (
        <li key={example.title} className="flex gap-3 rounded-lg bg-muted p-3">
          <span aria-hidden="true" className="grid size-6 shrink-0 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground tabular-nums">
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold">{example.title}</p>
            <p className="mt-0.5 text-sm text-pretty text-muted-foreground">{example.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
