'use server';

import { translateDbError, WhatsAppProviderError } from '@inmogest/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { done, fail, type FormState } from '@/lib/action.ts';
import { appOrigin } from '@/lib/request.ts';
import { createAdminClient } from '@/lib/supabase/admin.ts';
import { createClient } from '@/lib/supabase/server.ts';
import { resolveActiveOrganization } from '@/lib/tenant.ts';
import { generateWebhookSecret, getWhatsAppProvider, webhookUrl } from '@/lib/whatsapp.ts';
import { priceLabel } from '@/modules/properties/format.ts';
import { publicImageUrl } from '@/modules/properties/images.ts';
import { organizationSlug } from '@/modules/properties/queries.ts';
import { ATTACHMENT_TYPES, propertyMessage } from './labels.ts';

// La inmobiliaria sale de la sesión; los permisos los valida la base. El cliente admin se usa solo para
// escribir el estado que informa el proveedor, después de comprobar con la sesión que la conexión es visible.

const uuid = z.uuid();
const NOT_AVAILABLE = 'La conexión de WhatsApp todavía no está habilitada en esta instalación.';
const PROVIDER_ERROR = 'No pudimos comunicarnos con el servicio de WhatsApp. Probá de nuevo en unos minutos.';

async function activeOrganization() {
  const { active } = await resolveActiveOrganization();
  if (!active) redirect('/seleccionar-inmobiliaria');
  return active;
}

function revalidateInbox() {
  revalidatePath('/panel/conversaciones');
  revalidatePath('/panel/whatsapp');
}

async function visibleConnection(connectionId: string) {
  const organization = await activeOrganization();
  if (!organization.isOwner || !organization.canWrite) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from('whatsapp_connections')
    .select('id, instance_name, status')
    .eq('organization_id', organization.id)
    .eq('id', connectionId)
    .is('removed_at', null)
    .maybeSingle();
  return data;
}

export async function connectWhatsappAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await activeOrganization();
  if (formData.get('guidelines') !== 'on') {
    return fail('Para conectar tenés que aceptar las pautas.', { guidelines: 'Aceptá las pautas de uso responsable.' });
  }
  const provider = getWhatsAppProvider();
  if (!provider) return fail(NOT_AVAILABLE);

  const { secret, hash } = generateWebhookSecret();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_whatsapp_connection', {
    p_organization_id: organization.id,
    p_webhook_secret_hash: hash,
    p_guidelines_accepted: true,
  });
  const created = data?.[0];
  if (error || !created) return fail(error ? translateDbError(error).error.message : PROVIDER_ERROR);

  try {
    await provider.createInstance({ instanceName: created.instance_name, webhookUrl: await webhookUrl(secret) });
  } catch {
    // Sin instancia en el proveedor la conexión no sirve: se quita para que no ocupe el cupo del plan.
    await supabase.rpc('remove_whatsapp_connection', { p_connection_id: created.id });
    return fail(PROVIDER_ERROR);
  }
  revalidateInbox();
  return done('Escaneá el código para terminar de conectar.');
}

export type QrResult = { status: string; qr: string | null; pairingCode: string | null; error?: string };

/** Estado actual y, si hace falta escanear, el código. El QR no se guarda: vive solo en esta respuesta. */
export async function connectionQrAction(connectionId: string): Promise<QrResult> {
  const id = uuid.safeParse(connectionId);
  const connection = id.success ? await visibleConnection(id.data) : null;
  const provider = getWhatsAppProvider();
  if (!connection) return { status: 'disconnected', qr: null, pairingCode: null, error: 'No se encontró la conexión.' };
  if (!provider) return { status: connection.status, qr: null, pairingCode: null, error: NOT_AVAILABLE };

  const admin = createAdminClient();
  try {
    const state = await provider.getState(connection.instance_name);
    if (state === 'connected') {
      if (connection.status !== 'connected') {
        await admin.rpc('whatsapp_set_connection_state', { p_connection_id: connection.id, p_status: 'connected' });
        revalidateInbox();
      }
      return { status: 'connected', qr: null, pairingCode: null };
    }
    const qr = await provider.getQr(connection.instance_name);
    return { status: state, qr: qr?.base64 ?? null, pairingCode: qr?.pairingCode ?? null };
  } catch (error) {
    if (!(error instanceof WhatsAppProviderError && error.httpStatus === 404)) {
      return { status: connection.status, qr: null, pairingCode: null, error: PROVIDER_ERROR };
    }
  }

  // La instancia ya no existe en el proveedor: se crea de nuevo con un secreto nuevo, porque el anterior
  // no se puede recuperar (solo se guarda su hash).
  try {
    const { secret, hash } = generateWebhookSecret();
    const { error } = await admin.from('whatsapp_connections').update({ webhook_secret_hash: hash }).eq('id', connection.id);
    if (error) return { status: connection.status, qr: null, pairingCode: null, error: PROVIDER_ERROR };
    const { qr } = await provider.createInstance({ instanceName: connection.instance_name, webhookUrl: await webhookUrl(secret) });
    return { status: 'connecting', qr: qr?.base64 ?? null, pairingCode: qr?.pairingCode ?? null };
  } catch {
    return { status: connection.status, qr: null, pairingCode: null, error: PROVIDER_ERROR };
  }
}

