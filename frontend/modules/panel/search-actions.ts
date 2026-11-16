'use server';

import { formatPhone } from '@inmogest/shared';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { listContacts } from '@/modules/contacts/queries.ts';
import { priceLabel } from '@/modules/properties/format.ts';
import { listProperties } from '@/modules/properties/queries.ts';

// Búsqueda global del panel: propiedades, contactos y conversaciones de WhatsApp de la inmobiliaria
// activa. Reutiliza las mismas lecturas que los listados (filtran por organización y RLS aísla en la
// base); nunca se acepta un organization_id del cliente.

export type SearchResult = { id: string; href: string; title: string; detail: string };

export type GlobalSearchResults = {
  properties: SearchResult[];
  contacts: SearchResult[];
  conversations: SearchResult[];
};

const EMPTY: GlobalSearchResults = { properties: [], contacts: [], conversations: [] };
const LIMIT = 5;
const query = z.string().trim().min(2).max(100);

export async function globalSearchAction(raw: string): Promise<GlobalSearchResults> {
  const parsed = query.safeParse(raw);
  if (!parsed.success) return EMPTY;
  const { active } = await resolveActiveOrganization();
  if (!active) return EMPTY;
  const q = parsed.data;

  // El id de usuario solo se usa en los filtros "míos", que acá no se aplican.
  const [{ properties }, { contacts }] = await Promise.all([
    listProperties(active.id, '', { q }),
    listContacts(active.id, '', { q }),
  ]);
  const topContacts = contacts.slice(0, LIMIT);

  // Conversaciones de los contactos encontrados, o por número si se buscó un teléfono.
  const digits = q.replace(/\D/g, '');
  const supabase = await createClient();
  const contactIds = topContacts.map((contact) => contact.id);
  const filters = [
    contactIds.length > 0 ? `contact_id.in.(${contactIds.join(',')})` : null,
    digits.length >= 6 ? `phone_e164.like.*${digits}*` : null,
  ].filter(Boolean);
  const { data: conversations } =
    filters.length > 0
      ? await supabase
          .from('conversations')
          .select('id, phone_e164, last_message_preview, contacts(full_name)')
          .eq('organization_id', active.id)
          .or(filters.join(','))
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(LIMIT)
      : { data: [] };

  return {
    properties: properties.slice(0, LIMIT).map((property) => ({
      id: property.id,
      href: `/panel/propiedades/${property.id}`,
      title: property.title,
      detail: [property.code, [property.neighborhood, property.city].filter(Boolean).join(', '), priceLabel(property.price, property.currency)]
        .filter(Boolean)
        .join(' · '),
    })),
    contacts: topContacts.map((contact) => ({
      id: contact.id,
      href: `/panel/contactos/${contact.id}`,
      title: contact.full_name,
      detail: contact.contact_phones[0] ? formatPhone(contact.contact_phones[0].phone_e164) : (contact.contact_emails[0]?.email ?? ''),
    })),
    conversations: (conversations ?? []).map((conversation) => ({
      id: conversation.id,
      href: `/panel/conversaciones?c=${conversation.id}`,
      title: conversation.contacts?.full_name ?? formatPhone(conversation.phone_e164),
      detail: conversation.last_message_preview ?? '',
    })),
  };
}
