'use client';

import Link from 'next/link';
import { useActionState, useRef, useState, useTransition } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Button } from '@/components/ui/button.tsx';
import { describedBy, Field, Input, Label, Select } from '@/components/ui/form-controls.tsx';
import { Alert } from '@/components/ui/surfaces.tsx';
import { idle, type FormState } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/browser.ts';
import { createPropertyAction, findDuplicatesAction, registerImagesAction, updatePropertyAction } from './actions.ts';
import { IMAGE_MAX_BYTES, IMAGE_TYPES, IMAGES_BUCKET } from './images.ts';
import type { PropertyFormValues } from './form-values.ts';
import { FEATURES, OPERATION_LABELS, STATUS_LABELS, TYPE_LABELS } from './labels.ts';

type Member = { userId: string; name: string };

const textareaClasses =
  'flex min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm';

/** Monto para el campo: formato argentino sin moneda (98.000 · 1.234,50). */
function amountValue(value: number | null): string {
  if (value === null) return '';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-lg border border-border p-4 sm:p-5">
      <legend className="px-1 text-sm font-semibold text-primary">{title}</legend>
      {children}
    </fieldset>
  );
}

function TextInput({ name, label, defaultValue, error, ...props }: { name: string; label: string; defaultValue?: string | number | null; error?: string | undefined } & Omit<React.ComponentProps<'input'>, 'defaultValue'>) {
  return (
    <Field id={name} label={label} error={error}>
      <Input
        id={name}
        name={name}
        defaultValue={defaultValue ?? ''}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={describedBy(name, { error })}
        {...props}
      />
    </Field>
  );
}

type Duplicate = { id: string; code: string; title: string; reason: string };

