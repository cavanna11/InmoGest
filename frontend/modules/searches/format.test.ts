import { describe, expect, it } from 'vitest';
import { budgetLabel, matchReason } from './format.ts';

describe('matchReason', () => {
  it('explica qué falta, como en el PRD', () => {
    expect(matchReason({ desired_met: 2, desired_total: 3, missing_features: ['garage'], exchange_rate: null })).toBe(
      'Cumple los obligatorios; deseables: 2 de 3, falta cochera',
    );
  });

  it('sin deseables solo dice que cumple', () => {
    expect(matchReason({ desired_met: 0, desired_total: 0, missing_features: [], exchange_rate: null })).toBe('Cumple los obligatorios');
  });

  it('indica la cotización usada', () => {
    expect(matchReason({ desired_met: 0, desired_total: 0, missing_features: [], exchange_rate: 1000 })).toContain('cotización 1000');
  });
});

describe('budgetLabel', () => {
  it('formatea rangos y topes', () => {
    expect(budgetLabel(80000, 100000, 'USD')).toBe('USD 80.000 a USD 100.000');
    expect(budgetLabel(null, 100000, 'USD')).toBe('Hasta USD 100.000');
    expect(budgetLabel(null, null, 'USD')).toBe('Sin presupuesto');
  });
});
