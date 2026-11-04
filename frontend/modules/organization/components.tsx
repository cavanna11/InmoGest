'use client';

import { useActionState, useState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { describedBy, Field, Input, Select } from '@/components/ui/form-controls.tsx';
import { Alert } from '@/components/ui/surfaces.tsx';
import { idle } from '@/lib/action.ts';
import { updateOrganizationAction, uploadLogoAction } from './actions.ts';

export type OrganizationFormValues = {
  name: string;
  slug: string;
  contactEmail: string;
  contactPhone: string;
  defaultCurrency: string;
  agentsCanReassign: boolean;
  usdRateEnabled: boolean;
  usdRate: number | null;
};

export function OrganizationSettingsForm({ values, disabled }: { values: OrganizationFormValues; disabled: boolean }) {
  const [state, action] = useActionState(updateOrganizationAction, idle);
  const [slug, setSlug] = useState(values.slug);
  const e = state.fieldErrors ?? {};
  const slugChanged = slug.trim() !== values.slug;
  const slugHint = 'Se usa en las direcciones públicas de tus propiedades: /p/tu-inmobiliaria/…';

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <fieldset disabled={disabled} className="grid gap-4">
        <Field id="name" label="Nombre de la inmobiliaria" error={e.name}>
          <Input id="name" name="name" defaultValue={values.name} required aria-invalid={e.name ? true : undefined} aria-describedby={describedBy('name', { error: e.name })} />
        </Field>
        <Field id="slug" label="Dirección pública" hint={slugHint} error={e.slug}>
          <Input
            id="slug"
            name="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={e.slug ? true : undefined}
            aria-describedby={describedBy('slug', { hint: slugHint, error: e.slug })}
          />
        </Field>
        {slugChanged ? (
          <Alert variant="warning">
            Al cambiar la dirección cambia la URL pública de la inmobiliaria. Los enlaces con la dirección anterior van a
            redirigir a la nueva, y la anterior queda reservada para tu inmobiliaria.
          </Alert>
        ) : null}
        <Field id="contactEmail" label="Email de contacto (opcional)" error={e.contactEmail}>
          <Input id="contactEmail" name="contactEmail" type="email" defaultValue={values.contactEmail} aria-invalid={e.contactEmail ? true : undefined} aria-describedby={describedBy('contactEmail', { error: e.contactEmail })} />
        </Field>
        <Field id="contactPhone" label="Teléfono de contacto (opcional)" hint="Con característica, por ejemplo 11 2345-6789." error={e.contactPhone}>
          <Input id="contactPhone" name="contactPhone" type="tel" defaultValue={values.contactPhone} aria-invalid={e.contactPhone ? true : undefined} aria-describedby={describedBy('contactPhone', { hint: true, error: e.contactPhone })} />
        </Field>
        <Field id="defaultCurrency" label="Moneda por defecto" error={e.defaultCurrency}>
          <Select id="defaultCurrency" name="defaultCurrency" defaultValue={values.defaultCurrency}>
            <option value="ARS">Pesos (ARS)</option>
            <option value="USD">Dólares (USD)</option>
          </Select>
        </Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="agentsCanReassign" defaultChecked={values.agentsCanReassign} className="mt-0.5 size-4 accent-primary" />
          <span>Los agentes pueden reasignar contactos, conversaciones y tareas a otros agentes.</span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="usdRateEnabled" defaultChecked={values.usdRateEnabled} className="mt-0.5 size-4 accent-primary" />
          <span>Comparar búsquedas y propiedades en distinta moneda usando una cotización manual.</span>
        </label>
        <Field id="usdRate" label="Cotización USD/ARS" hint="Pesos por dólar. Solo se usa si la opción anterior está habilitada." error={e.usdRate}>
          <Input id="usdRate" name="usdRate" inputMode="decimal" defaultValue={values.usdRate ?? ''} />
        </Field>
        <div>
          <SubmitButton>Guardar cambios</SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}

export function LogoForm({ currentLogoUrl, disabled }: { currentLogoUrl: string | null; disabled: boolean }) {
  const [state, action] = useActionState(uploadLogoAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      {currentLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logo subido por la inmobiliaria, tamaño chico; sin optimización de imágenes por ahora
        <img src={currentLogoUrl} alt="Logo actual" className="h-16 w-auto max-w-48 rounded-md border border-border bg-background object-contain p-2" />
      ) : (
        <p className="text-sm text-muted-foreground">Todavía no cargaste un logo.</p>
      )}
      <fieldset disabled={disabled} className="grid gap-4">
        <Field id="logo" label="Imagen del logo" hint="PNG, JPG o WebP, hasta 2 MB." error={e.logo}>
          <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" aria-invalid={e.logo ? true : undefined} aria-describedby={describedBy('logo', { hint: true, error: e.logo })} />
        </Field>
        <div>
          <SubmitButton variant="outline" pendingLabel="Subiendo…">
            Subir logo
          </SubmitButton>
        </div>
      </fieldset>
    </form>
  );
}
