import { describe, expect, it } from 'vitest';
import { createEvolutionProvider, jidToE164, mapEvolutionState, parseEvolutionWebhook } from './evolution.ts';
import { WhatsAppProviderError } from './whatsapp.ts';

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };

function fakeFetch(status: number, response: unknown) {
  const calls: Call[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });
    return new Response(JSON.stringify(response), { status });
  }) as unknown as typeof fetch;
  return { calls, fetcher };
}

const message = (overrides: Record<string, unknown> = {}, key: Record<string, unknown> = {}) => ({
  event: 'messages.upsert',
  instance: 'ip_1',
  data: {
    key: { remoteJid: '5491155550002@s.whatsapp.net', fromMe: false, id: 'ABC', ...key },
    pushName: 'Bruno',
    message: { conversation: 'Hola' },
    messageType: 'conversation',
    messageTimestamp: 1_793_000_000,
    ...overrides,
  },
});

describe('parseEvolutionWebhook', () => {
  it('normaliza un mensaje de texto', () => {
    expect(parseEvolutionWebhook(message())).toEqual({
      kind: 'message',
      externalId: 'ABC',
      phoneE164: '+5491155550002',
      pushName: 'Bruno',
      fromMe: false,
      type: 'text',
      body: 'Hola',
      mediaMime: null,
      mediaName: null,
      sentAt: new Date(1_793_000_000_000).toISOString(),
    });
  });

  it('lee el texto de un mensaje extendido', () => {
    const event = parseEvolutionWebhook(message({ message: { extendedTextMessage: { text: 'Con link' } } }));
    expect(event).toMatchObject({ kind: 'message', type: 'text', body: 'Con link' });
  });

  it('normaliza adjuntos con su epígrafe, tipo y nombre', () => {
    expect(parseEvolutionWebhook(message({ message: { imageMessage: { caption: 'Frente', mimetype: 'image/jpeg' } } })))
      .toMatchObject({ type: 'image', body: 'Frente', mediaMime: 'image/jpeg' });
    expect(parseEvolutionWebhook(message({ message: { audioMessage: { mimetype: 'audio/ogg; codecs=opus' } } })))
      .toMatchObject({ type: 'audio', body: '', mediaMime: 'audio/ogg; codecs=opus' });
    expect(parseEvolutionWebhook(message({ message: { documentMessage: { fileName: 'a.pdf', mimetype: 'application/pdf' } } })))
      .toMatchObject({ type: 'document', mediaName: 'a.pdf' });
    expect(parseEvolutionWebhook(message({
      message: { documentWithCaptionMessage: { message: { documentMessage: { caption: 'Plano', fileName: 'p.pdf' } } } },
    }))).toMatchObject({ type: 'document', body: 'Plano', mediaName: 'p.pdf' });
  });

  it('conserva como aviso lo que no se puede mostrar', () => {
    expect(parseEvolutionWebhook(message({ message: { locationMessage: {} }, messageType: 'locationMessage' })))
      .toMatchObject({ kind: 'message', type: 'other' });
  });

  it('distingue lo enviado desde el teléfono', () => {
    expect(parseEvolutionWebhook(message({}, { fromMe: true }))).toMatchObject({ fromMe: true });
  });

  it('usa el número alternativo cuando el chat viene con LID', () => {
    expect(parseEvolutionWebhook(message({}, { remoteJid: '123@lid', remoteJidAlt: '5491155550009@s.whatsapp.net' })))
      .toMatchObject({ phoneE164: '+5491155550009' });
    expect(parseEvolutionWebhook(message({}, { remoteJid: '123@lid' }))).toMatchObject({ kind: 'ignored' });
  });

  it('ignora grupos, estados y eventos técnicos', () => {
    expect(parseEvolutionWebhook(message({}, { remoteJid: '123-456@g.us' }))).toMatchObject({ kind: 'ignored' });
    expect(parseEvolutionWebhook(message({}, { remoteJid: 'status@broadcast' }))).toMatchObject({ kind: 'ignored' });
    expect(parseEvolutionWebhook(message({ messageType: 'reactionMessage' }))).toMatchObject({ kind: 'ignored' });
    expect(parseEvolutionWebhook(message({ messageType: 'protocolMessage' }))).toMatchObject({ kind: 'ignored' });
  });

  it('normaliza los cambios de conexión', () => {
    expect(parseEvolutionWebhook({ event: 'connection.update', data: { state: 'open', wuid: '5491144440000@s.whatsapp.net', statusReason: 200 } }))
      .toEqual({ kind: 'connection', state: 'connected', phoneE164: '+5491144440000', reason: 'status_200' });
    expect(parseEvolutionWebhook({ event: 'connection.update', data: { state: 'close', statusReason: 401 } }))
      .toMatchObject({ state: 'needs_qr' });
    expect(parseEvolutionWebhook({ event: 'CONNECTION_UPDATE', data: { state: 'close', statusReason: 428 } }))
      .toMatchObject({ state: 'disconnected' });
  });

  it('nunca lanza con datos inesperados', () => {
    for (const payload of [null, 'x', 1, [], {}, { event: 'messages.upsert' }, { event: 'messages.upsert', data: { key: {} } }, { event: 'otro', data: {} }]) {
      expect(parseEvolutionWebhook(payload).kind).toBe('ignored');
    }
  });
});

