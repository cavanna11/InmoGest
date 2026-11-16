'use client';

import { ImagePlus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Checkbox } from '@/components/ui/checkbox.tsx';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field.tsx';
import { Input } from '@/components/ui/input.tsx';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.tsx';
import { Alert } from '@/components/ui/surfaces.tsx';
import { Textarea } from '@/components/ui/textarea.tsx';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group.tsx';
import { useFieldValidation } from '@/hooks/use-field-validation.ts';
import { formValues, idle, type FormState } from '@/lib/action.ts';
import { createClient } from '@/lib/supabase/browser.ts';
import { createPropertyAction, findDuplicatesAction, registerImagesAction, updatePropertyAction } from './actions.ts';
import type { PropertyFormValues } from './form-values.ts';
import { IMAGE_MAX_BYTES, IMAGE_TYPES, IMAGES_BUCKET } from './images.ts';
import { FEATURES, OPERATION_LABELS, STATUS_LABELS, TYPE_LABELS } from './labels.ts';
import { prepareImage } from './resize.ts';
import { propertySchema } from './schemas.ts';

type Member = { userId: string; name: string };
type Duplicate = { id: string; code: string; title: string; reason: string };

/** Monto para el campo: formato argentino sin moneda (98.000 · 1.234,50). */
function amountValue(value: number | null): string {
  if (value === null) return '';
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value);
}

// Mismo esquema que el servidor (el formulario manda las características como campos repetidos).
function parseProperty(data: FormData) {
  return propertySchema.safeParse({
    ...formValues(data),
    features: data.getAll('features').filter((value): value is string => typeof value === 'string'),
  });
}

/** Campo con etiqueta, ayuda y error asociados (shadcn Field). */
function FormField({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      {children}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : hint ? <FieldDescription id={`${id}-hint`}>{hint}</FieldDescription> : null}
    </Field>
  );
}

function described(id: string, error?: string, hint?: string) {
  return error ? `${id}-error` : hint ? `${id}-hint` : undefined;
}

function TextField({
  name,
  label,
  hint,
  error,
  defaultValue,
  className,
  ...props
}: { name: string; label: string; hint?: string; error?: string | undefined; defaultValue?: string | number | null; className?: string } & Omit<
  React.ComponentProps<'input'>,
  'defaultValue' | 'name'
>) {
  return (
    <FormField id={name} label={label} hint={hint} error={error} className={className}>
      <Input id={name} name={name} defaultValue={defaultValue ?? ''} aria-invalid={error ? true : undefined} aria-describedby={described(name, error, hint)} {...props} />
    </FormField>
  );
}

