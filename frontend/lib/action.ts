import type { z } from 'zod';

/**
 * Estado que devuelven las Server Actions a los formularios (useActionState).
 * Los mensajes son en español y nunca incluyen SQL ni datos internos.
 */
export type FormState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Datos extra para mostrar una sola vez (por ejemplo, el enlace de una invitación). */
  data?: Record<string, string>;
};

export const idle: FormState = { status: 'idle' };

export function fail(message: string, fieldErrors?: Record<string, string>): FormState {
  return { status: 'error', message, ...(fieldErrors ? { fieldErrors } : {}) };
}

export function done(message: string, data?: Record<string, string>): FormState {
  return { status: 'success', message, ...(data ? { data } : {}) };
}

/** Errores de validación de Zod → un mensaje por campo (el primero). */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}

export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') values[key] = value;
  }
  return values;
}
