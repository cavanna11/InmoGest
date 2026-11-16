'use client';

import { CalendarPlus, Eye, MoreVertical, Phone, SearchCheck } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { StartConversationButton } from '@/modules/whatsapp/components.tsx';

/**
 * Acciones de un contacto sin entrar a la ficha: escribir por WhatsApp y llamar a mano; agendar
 * visita y cargar qué busca en el menú. A quien pidió no ser contactado no se le ofrece escribir ni llamar.
 */
export function ContactActions({
  id,
  name,
  phone,
  doNotContact,
  canWrite,
}: {
  id: string;
  name: string;
  phone: string | null;
  doNotContact: boolean;
  canWrite: boolean;
}) {
  const reachable = !doNotContact;
  return (
    <div className="flex items-center justify-end gap-1.5">
      {canWrite && reachable && phone ? <StartConversationButton contactId={id} contactName={name} /> : null}
      {reachable && phone ? (
        <Button asChild variant="outline" size="icon" className="size-10 sm:size-9">
          <a href={`tel:${phone}`} aria-label={`Llamar a ${name}`} title="Llamar">
            <Phone aria-hidden="true" />
          </a>
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" className="size-10 sm:size-9" aria-label={`Más acciones de ${name}`}>
            <MoreVertical aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuItem asChild>
              <Link href={`/panel/contactos/${id}`}>
                <Eye aria-hidden="true" />
                Ver la ficha
              </Link>
            </DropdownMenuItem>
            {canWrite ? (
              <>
                <DropdownMenuItem asChild>
                  <Link href={`/panel/agenda?agendar=1&contacto=${id}`}>
                    <CalendarPlus aria-hidden="true" />
                    Agendar visita
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/panel/busquedas/nueva?contacto=${id}`}>
                    <SearchCheck aria-hidden="true" />
                    Cargar qué busca
                  </Link>
                </DropdownMenuItem>
              </>
            ) : null}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
