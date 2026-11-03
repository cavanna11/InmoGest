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