export function PropertyForm({
  values,
  members,
  canReassign,
  currentUserId,
}: {
  values: PropertyFormValues;
  members: Member[];
  canReassign: boolean;
  currentUserId: string;
}) {
  const editing = Boolean(values.id);
  const [state, action] = useActionState(editing ? updatePropertyAction : createPropertyAction, idle);
  const e = state.fieldErrors ?? {};
  const formRef = useRef<HTMLFormElement>(null);
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [, startTransition] = useTransition();
  const assignable = canReassign ? members : members.filter((member) => member.userId === currentUserId || member.userId === values.assigned_user_id);

  // Aviso de posible duplicado al completar la dirección o cambiar operación o tipo (no impide guardar).
  function checkDuplicates() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    startTransition(async () => {
      setDuplicates(
        await findDuplicatesAction({
          address: String(data.get('address') ?? ''),
          operation: String(data.get('operation') ?? ''),
          propertyType: String(data.get('propertyType') ?? ''),
          excludeId: values.id,
        }),
      );
    });
  }

  return (
    <form ref={formRef} action={action} className="grid gap-6" noValidate>
      <FormMessage state={state} />
      {values.id ? <input type="hidden" name="propertyId" value={values.id} /> : null}

      <Section title="Datos principales">
        <TextInput name="title" label="Título" defaultValue={values.title} error={e.title} required maxLength={120} placeholder="Ej.: Departamento 3 ambientes con balcón" />
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="operation" label="Operación" error={e.operation}>
            <Select id="operation" name="operation" defaultValue={values.operation} onChange={checkDuplicates}>
              {Object.entries(OPERATION_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="propertyType" label="Tipo" error={e.propertyType}>
            <Select id="propertyType" name="propertyType" defaultValue={values.property_type} onChange={checkDuplicates}>
              {Object.entries(TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="status" label="Estado" error={e.status} hint="En borrador o pausada no se publica.">
            <Select id="status" name="status" defaultValue={values.status} aria-describedby="status-hint">
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <TextInput name="price" label="Precio" defaultValue={amountValue(values.price)} error={e.price} inputMode="decimal" placeholder="98.000" />
          <Field id="currency" label="Moneda">
            <Select id="currency" name="currency" defaultValue={values.currency}>
              <option value="USD">USD</option>
              <option value="ARS">ARS</option>
            </Select>
          </Field>
          <TextInput name="expenses" label="Expensas (opcional)" defaultValue={amountValue(values.expenses)} error={e.expenses} inputMode="decimal" />
          <Field id="expensesCurrency" label="Moneda">
            <Select id="expensesCurrency" name="expensesCurrency" defaultValue={values.expenses_currency}>
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </Select>
          </Field>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="description">Descripción</Label>
          <textarea id="description" name="description" defaultValue={values.description} maxLength={8000} className={textareaClasses} />
        </div>
      </Section>

      <Section title="Ubicación">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput name="province" label="Provincia" defaultValue={values.province} error={e.province} maxLength={80} />
          <TextInput name="city" label="Localidad" defaultValue={values.city} error={e.city} maxLength={80} />
          <TextInput name="neighborhood" label="Barrio" defaultValue={values.neighborhood} error={e.neighborhood} maxLength={80} />
        </div>
        <TextInput name="address" label="Dirección" defaultValue={values.address} error={e.address} maxLength={160} onBlur={checkDuplicates} placeholder="Calle, número, piso y depto." />
        {duplicates.length > 0 ? (
          <Alert variant="warning">
            <p className="font-medium">Puede que esta propiedad ya esté cargada:</p>
            <ul className="mt-1 list-disc pl-5">
              {duplicates.map((duplicate) => (
                <li key={duplicate.id}>
                  <Link href={`/panel/propiedades/${duplicate.id}`} target="_blank" className="underline underline-offset-4">
                    {duplicate.code} · {duplicate.title}
                  </Link>{' '}
                  ({duplicate.reason === 'same_address' ? 'misma dirección' : 'mismo propietario, operación y tipo'})
                </li>
              ))}
            </ul>
            <p className="mt-1">Podés guardarla igual; el dueño puede fusionarlas después.</p>
          </Alert>
        ) : null}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="showAddress" defaultChecked={values.show_address} className="size-4 accent-[var(--primary)]" />
          Mostrar la dirección exacta en la página pública
        </label>
      </Section>

      <Section title="Características">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          <TextInput name="rooms" label="Ambientes" defaultValue={values.rooms} error={e.rooms} inputMode="numeric" />
          <TextInput name="bedrooms" label="Dormitorios" defaultValue={values.bedrooms} error={e.bedrooms} inputMode="numeric" />
          <TextInput name="bathrooms" label="Baños" defaultValue={values.bathrooms} error={e.bathrooms} inputMode="numeric" />
          <TextInput name="coveredArea" label="Cubierta (m²)" defaultValue={values.covered_area_m2} error={e.coveredArea} inputMode="decimal" />
          <TextInput name="totalArea" label="Total (m²)" defaultValue={values.total_area_m2} error={e.totalArea} inputMode="decimal" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(FEATURES).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-primary-soft/50">
              <input type="checkbox" name="features" value={value} defaultChecked={values.features.includes(value)} className="size-4 accent-[var(--primary)]" />
              {label}
            </label>
          ))}
        </div>
      </Section>

      <Section title="Asignación">
        <Field id="assignedUserId" label="Agente a cargo" hint={canReassign ? undefined : 'Solo el dueño puede asignarla a otra persona.'}>
          <Select id="assignedUserId" name="assignedUserId" defaultValue={values.assigned_user_id ?? (editing ? '' : currentUserId)}>
            <option value="">Sin asignar</option>
            {assignable.map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <SubmitButton className="justify-self-start" pendingLabel="Guardando…">
        {editing ? 'Guardar cambios' : 'Crear propiedad'}
      </SubmitButton>
    </form>
  );
}

/**
 * Subida de fotos directo a Storage desde el navegador (RLS de Storage: miembros con la cuenta
 * habilitada) y registro en la base con una Server Action.
 */
export function ImageUploader({ organizationId, propertyId }: { organizationId: string; propertyId: string }) {
  const [state, setState] = useState<FormState>(idle);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    const invalid = list.find((file) => !IMAGE_TYPES[file.type] || file.size > IMAGE_MAX_BYTES);
    if (invalid) {
      setState({ status: 'error', message: `"${invalid.name}": usá fotos JPG, PNG o WebP de hasta 5 MB.` });
      return;
    }
    setBusy(true);
    setState(idle);
    const supabase = createClient();
    const paths: string[] = [];
    for (const file of list) {
      const path = `${organizationId}/${propertyId}/${crypto.randomUUID()}.${IMAGE_TYPES[file.type]}`;
      const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setState({ status: 'error', message: `No pudimos subir "${file.name}". Probá de nuevo.` });
        break;
      }
      paths.push(path);
    }
    if (paths.length > 0) setState(await registerImagesAction(propertyId, paths));
    setBusy(false);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div className="grid gap-3">
      <FormMessage state={state} />
      <label htmlFor="photos" className="sr-only">
        Agregar fotos
      </label>
      <input
        ref={inputRef}
        id="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy}
        onChange={(event) => upload(event.currentTarget.files)}
        className="block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90 disabled:opacity-50"
      />
      <p className="text-xs text-muted-foreground">{busy ? 'Subiendo fotos…' : 'JPG, PNG o WebP de hasta 5 MB. La primera es la portada.'}</p>
    </div>
  );
}

/** Enlace público para copiar (página pública de la propiedad, F-10). */
export function CopyPublicLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <label htmlFor="public-link" className="sr-only">
        Enlace público
      </label>
      <Input id="public-link" readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
      <Button
        type="button"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? 'Copiado' : 'Copiar'}
      </Button>
    </div>
  );
}
