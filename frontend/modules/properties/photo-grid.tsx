'use client';

import { Star, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
import { Badge } from '@/components/ui/surfaces.tsx';
import { deleteImageAction, setCoverAction } from './actions.ts';

type Photo = { id: string; url: string };

const UNDO_MS = 6000;

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

/**
 * Fotos de la propiedad. Borrar no pide confirmación: la foto desaparece y durante unos segundos se
 * puede deshacer; recién después se borra de verdad (también si salís de la página antes).
 */
export function PhotoGrid({ propertyId, photos, canWrite }: { propertyId: string; photos: Photo[]; canWrite: boolean }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();
  const pending = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  // Al salir de la página se confirman los borrados que quedaron pendientes.
  useEffect(() => {
    const timers = pending.current;
    return () => {
      for (const [imageId, timer] of timers) {
        clearTimeout(timer);
        void deleteImageAction(form({ imageId, propertyId }));
      }
      timers.clear();
    };
  }, [propertyId]);

  function remove(photo: Photo, position: number) {
    setHidden((current) => new Set(current).add(photo.id));
    const timer = setTimeout(() => {
      pending.current.delete(photo.id);
      startTransition(() => deleteImageAction(form({ imageId: photo.id, propertyId })));
    }, UNDO_MS);
    pending.current.set(photo.id, timer);
    toast(`Foto ${position} borrada.`, {
      duration: UNDO_MS,
      action: {
        label: 'Deshacer',
        onClick: () => {
          clearTimeout(pending.current.get(photo.id));
          pending.current.delete(photo.id);
          setHidden((current) => {
            const next = new Set(current);
            next.delete(photo.id);
            return next;
          });
        },
      },
    });
  }

  const visible = photos.filter((photo) => !hidden.has(photo.id));
  if (visible.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no tiene fotos. Las propiedades con fotos se consultan mucho más.</p>;
  }
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {visible.map((photo, index) => (
        <li key={photo.id} className="relative overflow-hidden rounded-md border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element -- fotos de Storage, sin optimizador configurado */}
          <img src={photo.url} alt={`Foto ${index + 1}`} width={400} height={300} className="aspect-[4/3] w-full object-cover" loading={index < 3 ? 'eager' : 'lazy'} />
          {index === 0 ? (
            <span className="absolute top-1.5 left-1.5">
              <Badge variant="highlight">Portada</Badge>
            </span>
          ) : null}
          {canWrite ? (
            <div className="flex justify-end gap-1 bg-surface p-1">
              {index > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-10 sm:size-8"
                  aria-label={`Usar la foto ${index + 1} como portada`}
                  title="Usar como portada"
                  onClick={() => startTransition(() => setCoverAction(form({ imageId: photo.id, propertyId })))}
                >
                  <Star aria-hidden="true" />
                </Button>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 sm:size-8"
                aria-label={`Borrar la foto ${index + 1}`}
                title="Borrar"
                onClick={() => remove(photo, index + 1)}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
