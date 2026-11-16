'use client';

import { Bookmark, BookmarkPlus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button.tsx';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog.tsx';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.tsx';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field.tsx';
import { Input } from '@/components/ui/input.tsx';
import { useLocalPreference } from './local-preference.ts';

type View = { name: string; query: string };

/**
 * Vistas guardadas de un listado (filtros y orden con un nombre). Se guardan en este navegador: no son
 * datos de la inmobiliaria y no tocan la base.
 */
export function SavedViews({ storageKey, basePath, query }: { storageKey: string; basePath: string; query: string }) {
  const router = useRouter();
  const [views, setViews] = useLocalPreference<View[]>(`inmopanel-vistas-${storageKey}`, []);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function save(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Poné un nombre para encontrarla después, por ejemplo “Alquileres en Palermo”.');
      return;
    }
    setViews([...views.filter((view) => view.name !== trimmed), { name: trimmed, query }]);
    setSaving(false);
    setName('');
    toast.success(`Vista “${trimmed}” guardada.`);
  }

  function remove(view: View) {
    const previous = views;
    setViews(views.filter((item) => item.name !== view.name));
    toast(`Vista “${view.name}” borrada.`, { action: { label: 'Deshacer', onClick: () => setViews(previous) } });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="h-9">
            <Bookmark aria-hidden="true" />
            Vistas
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {views.length > 0 ? (
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">Tus vistas</DropdownMenuLabel>
              {views.map((view) => (
                <DropdownMenuItem key={view.name} onSelect={() => router.push(view.query ? `${basePath}?${view.query}` : basePath)}>
                  <Bookmark aria-hidden="true" />
                  <span className="truncate">{view.name}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          ) : (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">Guardá los filtros que más usás para volver a ellos con un clic.</p>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setSaving(true)}>
            <BookmarkPlus aria-hidden="true" />
            Guardar los filtros actuales…
          </DropdownMenuItem>
          {views.length > 0 ? (
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <Trash2 aria-hidden="true" />
                Borrar una vista
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {views.map((view) => (
                  <DropdownMenuItem key={view.name} onSelect={() => remove(view)}>
                    {view.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={saving} onOpenChange={setSaving}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={save} noValidate className="grid gap-4">
            <DialogHeader>
              <DialogTitle>Guardar vista</DialogTitle>
              <DialogDescription>Guarda los filtros y el orden que estás usando ahora.</DialogDescription>
            </DialogHeader>
            <Field data-invalid={error ? true : undefined}>
              <FieldLabel htmlFor="view-name">Nombre</FieldLabel>
              <Input
                id="view-name"
                value={name}
                maxLength={40}
                autoComplete="off"
                placeholder="Alquileres en Palermo"
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'view-name-error' : 'view-name-hint'}
                onChange={(event) => {
                  setName(event.target.value);
                  setError('');
                }}
              />
              {error ? <FieldError id="view-name-error">{error}</FieldError> : <FieldDescription id="view-name-hint">Se guarda en este navegador.</FieldDescription>}
            </Field>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaving(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar vista</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
