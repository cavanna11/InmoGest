import type { Database } from '@inmogest/shared';

type AccountState = Database['public']['Enums']['account_state'];

export const ACCOUNT_STATE_LABELS: Record<AccountState, string> = {
  trial: 'En prueba',
  active: 'Activa',
  read_only: 'Solo lectura',
  blocked: 'Bloqueada',
  pending_deletion: 'Para eliminar',
};

export const ROLE_LABELS: Record<string, string> = {
  owner: 'Dueño',
  agent: 'Agente',
};
