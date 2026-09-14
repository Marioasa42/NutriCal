import { describe, expect, it } from 'vitest';

import type { DayTotals } from '@/domain/diary/day';
import type { DailyGoals } from '@/domain/goals/goals';
import { newGoalsId } from '@/domain/identity/ids';
import {
  buildMicronutrientPanel,
  buildMicronutrientRow,
} from '@/domain/nutrition/micronutrient-panel';
import { referenceIntakeFor, upperLimitFor } from '@/domain/nutrition/reference-intakes';
import { instant, localDate } from '@/domain/time/local-date';
import { grams, kilocalories, micrograms, milligrams } from '@/domain/units/units';

/** Totales de un día mínimos, con solo lo que cada test necesita fijar. */
function dayTotals(overrides: Partial<DayTotals> = {}): DayTotals {
  return {
    macros: {
      energy: kilocalories(2000),
      protein: grams(100),
      carbohydrates: grams(250),
      fat: grams(70),
    },
    micros: {},
    energyBurned: kilocalories(0),
    unknown: {},
    ...overrides,
  };
}

function goalsWith(micros: DailyGoals['micros']): DailyGoals {
  return {
    id: newGoalsId(),
    effectiveFrom: localDate('2026-01-01'),
    energy: kilocalories(2000),
    protein: grams(100),
    carbohydrates: grams(250),
    fat: grams(70),
    micros,
    origin: { kind: 'manual' },
    createdAt: instant('2026-01-01T00:00:00.000Z'),
    updatedAt: instant('2026-01-01T00:00:00.000Z'),
  };
}

describe('buildMicronutrientRow', () => {
  it('sin ningún registro que aporte el dato, sale "noData" y no un cero', () => {
    const row = buildMicronutrientRow('iron', dayTotals(), 3, 'unspecified', undefined);
    expect(row).toEqual({ kind: 'noData', id: 'iron', totalEntries: 3 });
  });

  it('con dato conocido y sin objetivo propio, usa la referencia oficial', () => {
    const totals = dayTotals({ micros: { iron: milligrams(9) } });
    const row = buildMicronutrientRow('iron', totals, 2, 'female', undefined);

    if (row.kind !== 'known') {
      throw new Error('Se esperaba una fila con dato.');
    }
    expect(row.amount).toBe(9);
    expect(row.target).toBe(referenceIntakeFor('iron', 'female'));
    expect(row.targetSource).toBe('reference');
    expect(row.unknownCount).toBe(0);
  });

  it('prefiere el objetivo propio cuando existe, sobre la referencia', () => {
    const totals = dayTotals({ micros: { iron: milligrams(9) } });
    const goals = goalsWith({ iron: milligrams(20) });
    const row = buildMicronutrientRow('iron', totals, 1, 'female', goals);

    if (row.kind !== 'known') {
      throw new Error('Se esperaba una fila con dato.');
    }
    expect(row.target).toBe(20);
    expect(row.targetSource).toBe('goal');
    expect(row.percentOfTarget).toBeCloseTo(45);
  });

  it('sin ningún objetivo fijado todavía (perfil nuevo), cae a la referencia igual que con uno vacío', () => {
    const totals = dayTotals({ micros: { calcium: milligrams(500) } });
    const conGoalsVacios = buildMicronutrientRow('calcium', totals, 1, 'male', goalsWith({}));
    const sinGoals = buildMicronutrientRow('calcium', totals, 1, 'male', undefined);

    expect(conGoalsVacios).toEqual(sinGoals);
  });

  it('conserva el recuento de "unknown" en la fila', () => {
    const totals = dayTotals({ micros: { vitaminC: milligrams(30) }, unknown: { vitaminC: 2 } });
    const row = buildMicronutrientRow('vitaminC', totals, 5, 'unspecified', undefined);

    expect(row.kind === 'known' && row.unknownCount).toBe(2);
  });

  it('lleva el límite superior cuando la tabla lo tiene, y lo omite cuando es "ND"', () => {
    const totals = dayTotals({
      micros: { vitaminC: milligrams(30), potassium: milligrams(1000) },
    });

    const vitaminaC = buildMicronutrientRow('vitaminC', totals, 1, 'unspecified', undefined);
    expect(vitaminaC.kind === 'known' && vitaminaC.upperLimit).toBe(upperLimitFor('vitaminC'));

    // El potasio es uno de los "ND" de D-045: no hay límite superior fiable.
    const potasio = buildMicronutrientRow('potassium', totals, 1, 'unspecified', undefined);
    expect(potasio.kind === 'known' && 'upperLimit' in potasio).toBe(false);
  });

  it('funciona igual para un micronutriente en microgramos', () => {
    const totals = dayTotals({ micros: { vitaminB12: micrograms(1.2) } });
    const row = buildMicronutrientRow('vitaminB12', totals, 1, 'unspecified', undefined);

    expect(row.kind === 'known' && row.amount).toBe(1.2);
  });
});

describe('buildMicronutrientPanel', () => {
  it('devuelve una fila por cada uno de los veintidós micronutrientes del catálogo', () => {
    const panel = buildMicronutrientPanel(dayTotals(), 0, 'unspecified', undefined);
    expect(panel).toHaveLength(22);
  });

  it('el yodo, que ninguna fuente aporta hoy, sale como "noData" y no revienta nada', () => {
    const panel = buildMicronutrientPanel(dayTotals(), 4, 'unspecified', undefined);
    const iodine = panel.find((row) => row.id === 'iodine');
    expect(iodine).toEqual({ kind: 'noData', id: 'iodine', totalEntries: 4 });
  });
});
