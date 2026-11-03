import { describe, expect, it } from 'vitest';
import { translateDbError } from './db-errors.ts';

describe('translateDbError', () => {
  it.each([
    ['23505', 'duplicate'],
    ['23503', 'invalid_reference'],
    ['23514', 'invalid_data'],
    ['22P02', 'invalid_data'],
    ['42501', 'forbidden'],
    ['PGRST116', 'not_found'],
    ['P0002', 'not_found'],
    ['IG003', 'last_owner'],
    ['IG004', 'platform_only'],
    ['IG005', 'slug_unavailable'],
    ['IG006', 'legal_document_invalid'],
    ['IG007', 'email_not_confirmed'],
    ['IG008', 'organization_limit'],
    ['IG009', 'invitation_unavailable'],
    ['IG010', 'last_terminal_stage'],
    ['IG011', 'contact_exists'],
    ['IG012', 'reassign_not_allowed'],
    ['IG013', 'invalid_merge'],
    ['IG014', 'invalid_property_merge'],
    ['XX000', 'unexpected'],
  ])('%s → %s', (code, expected) => {
    expect(translateDbError({ code }).error.code).toBe(expected);
  });

  it('error nulo o sin código es inesperado', () => {
    expect(translateDbError(null).error.code).toBe('unexpected');
    expect(translateDbError({}).error.code).toBe('unexpected');
  });

  it('indica el límite y el plan', () => {
    const detail = JSON.stringify({ resource: 'users', limit: 2, plan: 'Inicial' });
    expect(translateDbError({ code: 'IG001', details: detail }).error).toEqual({
      code: 'plan_limit_reached',
      message: 'Llegaste al límite de 2 usuarios del plan Inicial. Cambiá de plan para agregar más.',
    });
    const single = JSON.stringify({ resource: 'whatsapp_numbers', limit: 1, plan: 'Profesional' });
    expect(translateDbError({ code: 'IG001', detail: single }).error.message).toContain(
      '1 número de WhatsApp del plan Profesional',
    );
  });

  it('límite con detalle ilegible usa un mensaje genérico', () => {
    expect(translateDbError({ code: 'IG001', details: 'no-json' }).error.message).toBe(
      'Llegaste al límite de tu plan. Cambiá de plan para agregar más.',
    );
  });

  it('explica por qué no se puede usar una invitación', () => {
    expect(translateDbError({ code: 'IG009', details: 'expired' }).error.message).toContain('venció');
    expect(translateDbError({ code: 'IG009', detail: 'email_mismatch' }).error.message).toContain('otro email');
    expect(translateDbError({ code: 'IG009', details: 'raro' }).error.message).toContain('no es válido');
  });

  it('nunca expone el mensaje original de la base', () => {
    const result = translateDbError({ code: '23505', details: 'Key (email)=(x@y.test) already exists.' });
    expect(result.error.message).not.toContain('x@y.test');
  });
});
