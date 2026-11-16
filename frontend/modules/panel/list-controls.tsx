'use client';

import { Loader2, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button.tsx';
import { Field, FieldLabel } from '@/components/ui/field.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet.tsx';
import { SavedViews } from './saved-views.tsx';

const ALL = 'todos';

export type ListFilter = { key: string; label: string; all: string; options: Record<string, string> };

/**
 * Búsqueda, filtros y orden de un listado. Se aplican solos (sin botón "Filtrar") y quedan en la URL,
 * así se pueden compartir o guardar como vista. En el celular, los filtros van en un panel.
 * `params` trae los valores actuales de la URL: `q`, `orden`, cada filtro y lo que haya que conservar
 * (por ejemplo, la vista "Para retomar").
 */
export function ListControls({
  params,
  filters,
  sorts,
  storageKey,
  searchLabel,
  searchPlaceholder,
}: {
  params: Record<string, string>;
  filters: ListFilter[];
  sorts: Record<string, string>;
  storageKey: string;
  searchLabel: string;
  searchPlaceholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(params.q ?? '');
  const lastSent = useRef(params.q ?? '');
  const defaultSort = Object.keys(sorts)[0] ?? '';

  function toQuery(values: Record<string, string>): string {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(values)) {
      if (value && value !== ALL && !(key === 'orden' && value === defaultSort)) query.set(key, value);
    }
    return query.toString();
  }

  function apply(next: Record<string, string>) {
    const query = toQuery({ ...params, q: text, ...next });
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  // La búsqueda por texto se aplica sola, con una pausa corta entre teclas.
  useEffect(() => {
    if (text === lastSent.current) return;
    const timer = setTimeout(() => {
      lastSent.current = text;
      apply({ q: text });
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo reacciona al texto
  }, [text]);

  const active = filters.filter(({ key }) => params[key]).length;
  // Se dibujan dos veces (barra en la compu, panel en el celular): cada copia con sus propios ids.
  const selects = (place: string) =>
    filters.map(({ key, label, all, options }) => (
      <Field key={key} className="gap-1.5 lg:w-auto">
        <FieldLabel htmlFor={`${place}-${key}`} className="text-xs text-muted-foreground lg:hidden">
          {label}
        </FieldLabel>
        <Select value={params[key] || ALL} onValueChange={(value) => apply({ [key]: value === ALL ? '' : value })}>
          <SelectTrigger id={`${place}-${key}`} className="w-full lg:w-40" aria-label={label}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={ALL}>{all}</SelectItem>
              {Object.entries(options).map(([value, optionLabel]) => (
                <SelectItem key={value} value={value}>
                  {optionLabel}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    ));
  const sort = (place: string) =>
    Object.keys(sorts).length > 1 ? (
      <Field className="gap-1.5 lg:w-auto">
        <FieldLabel htmlFor={`${place}-orden`} className="text-xs text-muted-foreground lg:hidden">
          Ordenar
        </FieldLabel>
        <Select value={params.orden || defaultSort} onValueChange={(value) => apply({ orden: value })}>
          <SelectTrigger id={`${place}-orden`} className="w-full lg:w-48" aria-label="Ordenar">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {Object.entries(sorts).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    ) : null;

  function clear() {
    setText('');
    lastSent.current = '';
    const keep = Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'q' && !filters.some((filter) => filter.key === key)));
    const query = toQuery(keep);
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return (
    <div className="grid gap-3" aria-busy={pending}>
      <div className="flex flex-wrap items-center gap-2">
        <div role="search" className="relative min-w-0 flex-1 basis-56">
          <label htmlFor="q" className="sr-only">
            {searchLabel}
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="q"
            type="search"
            inputMode="search"
            autoComplete="off"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                lastSent.current = text;
                apply({ q: text });
              }
            }}
            placeholder={searchPlaceholder}
            className="h-9 pl-9"
          />
        </div>

        <Sheet>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" className="h-9 lg:hidden">
              <SlidersHorizontal aria-hidden="true" />
              Filtros
              {active > 0 ? <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{active}</span> : null}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtrar y ordenar</SheetTitle>
              <SheetDescription>Los cambios se aplican al instante.</SheetDescription>
            </SheetHeader>
            <div className="grid gap-4 px-4 pb-6">
              {selects('panel')}
              {sort('panel')}
            </div>
          </SheetContent>
        </Sheet>

        <div className="hidden flex-wrap items-center gap-2 lg:flex">
          {selects('barra')}
          {sort('barra')}
        </div>
        <SavedViews storageKey={storageKey} basePath={pathname} query={toQuery({ ...params, q: text })} />
      </div>

      <div className="flex min-h-5 flex-wrap items-center gap-2 text-sm">
        {active > 0 || params.q ? (
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={clear}>
            <X aria-hidden="true" />
            Limpiar filtros
          </Button>
        ) : null}
        <span aria-live="polite" className="flex items-center gap-1.5 text-muted-foreground">
          {pending ? (
            <>
              <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> Actualizando…
            </>
          ) : null}
        </span>
      </div>
    </div>
  );
}
