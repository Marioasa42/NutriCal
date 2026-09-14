import { describe, expect, it } from 'vitest';

import { goalsEffectiveOn, isEnergyGoalAllowed, minEnergyGoalFor, type DailyGoals } from '@/domain/goals/goals';
import type { GoalsId } from '@/domain/identity/ids';
import { instant, localDate } from '@/domain/time/local-date';
import { grams, kilocalories } from '@/domain/units/units';

/** Una versión de objetivos mínima, con solo los campos que cada test necesita fijar. */
function goalsVersion(overrides: Partial<DailyGoals> & Pick<DailyGoals, 'id'>): DailyGoals {
  return {
    effectiveFrom: localDate('2026-01-01'),
    energy: kilocalories(2000),
    protein: grams(100),
    carbohydrates: grams(250),
    fat: grams(70),
    micros: {},
    origin: { kind: 'manual' },
    createdAt: instant('2026-01-01T00:00:00.000Z'),
    updatedAt: instant('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

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

/**
 * La decisión 10 de la fase 2: dos versiones con el mismo `effectiveFrom`
 * (editar los objetivos dos veces el mismo día) deben desempatarse por
 * `updatedAt`, no por el orden en que lleguen del almacenamiento.
 */
describe('goalsEffectiveOn', () => {
  it('elige la versión vigente más reciente para la fecha', () => {
    const enero = goalsVersion({ id: 'g1' as GoalsId, effectiveFrom: localDate('2026-01-01') });
    const marzo = goalsVersion({
      id: 'g2' as GoalsId,
      effectiveFrom: localDate('2026-03-01'),
      energy: kilocalories(1800),
      updatedAt: instant('2026-03-01T00:00:00.000Z'),
    });

    expect(goalsEffectiveOn([enero, marzo], localDate('2026-06-15'))?.id).toBe('g2');
    // Un día anterior a la subida de marzo sigue viendo la versión de enero:
    // subir el objetivo hoy no reescribe si se cumplió en febrero.
    expect(goalsEffectiveOn([enero, marzo], localDate('2026-02-15'))?.id).toBe('g1');
  });

  it('desempata por updatedAt cuando dos versiones entran en vigor el mismo día', () => {
    // El caso real: se edita dos veces el mismo día. Las dos versiones tienen
    // el mismo `effectiveFrom`, y antes del arreglo el resultado dependía del
    // orden de llegada del array, no de cuál se guardó después.
    const primeraEdicion = goalsVersion({
      id: 'g1' as GoalsId,
      effectiveFrom: localDate('2026-06-01'),
      energy: kilocalories(1800),
      updatedAt: instant('2026-06-01T09:00:00.000Z'),
    });
    const segundaEdicion = goalsVersion({
      id: 'g2' as GoalsId,
      effectiveFrom: localDate('2026-06-01'),
      energy: kilocalories(2000),
      updatedAt: instant('2026-06-01T18:00:00.000Z'),
    });

    // El orden de entrada no debe importar: se prueban las dos permutaciones.
    expect(goalsEffectiveOn([primeraEdicion, segundaEdicion], localDate('2026-06-01'))?.id).toBe(
      'g2',
    );
    expect(goalsEffectiveOn([segundaEdicion, primeraEdicion], localDate('2026-06-01'))?.id).toBe(
      'g2',
    );
  });

  it('no cuenta una versión borrada, aunque sea la más reciente', () => {
    const viva = goalsVersion({ id: 'g1' as GoalsId, effectiveFrom: localDate('2026-01-01') });
    const borrada = goalsVersion({
      id: 'g2' as GoalsId,
      effectiveFrom: localDate('2026-03-01'),
      deletedAt: instant('2026-04-01T00:00:00.000Z'),
    });

    expect(goalsEffectiveOn([viva, borrada], localDate('2026-06-01'))?.id).toBe('g1');
  });

  it('no hay nada vigente antes de la primera versión', () => {
    const version = goalsVersion({ id: 'g1' as GoalsId, effectiveFrom: localDate('2026-06-01') });
    expect(goalsEffectiveOn([version], localDate('2026-01-01'))).toBeUndefined();
  });

  it('una lista vacía no tiene nada vigente', () => {
    expect(goalsEffectiveOn([], localDate('2026-01-01'))).toBeUndefined();
  });
});
