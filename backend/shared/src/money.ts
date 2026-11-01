import { err, ok, type Result } from './result.ts';

/**
 * Dinero (PRD §6 Propiedades, docs/DATABASE.md).
 * - En TypeScript: centavos enteros en bigint. En la base: numeric(14,2).
 * - La moneda es siempre explícita; nunca se suman ni comparan montos de distinta moneda.
 */

export const CURRENCIES = ['ARS', 'USD'] as const;
export type Currency = (typeof CURRENCIES)[number];

export type Money = { readonly cents: bigint; readonly currency: Currency };

export type MoneyErrorCode = 'amount_empty' | 'amount_invalid' | 'amount_out_of_range' | 'currency_mismatch';

/** Máximo representable por numeric(14,2): 999.999.999.999,99 */
export const MAX_CENTS = 99_999_999_999_999n;

export function isCurrency(value: unknown): value is Currency {
  return typeof value === 'string' && (CURRENCIES as readonly string[]).includes(value);
}

export function money(cents: bigint, currency: Currency): Money {
  if (cents > MAX_CENTS || cents < -MAX_CENTS) throw new RangeError('Monto fuera de rango');
  return { cents, currency };
}

/**
 * Interpreta un monto cargado por un usuario argentino:
 * "100.000" → 100000; "1.234,50" → 1234,50; "1234,5" → 1234,50; "99.90" → 99,90.
 * No acepta negativos ni más de dos decimales.
 */
export function parseAmount(input: string, currency: Currency): Result<Money, MoneyErrorCode> {
  const value = input.trim().replace(/\s/g, '').replace(/^\$/, '');
  if (value === '') return err('amount_empty', 'Ingresá un monto.');

  let integer: string;
  let decimals = '';
  if (value.includes(',')) {
    // Coma decimal; los puntos son separadores de miles.
    const [intPart = '', decPart = '', ...rest] = value.split(',');
    if (rest.length > 0 || !isGroupedOrPlain(intPart, '.')) return invalidAmount();
    integer = intPart.replaceAll('.', '');
    decimals = decPart;
  } else {
    const parts = value.split('.');
    const last = parts.at(-1) ?? '';
    if (parts.length === 2 && last.length <= 2 && last.length > 0) {
      // Un solo punto seguido de 1 o 2 dígitos: punto decimal.
      integer = parts[0] ?? '';
      decimals = last;
    } else {
      if (!isGroupedOrPlain(value, '.')) return invalidAmount();
      integer = value.replaceAll('.', '');
    }
  }

  if (!/^\d+$/.test(integer) || !/^\d{0,2}$/.test(decimals)) return invalidAmount();

  const cents = BigInt(integer) * 100n + BigInt(decimals.padEnd(2, '0'));
  if (cents > MAX_CENTS) {
    return err('amount_out_of_range', 'El monto es demasiado grande.');
  }
  return ok({ cents, currency });
}

/** Valor numeric(14,2) que devuelve la base (string o number) → Money. */
export function fromDbNumeric(value: string | number, currency: Currency): Money {
  const text = typeof value === 'number' ? value.toFixed(2) : value.trim();
  const match = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!match) throw new TypeError('Valor numérico inválido');
  const [, sign, intPart = '0', decPart = ''] = match;
  const abs = BigInt(intPart) * 100n + BigInt(decPart.padEnd(2, '0'));
  return money(sign ? -abs : abs, currency);
}

/** Money → texto para una columna numeric(14,2). La moneda va en su propia columna. */
export function toDbNumeric(amount: Money): string {
  const negative = amount.cents < 0n;
  const abs = negative ? -amount.cents : amount.cents;
  const text = `${abs / 100n}.${(abs % 100n).toString().padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

export function addMoney(a: Money, b: Money): Result<Money, MoneyErrorCode> {
  if (a.currency !== b.currency) return mismatch();
  const cents = a.cents + b.cents;
  if (cents > MAX_CENTS || cents < -MAX_CENTS) {
    return err('amount_out_of_range', 'El monto es demasiado grande.');
  }
  return ok(money(cents, a.currency));
}

/** -1, 0 o 1. Error si las monedas son distintas (se necesita una cotización explícita). */
export function compareMoney(a: Money, b: Money): Result<-1 | 0 | 1, MoneyErrorCode> {
  if (a.currency !== b.currency) return mismatch();
  return ok(a.cents === b.cents ? 0 : a.cents < b.cents ? -1 : 1);
}

const integerFormat = new Intl.NumberFormat('es-AR', { useGrouping: true, maximumFractionDigits: 0 });

/** "USD 100.000" · "ARS 1.234,50". Muestra decimales solo si los hay. */
export function formatMoney(amount: Money): string {
  const negative = amount.cents < 0n;
  const abs = negative ? -amount.cents : amount.cents;
  const fraction = abs % 100n;
  const integer = integerFormat.format(abs / 100n);
  const decimals = fraction === 0n ? '' : `,${fraction.toString().padStart(2, '0')}`;
  return `${amount.currency} ${negative ? '-' : ''}${integer}${decimals}`;
}

function isGroupedOrPlain(value: string, separator: string): boolean {
  if (!value.includes(separator)) return /^\d+$/.test(value);
  const groups = value.split(separator);
  const [first = '', ...rest] = groups;
  return /^\d{1,3}$/.test(first) && rest.every((group) => /^\d{3}$/.test(group));
}

function invalidAmount() {
  return err('amount_invalid' as const, 'El monto no es válido. Ejemplo: 150.000 o 1.234,50.');
}

function mismatch() {
  return err(
    'currency_mismatch' as const,
    'No se pueden combinar montos en monedas distintas sin una cotización.',
  );
}
