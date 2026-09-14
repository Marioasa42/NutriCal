import { describe, expect, it } from 'vitest';

import { parseGoalsForm, type GoalsFormFields } from '@/features/goals/goals-form';

function fields(overrides: Partial<GoalsFormFields> = {}): GoalsFormFields {
  return {
    energy: '2000',
    protein: '100',
    carbohydrates: '250',
    fat: '70',
    fiber: '',
    ...overrides,
  };
}

describe('parseGoalsForm', () => {
  it('acepta las cuatro macros sin fibra', () => {
    const result = parseGoalsForm(fields());
    expect(result).toEqual({
      kind: 'valid',
      values: { energy: 2000, protein: 100, carbohydrates: 250, fat: 70 },
    });
  });

  it('incluye la fibra cuando se rellena', () => {
    const result = parseGoalsForm(fields({ fiber: '30' }));
    expect(result.kind).toBe('valid');
    expect(result.kind === 'valid' && result.values.fiber).toBe(30);
  });

  it('admite la coma decimal', () => {
    const result = parseGoalsForm(fields({ protein: '100,5' }));
    expect(result.kind === 'valid' && result.values.protein).toBe(100.5);
  });

  it('rechaza si falta cualquiera de las cuatro macros obligatorias', () => {
    expect(parseGoalsForm(fields({ energy: '' })).kind).toBe('invalid');
    expect(parseGoalsForm(fields({ protein: '' })).kind).toBe('invalid');
    expect(parseGoalsForm(fields({ carbohydrates: '' })).kind).toBe('invalid');
    expect(parseGoalsForm(fields({ fat: '' })).kind).toBe('invalid');
  });

  it('rechaza una energía de cero: un objetivo de cero calorías no es un objetivo', () => {
    expect(parseGoalsForm(fields({ energy: '0' })).kind).toBe('invalid');
  });

  it('rechaza un número negativo en cualquier campo', () => {
    expect(parseGoalsForm(fields({ protein: '-5' })).kind).toBe('invalid');
    expect(parseGoalsForm(fields({ fiber: '-1' })).kind).toBe('invalid');
  });

  it('rechaza texto que no es un número', () => {
    expect(parseGoalsForm(fields({ fat: 'setenta' })).kind).toBe('invalid');
  });

  it('un campo opcional vacío no cuenta como cero', () => {
    const result = parseGoalsForm(fields({ fiber: '' }));
    expect(result.kind === 'valid' && 'fiber' in result.values).toBe(false);
  });
});
