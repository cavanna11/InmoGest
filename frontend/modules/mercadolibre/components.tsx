'use client';

import type { AttributeValue, MlAttributeDefinition, MlListingSettings, MlNamed } from '@inmogest/shared';
import { useActionState, useState, useTransition } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Field, Input, Select } from '@/components/ui/form-controls.tsx';
import { Alert } from '@/components/ui/surfaces.tsx';
import { idle } from '@/lib/action.ts';
import { mercadoLibreLocationsAction, publishMercadoLibreAction, syncMercadoLibreAction } from './actions.ts';

type Location = { state?: MlNamed | undefined; city?: MlNamed | undefined; neighborhood?: MlNamed | undefined };

function numberPart(value: string | undefined): string {
  return value?.split(' ')[0] ?? '';
}

/** Un atributo de la categoría, según su tipo: lista de valores, número con unidad, número o texto. */
function AttributeInput({
  definition,
  value,
  onChange,
}: {
  definition: MlAttributeDefinition;
  value: AttributeValue | undefined;
  onChange: (value: AttributeValue | undefined) => void;
}) {
  const id = `attr-${definition.id}`;
  const label = `${definition.name}${definition.required ? '' : ' (opcional)'}`;
  if (definition.values.length > 0) {
    return (
      <Field id={id} label={label}>
        <Select
          id={id}
          value={value?.value_id ?? ''}
          required={definition.required}
          onChange={(event) => onChange(event.target.value ? { value_id: event.target.value } : undefined)}
        >
          <option value="">Elegí una opción</option>
          {definition.values.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </Select>
      </Field>
    );
  }
  const unit = definition.valueType === 'number_unit' ? (definition.defaultUnit ?? definition.units[0] ?? '') : '';
  const numeric = definition.valueType === 'number' || definition.valueType === 'number_unit';
  return (
    <Field id={id} label={unit ? `${label} (${unit})` : label}>
      <Input
        id={id}
        inputMode={numeric ? 'decimal' : 'text'}
        required={definition.required}
        defaultValue={unit ? numberPart(value?.value_name) : (value?.value_name ?? '')}
        onChange={(event) => {
          const text = event.target.value.trim();
          onChange(text ? { value_name: unit ? `${text} ${unit}` : text } : undefined);
        }}
      />
    </Field>
  );
}

/**
 * Configuración y envío de la publicación: tipo de publicación, ubicación de Mercado Libre y los
 * atributos obligatorios que InmoPanel no completa solo.
 */
export function MercadoLibrePublishForm({
  propertyId,
  categoryId,
  listingTypes,
  definitions,
  automatic,
  states,
  initialCities,
  initialNeighborhoods,
  initial,
  published,
}: {
  propertyId: string;
  categoryId: string;
  listingTypes: MlNamed[];
  definitions: MlAttributeDefinition[];
  /** Nombres de los atributos que se completan con los datos de la propiedad. */
  automatic: string[];
  states: MlNamed[];
  initialCities: MlNamed[];
  initialNeighborhoods: MlNamed[];
  initial: MlListingSettings;
  published: boolean;
}) {
  const [state, action] = useActionState(publishMercadoLibreAction, idle);
  const [listingType, setListingType] = useState(initial.listing_type_id ?? listingTypes[0]?.id ?? '');
  const [location, setLocation] = useState<Location>(initial.location ?? {});
  const [cities, setCities] = useState(initialCities);
  const [neighborhoods, setNeighborhoods] = useState(initialNeighborhoods);
  const [attributes, setAttributes] = useState<Record<string, AttributeValue>>(initial.attributes ?? {});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();

  const pick = (list: MlNamed[], id: string) => list.find((item) => item.id === id);

  function chooseState(id: string) {
    const chosen = pick(states, id);
    setLocation({ state: chosen });
    setCities([]);
    setNeighborhoods([]);
    if (!chosen) return;
    startLoading(async () => {
      const result = await mercadoLibreLocationsAction('state', chosen.id);
      setLoadError(result.error ?? null);
      setCities(result.options);
    });
  }

  function chooseCity(id: string) {
    const chosen = pick(cities, id);
    setLocation((current) => ({ state: current.state, city: chosen }));
    setNeighborhoods([]);
    if (!chosen) return;
    startLoading(async () => {
      const result = await mercadoLibreLocationsAction('city', chosen.id);
      setLoadError(result.error ?? null);
      setNeighborhoods(result.options);
    });
  }

  const settings: MlListingSettings = {
    category_id: categoryId,
    listing_type_id: listingType,
    location,
    attributes: Object.fromEntries(Object.entries(attributes).filter(([, value]) => value.value_id || value.value_name)),
  };
  const required = definitions.filter((definition) => definition.required);
  const optional = definitions.filter((definition) => !definition.required);

  return (
    <form action={action} className="grid gap-6" noValidate>
      <input type="hidden" name="propertyId" value={propertyId} />
      <input type="hidden" name="settings" value={JSON.stringify(settings)} />
      <FormMessage state={state} />

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-base font-semibold">Tipo de publicación</legend>
        <Field id="listingType" label="Tipo" hint="Usa el cupo de los paquetes de publicación que contrataste en Mercado Libre.">
          <Select id="listingType" value={listingType} onChange={(event) => setListingType(event.target.value)} disabled={published}>
            {listingTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </Select>
        </Field>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-base font-semibold">Ubicación en Mercado Libre</legend>
        {loadError ? <Alert variant="destructive">{loadError}</Alert> : null}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="ml-state" label="Provincia o zona">
            <Select id="ml-state" value={location.state?.id ?? ''} onChange={(event) => chooseState(event.target.value)}>
              <option value="">Elegí una opción</option>
              {states.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="ml-city" label="Ciudad o partido">
            <Select id="ml-city" value={location.city?.id ?? ''} onChange={(event) => chooseCity(event.target.value)} disabled={cities.length === 0}>
              <option value="">{loading && !location.city ? 'Cargando…' : 'Elegí una opción'}</option>
              {cities.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="ml-neighborhood" label="Barrio o localidad">
            <Select
              id="ml-neighborhood"
              value={location.neighborhood?.id ?? ''}
              onChange={(event) => setLocation((current) => ({ ...current, neighborhood: pick(neighborhoods, event.target.value) }))}
              disabled={neighborhoods.length === 0}
            >
              <option value="">{loading && location.city ? 'Cargando…' : 'Elegí una opción'}</option>
              {neighborhoods.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="mb-2 text-base font-semibold">Datos que pide Mercado Libre</legend>
        {automatic.length > 0 ? (
          <p className="text-sm text-muted-foreground">Se completan con los datos de la propiedad: {automatic.join(', ')}.</p>
        ) : null}
        {required.length === 0 ? <p className="text-sm text-muted-foreground">No hace falta cargar nada más.</p> : null}
        <div className="grid gap-4 sm:grid-cols-2">
          {required.map((definition) => (
            <AttributeInput
              key={definition.id}
              definition={definition}
              value={attributes[definition.id]}
              onChange={(value) =>
                setAttributes((current) => {
                  const next = { ...current };
                  if (value) next[definition.id] = value;
                  else delete next[definition.id];
                  return next;
                })
              }
            />
          ))}
        </div>
        {optional.length > 0 ? (
          <details className="rounded-md border border-border p-3">
            <summary className="cursor-pointer text-sm font-medium">Más datos opcionales ({optional.length})</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {optional.map((definition) => (
                <AttributeInput
                  key={definition.id}
                  definition={definition}
                  value={attributes[definition.id]}
                  onChange={(value) =>
                    setAttributes((current) => {
                      const next = { ...current };
                      if (value) next[definition.id] = value;
                      else delete next[definition.id];
                      return next;
                    })
                  }
                />
              ))}
            </div>
          </details>
        ) : null}
      </fieldset>

      <div>
        <SubmitButton pendingLabel={published ? 'Actualizando…' : 'Publicando…'}>
          {published ? 'Guardar y actualizar en Mercado Libre' : 'Publicar en Mercado Libre'}
        </SubmitButton>
      </div>
    </form>
  );
}

/** Vuelve a mandar la propiedad a Mercado Libre. */
export function MercadoLibreSyncButton({ propertyId }: { propertyId: string }) {
  const [state, action] = useActionState(syncMercadoLibreAction, idle);
  return (
    <form action={action} className="grid gap-2">
      <input type="hidden" name="propertyId" value={propertyId} />
      <FormMessage state={state} />
      <div>
        <SubmitButton variant="outline" pendingLabel="Sincronizando…">
          Sincronizar ahora
        </SubmitButton>
      </div>
    </form>
  );
}
