'use client';

import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { describedBy, Field, Input, Label, Select } from '@/components/ui/form-controls.tsx';
import { idle } from '@/lib/action.ts';
import { FEATURES, OPERATION_LABELS, TYPE_LABELS } from '../properties/labels.ts';
import { addStageAction, saveSearchAction } from './actions.ts';

type Member = { userId: string; name: string };

export type SearchFormValues = {
  id?: string;
  contactId: string;
  operation: string;
  propertyTypes: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  currency: string;
  tolerance: number;
  minRooms: number | null;
  minBedrooms: number | null;
  locations: string;
  required: string[];
  desired: string[];
  notes: string;
  assignedUserId: string | null;
};

function amountValue(value: number | null): string {
  return value === null ? '' : new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid min-w-0 gap-4 rounded-lg border border-border p-4 sm:p-5">
      <legend className="px-1 text-sm font-semibold text-primary">{title}</legend>
      {children}
    </fieldset>
  );
}

function Checks({ name, options, selected, label }: { name: string; options: Record<string, string>; selected: string[]; label: string }) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-2 gap-1 sm:grid-cols-4">
      {Object.entries(options).map(([value, text]) => (
        <label key={value} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary-soft/50">
          <input type="checkbox" name={name} value={value} defaultChecked={selected.includes(value)} className="size-4 accent-[var(--primary)]" />
          {text}
        </label>
      ))}
    </div>
  );
}

export function SearchForm({
  values,
  members,
  canReassign,
  currentUserId,
}: {
  values: SearchFormValues;
  members: Member[];
  canReassign: boolean;
  currentUserId: string;
}) {
  const [state, action] = useActionState(saveSearchAction, idle);
  const e = state.fieldErrors ?? {};
  const assignable = canReassign ? members : members.filter((member) => member.userId === currentUserId || member.userId === values.assignedUserId);
  return (
    <form action={action} className="grid gap-6" noValidate>
      <FormMessage state={state} />
      {values.id ? <input type="hidden" name="searchId" value={values.id} /> : null}
      <input type="hidden" name="contactId" value={values.contactId} />

      <Group title="Qué busca (obligatorio)">
        <Field id="operation" label="Operación" error={e.operation}>
          <Select id="operation" name="operation" defaultValue={values.operation}>
            {Object.entries(OPERATION_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-2">
          <Label>Tipo de propiedad</Label>
          <Checks name="propertyTypes" label="Tipo de propiedad" options={TYPE_LABELS} selected={values.propertyTypes} />
          {e.propertyTypes ? (
            <p className="text-sm text-destructive" role="alert">
              {e.propertyTypes}
            </p>
          ) : null}
        </div>
        <Field id="locations" label="Zonas" hint="Barrios o localidades separados por coma. Vacío: cualquier zona." error={e.locations}>
          <Input id="locations" name="locations" defaultValue={values.locations} placeholder="Belgrano, Núñez, Colegiales" aria-describedby={describedBy('locations', { hint: true, error: e.locations })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-4">
          <Field id="budgetMin" label="Presupuesto mínimo" error={e.budgetMin}>
            <Input id="budgetMin" name="budgetMin" inputMode="decimal" defaultValue={amountValue(values.budgetMin)} />
          </Field>
          <Field id="budgetMax" label="Presupuesto máximo" error={e.budgetMax}>
            <Input id="budgetMax" name="budgetMax" inputMode="decimal" defaultValue={amountValue(values.budgetMax)} placeholder="100.000" />
          </Field>
          <Field id="currency" label="Moneda">
            <Select id="currency" name="currency" defaultValue={values.currency}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </Select>
          </Field>
          <Field id="tolerance" label="Tolerancia (%)" error={e.tolerance}>
            <Input id="tolerance" name="tolerance" inputMode="decimal" defaultValue={String(values.tolerance)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="minRooms" label="Ambientes mínimos" error={e.minRooms}>
            <Input id="minRooms" name="minRooms" inputMode="numeric" defaultValue={values.minRooms ?? ''} />
          </Field>
          <Field id="minBedrooms" label="Dormitorios mínimos" error={e.minBedrooms}>
            <Input id="minBedrooms" name="minBedrooms" inputMode="numeric" defaultValue={values.minBedrooms ?? ''} />
          </Field>
        </div>
        <div className="grid gap-2">
          <Label>Características requeridas</Label>
          <Checks name="required" label="Características requeridas" options={FEATURES} selected={values.required} />
        </div>
      </Group>

      <Group title="Qué le gustaría (define el puntaje)">
        <Checks name="desired" label="Características deseadas" options={FEATURES} selected={values.desired} />
      </Group>

      <Group title="Seguimiento">
        <Field id="assignedUserId" label="Agente a cargo" hint={canReassign ? undefined : 'Solo el dueño puede asignarla a otra persona.'}>
          <Select id="assignedUserId" name="assignedUserId" defaultValue={values.assignedUserId ?? (values.id ? '' : currentUserId)}>
            <option value="">Sin asignar</option>
            {assignable.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-2">
          <Label htmlFor="notes">Notas</Label>
          <textarea
            id="notes"
            name="notes"
            defaultValue={values.notes}
            maxLength={2000}
            className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
          />
        </div>
      </Group>

      <SubmitButton className="justify-self-start">{values.id ? 'Guardar cambios' : 'Crear búsqueda'}</SubmitButton>
    </form>
  );
}

export function AddStageForm() {
  const [state, action] = useActionState(addStageAction, idle);
  return (
    <form action={action} className="grid gap-3" noValidate>
      <FormMessage state={state} />
      <Field id="stage-name" label="Nueva etapa" error={state.fieldErrors?.name}>
        <Input id="stage-name" name="name" maxLength={60} placeholder="Ej.: Tasación pendiente" />
      </Field>
      <SubmitButton variant="outline" size="sm" className="justify-self-start">
        Agregar etapa
      </SubmitButton>
    </form>
  );
}
