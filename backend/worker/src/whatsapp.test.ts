import { WhatsAppProviderError, type WhatsAppProvider } from '@inmogest/shared';
import { describe, expect, it, vi } from 'vitest';
import type { Logger } from './logger.ts';
import { baseMime, mediaExtension, processOutbox, reconcileConnections, type OutboxItem, type WhatsAppStore } from './whatsapp.ts';

const logger: Logger = () => undefined;

const item = (overrides: Partial<OutboxItem> = {}): OutboxItem => ({
  id: 'o1',
  organization_id: 'org',
  connection_id: 'c1',
  instance_name: 'ip_1',
  message_id: 'm1',
  phone_e164: '+5491155550002',
  type: 'text',
  body: 'Hola',
  media_path: null,
  media_url: null,
  media_mime: null,
  media_name: null,
  attempts: 1,
  ...overrides,
});

function fakes(items: OutboxItem[] = []) {
  const store = {
    claimOutbox: vi.fn(async () => items),
    completeOutbox: vi.fn(async () => undefined),
    failOutbox: vi.fn(async () => undefined),
    signedMediaUrl: vi.fn(async (path: string): Promise<string | null> => `https://storage.test/${path}?token=t`),
    activeConnections: vi.fn(async () => []),
    setConnectionState: vi.fn(async () => undefined),
  } satisfies WhatsAppStore;
  const provider = {
    createInstance: vi.fn(),
    getQr: vi.fn(),
    getState: vi.fn(),
    removeInstance: vi.fn(),
    sendText: vi.fn(async () => ({ externalId: 'EXT' })),
    sendMedia: vi.fn(async () => ({ externalId: 'EXT' })),
    downloadMedia: vi.fn(),
  } satisfies WhatsAppProvider;
  return { store, provider };
}

describe('processOutbox', () => {
  it('envía un texto y lo confirma con el id externo', async () => {
    const { store, provider } = fakes([item()]);
    await expect(processOutbox(store, provider, logger)).resolves.toBe(1);
    expect(provider.sendText).toHaveBeenCalledWith({ instanceName: 'ip_1', phoneE164: '+5491155550002', text: 'Hola' });
    expect(store.completeOutbox).toHaveBeenCalledWith('o1', 'EXT');
  });

  it('firma el adjunto privado antes de enviarlo', async () => {
    const { store, provider } = fakes([item({ type: 'document', body: 'Plano', media_path: 'org/outbound/a.pdf', media_mime: 'application/pdf', media_name: 'a.pdf' })]);
    await processOutbox(store, provider, logger);
    expect(provider.sendMedia).toHaveBeenCalledWith(expect.objectContaining({
      type: 'document',
      mediaUrl: 'https://storage.test/org/outbound/a.pdf?token=t',
      fileName: 'a.pdf',
      caption: 'Plano',
    }));
  });

  it('usa directo la URL pública de una foto de propiedad', async () => {
    const { store, provider } = fakes([item({ type: 'image', media_url: 'https://x.test/1.jpg' })]);
    await processOutbox(store, provider, logger);
    expect(store.signedMediaUrl).not.toHaveBeenCalled();
    expect(provider.sendMedia).toHaveBeenCalledWith(expect.objectContaining({ mediaUrl: 'https://x.test/1.jpg' }));
  });

  it('registra el error del proveedor y sigue con el siguiente', async () => {
    const { store, provider } = fakes([item({ id: 'o1' }), item({ id: 'o2' })]);
    provider.sendText.mockRejectedValueOnce(new WhatsAppProviderError('provider_http_500', 500));
    await processOutbox(store, provider, logger);
    expect(store.failOutbox).toHaveBeenCalledWith('o1', 'provider_http_500', 30);
    expect(store.completeOutbox).toHaveBeenCalledWith('o2', 'EXT');
  });

  it('no filtra el mensaje de un error inesperado', async () => {
    const { store, provider } = fakes([item()]);
    provider.sendText.mockRejectedValueOnce(new Error('dato personal'));
    await processOutbox(store, provider, logger);
    expect(store.failOutbox).toHaveBeenCalledWith('o1', 'unexpected', 30);
  });

  it('falla si no se puede firmar el adjunto', async () => {
    const { store, provider } = fakes([item({ type: 'image', media_path: 'org/x.jpg' })]);
    store.signedMediaUrl.mockResolvedValueOnce(null);
    await processOutbox(store, provider, logger);
    expect(store.failOutbox).toHaveBeenCalledWith('o1', 'media_unavailable', 30);
    expect(provider.sendMedia).not.toHaveBeenCalled();
  });
});

describe('reconcileConnections', () => {
  const withConnection = () => {
    const f = fakes();
    f.store.activeConnections.mockResolvedValue([{ id: 'c1', instance_name: 'ip_1', status: 'connected' }] as never);
    return f;
  };

  it('actualiza el estado si cambió', async () => {
    const { store, provider } = withConnection();
    provider.getState.mockResolvedValue('disconnected');
    await reconcileConnections(store, provider, logger);
    expect(store.setConnectionState).toHaveBeenCalledWith('c1', 'disconnected', 'reconciled');
  });

  it('no escribe si sigue igual', async () => {
    const { store, provider } = withConnection();
    provider.getState.mockResolvedValue('connected');
    await reconcileConnections(store, provider, logger);
    expect(store.setConnectionState).not.toHaveBeenCalled();
  });

  it('una instancia que ya no existe requiere escanear de nuevo', async () => {
    const { store, provider } = withConnection();
    provider.getState.mockRejectedValue(new WhatsAppProviderError('provider_http_404', 404));
    await reconcileConnections(store, provider, logger);
    expect(store.setConnectionState).toHaveBeenCalledWith('c1', 'needs_qr', 'instance_missing');
  });

  it('si no llega al proveedor no marca desconectada a la inmobiliaria', async () => {
    const { store, provider } = withConnection();
    provider.getState.mockRejectedValue(new WhatsAppProviderError('provider_unreachable'));
    await reconcileConnections(store, provider, logger);
    expect(store.setConnectionState).not.toHaveBeenCalled();
  });
});

describe('adjuntos', () => {
  it('normaliza el tipo y su extensión', () => {
    expect(baseMime('audio/ogg; codecs=opus')).toBe('audio/ogg');
    expect(mediaExtension('audio/ogg; codecs=opus')).toBe('ogg');
    expect(mediaExtension('application/x-msdownload')).toBeNull();
    expect(mediaExtension(null)).toBeNull();
  });
});
