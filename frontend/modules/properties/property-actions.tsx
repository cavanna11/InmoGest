'use client';

import { CalendarPlus, Copy, Eye, MessageCircle, MoreVertical, RefreshCw, Store } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { setPropertyStatusAction } from './actions.ts';
import { STATUS_LABELS, type PropertyStatus } from './labels.ts';

/**
 * Acciones de una propiedad sin entrar a la ficha: ver, mandar por WhatsApp, agendar visita, copiar
 * el link de su página, publicar en Mercado Libre y cambiar el estado (con "Deshacer").
 */
export function PropertyActions({
  id,
  title,
  status,
  publicUrl,
  canWrite,
  mercadoLibre,
}: {
  id: string;
  title: string;
  status: PropertyStatus;
  publicUrl: string | null;
  canWrite: boolean;
  mercadoLibre: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const isPublic = status !== 'draft' && status !== 'paused';

  function changeStatus(next: PropertyStatus, previous: PropertyStatus, undo = false) {
    startTransition(async () => {
      const result = await setPropertyStatusAction(id, next);
      if (result.status === 'error') {
        toast.error(result.message ?? 'No se pudo cambiar el estado.');
        return;
      }
      if (undo) toast.success('Listo, quedó como antes.');
      else toast.success(`${title}: ${STATUS_LABELS[next]}.`, { action: { label: 'Deshacer', onClick: () => changeStatus(previous, next, true) } });
    });
  }

  async function copyLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      toast.success('Link copiado. Pegalo donde quieras compartirlo.');
    } catch {
      toast.error('No se pudo copiar. Abrí la ficha y copialo desde “Dónde está publicada”.');
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="secondary" size="icon" className="size-10 shadow-sm sm:size-9" aria-label={`Acciones de ${title}`} disabled={pending}>
          <MoreVertical aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href={`/panel/propiedades/${id}`}>
              <Eye aria-hidden="true" />
              Ver la ficha
            </Link>
          </DropdownMenuItem>
          {canWrite && isPublic ? (
            <DropdownMenuItem asChild>
              <Link href={`/panel/propiedades/${id}#enviar`}>
                <MessageCircle aria-hidden="true" />
                Enviar por WhatsApp
              </Link>
            </DropdownMenuItem>
          ) : null}
          {canWrite ? (
            <DropdownMenuItem asChild>
              <Link href={`/panel/agenda?agendar=1&propiedad=${id}`}>
                <CalendarPlus aria-hidden="true" />
                Agendar visita
              </Link>
            </DropdownMenuItem>
          ) : null}
          {publicUrl && isPublic ? (
            <DropdownMenuItem onSelect={copyLink}>
              <Copy aria-hidden="true" />
              Copiar link de la página
            </DropdownMenuItem>
          ) : null}
          {canWrite && mercadoLibre && isPublic ? (
            <DropdownMenuItem asChild>
              <Link href={`/panel/propiedades/${id}/mercadolibre`}>
                <Store aria-hidden="true" />
                Publicar en Mercado Libre
              </Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        {canWrite ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <RefreshCw aria-hidden="true" />
                Cambiar estado
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuRadioGroup value={status} onValueChange={(value) => value !== status && changeStatus(value as PropertyStatus, status)}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <DropdownMenuRadioItem key={value} value={value}>
                      {label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
