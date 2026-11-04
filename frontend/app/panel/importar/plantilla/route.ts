import { NextResponse, type NextRequest } from 'next/server';
import { toCsv } from '@/modules/import/csv.ts';
import { TEMPLATE_EXAMPLES, TEMPLATE_HEADERS } from '@/modules/import/rows.ts';

// Plantilla CSV de importación: encabezado y una fila de ejemplo. No tiene datos de nadie.
export function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get('tipo') === 'propiedades' ? 'propiedades' : 'contactos';
  return new NextResponse(toCsv([TEMPLATE_HEADERS[kind], TEMPLATE_EXAMPLES[kind]]), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="plantilla-${kind}.csv"`,
    },
  });
}