describe('jidToE164 y estados', () => {
  it('convierte solo chats individuales', () => {
    expect(jidToE164('5491155550002:12@s.whatsapp.net')).toBe('+5491155550002');
    expect(jidToE164('1@s.whatsapp.net')).toBeNull();
    expect(jidToE164('5491155550002@g.us')).toBeNull();
    expect(jidToE164(null)).toBeNull();
  });

  it('mapea los estados del proveedor', () => {
    expect(mapEvolutionState('open')).toBe('connected');
    expect(mapEvolutionState('connecting')).toBe('connecting');
    expect(mapEvolutionState('refused')).toBe('needs_qr');
    expect(mapEvolutionState('close')).toBe('disconnected');
    expect(mapEvolutionState(undefined)).toBe('disconnected');
  });
});

describe('createEvolutionProvider', () => {
  const build = (status: number, response: unknown) => {
    const { calls, fetcher } = fakeFetch(status, response);
    return { calls, provider: createEvolutionProvider({ baseUrl: 'https://evo.test/', apiKey: 'clave', fetch: fetcher }) };
  };

  it('crea la instancia con el webhook y solo los eventos necesarios', async () => {
    const { calls, provider } = build(201, { qrcode: { base64: 'data:image/png;base64,AA', pairingCode: null } });
    const result = await provider.createInstance({ instanceName: 'ip_1', webhookUrl: 'https://app.test/hook/s' });
    expect(result.qr?.base64).toBe('data:image/png;base64,AA');
    expect(calls[0]).toMatchObject({
      url: 'https://evo.test/instance/create',
      method: 'POST',
      headers: { apikey: 'clave' },
      body: {
        instanceName: 'ip_1',
        integration: 'WHATSAPP-BAILEYS',
        webhook: { url: 'https://app.test/hook/s', base64: false, events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'] },
      },
    });
  });

  it('envía texto con el número sin "+" y devuelve el id externo', async () => {
    const { calls, provider } = build(201, { key: { id: 'EXT1' } });
    await expect(provider.sendText({ instanceName: 'ip_1', phoneE164: '+5491155550002', text: 'Hola' })).resolves.toEqual({ externalId: 'EXT1' });
    expect(calls[0]).toMatchObject({ url: 'https://evo.test/message/sendText/ip_1', body: { number: '5491155550002', text: 'Hola' } });
  });

  it('envía adjuntos por URL', async () => {
    const { calls, provider } = build(201, { key: { id: 'EXT2' } });
    await provider.sendMedia({ instanceName: 'ip_1', phoneE164: '+5491155550002', type: 'image', mediaUrl: 'https://x.test/1.jpg', caption: 'Mirá' });
    expect(calls[0]?.body).toEqual({ number: '5491155550002', mediatype: 'image', media: 'https://x.test/1.jpg', caption: 'Mirá' });
  });

  it('traduce los errores sin exponer datos', async () => {
    const { provider } = build(500, { message: 'detalle interno' });
    const error = await provider.sendText({ instanceName: 'ip_1', phoneE164: '+5491155550002', text: 'Hola' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(WhatsAppProviderError);
    expect((error as WhatsAppProviderError).code).toBe('provider_http_500');
  });

  it('informa cuando no llega al proveedor', async () => {
    const provider = createEvolutionProvider({
      baseUrl: 'https://evo.test',
      apiKey: 'clave',
      fetch: (async () => {
        throw new Error('ECONNREFUSED clave');
      }) as unknown as typeof fetch,
    });
    await expect(provider.getState('ip_1')).rejects.toMatchObject({ code: 'provider_unreachable' });
  });

  it('quitar una instancia que ya no existe no es un error', async () => {
    const { provider } = build(404, {});
    await expect(provider.removeInstance('ip_1')).resolves.toBeUndefined();
  });

  it('descarga un adjunto o informa que no está disponible', async () => {
    const ok = build(200, { base64: 'QUJD', mimetype: 'image/jpeg' });
    await expect(ok.provider.downloadMedia({ instanceName: 'ip_1', externalId: 'E' })).resolves.toEqual({ base64: 'QUJD', mimeType: 'image/jpeg' });
    expect(ok.calls[0]?.body).toEqual({ message: { key: { id: 'E' } }, convertToMp4: false });
    const empty = build(200, {});
    await expect(empty.provider.downloadMedia({ instanceName: 'ip_1', externalId: 'E' })).rejects.toMatchObject({ code: 'provider_media_unavailable' });
  });
});