export async function removeConnectionAction(formData: FormData): Promise<void> {
  const id = uuid.safeParse(formData.get('connectionId'));
  if (!id.success) return;
  const connection = await visibleConnection(id.data);
  if (!connection) return;
  // Se intenta cerrar la sesión; si el proveedor no responde, igual se quita del panel.
  await getWhatsAppProvider()?.removeInstance(connection.instance_name).catch(() => undefined);
  const supabase = await createClient();
  await supabase.rpc('remove_whatsapp_connection', { p_connection_id: connection.id });
  revalidateInbox();
}

export async function requestOfficialApiAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await activeOrganization();
  const notes = z.string().trim().max(1000).safeParse(formData.get('notes') ?? '');
  if (!notes.success) return fail('El comentario puede tener hasta 1000 caracteres.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('request_whatsapp_official_api', { p_organization_id: organization.id, p_notes: notes.data });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/panel/whatsapp');
  return done('Recibimos tu pedido.');
}

/** Abrir marca como leída y asigna al primero que abre (F-16). */
export async function openConversationAction(conversationId: string): Promise<void> {
  const id = uuid.safeParse(conversationId);
  if (!id.success) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc('open_whatsapp_conversation', { p_conversation_id: id.data });
  if (!error) revalidatePath('/panel/conversaciones');
}

export async function assignConversationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get('conversationId'));
  const raw = formData.get('userId');
  const user = raw ? uuid.safeParse(raw) : null;
  if (!id.success || (user && !user.success)) return fail('No se pudo reasignar.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('assign_whatsapp_conversation', {
    p_conversation_id: id.data,
    p_user_id: (user?.data ?? null) as string,
  });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/panel/conversaciones');
  return done('Conversación reasignada.');
}

export async function sendMessageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get('conversationId'));
  const body = z.string().trim().min(1).max(4000).safeParse(formData.get('body'));
  if (!id.success) return fail('No se encontró la conversación.');
  if (!body.success) return fail('Escribí un mensaje de hasta 4000 caracteres.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('send_whatsapp_message', { p_conversation_id: id.data, p_body: body.data });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/panel/conversaciones');
  return done('');
}

/** El archivo ya se subió directo a Storage desde el navegador. La base valida su carpeta. */
export async function sendAttachmentAction(input: { conversationId: string; path: string; mime: string; name: string; caption: string }): Promise<FormState> {
  const id = uuid.safeParse(input.conversationId);
  const attachment = ATTACHMENT_TYPES[input.mime];
  if (!id.success || !attachment) return fail('Ese tipo de archivo no se puede enviar.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('send_whatsapp_message', {
    p_conversation_id: id.data,
    p_body: input.caption.slice(0, 1000),
    p_type: attachment.type,
    p_media_path: input.path,
    p_media_mime: input.mime,
    p_media_name: input.name.slice(0, 255),
  });
  if (error) return fail(translateDbError(error).error.message);
  revalidatePath('/panel/conversaciones');
  return done('');
}

/** Desde la ficha del contacto: abre su conversación, o la inicia si no hay. */
export async function startConversationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = uuid.safeParse(formData.get('contactId'));
  if (!id.success) return fail('No se encontró el contacto.');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_whatsapp_conversation', { p_contact_id: id.data });
  if (error) return fail(translateDbError(error).error.message);
  redirect(`/panel/conversaciones?c=${data}`);
}

/** CU-08: envía la ficha con hasta 3 fotos y el link a la página pública. */
export async function sendPropertyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const organization = await activeOrganization();
  const propertyId = uuid.safeParse(formData.get('propertyId'));
  const contactId = uuid.safeParse(formData.get('contactId'));
  if (!propertyId.success) return fail('No se encontró la propiedad.');
  if (!contactId.success) return fail('Elegí un contacto.', { contactId: 'Elegí un contacto.' });

  const supabase = await createClient();
  const { data: property } = await supabase
    .from('properties')
    .select('title, slug, price, currency, neighborhood, city, property_images(storage_path, position)')
    .eq('organization_id', organization.id)
    .eq('id', propertyId.data)
    .order('position', { referencedTable: 'property_images', ascending: true })
    .maybeSingle();
  const slug = await organizationSlug(organization.id);
  if (!property || !slug) return fail('No se encontró la propiedad.');

  const { data: conversationId, error: startError } = await supabase.rpc('start_whatsapp_conversation', { p_contact_id: contactId.data });
  if (startError || !conversationId) return fail(startError ? translateDbError(startError).error.message : PROVIDER_ERROR);

  const location = [property.neighborhood, property.city].filter(Boolean).join(', ');
  const { error } = await supabase.rpc('send_property_whatsapp', {
    p_conversation_id: conversationId,
    p_property_id: propertyId.data,
    p_text: propertyMessage({
      title: property.title,
      price: property.price === null ? null : priceLabel(property.price, property.currency),
      location: location || null,
      url: `${await appOrigin()}/p/${slug}/${property.slug}`,
    }),
    p_photo_urls: property.property_images.slice(0, 3).map((image) => publicImageUrl(image.storage_path)),
  });
  if (error) return fail(translateDbError(error).error.message);
  redirect(`/panel/conversaciones?c=${conversationId}`);
}
