'use client';

import { Bell, Building2, CalendarPlus, LogOut, Monitor, Moon, Plus, Search, Shield, Sun, UserRound, UserRoundPlus, Repeat } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { chooseTheme, useThemeChoice, type ThemeChoice } from '@/components/theme.tsx';
import { Button } from '@/components/ui/button.tsx';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Kbd } from '@/components/ui/kbd.tsx';
import { navigationGroups } from './navigation.ts';
import { globalSearchAction, type GlobalSearchResults } from './search-actions.ts';

const NO_RESULTS: GlobalSearchResults = { properties: [], contacts: [], conversations: [] };

// Acciones para crear, compartidas por el botón "Nueva" y la búsqueda global.
const CREATE_ACTIONS = [
  { href: '/panel/propiedades/nueva', label: 'Nueva propiedad', icon: Building2 },
  { href: '/panel/contactos/nuevo', label: 'Nuevo contacto', icon: UserRoundPlus },
  { href: '/panel/agenda?agendar=1', label: 'Agendar visita', icon: CalendarPlus },
] as const;

/** Búsqueda global (Ctrl+K): propiedades, contactos y conversaciones, más atajos a secciones y altas. */
export function GlobalSearch({ isOwner, canWrite }: { isOwner: boolean; canWrite: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [results, setResults] = useState<GlobalSearchResults>(NO_RESULTS);
  const [pending, startTransition] = useTransition();
  const latest = useRef('');

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Busca en el servidor con una pausa corta entre teclas; descarta respuestas viejas.
  useEffect(() => {
    const term = text.trim();
    latest.current = term;
    if (term.length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const found = await globalSearchAction(term);
          if (latest.current === term) setResults(found);
        } catch {
          // Sin conexión o error del servidor: se muestran los atajos y el aviso de "no encontramos".
          if (latest.current === term) setResults(NO_RESULTS);
        }
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [text]);

  const term = text.trim().toLowerCase();
  const shown = term.length < 2 ? NO_RESULTS : results;
  const sections = navigationGroups(isOwner)
    .flatMap((group) => group.items)
    .filter((item) => !term || item.label.toLowerCase().includes(term));
  const creates = canWrite ? CREATE_ACTIONS.filter((action) => !term || action.label.toLowerCase().includes(term)) : [];
  const found = shown.properties.length + shown.contacts.length + shown.conversations.length;

  function go(href: string) {
    setOpen(false);
    setText('');
    router.push(href);
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-9 justify-start gap-2 px-2.5 text-muted-foreground sm:w-full sm:max-w-sm sm:px-3"
      >
        <Search aria-hidden="true" />
        {/* El texto visible es también el nombre accesible (en el celular queda solo para lectores). */}
        <span className="sr-only truncate sm:not-sr-only">Buscar propiedad o contacto…</span>
        <Kbd className="ml-auto hidden md:inline-flex">Ctrl+K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Buscar en el panel"
        description="Propiedades, contactos, conversaciones y secciones."
        shouldFilter={false}
      >
        <CommandInput value={text} onValueChange={setText} placeholder="Escribí un nombre, teléfono, barrio o código…" />
        <CommandList>
          <CommandEmpty>
            {term.length >= 2 && pending ? 'Buscando…' : term.length >= 2 ? 'No encontramos nada con eso. Probá con otra palabra.' : 'Escribí al menos 2 letras.'}
          </CommandEmpty>
          <ResultGroup heading="Propiedades" items={shown.properties} onSelect={go} />
          <ResultGroup heading="Contactos" items={shown.contacts} onSelect={go} />
          <ResultGroup heading="Conversaciones de WhatsApp" items={shown.conversations} onSelect={go} />
          {creates.length > 0 ? (
            <CommandGroup heading="Crear">
              {creates.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} value={`crear ${label}`} onSelect={() => go(href)}>
                  <Icon aria-hidden="true" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
          {found === 0 || !term ? (
            <CommandGroup heading="Ir a">
              {sections.map(({ href, label, icon: Icon }) => (
                <CommandItem key={href} value={`ir ${label}`} onSelect={() => go(href)}>
                  <Icon aria-hidden="true" />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null}
        </CommandList>
        <p aria-live="polite" className="sr-only">
          {term.length >= 2 && !pending ? `${found} resultados` : ''}
        </p>
      </CommandDialog>
    </>
  );
}

function ResultGroup({ heading, items, onSelect }: { heading: string; items: GlobalSearchResults['properties']; onSelect: (href: string) => void }) {
  if (items.length === 0) return null;
  return (
    <CommandGroup heading={heading}>
      {items.map((item) => (
        <CommandItem key={item.id} value={`${heading}-${item.id}`} onSelect={() => onSelect(item.href)} className="grid gap-0.5">
          <span className="truncate font-medium">{item.title}</span>
          {item.detail ? <span className="truncate text-xs text-muted-foreground">{item.detail}</span> : null}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

/** Botón "Nueva": las altas más frecuentes, a un clic desde cualquier pantalla. */
export function NewMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-9" aria-label="Crear nueva">
          <Plus aria-hidden="true" />
          <span className="hidden sm:inline">Nueva</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          {CREATE_ACTIONS.map(({ href, label, icon: Icon }) => (
            <DropdownMenuItem key={href} asChild>
              <Link href={href}>
                <Icon aria-hidden="true" />
                {label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Campana con las notificaciones sin leer. */
export function NotificationsLink({ unread }: { unread: number }) {
  const label = unread > 0 ? `Notificaciones: ${unread} sin leer` : 'Notificaciones';
  return (
    <Button asChild variant="ghost" size="icon" className="relative size-9">
      <Link href="/panel/notificaciones" aria-label={label} title={label}>
        <Bell aria-hidden="true" />
        {unread > 0 ? (
          <span aria-hidden="true" className="absolute top-1 right-1 grid h-4 min-w-4 place-items-center rounded-full bg-highlight px-1 text-[10px] leading-none font-bold text-highlight-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}

const THEMES: Array<{ value: ThemeChoice; label: string; icon: typeof Sun }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Según el sistema', icon: Monitor },
];

/** Menú de la cuenta: perfil, modo de color, cambio de inmobiliaria, plataforma (C&C) y salir. */
export function UserMenu({
  name,
  email,
  canSwitch,
  isPlatformAdmin,
  signOut,
}: {
  name: string;
  email: string;
  canSwitch: boolean;
  isPlatformAdmin: boolean;
  signOut: () => Promise<void>;
}) {
  const theme = useThemeChoice();
  const signOutForm = useRef<HTMLFormElement>(null);
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?';
  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 rounded-full" aria-label={`Tu cuenta: ${name}`}>
          <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground">
            {initials}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="grid font-normal">
          <span className="truncate font-medium">{name}</span>
          <span className="truncate text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/panel/perfil">
              <UserRound aria-hidden="true" />
              Mi perfil
            </Link>
          </DropdownMenuItem>
          {canSwitch ? (
            <DropdownMenuItem asChild>
              <Link href="/seleccionar-inmobiliaria">
                <Repeat aria-hidden="true" />
                Cambiar de inmobiliaria
              </Link>
            </DropdownMenuItem>
          ) : null}
          {isPlatformAdmin ? (
            <DropdownMenuItem asChild>
              <Link href="/plataforma">
                <Shield aria-hidden="true" />
                Plataforma C&amp;C
              </Link>
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">Modo de color</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={(value) => chooseTheme(value as ThemeChoice)}>
          {THEMES.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon aria-hidden="true" />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        {/* El formulario vive fuera del menú: al elegir "Salir" el menú se cierra y se desmonta. */}
        <DropdownMenuItem onSelect={() => signOutForm.current?.requestSubmit()}>
          <LogOut aria-hidden="true" />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <form ref={signOutForm} action={signOut} hidden />
    </>
  );
}
