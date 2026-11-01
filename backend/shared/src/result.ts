/**
 * Resultado tipado para Server Actions, worker y utilidades.
 * Los errores llevan un código estable (para lógica y tests) y un mensaje en español (para la interfaz).
 */
export type Ok<T> = { ok: true; value: T };
export type Err<C extends string = string> = { ok: false; error: { code: C; message: string } };
export type Result<T, C extends string = string> = Ok<T> | Err<C>;

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value };
}

export function err<C extends string>(code: C, message: string): Err<C> {
  return { ok: false, error: { code, message } };
}

export function isOk<T, C extends string>(result: Result<T, C>): result is Ok<T> {
  return result.ok;
}
