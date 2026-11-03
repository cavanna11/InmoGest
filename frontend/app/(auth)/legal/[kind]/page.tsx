import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { Badge, Card, CardTitle } from '@/components/ui/surfaces.tsx';
import { getRegistrationLegalDocuments } from '@/modules/auth/queries.ts';
import { createClient } from '@/lib/supabase/server.ts';

export const metadata: Metadata = { title: 'Documentos legales' };

const KINDS = { terminos: 'terms', privacidad: 'privacy' } as const;

// Texto vigente de los términos o la política de privacidad (los que se aceptan al registrarse).
export default function LegalDocumentPage({ params }: PageProps<'/legal/[kind]'>) {
  return (
    <Suspense fallback={<p className="text-muted-foreground">Cargando…</p>}>
      <LegalDocument params={params} />
    </Suspense>
  );
}

async function LegalDocument({ params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const docKind = KINDS[kind as keyof typeof KINDS];
  if (!docKind) notFound();

  const current = (await getRegistrationLegalDocuments())?.find((doc) => doc.kind === docKind);
  if (!current) {
    return (
      <Card>
        <CardTitle>Documento no disponible</CardTitle>
        <p className="mt-2 text-sm text-muted-foreground">Todavía no hay una versión publicada.</p>
      </Card>
    );
  }
  const supabase = await createClient();
  const { data } = await supabase.from('legal_documents').select('title, content, version').eq('id', current.id).maybeSingle();
  if (!data) notFound();

  return (
    <Card>
      <CardTitle>{data.title}</CardTitle>
      <p className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
        Versión {data.version}
        {current.isDraft ? <Badge variant="warning">No válido — solo desarrollo</Badge> : null}
      </p>
      <div className="mt-4 whitespace-pre-line text-sm">{data.content}</div>
    </Card>
  );
}
