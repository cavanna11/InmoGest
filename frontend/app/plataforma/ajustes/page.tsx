import { Button } from '@/components/ui/button.tsx';
import { Field, Input, Label } from '@/components/ui/form-controls.tsx';
import { Alert, Card, CardDescription, CardTitle } from '@/components/ui/surfaces.tsx';
import { createClient } from '@/lib/supabase/server.ts';
import { updatePlanAction, updateSettingsAction } from '@/modules/platform/actions.ts';
import { requirePlatformAdmin } from '@/modules/platform/guard.ts';

export const metadata = { title: 'Planes y ajustes' };

// Límites de cada plan, límites globales de WhatsApp y datos de pago (CU-15, F-29).
export default async function PlatformSettingsPage() {
  const role = await requirePlatformAdmin('/plataforma/ajustes');
  const supabase = await createClient();
  const [{ data: plans }, { data: settings }] = await Promise.all([
    supabase.from('plans').select('code, name, max_users, max_properties, max_whatsapp_numbers, reference_price_usd').order('sort_order'),
    supabase.from('platform_settings').select('payment_instructions, wa_auto_daily_limit, wa_auto_hourly_limit, wa_auto_min_interval_seconds').eq('id', true).maybeSingle(),
  ]);
  const disabled = !role.isPrincipal;

  return (
    <div className="grid grid-cols-1 gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Planes y ajustes</h1>
      {disabled ? <Alert>Solo el superadministrador principal puede hacer cambios.</Alert> : null}

      <Card>
        <CardTitle>Límites de los planes</CardTitle>
        <CardDescription>Se aplican de inmediato. Nunca se borran datos: al llegar al límite no se pueden crear más. Números de WhatsApp vacío: sin definir (se permite 1).</CardDescription>
        <ul className="mt-4 grid gap-3">
          {(plans ?? []).map((plan) => (
            <li key={plan.code} className="rounded-md border border-border p-3">
              <form action={updatePlanAction} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_repeat(3,7rem)_auto]">
                <input type="hidden" name="code" value={plan.code} />
                <p className="font-medium">
                  {plan.name} <span className="text-xs font-normal text-muted-foreground">USD {plan.reference_price_usd}</span>
                </p>
                <Field id={`users-${plan.code}`} label="Usuarios">
                  <Input id={`users-${plan.code}`} name="maxUsers" inputMode="numeric" defaultValue={plan.max_users} disabled={disabled} />
                </Field>
                <Field id={`props-${plan.code}`} label="Propiedades">
                  <Input id={`props-${plan.code}`} name="maxProperties" inputMode="numeric" defaultValue={plan.max_properties} disabled={disabled} />
                </Field>
                <Field id={`wa-${plan.code}`} label="WhatsApp">
                  <Input id={`wa-${plan.code}`} name="maxWhatsapp" inputMode="numeric" defaultValue={plan.max_whatsapp_numbers ?? ''} disabled={disabled} />
                </Field>
                <Button type="submit" variant="outline" disabled={disabled}>
                  Guardar
                </Button>
              </form>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardTitle>Ajustes generales</CardTitle>
        <form action={updateSettingsAction} className="mt-4 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="paymentInstructions">Datos para transferir</Label>
            <textarea
              id="paymentInstructions"
              name="paymentInstructions"
              defaultValue={settings?.payment_instructions ?? ''}
              maxLength={2000}
              disabled={disabled}
              placeholder="Alias, CBU, titular… Vacío: en Plan y pago se indica pedirlos por WhatsApp."
              className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field id="waDaily" label="Automáticos por día, por número">
              <Input id="waDaily" name="waDaily" inputMode="numeric" defaultValue={settings?.wa_auto_daily_limit ?? 30} disabled={disabled} />
            </Field>
            <Field id="waHourly" label="Automáticos por hora, por número">
              <Input id="waHourly" name="waHourly" inputMode="numeric" defaultValue={settings?.wa_auto_hourly_limit ?? 10} disabled={disabled} />
            </Field>
            <Field id="waInterval" label="Segundos entre envíos">
              <Input id="waInterval" name="waInterval" inputMode="numeric" defaultValue={settings?.wa_auto_min_interval_seconds ?? 15} disabled={disabled} />
            </Field>
          </div>
          <Button type="submit" className="justify-self-start" disabled={disabled}>
            Guardar ajustes
          </Button>
        </form>
      </Card>
    </div>
  );
}
