import { describe, expect, it } from 'vitest';
import { createSecretBox, SecretBoxError } from './secret-box.ts';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('createSecretBox', () => {
  it('cifra y descifra', async () => {
    const box = await createSecretBox(KEY);
    const sealed = await box.seal('APP_USR-123-abc');
    expect(sealed).toMatch(/^v1\.[\w-]+\.[\w-]+$/);
    expect(sealed).not.toContain('APP_USR');
    expect(await box.open(sealed)).toBe('APP_USR-123-abc');
  });

  it('usa un IV distinto cada vez', async () => {
    const box = await createSecretBox(KEY);
    expect(await box.seal('x')).not.toBe(await box.seal('x'));
  });

  it('rechaza una clave que no tiene 32 bytes', async () => {
    await expect(createSecretBox(Buffer.alloc(16).toString('base64'))).rejects.toBeInstanceOf(SecretBoxError);
  });

  it('no abre con otra clave ni un texto alterado', async () => {
    const sealed = await (await createSecretBox(KEY)).seal('secreto');
    const other = await createSecretBox(Buffer.alloc(32, 9).toString('base64'));
    await expect(other.open(sealed)).rejects.toMatchObject({ code: 'invalid_payload' });
    const box = await createSecretBox(KEY);
    await expect(box.open(`${sealed.slice(0, -2)}AA`)).rejects.toMatchObject({ code: 'invalid_payload' });
    await expect(box.open('basura')).rejects.toMatchObject({ code: 'invalid_payload' });
  });
});
