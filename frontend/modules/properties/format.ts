import { formatMoney, fromDbNumeric, isCurrency } from '@inmogest/shared';

/** Precio para mostrar ("USD 98.000"); sin precio, "Consultar". */
export function priceLabel(price: number | null, currency: string): string {
  if (price === null || !isCurrency(currency)) return 'Consultar';
  return formatMoney(fromDbNumeric(price, currency));
}

/** Superficie en m² con formato argentino. */
export function areaLabel(value: number | null): string | null {
  return value === null ? null : `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(value)} m²`;
}
