import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import { err, ok, type Result } from './result.ts';

/**
 * Normalización de teléfonos (PRD §6 Contactos, docs/DATABASE.md).
 * - Formato E.164.
 * - Los argentinos siempre como móvil (+549…): la clave para detectar duplicados.
 * - Sin prefijo internacional se asume Argentina.
 */

export type PhoneErrorCode = 'phone_empty' | 'phone_invalid';

export type NormalizedPhone = {
  /** E.164; si es argentino, siempre +549… */
  e164: string;
  /** Valor tal como se cargó (recortado), para mostrar y auditar. */
  raw: string;
};

const MAX_INPUT_LENGTH = 32;
const AR_CALLING_CODE = '54';

export function normalizePhone(input: string): Result<NormalizedPhone, PhoneErrorCode> {
  const raw = input.trim();
  if (raw === '') return err('phone_empty', 'Ingresá un teléfono.');
  if (raw.length > MAX_INPUT_LENGTH || /[a-z]/i.test(raw)) {
    return invalid();
  }

  const parsed = parsePhoneNumberFromString(raw, 'AR');
  if (!parsed) return invalid();

  if (parsed.countryCallingCode !== AR_CALLING_CODE) {
    return parsed.isValid() ? ok({ e164: parsed.number, raw }) : invalid();
  }

  // Número nacional sin el 9 de móvil: área + abonado (10 dígitos si es válido).
  const national = parsed.nationalNumber.startsWith('9')
    ? parsed.nationalNumber.slice(1)
    : parsed.nationalNumber;

  if (parsed.isValid()) return ok({ e164: `+549${national}`, raw });

  // libphonenumber no quita el "15" de móvil cuando la característica tiene 4 dígitos
  // (ej. 02944 15 41-2345). Se prueba quitarlo después de una característica de 2 a 4 dígitos
  // y se acepta solo si exactamente una interpretación es válida.
  if (national.length === 12) {
    const candidates = new Set<string>();
    for (const areaLength of [2, 3, 4]) {
      if (national.slice(areaLength, areaLength + 2) !== '15') continue;
      const candidate = national.slice(0, areaLength) + national.slice(areaLength + 2);
      if (parsePhoneNumberFromString(`+54${candidate}`)?.isValid()) candidates.add(candidate);
    }
    const [only] = candidates;
    if (candidates.size === 1 && only) return ok({ e164: `+549${only}`, raw });
  }

  return invalid();
}

/** Igual que normalizePhone pero devuelve null si no es válido. Útil para comparar duplicados. */
export function toE164(input: string): string | null {
  const result = normalizePhone(input);
  return result.ok ? result.value.e164 : null;
}

function invalid() {
  return err(
    'phone_invalid' as const,
    'El teléfono no es válido. Cargalo con característica, por ejemplo 11 2345-6789.',
  );
}
