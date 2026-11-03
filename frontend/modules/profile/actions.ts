'use server';

import { translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { done, fail, formValues, zodFieldErrors, type FormState } from '@/lib/action.ts';
import { getCurrentUser } from '@/lib/auth.ts';
import { profileSchema } from '@/lib/schemas.ts';
import { createClient } from '@/lib/supabase/server.ts';

/** Datos del perfil propio (nombre y teléfono). RLS solo permite editar el perfil propio. */
export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser();
  if (!user) return fail('Tu sesión venció. Volvé a ingresar.');
  const parsed = profileSchema.safeParse(formValues(formData));
  if (!parsed.success) return fail('Revisá los datos marcados.', zodFieldErrors(parsed.error));

  const supabase = await createClient();
  const { error } = await supabase
    .from('profiles')
    .update({ full_name: parsed.data.fullName, phone: parsed.data.phone })
    .eq('id', user.id);
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/panel', 'layout');
  return done('Guardamos tus datos.');
}
