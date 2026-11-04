'use server';

import { slugify, translateDbError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { validateFile, type ImportKind } from './rows.ts';

// Importación CSV (CU-12): solo el dueño, con vista previa y confirmación explícita. El archivo se
// valida de nuevo al confirmar: lo que llega del navegador nunca se da por bueno.

export type RowIssue = { line: number; error: string; label?: string };
export type PreviewResult =
  | { ok: false; error: string }
  | { ok: true; valid: Array<{ line: number; label: string; warning?: string }>; invalid: RowIssue[] };
export type ImportResult =
  | { ok: false; error: string }
  | { ok: true; imported: number; rejected: RowIssue[] };

const MAX_TEXT_LENGTH = 2_500_000;
const CONCURRENCY = 6;

async function ownerContext() {
  const { active } = await resolveActiveOrganization();
  if (!active) return { organization: null, error: 'Elegí una inmobiliaria.' };
  if (!active.isOwner) return { organization: null, error: 'Solo el dueño de la inmobiliaria puede importar.' };
  if (!active.canWrite) return { organization: null, error: 'La cuenta está en solo lectura: no se puede importar.' };
  return { organization: active, error: null };
}

function fileProblem(result: { tooMany: boolean; badHeader: boolean; rows: unknown[] }, text: string): string | null {
  if (text.length > MAX_TEXT_LENGTH) return 'El archivo es demasiado grande (máximo 2,5 MB).';
  if (result.badHeader) return 'No reconocemos el encabezado. Usá la plantilla para ver las columnas.';
  if (result.tooMany) return 'El archivo tiene más de 1000 filas. Dividilo en partes.';
  if (result.rows.length === 0) return 'El archivo no tiene filas.';
  return null;
}

/** Ejecuta en paralelo con un tope, para no saturar la base ni exceder el tiempo de la función. */
async function inBatches<T>(items: T[], run: (item: T) => Promise<void>) {
  for (let index = 0; index < items.length; index += CONCURRENCY) {
    await Promise.all(items.slice(index, index + CONCURRENCY).map(run));
  }
}

export async function previewImportAction(kind: ImportKind, text: string): Promise<PreviewResult> {
  const { organization, error } = await ownerContext();
  if (!organization) return { ok: false, error: error ?? 'Sin permiso.' };
  const supabase = await createClient();

  if (kind === 'contactos') {
    const result = validateFile('contactos', text);
    const problem = fileProblem(result, text);
    if (problem) return { ok: false, error: problem };
    const [phones, emails] = await Promise.all([
      supabase.from('contact_phones').select('phone_e164').eq('organization_id', organization.id),
      supabase.from('contact_emails').select('email').eq('organization_id', organization.id),
    ]);
    const existing = new Set([...(phones.data ?? []).map((row) => row.phone_e164), ...(emails.data ?? []).map((row) => String(row.email).toLowerCase())]);
    const valid: Array<{ line: number; label: string }> = [];
    const invalid: RowIssue[] = [];
    for (const row of result.rows) {
      if (!row.ok) {
        invalid.push({ line: row.line, error: row.error });
      } else if ([...row.data.phones, ...row.data.emails].some((key) => existing.has(key))) {
        invalid.push({ line: row.line, label: row.label, error: 'Ya hay un contacto con ese teléfono o email (no se crea otro).' });
      } else {
        valid.push({ line: row.line, label: row.label });
      }
    }
    return { ok: true, valid, invalid };
  }

  const result = validateFile('propiedades', text);
  const problem = fileProblem(result, text);
  if (problem) return { ok: false, error: problem };
  const { data: addresses } = await supabase.from('properties').select('address').eq('organization_id', organization.id).is('merged_into_id', null).neq('address', '');
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const known = new Set((addresses ?? []).map((row) => normalize(row.address)));
  const valid: Array<{ line: number; label: string; warning?: string }> = [];
  const invalid: RowIssue[] = [];
  for (const row of result.rows) {
    if (!row.ok) {
      invalid.push({ line: row.line, error: row.error });
    } else {
      const duplicate = row.data.address !== '' && known.has(normalize(row.data.address));
      // Propiedades: el posible duplicado se avisa pero no impide guardar (PRD §6).
      valid.push({ line: row.line, label: row.label, ...(duplicate ? { warning: 'Posible duplicado: misma dirección.' } : {}) });
    }
  }
  return { ok: true, valid, invalid };
}

export async function confirmImportAction(kind: ImportKind, text: string): Promise<ImportResult> {
  const { organization, error } = await ownerContext();
  if (!organization) return { ok: false, error: error ?? 'Sin permiso.' };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const rejected: RowIssue[] = [];
  let imported = 0;

  if (kind === 'contactos') {
    const result = validateFile('contactos', text);
    const problem = fileProblem(result, text);
    if (problem) return { ok: false, error: problem };
    await inBatches(result.rows, async (row) => {
      if (!row.ok) {
        rejected.push({ line: row.line, error: row.error });
        return;
      }
      const { error: rowError } = await supabase.rpc('create_contact', {
        p_organization_id: organization.id,
        p_full_name: row.data.fullName,
        p_phones: row.data.phones,
        p_emails: row.data.emails,
        p_notes: row.data.notes,
        p_is_prospect: row.data.isProspect,
        p_is_owner: row.data.isOwner,
        p_source: 'import',
      });
      if (rowError) rejected.push({ line: row.line, label: row.label, error: translateDbError(rowError).error.message });
      else imported += 1;
    });
    revalidatePath('/panel/contactos');
  } else {
    const result = validateFile('propiedades', text);
    const problem = fileProblem(result, text);
    if (problem) return { ok: false, error: problem };
    // Propiedades una por una: el correlativo y el límite del plan se calculan en cada alta.
    for (const row of result.rows) {
      if (!row.ok) {
        rejected.push({ line: row.line, error: row.error });
        continue;
      }
      const { error: rowError } = await supabase.from('properties').insert({
        organization_id: organization.id,
        slug: slugify(row.data.title, 'propiedad').slice(0, 70).replace(/-+$/, ''),
        created_by: auth.user?.id ?? null,
        ...row.data,
      });
      if (rowError) rejected.push({ line: row.line, label: row.label, error: translateDbError(rowError).error.message });
      else imported += 1;
    }
    revalidatePath('/panel/propiedades');
  }

  await supabase.rpc('log_import', { p_organization_id: organization.id, p_kind: kind, p_imported: imported, p_rejected: rejected.length });
  rejected.sort((a, b) => a.line - b.line);
  return { ok: true, imported, rejected };
}
