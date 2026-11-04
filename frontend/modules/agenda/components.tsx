'use client';

import { useActionState } from 'react';
import { FormMessage, SubmitButton } from '@/components/form-feedback.tsx';
import { Field, Input, Select } from '@/components/ui/form-controls.tsx';
import { idle } from '@/lib/action.ts';
import { createAppointmentAction, createTaskAction } from './actions.ts';

type Options = {
  contacts: Array<{ id: string; full_name: string }>;
  properties: Array<{ id: string; code: string | null; title: string }>;
  members: Array<{ userId: string; name: string }>;
  currentUserId: string;
  canAssignOthers: boolean;
  today: string;
};

function assignable({ members, currentUserId, canAssignOthers }: Options) {
  return canAssignOthers ? members : members.filter((member) => member.userId === currentUserId);
}

export function AppointmentForm(options: Options) {
  const [state, action] = useActionState(createAppointmentAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate key={state.status === 'success' ? state.message : 'visit'}>
      <FormMessage state={state} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="visit-contact" label="Cliente" error={e.contactId}>
          <Select id="visit-contact" name="contactId" defaultValue="">
            <option value="" disabled>
              Elegí un contacto
            </option>
            {options.contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="visit-property" label="Propiedad" error={e.propertyId}>
          <Select id="visit-property" name="propertyId" defaultValue="">
            <option value="" disabled>
              Elegí una propiedad
            </option>
            {options.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.code} · {property.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="visit-date" label="Fecha" error={e.date}>
          <Input id="visit-date" name="date" type="date" defaultValue={options.today} />
        </Field>
        <Field id="visit-time" label="Hora" error={e.time}>
          <Input id="visit-time" name="time" type="time" defaultValue="10:00" />
        </Field>
        <Field id="visit-agent" label="Agente">
          <Select id="visit-agent" name="assignedUserId" defaultValue={options.currentUserId}>
            <option value="">Sin asignar</option>
            {assignable(options).map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field id="visit-notes" label="Notas (opcional)">
        <Input id="visit-notes" name="notes" maxLength={2000} />
      </Field>
      <SubmitButton size="sm" className="justify-self-start">
        Agendar visita
      </SubmitButton>
    </form>
  );
}

export function TaskForm(options: Options) {
  const [state, action] = useActionState(createTaskAction, idle);
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4" noValidate key={state.status === 'success' ? state.message : 'task'}>
      <FormMessage state={state} />
      <Field id="task-title" label="Qué hay que hacer" error={e.title}>
        <Input id="task-title" name="title" maxLength={200} placeholder="Ej.: Llamar a Jorge por las fotos" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-4">
        <Field id="task-date" label="Vence" error={e.date}>
          <Input id="task-date" name="date" type="date" defaultValue={options.today} />
        </Field>
        <Field id="task-time" label="Hora" error={e.time}>
          <Input id="task-time" name="time" type="time" defaultValue="18:00" />
        </Field>
        <Field id="task-priority" label="Prioridad">
          <Select id="task-priority" name="priority" defaultValue="normal">
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </Select>
        </Field>
        <Field id="task-agent" label="Agente">
          <Select id="task-agent" name="assignedUserId" defaultValue={options.currentUserId}>
            <option value="">Sin asignar</option>
            {assignable(options).map((member) => (
              <option key={member.userId} value={member.userId}>
                {member.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="task-contact" label="Contacto (opcional)">
          <Select id="task-contact" name="contactId" defaultValue="">
            <option value="">Ninguno</option>
            {options.contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contact.full_name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="task-property" label="Propiedad (opcional)">
          <Select id="task-property" name="propertyId" defaultValue="">
            <option value="">Ninguna</option>
            {options.properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.code} · {property.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <SubmitButton size="sm" className="justify-self-start">
        Crear tarea
      </SubmitButton>
    </form>
  );
}
