import { describe, expect, it } from 'vitest';

import {
  MICRONUTRIENT_REFERENCE_INTAKES,
  referenceIntakeFor,
  upperLimitFor,
} from '@/domain/nutrition/reference-intakes';
import { MICRONUTRIENT_IDS, unitOf } from '@/domain/nutrition/micronutrients';

/**
 * Estos valores vienen de una tabla oficial citada (ver el comentario del
 * archivo), así que lo que hay que probar no es "¿son correctos los números?"
 * —eso lo garantiza la cita, no un test— sino las propiedades que el código sí
 * puede romper: que la unidad de cada cifra coincide con la que el catálogo de
 * micronutrientes declara, y que la elección de sexo hace lo que promete.
 */

describe('el catálogo cubre exactamente los 22 micronutrientes', () => {
  it('sin que falte ni sobre ninguno', () => {
    // La comprobación de tipos ya lo garantiza en tiempo de compilación
    // (`ReferenceIntakesAreInSync`); esto lo repite en tiempo de ejecución
    // porque un `Record` mal escrito a mano podría tener una clave con el
    // valor `undefined` que el tipo no vería.
    for (const id of MICRONUTRIENT_IDS) {
      expect(MICRONUTRIENT_REFERENCE_INTAKES[id]).toBeDefined();
    }
    expect(Object.keys(MICRONUTRIENT_REFERENCE_INTAKES)).toHaveLength(MICRONUTRIENT_IDS.length);
  });
});

describe('cada cifra lleva la unidad que le corresponde', () => {
  it('miligramos o microgramos, según lo que declara MICRONUTRIENTS', () => {
    // Los constructores `milligrams`/`micrograms` ya impiden mezclar la unidad
    // en tiempo de compilación (decisión 1 de CLAUDE.md: unidades canónicas con
    // marca); esto comprueba que la MAGNITUD introducida a mano no se equivocó
    // de orden de tamaño, que es el error que el tipo no puede cazar: escribir
    // `milligrams(3000)` en vez de `micrograms(3000)` para la vitamina A
    // compilaría igual y sería mil veces la cifra real.
    for (const id of MICRONUTRIENT_IDS) {
      const { female, male, upperLimit } = MICRONUTRIENT_REFERENCE_INTAKES[id];
      const [min, max]: readonly [number, number] =
        unitOf(id) === 'ug' ? [0.1, 5000] : [0.05, 4200];

      for (const amount of [female, male, ...(upperLimit === undefined ? [] : [upperLimit])]) {
        expect(amount).toBeGreaterThanOrEqual(min);
        expect(amount).toBeLessThanOrEqual(max);
      }
    }
  });
});

describe('referenceIntakeFor', () => {
  it('devuelve el valor de mujer u hombre cuando el sexo se declara', () => {
    expect(referenceIntakeFor('iron', 'female')).toBe(18);
    expect(referenceIntakeFor('iron', 'male')).toBe(8);
  });

  it('sin sexo declarado, toma el mayor de los dos (D-044)', () => {
    // El hierro es el caso donde manda la mujer: 18 mg frente a 8.
    expect(referenceIntakeFor('iron', 'unspecified')).toBe(18);
    // La vitamina A es el caso donde manda el hombre: 900 µg frente a 700.
    expect(referenceIntakeFor('vitaminA', 'unspecified')).toBe(900);
  });

  it('cuando los dos coinciden, da igual cuál "gane"', () => {
    expect(referenceIntakeFor('vitaminD', 'unspecified')).toBe(15);
  });
});

describe('upperLimitFor', () => {
  it('existe para un nutriente con límite establecido', () => {
    expect(upperLimitFor('iron')).toBe(45);
  });

  it('es `undefined` cuando la fuente dice "ND" (D-045)', () => {
    // La B12 es uno de los siete sin límite superior establecido. Devolver un
    // número aquí sería inventar un dato que la ciencia no respalda.
    expect(upperLimitFor('vitaminB12')).toBeUndefined();
    expect(upperLimitFor('vitaminK')).toBeUndefined();
    expect(upperLimitFor('thiamin')).toBeUndefined();
    expect(upperLimitFor('riboflavin')).toBeUndefined();
    expect(upperLimitFor('potassium')).toBeUndefined();
  });

  it('el sodio tiene un techo aunque la fuente no le dé un UL clásico', () => {
    // Es la Chronic Disease Risk Reduction Intake (CDRR), no un UL de
    // toxicidad; se documenta así en el propio catálogo.
    expect(upperLimitFor('sodium')).toBe(2300);
  });
});