function ChoiceField({
  name,
  label,
  options,
  defaultValue,
  error,
  hint,
  onValueChange,
  className,
}: {
  name: string;
  label: string;
  options: Record<string, string>;
  defaultValue: string;
  error?: string | undefined;
  hint?: string;
  onValueChange?: () => void;
  className?: string;
}) {
  return (
    <FormField id={name} label={label} hint={hint} error={error} className={className}>
      <Select name={name} defaultValue={defaultValue} onValueChange={onValueChange}>
        <SelectTrigger id={name} className="w-full" aria-invalid={error ? true : undefined} aria-describedby={described(name, error, hint)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(options).map(([value, optionLabel]) => (
              <SelectItem key={value} value={value}>
                {optionLabel}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormField>
  );
}

const CURRENCIES = { USD: 'USD', ARS: 'ARS' };

/** Aviso de posible duplicado (CU-05): avisa, no impide guardar. */
function DuplicatesNotice({ duplicates }: { duplicates: Duplicate[] }) {
  if (duplicates.length === 0) return null;
  return (
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
  );
}

function useDuplicateCheck(formRef: React.RefObject<HTMLFormElement | null>, excludeId?: string) {
  const [duplicates, setDuplicates] = useState<Duplicate[]>([]);
  const [, startTransition] = useTransition();
  function check() {
    // La lista desplegable actualiza su valor después del evento: se lee en el próximo ciclo.
    setTimeout(() => {
      const form = formRef.current;
      if (!form) return;
      const data = new FormData(form);
      startTransition(async () => {
        setDuplicates(
          await findDuplicatesAction({
            address: String(data.get('address') ?? ''),
            operation: String(data.get('operation') ?? ''),
            propertyType: String(data.get('propertyType') ?? ''),
            excludeId,
          }),
        );
      });
    }, 0);
  }
  return { duplicates, check };
}

/**
 * Alta rápida (paso 1 de 3): lo mínimo para crear la propiedad. El resto (descripción, superficies,
 * características, expensas) se completa después en la ficha. Los campos que no se piden viajan con su
 * valor por defecto, así el servidor valida lo mismo que en el formulario completo.
 */
export function QuickPropertyForm({ defaults, currentUserId }: { defaults: PropertyFormValues; currentUserId: string }) {
  const [state, action] = useActionState(createPropertyAction, idle);
  const { formRef, onChange, onBlur, onSubmitCapture, error: e } = useFieldValidation(parseProperty, state.fieldErrors, { warnUnsaved: true });
  const { duplicates, check } = useDuplicateCheck(formRef);
  const [status, setStatus] = useState<'available' | 'draft'>('available');
  const [operation, setOperation] = useState(defaults.operation);

  return (
    <form ref={formRef} action={action} onChange={onChange} onBlur={onBlur} onSubmitCapture={onSubmitCapture} noValidate className="grid gap-6">
      <FormMessage state={state} />
      {/* Valores por defecto de lo que se completa después. */}
      <input type="hidden" name="description" value="" />
      <input type="hidden" name="expenses" value="" />
      <input type="hidden" name="expensesCurrency" value={defaults.expenses_currency} />
      <input type="hidden" name="province" value="" />
      {['rooms', 'bedrooms', 'bathrooms', 'coveredArea', 'totalArea'].map((name) => (
        <input key={name} type="hidden" name={name} value="" />
      ))}
      <input type="hidden" name="assignedUserId" value={currentUserId} />
      <input type="hidden" name="status" value={status} />
      <input type="hidden" name="operation" value={operation} />

      <FieldGroup>
        <TextField name="title" label="Título" error={e('title')} required maxLength={120} placeholder="Departamento 3 ambientes con balcón" autoComplete="off" />

        <Field>
          <FieldLabel id="operation-label">Operación</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={operation}
            onValueChange={(value) => {
              if (value) {
                setOperation(value);
                check();
              }
            }}
            aria-labelledby="operation-label"
            className="w-full flex-wrap sm:w-fit"
          >
            {Object.entries(OPERATION_LABELS).map(([value, label]) => (
              <ToggleGroupItem key={value} value={value} className="h-10 flex-1 px-4 sm:flex-none">
                {label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        <ChoiceField name="propertyType" label="Tipo" options={TYPE_LABELS} defaultValue={defaults.property_type} error={e('propertyType')} onValueChange={check} className="sm:max-w-xs" />

        <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 sm:max-w-md">
          <TextField
            name="price"
            label="Precio"
            hint={status === 'draft' ? 'Opcional mientras esté en borrador.' : undefined}
            error={e('price')}
            inputMode="decimal"
            placeholder="98.000"
            autoComplete="off"
          />
          <ChoiceField name="currency" label="Moneda" options={CURRENCIES} defaultValue={defaults.currency} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField name="neighborhood" label="Barrio" error={e('neighborhood')} maxLength={80} placeholder="Palermo" autoComplete="off" />
          <TextField name="city" label="Localidad" error={e('city')} maxLength={80} placeholder="CABA" autoComplete="off" />
        </div>
        <TextField
          name="address"
          label="Dirección (opcional)"
          hint="No se muestra en la página pública salvo que lo elijas después."
          error={e('address')}
          maxLength={160}
          onBlur={check}
          placeholder="Calle, número, piso y depto."
          autoComplete="off"
        />
        <DuplicatesNotice duplicates={duplicates} />

        <Field>
          <FieldLabel id="status-label">¿Ya se puede mostrar?</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            value={status}
            onValueChange={(value) => value && setStatus(value as 'available' | 'draft')}
            aria-labelledby="status-label"
            aria-describedby="status-hint"
            className="w-full sm:w-fit"
          >
            <ToggleGroupItem value="available" className="h-10 flex-1 px-4 sm:flex-none">
              Sí, disponible
            </ToggleGroupItem>
            <ToggleGroupItem value="draft" className="h-10 flex-1 px-4 sm:flex-none">
              Todavía no (borrador)
            </ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription id="status-hint">En borrador no tiene página pública ni se puede enviar ni publicar.</FieldDescription>
        </Field>
      </FieldGroup>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Creando…">Crear y seguir con las fotos</SubmitButton>
        <Button asChild variant="ghost">
          <Link href="/panel/propiedades">Cancelar</Link>
        </Button>
      </div>
    </form>
  );
}

/** Formulario completo de la propiedad (pestaña "Datos" de la ficha). */
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
  const { formRef, onChange, onBlur, onSubmitCapture, error: e } = useFieldValidation(parseProperty, state.fieldErrors, { warnUnsaved: true });
  const { duplicates, check } = useDuplicateCheck(formRef, values.id);
  // El botón está al final de un formulario largo: el resultado también se avisa abajo de la pantalla.
  useEffect(() => {
    if (state.status === 'success' && state.message) toast.success(state.message);
    else if (state.status === 'error' && state.message) toast.error(state.message);
  }, [state]);
  const assignable = canReassign ? members : members.filter((member) => member.userId === currentUserId || member.userId === values.assigned_user_id);
  const assignOptions = { none: 'Sin asignar', ...Object.fromEntries(assignable.map((member) => [member.userId, member.name])) };

  return (
    <form ref={formRef} action={action} onChange={onChange} onBlur={onBlur} onSubmitCapture={onSubmitCapture} className="grid gap-6" noValidate>
      <FormMessage state={state} />
      {values.id ? <input type="hidden" name="propertyId" value={values.id} /> : null}

      <FieldSet>
        <FieldLegend>Datos principales</FieldLegend>
        <FieldGroup>
          <TextField name="title" label="Título" defaultValue={values.title} error={e('title')} required maxLength={120} placeholder="Departamento 3 ambientes con balcón" autoComplete="off" />
          <div className="grid gap-4 sm:grid-cols-3">
            <ChoiceField name="operation" label="Operación" options={OPERATION_LABELS} defaultValue={values.operation} error={e('operation')} onValueChange={check} />
            <ChoiceField name="propertyType" label="Tipo" options={TYPE_LABELS} defaultValue={values.property_type} error={e('propertyType')} onValueChange={check} />
            <ChoiceField name="status" label="Estado" options={STATUS_LABELS} defaultValue={values.status} error={e('status')} hint="En borrador o pausada no se publica." />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-3 sm:grid-cols-[minmax(0,2fr)_6.5rem_minmax(0,2fr)_6.5rem]">
            <TextField name="price" label="Precio" defaultValue={amountValue(values.price)} error={e('price')} inputMode="decimal" placeholder="98.000" autoComplete="off" />
            <ChoiceField name="currency" label="Moneda del precio" options={CURRENCIES} defaultValue={values.currency} />
            <TextField name="expenses" label="Expensas (opcional)" defaultValue={amountValue(values.expenses)} error={e('expenses')} inputMode="decimal" autoComplete="off" />
            <ChoiceField name="expensesCurrency" label="Moneda de expensas" options={CURRENCIES} defaultValue={values.expenses_currency} />
          </div>
          <FormField id="description" label="Descripción" error={e('description')}>
            <Textarea id="description" name="description" defaultValue={values.description} maxLength={8000} className="min-h-32" aria-invalid={e('description') ? true : undefined} />
          </FormField>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Ubicación</FieldLegend>
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField name="province" label="Provincia" defaultValue={values.province} error={e('province')} maxLength={80} autoComplete="off" />
            <TextField name="city" label="Localidad" defaultValue={values.city} error={e('city')} maxLength={80} autoComplete="off" />
            <TextField name="neighborhood" label="Barrio" defaultValue={values.neighborhood} error={e('neighborhood')} maxLength={80} autoComplete="off" />
          </div>
          <TextField name="address" label="Dirección" defaultValue={values.address} error={e('address')} maxLength={160} onBlur={check} placeholder="Calle, número, piso y depto." autoComplete="off" />
          <DuplicatesNotice duplicates={duplicates} />
          <Field orientation="horizontal">
            <Checkbox id="showAddress" name="showAddress" defaultChecked={values.show_address} />
            <FieldLabel htmlFor="showAddress" className="font-normal">
              Mostrar la dirección exacta en la página pública
            </FieldLabel>
          </Field>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Características</FieldLegend>
        <FieldGroup>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <TextField name="rooms" label="Ambientes" defaultValue={values.rooms} error={e('rooms')} inputMode="numeric" autoComplete="off" />
            <TextField name="bedrooms" label="Dormitorios" defaultValue={values.bedrooms} error={e('bedrooms')} inputMode="numeric" autoComplete="off" />
            <TextField name="bathrooms" label="Baños" defaultValue={values.bathrooms} error={e('bathrooms')} inputMode="numeric" autoComplete="off" />
            <TextField name="coveredArea" label="Cubierta (m²)" defaultValue={values.covered_area_m2} error={e('coveredArea')} inputMode="decimal" autoComplete="off" />
            <TextField name="totalArea" label="Total (m²)" defaultValue={values.total_area_m2} error={e('totalArea')} inputMode="decimal" autoComplete="off" />
          </div>
          <FieldSet>
            <FieldLegend variant="label">Qué tiene</FieldLegend>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
              {Object.entries(FEATURES).map(([value, label]) => (
                <Field key={value} orientation="horizontal" className="min-h-10 gap-2 rounded-md px-1">
                  <Checkbox id={`feature-${value}`} name="features" value={value} defaultChecked={values.features.includes(value)} />
                  <FieldLabel htmlFor={`feature-${value}`} className="font-normal">
                    {label}
                  </FieldLabel>
                </Field>
              ))}
            </div>
          </FieldSet>
        </FieldGroup>
      </FieldSet>

      <FieldSet>
        <FieldLegend>Asignación</FieldLegend>
        <AssigneeField
          options={assignOptions}
          defaultValue={values.assigned_user_id ?? (editing ? '' : currentUserId)}
          hint={canReassign ? undefined : 'Solo el dueño puede asignarla a otra persona.'}
        />
      </FieldSet>

      <SubmitButton className="justify-self-start" pendingLabel="Guardando…">
        {editing ? 'Guardar cambios' : 'Crear propiedad'}
      </SubmitButton>
    </form>
  );
}

/** El selector no admite un valor vacío: "Sin asignar" viaja como "" en un campo oculto. */
function AssigneeField({ options, defaultValue, hint }: { options: Record<string, string>; defaultValue: string; hint?: string | undefined }) {
  const [value, setValue] = useState(defaultValue || 'none');
  return (
    <FormField id="assignedUser" label="Agente a cargo" hint={hint}>
      <input type="hidden" name="assignedUserId" value={value === 'none' ? '' : value} />
      <Select value={value} onValueChange={setValue}>
        <SelectTrigger id="assignedUser" className="w-full sm:max-w-xs" aria-describedby={hint ? 'assignedUser-hint' : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {Object.entries(options).map(([optionValue, label]) => (
              <SelectItem key={optionValue} value={optionValue}>
                {label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </FormField>
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
      setState({ status: 'error', message: `“${invalid.name}”: usá fotos JPG, PNG o WebP de hasta 5 MB.` });
      return;
    }
    setBusy(true);
    setState(idle);
    const supabase = createClient();
    const paths: string[] = [];
    for (const file of list) {
      // Se reduce antes de subir: listados y página pública no bajan fotos de varios MB.
      const { blob, type } = await prepareImage(file);
      const path = `${organizationId}/${propertyId}/${crypto.randomUUID()}.${IMAGE_TYPES[type]}`;
      const { error } = await supabase.storage.from(IMAGES_BUCKET).upload(path, blob, { contentType: type, upsert: false });
      if (error) {
        setState({ status: 'error', message: `No pudimos subir “${file.name}”. Revisá la conexión y probá de nuevo.` });
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
      <input
        ref={inputRef}
        id="photos"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        disabled={busy}
        onChange={(event) => upload(event.currentTarget.files)}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
      />
      <Button type="button" variant="outline" className="h-auto justify-self-start py-2.5" disabled={busy} onClick={() => inputRef.current?.click()} aria-describedby="photos-hint">
        {busy ? <Loader2 aria-hidden="true" className="animate-spin" /> : <ImagePlus aria-hidden="true" />}
        {busy ? 'Subiendo fotos…' : 'Agregar fotos'}
      </Button>
      <p id="photos-hint" className="text-xs text-muted-foreground">
        JPG, PNG o WebP de hasta 5 MB. Podés elegir varias a la vez. La primera es la portada.
      </p>
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
