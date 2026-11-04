'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server.ts';
import { getPlatformRole } from '@/lib/platform.ts';
import { setActiveOrganizationCookie } from '@/lib/tenant.ts';

// Acciones del panel de superadministrador (CU-15, CU-16). La base vuelve a verificar el rol en cada
// una (RLS y RPC) y deja auditoría; esto solo evita llamadas inútiles.

const uuid = z.uuid();

async function principalOnly(): Promise<boolean> {
  return (await getPlatformRole()).isPrincipal;
}

function orgPath(id: string) {
  return `/plataforma/${id}`;
}

export async function reviewPaymentAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('reportId'));
  const organizationId = uuid.safeParse(formData.get('organizationId'));
  const decision = formData.get('decision');
  if (!(await principalOnly()) || !id.success || !organizationId.success) return;
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const supabase = await createClient();
  const { error } = await supabase.rpc(decision === 'approve' ? 'approve_payment' : 'reject_payment', { p_report_id: id.data, p_note: note });
  if (error) redirect(`${orgPath(organizationId.data)}?error=pago`);
  revalidatePath('/plataforma', 'layout');
}

export async function changePlanAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('organizationId'));
  const plan = z.string().regex(/^[a-z][a-z0-9_]{1,30}$/).safeParse(formData.get('planCode'));
  if (!(await principalOnly()) || !id.success || !plan.success) return;
  const supabase = await createClient();
  await supabase.from('organizations').update({ plan_code: plan.data }).eq('id', id.data);
  revalidatePath('/plataforma', 'layout');
}

/** Extiende la prueba N días, contados desde hoy o desde su fin si todavía no venció. */
export async function extendTrialAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('organizationId'));
  const days = z.coerce.number().int().min(1).max(365).safeParse(formData.get('days'));
  if (!(await principalOnly()) || !id.success || !days.success) return;
  const supabase = await createClient();
  const { data } = await supabase.from('organizations').select('trial_ends_at').eq('id', id.data).maybeSingle();
  if (!data) return;
  const base = Math.max(Date.now(), new Date(data.trial_ends_at).getTime());
  await supabase
    .from('organizations')
    .update({ trial_ends_at: new Date(base + days.data * 86_400_000).toISOString() })
    .eq('id', id.data);
  revalidatePath('/plataforma', 'layout');
}

export async function setSuspendedAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('organizationId'));
  if (!(await principalOnly()) || !id.success) return;
  const suspend = formData.get('suspend') === '1';
  const supabase = await createClient();
  await supabase.from('organizations').update({ suspended_at: suspend ? new Date().toISOString() : null }).eq('id', id.data);
  revalidatePath('/plataforma', 'layout');
}

/** «Ingresar como» (CU-16, ADR 0003): queda registrado y la interfaz lo indica siempre. */
export async function enterAsAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('organizationId'));
  if (!(await principalOnly()) || !id.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('start_support_session', { p_organization_id: id.data });
  if (error) redirect(`${orgPath(id.data)}?error=soporte`);
  await setActiveOrganizationCookie(id.data);
  redirect('/panel');
}

const planLimits = z.object({
  code: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/),
  maxUsers: z.coerce.number().int().min(1).max(100_000),
  maxProperties: z.coerce.number().int().min(1).max(10_000_000),
  maxWhatsapp: z.string().trim().transform((value) => (value === '' ? null : Number(value))).pipe(z.number().int().min(1).max(1000).nullable()),
});

export async function updatePlanAction(formData: FormData): Promise<void> {
  const parsed = planLimits.safeParse(Object.fromEntries(formData));
  if (!(await principalOnly()) || !parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from('plans')
    .update({ max_users: parsed.data.maxUsers, max_properties: parsed.data.maxProperties, max_whatsapp_numbers: parsed.data.maxWhatsapp })
    .eq('code', parsed.data.code);
  revalidatePath('/plataforma/ajustes');
}

const settings = z.object({
  paymentInstructions: z.string().trim().max(2000),
  waDaily: z.coerce.number().int().min(0).max(100_000),
  waHourly: z.coerce.number().int().min(0).max(100_000),
  waInterval: z.coerce.number().int().min(0).max(86_400),
});

export async function updateSettingsAction(formData: FormData): Promise<void> {
  const parsed = settings.safeParse(Object.fromEntries(formData));
  if (!(await principalOnly()) || !parsed.success) return;
  const supabase = await createClient();
  await supabase
    .from('platform_settings')
    .update({
      payment_instructions: parsed.data.paymentInstructions,
      wa_auto_daily_limit: parsed.data.waDaily,
      wa_auto_hourly_limit: parsed.data.waHourly,
      wa_auto_min_interval_seconds: parsed.data.waInterval,
    })
    .eq('id', true);
  revalidatePath('/plataforma/ajustes');
}
