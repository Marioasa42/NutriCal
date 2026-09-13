import { describe, expect, it } from 'vitest';

import type { MassFoodSnapshot, MealEntry } from '@/domain/diary/meal-entry';
import { dayTotals, entryTotals, sumProfiles } from '@/domain/diary/totals';
import type { NutrientProfile } from '@/domain/food/food';
import { grams, kilocalories, micrograms, milligrams } from '@/domain/units/units';
import { aDate, anInstant, makeExerciseEntry, makeFood, makeMealEntry } from '@/test/factories';

/**
 * Tests de la suma de nutrientes.
 *
 * El caso que de verdad importa no es que sumar funcione, sino qué pasa cuando
 * los registros no traen los mismos datos: es donde un total puede acabar
 * mintiendo sin que nadie se entere.
 */

/** Un perfil suelto, para probar la suma sin montar registros enteros. */
function perfil(options: {
  energy: number;
  protein?: number;
  fiber?: number;
  iron?: number;
  folate?: number;
}): NutrientProfile {
  return {
    macros: {
      energy: kilocalories(options.energy),
      protein: grams(options.protein ?? 0),
      carbohydrates: grams(0),
      fat: grams(0),
      ...(options.fiber !== undefined ? { fiber: grams(options.fiber) } : {}),
    },
    micros: {
      ...(options.iron !== undefined ? { iron: milligrams(options.iron) } : {}),
      ...(options.folate !== undefined ? { folate: micrograms(options.folate) } : {}),
    },
  };
}

describe('entryTotals', () => {
  it('escala la instantánea a la porción registrada', () => {
    // La manzana de las fábricas: 52 kcal por 100 g, registrada a 150 g.
    const totals = entryTotals(makeMealEntry({ amountG: 150 }));
    expect(totals.macros.energy).toBe(78);
    expect(totals.macros.carbohydrates).toBeCloseTo(20.7, 10);
    expect(totals.micros.vitaminC).toBeCloseTo(6.9, 10);
  });

  it('usa la instantánea del registro, no el alimento actual', () => {
    /*
     * Esta es la prueba de D-003 y de la decisión 2 de CLAUDE.md. El registro
     * lleva dentro una copia congelada del alimento; cambiar el alimento después
     * no puede tocar lo que ya está registrado.
     */
    const entry = makeMealEntry({ amountG: 100 });
    const original = entryTotals(entry).macros.energy;

    const corregido = makeFood({ id: entry.food.foodId, energyKcal: 999 });
    expect(entryTotals(entry).macros.energy).toBe(original);
    expect(corregido.per100.macros.energy).toBe(999);
  });

  it('media ración se escala sin redondear', () => {
    // Media unidad mediana de manzana: 91 g, que no es un múltiplo de cien.
    const food = makeFood();
    const serving = food.servings[0];
    if (serving === undefined) {
      throw new Error('La fábrica debería dar un alimento con una ración.');
    }

    const snapshot: MassFoodSnapshot = {
      foodId: food.id,
      name: food.name,
      source: food.source,
      baseUnit: 'g',
      per100: food.per100,
      completion: food.completion,
      capturedAt: anInstant(),
      servings: food.servings,
    };

    const entry: MealEntry = {
      ...makeMealEntry(),
      food: snapshot,
      portion: {
        selection: { kind: 'serving', servingId: serving.id, count: 0.5 },
        amountInBaseUnit: grams(91),
      },
    };

    // 52 × 0,91 = 47,32. Un redondeo intermedio daría 47 o 47,3.
    expect(entryTotals(entry).macros.energy).toBeCloseTo(47.32, 10);
  });
});

