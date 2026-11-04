import 'server-only';
import { readPublicEnv } from '@/lib/env.ts';
import { createClient } from '@/lib/supabase/server.ts';

export type LegalDocumentSummary = {
  id: string;
  kind: 'terms' | 'privacy';
  version: string;
  title: string;
  isDraft: boolean;
};

/**
 * Términos y privacidad vigentes para el registro (ADR 0009). null = registro cerrado: no hay ambos
 * documentos publicados explícitamente.
 */
export async function getRegistrationLegalDocuments(): Promise<LegalDocumentSummary[] | null> {
  if (!readPublicEnv()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('registration_legal_documents');
  if (error || !data || data.length < 2) return null;
  return data.map((doc) => ({
    id: doc.id,
    kind: doc.kind,
    version: doc.version,
    title: doc.title,
    isDraft: doc.is_draft,
  }));
}

/** Documentos vigentes que este usuario todavía no aceptó. */
export async function getPendingLegalDocuments(userId: string) {
  const current = await getRegistrationLegalDocuments();
  if (!current) return [];
  const supabase = await createClient();
  const { data } = await supabase.from('legal_acceptances').select('legal_document_id').eq('user_id', userId);
  const accepted = new Set((data ?? []).map((row) => row.legal_document_id));
  return current.filter((document) => !accepted.has(document.id));
}
