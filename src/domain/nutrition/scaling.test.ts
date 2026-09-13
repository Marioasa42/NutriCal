import { describe, expect, it } from 'vitest';

import type { NutrientProfile } from '@/domain/food/food';
import { scaleMacros, scaleMicros, scaleProfile, scalingFactor } from '@/domain/nutrition/scaling';
import {
  grams,
  kilocalories,
  micrograms,
  milligrams,
  milliliters,
  type Micrograms,
  type Milligrams,
} from '@/domain/units/units';

/**
 * Tests del escalado de porciones.
 *
 * Lo que se prueba aquí no es que multiplicar funcione, sino las cuatro cosas
 * que el escalado tiene que conservar: la ausencia, el cero, la marca de cada
 * unidad y la ausencia de redondeo.
 */

/** Perfil de referencia por 100 g: una manzana, con huecos a propósito. */
const manzanaPor100: NutrientProfile = {
  macros: {
    energy: kilocalories(52),
    protein: grams(0.3),
    carbohydrates: grams(13.8),
    fat: grams(0.2),
    fiber: grams(2.4),
    // `sugars`, `saturatedFat` y `salt` faltan: la fuente no los aportaba.
  },
  micros: {
    vitaminC: milligrams(4.6),
    potassium: milligrams(107),
    folate: micrograms(3),
  },
};

describe('scalingFactor', () => {
  it('cien unidades base son el perfil tal cual', () => {
    expect(scalingFactor(grams(100))).toBe(1);
    expect(scalingFactor(milliliters(100))).toBe(1);
  });

  it('traduce cualquier cantidad a su proporción sobre cien', () => {
    expect(scalingFactor(grams(150))).toBe(1.5);
    expect(scalingFactor(grams(30))).toBe(0.3);
    expect(scalingFactor(grams(0))).toBe(0);
  });
});

describe('escalado de macronutrientes', () => {
  it('a cien unidades devuelve las mismas cifras', () => {
    expect(scaleMacros(manzanaPor100.macros, 1)).toEqual(manzanaPor100.macros);
  });

  it('multiplica cada macro por el factor', () => {
    const escalado = scaleMacros(manzanaPor100.macros, 1.5);
    expect(escalado.energy).toBe(78);
    expect(escalado.carbohydrates).toBeCloseTo(20.7, 10);
    expect(escalado.fiber).toBeCloseTo(3.6, 10);
  });

  it('una macro ausente sigue ausente, no se convierte en cero', () => {
    const escalado = scaleMacros(manzanaPor100.macros, 2);
    // Esta es la regla de D-001 y la razón de comprobar la clave y no el valor:
    // `escalado.sugars` valdría `undefined` en los dos casos, pero solo uno de
    // los dos significa "no lo sabemos".
    expect('sugars' in escalado).toBe(false);
    expect('saturatedFat' in escalado).toBe(false);
    expect('salt' in escalado).toBe(false);
    expect('fiber' in escalado).toBe(true);
  });

  it('un cero real sigue siendo cero a cualquier cantidad', () => {
    // El agua: cero calorías de verdad, y fibra declarada a cero.
    const agua = {
      energy: kilocalories(0),
      protein: grams(0),
      carbohydrates: grams(0),
      fat: grams(0),
      fiber: grams(0),
    };

    const escalado = scaleMacros(agua, 12.5);
    expect(escalado.energy).toBe(0);
    expect('fiber' in escalado).toBe(true);
    expect(escalado.fiber).toBe(0);
  });

  it('una cantidad de cero no borra las claves que sí se conocían', () => {
    const escalado = scaleMacros(manzanaPor100.macros, 0);
    expect(escalado.energy).toBe(0);
    // Comer cero gramos no convierte un dato conocido en desconocido.
    expect('fiber' in escalado).toBe(true);
    expect('sugars' in escalado).toBe(false);
  });
});

describe('escalado de micronutrientes', () => {
  it('escala solo los que la fuente aportaba', () => {
    const escalado = scaleMicros(manzanaPor100.micros, 1.82);
    expect(escalado.vitaminC).toBeCloseTo(8.372, 10);
    expect(escalado.potassium).toBeCloseTo(194.74, 10);
    expect('iron' in escalado).toBe(false);
    expect('vitaminB12' in escalado).toBe(false);
  });

  it('cada micronutriente conserva su unidad al escalar', () => {
    const escalado = scaleMicros(manzanaPor100.micros, 2);

    /*
     * La comprobación de verdad es de compilación, no de ejecución: estas dos
     * anotaciones solo compilan si el escalado devolvió la marca correcta para
     * cada clave. Cambiar `Milligrams` por `Micrograms` aquí rompe el build,
     * que es exactamente lo que se quiere de un tipo con marca.
     */
    const vitaminC: Milligrams | undefined = escalado.vitaminC;
    const folate: Micrograms | undefined = escalado.folate;

    expect(vitaminC).toBeCloseTo(9.2, 10);
    expect(folate).toBe(6);
  });
});

describe('scaleProfile', () => {
  it('escala macros y micros con la misma cantidad', () => {
    const perfil = scaleProfile(manzanaPor100, grams(182));
    expect(perfil.macros.energy).toBeCloseTo(94.64, 10);
    expect(perfil.micros.potassium).toBeCloseTo(194.74, 10);
  });

  it('funciona igual con un alimento medido en mililitros', () => {
    const refresco: NutrientProfile = {
      macros: {
        energy: kilocalories(0.3),
        protein: grams(0),
        carbohydrates: grams(0),
        fat: grams(0),
      },
      micros: { sodium: milligrams(4) },
    };

    const lata = scaleProfile(refresco, milliliters(330));
    expect(lata.macros.energy).toBeCloseTo(0.99, 10);
    expect(lata.micros.sodium).toBeCloseTo(13.2, 10);
  });

  it('no redondea: el resultado conserva los decimales que salgan', () => {
    // 33 g de la manzana dan 17,16 kcal. Un redondeo por el camino daría 17.
    const perfil = scaleProfile(manzanaPor100, grams(33));
    expect(perfil.macros.energy).toBeCloseTo(17.16, 10);
    expect(Number.isInteger(perfil.macros.energy)).toBe(false);
  });
});