describe('sumProfiles', () => {
  it('un día sin registros suma cero y no declara nada desconocido', () => {
    const total = sumProfiles([]);
    expect(total.macros.energy).toBe(0);
    expect(total.macros.protein).toBe(0);
    expect(total.micros).toEqual({});
    // Sin registros no hay nadie que deje de aportar un dato.
    expect(total.unknown).toEqual({});
  });

  it('suma las macros obligatorias de todos los registros', () => {
    const total = sumProfiles([
      perfil({ energy: 100, protein: 5 }),
      perfil({ energy: 250, protein: 12 }),
    ]);
    expect(total.macros.energy).toBe(350);
    expect(total.macros.protein).toBe(17);
  });

  it('las obligatorias nunca aparecen como desconocidas', () => {
    // `Macros` es estricto: ningún alimento llega a serlo sin las cuatro (D-002).
    const total = sumProfiles([perfil({ energy: 100 })]);
    expect('energy' in total.unknown).toBe(false);
    expect('protein' in total.unknown).toBe(false);
    expect('carbohydrates' in total.unknown).toBe(false);
    expect('fat' in total.unknown).toBe(false);
  });

  it('suma lo que sabe y dice de cuántos registros no lo sabía', () => {
    /*
     * El caso que da sentido a todo esto: dos de tres registros traen fibra. El
     * total de fibra es 5, pero es un mínimo, no el total del día. Sumar cero
     * por el que falta daría el mismo número fingiendo que está completo.
     */
    const total = sumProfiles([
      perfil({ energy: 100, fiber: 2 }),
      perfil({ energy: 100, fiber: 3 }),
      perfil({ energy: 100 }),
    ]);

    expect(total.macros.fiber).toBe(5);
    expect(total.unknown.fiber).toBe(1);
  });

  it('un cero declarado cuenta como dato conocido, no como hueco', () => {
    // La diferencia entera entre D-001 y hacer las cosas a ojo: el agua declara
    // fibra cero de verdad, y eso es información, no ausencia de información.
    const total = sumProfiles([perfil({ energy: 0, fiber: 0 }), perfil({ energy: 100, fiber: 4 })]);
    expect(total.macros.fiber).toBe(4);
    expect('fiber' in total.unknown).toBe(false);
  });

  it('un nutriente que no aporta nadie se omite y se cuenta entero', () => {
    const total = sumProfiles([perfil({ energy: 100 }), perfil({ energy: 200 })]);
    // No hay una cifra de sal que enseñar...
    expect('salt' in total.macros).toBe(false);
    // ...pero sí se puede decir que ninguno de los dos registros la traía.
    expect(total.unknown.salt).toBe(2);
  });

  it('suma cada micronutriente en su propia unidad', () => {
    const total = sumProfiles([
      perfil({ energy: 100, iron: 2.5, folate: 30 }),
      perfil({ energy: 100, iron: 1.5 }),
    ]);

    expect(total.micros.iron).toBe(4);
    // El folato sale de un solo registro, y el recuento lo deja claro.
    expect(total.micros.folate).toBe(30);
    expect(total.unknown.folate).toBe(1);
    expect(total.unknown.iron).toBeUndefined();
  });

  it('los micronutrientes que nadie aporta no inventan un cero', () => {
    const total = sumProfiles([perfil({ energy: 100, iron: 2 })]);
    expect('vitaminB12' in total.micros).toBe(false);
    expect(total.unknown.vitaminB12).toBe(1);
  });
});

describe('dayTotals', () => {
  it('junta las comidas y el ejercicio del día', () => {
    const totals = dayTotals(
      [makeMealEntry({ amountG: 100 }), makeMealEntry({ amountG: 200 })],
      [makeExerciseEntry({ energyKcal: 120 }), makeExerciseEntry({ energyKcal: 80 })],
    );

    expect(totals.macros.energy).toBeCloseTo(156, 10);
    expect(totals.energyBurned).toBe(200);
  });

  it('un día sin ejercicio no ha quemado nada', () => {
    const totals = dayTotals([makeMealEntry()], []);
    expect(totals.energyBurned).toBe(0);
  });

  it('no cuenta los registros con lápida', () => {
    // Los repositorios ya los excluyen (D-014), pero un archivo de exportación
    // los lleva dentro a propósito (D-006). El resultado tiene que ser el mismo.
    const totals = dayTotals(
      [
        makeMealEntry({ amountG: 100 }),
        makeMealEntry({ amountG: 500, deletedAt: anInstant('2026-09-12T18:00:00.000Z') }),
      ],
      [makeExerciseEntry({ energyKcal: 300, deletedAt: anInstant('2026-09-12T18:00:00.000Z') })],
    );

    expect(totals.macros.energy).toBe(52);
    expect(totals.energyBurned).toBe(0);
  });

  it('un registro borrado tampoco cuenta como dato que falta', () => {
    // Si contara, el día diría "un registro sin datos de sal" señalando a algo
    // que la persona usuaria ya borró y no puede arreglar.
    const totals = dayTotals(
      [makeMealEntry({ date: aDate(), deletedAt: anInstant('2026-09-12T18:00:00.000Z') })],
      [],
    );
    expect(totals.unknown).toEqual({});
  });
});
