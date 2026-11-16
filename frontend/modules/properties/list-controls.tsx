import { ListControls, type ListFilter } from '@/modules/panel/list-controls.tsx';
import { OPERATION_LABELS, STATUS_LABELS, TYPE_LABELS } from './labels.ts';

export type PropertyListParams = { q: string; estado: string; operacion: string; tipo: string; asignado: string; orden: string };

// El primero es el orden por defecto.
const SORTS = {
  recientes: 'Últimas modificadas',
  codigo: 'Más nuevas primero',
  'precio-asc': 'Precio: menor a mayor',
  'precio-desc': 'Precio: mayor a menor',
};

const FILTERS: ListFilter[] = [
  { key: 'estado', label: 'Estado', all: 'Todos los estados', options: STATUS_LABELS },
  { key: 'operacion', label: 'Operación', all: 'Venta y alquiler', options: OPERATION_LABELS },
  { key: 'tipo', label: 'Tipo', all: 'Todos los tipos', options: TYPE_LABELS },
  { key: 'asignado', label: 'A cargo', all: 'De todo el equipo', options: { mine: 'Mis propiedades', unassigned: 'Sin asignar' } },
];

/** Búsqueda, filtros, orden y vistas del listado de propiedades. */
export function PropertyListControls({ params }: { params: PropertyListParams }) {
  return (
    <ListControls
      params={params}
      filters={FILTERS}
      sorts={SORTS}
      storageKey="propiedades"
      searchLabel="Buscar propiedades"
      searchPlaceholder="Título, barrio, dirección o código"
    />
  );
}
