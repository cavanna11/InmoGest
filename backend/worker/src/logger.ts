/**
 * Logs JSON estructurados (docs/OBSERVABILITY.md). Nunca registrar contenido de mensajes, nombres,
 * teléfonos, emails, tokens ni claves: solo ids, códigos y duraciones.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFields = Record<string, string | number | boolean | null | undefined>;
export type Logger = (level: LogLevel, action: string, fields?: LogFields) => void;

export function createJsonLogger(component: string, write: (line: string) => void = console.log): Logger {
  return (level, action, fields = {}) => {
    write(JSON.stringify({ time: new Date().toISOString(), level, component, action, ...fields }));
  };
}

export const silentLogger: Logger = () => {};
