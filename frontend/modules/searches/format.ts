import { formatMoney, fromDbNumeric, isCurrency } from '@inmogest/shared';
import { FEATURES, isFeature } from '../properties/labels.ts';

/** Presupuesto para mostrar ("Hasta USD 100.000", "USD 80.000 a USD 100.000"). */
export function budgetLabel(min: number | null, max: number | null, currency: string): string {
  if (!isCurrency(currency)) return 'Sin presupuesto';
  const label = (value: number) => formatMoney(fromDbNumeric(value, currency));
  if (min !== null && max !== null) return `${label(min)} a ${label(max)}`;
  if (max !== null) return `Hasta ${label(max)}`;
  if (min !== null) return `Desde ${label(min)}`;
  return 'Sin presupuesto';
}

export function featureNames(keys: string[]): string {
  return keys.map((key) => (isFeature(key) ? FEATURES[key] : key).toLowerCase()).join(', ');
}

/** Motivo de la coincidencia (PRD §6): "Cumple los obligatorios; deseables: 2 de 3, falta cochera". */
export function matchReason(match: { desired_met: number; desired_total: number; missing_features: string[]; exchange_rate: number | null }): string {
  const parts = ['Cumple los obligatorios'];
  if (match.desired_total > 0) {
    parts.push(
      `deseables: ${match.desired_met} de ${match.desired_total}${match.missing_features.length > 0 ? `, falta ${featureNames(match.missing_features)}` : ''}`,
    );
  }
  if (match.exchange_rate !== null) parts.push(`comparado con la cotización ${match.exchange_rate}`);
  return parts.join('; ');
}
