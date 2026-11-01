import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatTime, fromLocal, parseDate, parseTime } from './dates.ts';

describe('formato en hora de Argentina', () => {
  it('convierte de UTC a Buenos Aires', () => {
    // 02:30 UTC del 1/11 son las 23:30 del 31/10 en Argentina.
    expect(formatDateTime('2026-11-01T02:30:00Z')).toBe('31/10/2026 23:30');
  });

  it('usa DD/MM/AAAA y 24 h', () => {
    expect(formatDate(new Date('2026-03-05T15:00:00Z'))).toBe('05/03/2026');
    expect(formatTime('2026-03-05T21:07:00Z')).toBe('18:07');
    expect(formatTime('2026-03-05T03:00:00Z')).toBe('00:00');
  });

  it('rechaza fechas inválidas', () => {
    expect(() => formatDate('no es fecha')).toThrow(TypeError);
  });
});

describe('parseDate', () => {
  it.each([
    ['31/10/2026', { day: 31, month: 10, year: 2026 }],
    ['1/2/2027', { day: 1, month: 2, year: 2027 }],
    ['29/02/2028', { day: 29, month: 2, year: 2028 }],
  ])('%s', (input, expected) => {
    expect(parseDate(input)).toEqual({ ok: true, value: expected });
  });

  it.each(['31/11/2026', '29/02/2027', '2026-10-31', '10/31/2026', '00/01/2026', ''])('rechaza %j', (input) => {
    expect(parseDate(input).ok).toBe(false);
  });
});

describe('parseTime', () => {
  it('acepta 24 h', () => {
    expect(parseTime('18:30')).toEqual({ ok: true, value: { hour: 18, minute: 30 } });
    expect(parseTime('0:05')).toEqual({ ok: true, value: { hour: 0, minute: 5 } });
  });

  it.each(['24:00', '12:60', '6 pm', ''])('rechaza %j', (input) => {
    expect(parseTime(input).ok).toBe(false);
  });
});

describe('fromLocal', () => {
  it('interpreta la hora como de Argentina', () => {
    expect(fromLocal({ year: 2026, month: 10, day: 31, hour: 23, minute: 30 }).toISOString()).toBe(
      '2026-11-01T02:30:00.000Z',
    );
  });

  it('ida y vuelta', () => {
    const instant = fromLocal({ year: 2027, month: 1, day: 15, hour: 9, minute: 0 });
    expect(formatDateTime(instant)).toBe('15/01/2027 09:00');
  });
});
