import { fromLocal } from '@inmogest/shared';
import { z } from 'zod';

// Entrada de visitas y tareas (CU-10). Fecha y hora en hora de Argentina, como las eligen los campos
// date y time del navegador; a la base llegan como instante UTC (ADR 0006).

/** "2026-11-08" + "11:30" → ISO en UTC. null si no es una fecha válida. */
export function localToIso(date: string, time: string): string | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const hour = /^(\d{2}):(\d{2})$/.exec(time);
  if (!day || !hour) return null;
  const [year, month, dayOfMonth, hours, minutes] = [day[1], day[2], day[3], hour[1], hour[2]].map(Number) as [number, number, number, number, number];
  if (month < 1 || month > 12 || dayOfMonth < 1 || dayOfMonth > 31 || hours > 23 || minutes > 59) return null;
  return fromLocal({ year, month, day: dayOfMonth, hour: hours, minute: minutes }).toISOString();
}

const assignee = z
  .string()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.uuid().nullable());

const optionalId = z
  .string()
  .optional()
  .transform((value) => (value ? value : null))
  .pipe(z.uuid().nullable());

const when = { date: z.string().min(1, 'Elegí la fecha.'), time: z.string().min(1, 'Elegí la hora.') };

export const appointmentSchema = z.object({
  contactId: z.uuid('Elegí el cliente.'),
  propertyId: z.uuid('Elegí la propiedad.'),
  ...when,
  notes: z.string().trim().max(2000, 'Máximo 2000 caracteres.'),
  assignedUserId: assignee,
});

export const taskSchema = z.object({
  title: z.string().trim().min(1, 'Escribí qué hay que hacer.').max(200, 'Máximo 200 caracteres.'),
  ...when,
  priority: z.enum(['low', 'normal', 'high'], { message: 'Elegí la prioridad.' }),
  contactId: optionalId,
  propertyId: optionalId,
  assignedUserId: assignee,
});

export const rescheduleSchema = z.object(when);
