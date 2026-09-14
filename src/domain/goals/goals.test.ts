import { describe, expect, it } from 'vitest';

import { isEnergyGoalAllowed, minEnergyGoalFor } from '@/domain/goals/goals';
import { kilocalories } from '@/domain/units/units';

/**
 * El suelo de calorías, revisado en la fase 2 para depender del sexo (ver el
 * comentario extenso de `MIN_ENERGY_GOAL` sobre de dónde sale de verdad esta
 * cifra: es una convención clínica, no una tabla RDA/AI como el resto de
 * valores de referencia).
 */
describe('minEnergyGoalFor', () => {
  it('1500 kcal para hombre, 1200 para mujer o sin especificar', () => {
    expect(minEnergyGoalFor('male')).toBe(1500);
    expect(minEnergyGoalFor('female')).toBe(1200);
    expect(minEnergyGoalFor('unspecified')).toBe(1200);
  });
});

describe('isEnergyGoalAllowed', () => {
  it('rechaza por debajo del suelo que corresponda', () => {
    expect(isEnergyGoalAllowed(kilocalories(1199), 'female')).toBe(false);
    expect(isEnergyGoalAllowed(kilocalories(1499), 'male')).toBe(false);
  });

  it('acepta justo en el suelo y por encima', () => {
    expect(isEnergyGoalAllowed(kilocalories(1200), 'female')).toBe(true);
    expect(isEnergyGoalAllowed(kilocalories(1500), 'male')).toBe(true);
    expect(isEnergyGoalAllowed(kilocalories(2000), 'male')).toBe(true);
  });

  it('sin sexo, usa el suelo más bajo de los dos', () => {
    // A propósito, y al revés que en `referenceIntakeFor`: un suelo es un
    // límite que impide guardar un objetivo, así que ante la duda tiene que
    // ser el MENOS restrictivo. 1300 kcal pasaría el suelo de 1200 pero no el
    // de 1500, y sin declarar el sexo no hay que bloquearlo con un límite
    // pensado para hombres.
    expect(isEnergyGoalAllowed(kilocalories(1300))).toBe(true);
    expect(isEnergyGoalAllowed(kilocalories(1199))).toBe(false);
  });
});
