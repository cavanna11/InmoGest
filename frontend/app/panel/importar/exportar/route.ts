import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { toCsv } from '@/modules/import/csv.ts';
import { FEATURES, isFeature, OPERATION_LABELS, STATUS_LABELS, TYPE_LABELS } from '@/modules/properties/labels.ts';

const MAX_ROWS = 10_000;

// Exportación CSV (F-25): solo el dueño; la inmobiliaria sale de la sesión y RLS aísla en la base.
export async function GET(request: NextRequest) {
  const { active } = await resolveActiveOrganization();
  if (!active || !active.isOwner) return new NextResponse('No autorizado', { status: 403 });
  const kind = request.nextUrl.searchParams.get('tipo') === 'propiedades' ? 'propiedades' : 'contactos';
  const supabase = await createClient();
  let rows: Array<Array<string | number | null>>;

  if (kind === 'contactos') {
    const { data } = await supabase
      .from('contacts')
      .select('full_name, is_prospect, is_owner, do_not_contact, notes, source, created_at, contact_phones(phone_e164), contact_emails(email)')
      .eq('organization_id', active.id)
      .is('merged_into_id', null)
      .order('full_name')
      .limit(MAX_ROWS);
    rows = [
      ['nombre', 'telefonos', 'emails', 'tipo', 'no_contactar', 'notas', 'origen', 'creado'],
      ...(data ?? []).map((contact) => [
        contact.full_name,
        contact.contact_phones.map((phone) => phone.phone_e164).join(' | '),
        contact.contact_emails.map((email) => email.email).join(' | '),
        contact.is_prospect && contact.is_owner ? 'ambos' : contact.is_owner ? 'propietario' : 'interesado',
        contact.do_not_contact ? 'si' : 'no',
        contact.notes,
        contact.source,
        contact.created_at,
      ]),
    ];
  } else {
    const { data } = await supabase
      .from('properties')
      .select('code, title, operation, property_type, status, price, currency, expenses, province, city, neighborhood, address, rooms, bedrooms, bathrooms, covered_area_m2, total_area_m2, features, description')
      .eq('organization_id', active.id)
      .is('merged_into_id', null)
      .order('seq')
      .limit(MAX_ROWS);
    rows = [
      ['codigo', 'titulo', 'operacion', 'tipo', 'estado', 'precio', 'moneda', 'expensas', 'provincia', 'localidad', 'barrio', 'direccion', 'ambientes', 'dormitorios', 'banos', 'sup_cubierta', 'sup_total', 'caracteristicas', 'descripcion'],
      ...(data ?? []).map((property) => [
        property.code,
        property.title,
        OPERATION_LABELS[property.operation],
        TYPE_LABELS[property.property_type],
        STATUS_LABELS[property.status],
        property.price,
        property.currency,
        property.expenses,
        property.province,
        property.city,
        property.neighborhood,
        property.address,
        property.rooms,
        property.bedrooms,
        property.bathrooms,
        property.covered_area_m2,
        property.total_area_m2,
        property.features.map((feature) => (isFeature(feature) ? FEATURES[feature] : feature)).join('|'),
        property.description,
      ]),
    ];
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${kind}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
