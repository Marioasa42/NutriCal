import { describe, expect, it } from 'vitest';

import type { Food } from '@/domain/food/food';
import type { FoodId, ServingId } from '@/domain/identity/ids';
import { instant } from '@/domain/time/local-date';
import { aceiteOliva } from '@/services/off/__fixtures__/aceite-oliva';
import { cocaColaZero } from '@/services/off/__fixtures__/coca-cola-zero';
import { evian } from '@/services/off/__fixtures__/evian';
import { limao } from '@/services/off/__fixtures__/limao';
import {
  normalizeProduct,
  normalizeProducts,
  readBaseUnit,
  type NormalizationContext,
  type ProductNormalization,
} from '@/services/off/normalize';
import { offProductSchema } from '@/services/off/schemas';

/**
 * Tests de normalización sobre productos reales de Open Food Facts.
 *
 * Los fixtures se capturaron una vez y viven en el repositorio: ningún test sale
 * a la red. La cabecera de cada archivo lleva la URL y la fecha de captura.
 */

const FETCHED_AT = instant('2026-09-13T12:00:00.000Z');

/**
 * Contexto determinista.
 *
 * La marca de los identificadores se pone con `as` solo aquí: en un test lo que
 * importa es que el identificador sea predecible, no que venga de un UUID.
 */
function testContext(): NormalizationContext {
  let counter = 0;
  return {
    now: () => FETCHED_AT,
    newFoodId: () => `food-${++counter}` as FoodId,
    newServingId: () => `serving-${++counter}` as ServingId,
  };
}

/** Estrecha el resultado a la rama completa y falla con un mensaje claro si no lo es. */
function expectComplete(result: ProductNormalization): Food {
  if (result.kind !== 'complete') {
    throw new Error(`Se esperaba un alimento completo y llegó "${result.kind}".`);
  }
  return result.food;
}

/** Los nutrientes crudos de un fixture, para los tests centinela. */
function rawNutriments(fixture: unknown): Record<string, unknown> {
  const parsed = offProductSchema.parse(fixture);
  return parsed.nutriments ?? {};
}

/*
 * ---------------------------------------------------------------------------
 * Centinelas de los fixtures.
 *
 * Cada fixture está aquí porque demuestra algo concreto. Si alguien refresca uno
 * y el producto ha cambiado en la fuente, estos tests avisan en vez de dejar que
 * el resto de la suite siga pasando mientras prueba otra cosa.
 * ---------------------------------------------------------------------------
 */
describe('los fixtures siguen conteniendo el caso que demuestran', () => {
  it('la Coca-Cola Zero trae ceros de verdad y no trae fibra', () => {
    const n = rawNutriments(cocaColaZero);
    expect(n.sugars_100g).toBe(0);
    expect(n.proteins_100g).toBe(0);
    expect(n.fat_100g).toBe(0);
    expect('fiber_100g' in n).toBe(false);
  });

  it('el agua trae fibra a cero y no trae sal, justo al revés', () => {
    const n = rawNutriments(evian);
    expect(n.fiber_100g).toBe(0);
    expect(n['energy-kcal_100g']).toBe(0);
    expect('salt_100g' in n).toBe(false);
  });

  it('al refresco de limón le falta una macro obligatoria', () => {
    const n = rawNutriments(limao);
    expect('carbohydrates_100g' in n).toBe(false);
  });

  it('el aceite no declara porción', () => {
    expect(offProductSchema.parse(aceiteOliva).serving_quantity).toBeNull();
  });
});

/*
 * ---------------------------------------------------------------------------
 * El caso central: cero legítimo frente a nutriente ausente.
 * ---------------------------------------------------------------------------
 */
describe('Coca-Cola Zero: cuatro ceros reales y una ausencia real', () => {
  const food = expectComplete(normalizeProduct(cocaColaZero, testContext()));

  it('conserva como cero los nutrientes que valen cero', () => {
    expect(food.per100.macros.protein).toBe(0);
    expect(food.per100.macros.carbohydrates).toBe(0);
    expect(food.per100.macros.fat).toBe(0);
    expect(food.per100.macros.sugars).toBe(0);
  });

  it('omite la clave del nutriente que la fuente no aporta', () => {
    // No es que valga cero: es que este producto no declara fibra en absoluto.
    expect('fiber' in food.per100.macros).toBe(false);
    expect(food.per100.macros.fiber).toBeUndefined();
  });

  it('conserva los valores pequeños que no son cero', () => {
    expect(food.per100.macros.energy).toBe(0.2);
    expect(food.per100.macros.salt).toBe(0.02);
  });

  it('declara exactamente qué macros conoce y cuáles no', () => {
    // La aserción más fuerte del archivo: fija la lista entera de claves, así que
    // falla tanto si se pierde un cero como si aparece una clave inventada.
    expect(Object.keys(food.per100.macros).sort()).toEqual([
      'carbohydrates',
      'energy',
      'fat',
      'protein',
      'salt',
      'saturatedFat',
      'sugars',
    ]);
  });
});

describe('Agua mineral: el contraste exacto', () => {
  const food = expectComplete(normalizeProduct(evian, testContext()));

  it('acepta una energía de cero sin mandar el producto a borrador', () => {
    expect(food.per100.macros.energy).toBe(0);
  });

  it('conserva la fibra a cero, que aquí sí viene declarada', () => {
    expect(food.per100.macros.fiber).toBe(0);
  });

  it('omite la sal, que aquí es la que falta', () => {
    expect('salt' in food.per100.macros).toBe(false);
  });

  it('no hay ninguna lista fija de nutrientes que siempre falten', () => {
    // Este es el test que demuestra que la distinción se decide producto a
    // producto y no por una regla escrita a mano: en la Coca-Cola falta la fibra
    // y hay sal, y en el agua hay fibra y falta la sal.
    const refresco = expectComplete(normalizeProduct(cocaColaZero, testContext()));
    expect('fiber' in refresco.per100.macros).toBe(false);
    expect('salt' in refresco.per100.macros).toBe(true);
    expect('fiber' in food.per100.macros).toBe(true);
    expect('salt' in food.per100.macros).toBe(false);
  });
});

/*
 * ---------------------------------------------------------------------------
 * La rama de borrador de la decisión D-002.
 * ---------------------------------------------------------------------------
 */
describe('Refresco de limón: producto incompleto', () => {
  const result = normalizeProduct(limao, testContext());

  it('sale por la rama de completar en lugar de lanzar o de descartarse', () => {
    expect(result.kind).toBe('needsCompletion');
  });

  it('nombra exactamente la macro que hay que pedir', () => {
    if (result.kind !== 'needsCompletion') {
      throw new Error('Se esperaba un borrador.');
    }
    expect(result.draft.missing).toEqual(['carbohydrates']);
  });

  it('conserva en el borrador lo que sí se sabe, ceros incluidos', () => {
    if (result.kind !== 'needsCompletion') {
      throw new Error('Se esperaba un borrador.');
    }
    // Un cero dentro de un borrador sigue siendo un cero: que falte una macro no
    // contamina la lectura de las demás.
    expect(result.draft.macros.fat).toBe(0);
    expect(result.draft.macros.protein).toBe(0.05);
    expect(result.draft.macros.energy).toBe(1);
    expect('carbohydrates' in result.draft.macros).toBe(false);
    expect('sugars' in result.draft.macros).toBe(false);
  });

  it('no inventa un identificador para algo que todavía no es un alimento', () => {
    // El borrador no tiene `id`: solo lo tendrá cuando esté completo y se guarde.
    expect(result.kind === 'needsCompletion' && 'id' in result.draft).toBe(false);
  });
});

/*
 * ---------------------------------------------------------------------------
 * Unidad base y porciones.
 * ---------------------------------------------------------------------------
 */
describe('unidad base', () => {
  it('el envase manda sobre la tabla cuando se contradicen', () => {
    // La Coca-Cola declara su tabla por 100 g y se vende en una lata de 330 ml,
    // y su porción de 330 son mililitros. Si ganara la tabla, el alimento
    // quedaría en gramos con una porción en mililitros metida dentro.
    const producto = offProductSchema.parse(cocaColaZero);
    expect(producto.nutrition_data_per).toBe('100g');
    expect(producto.quantity).toBe('330ml');
    expect(readBaseUnit(producto)).toBe('ml');
  });

  it('reconoce las unidades de volumen tal y como las escribe la fuente', () => {
    expect(readBaseUnit(offProductSchema.parse(evian))).toBe('ml'); // "1.25L"
    expect(readBaseUnit(offProductSchema.parse(limao))).toBe('ml'); // "25 cl"
    expect(readBaseUnit(offProductSchema.parse(aceiteOliva))).toBe('ml'); // "1 l"
  });

  it('usa gramos cuando nada indica volumen', () => {
    expect(readBaseUnit(offProductSchema.parse({ quantity: '500 g' }))).toBe('g');
    expect(readBaseUnit(offProductSchema.parse({}))).toBe('g');
  });

  it('cae en la tabla declarada cuando el envase no dice nada', () => {
    expect(readBaseUnit(offProductSchema.parse({ nutrition_data_per: '100ml' }))).toBe('ml');
  });

  it('el envase manda también cuando el sólido es el que lleva la tabla mal', () => {
    // La dirección contraria del caso de la Coca-Cola: aquí el envase dice masa
    // y es la tabla la que se declara en mililitros por error de la fuente. Si
    // ganara la tabla saldría un alimento en mililitros con una porción que el
    // envase declaró en gramos, que es el mismo error de D-005 con las unidades
    // cambiadas de sitio.
    //
    // Producto sintético, no capturado: los archivos de `__fixtures__` guardan
    // solo productos reales con su URL y su fecha, y esta incoherencia concreta
    // se construye aquí para no mezclar un invento con esas capturas.
    const solidoConTablaEnMl = {
      code: '0000000000001',
      product_name: 'Yogur natural',
      quantity: '500 g',
      serving_size: '125 g',
      serving_quantity: 125,
      nutrition_data_per: '100ml',
      nutriments: {
        'energy-kcal_100g': 61,
        proteins_100g: 3.5,
        carbohydrates_100g: 4.7,
        fat_100g: 3.3,
      },
    };

    expect(readBaseUnit(offProductSchema.parse(solidoConTablaEnMl))).toBe('g');

    // Y el alimento entero sale coherente: mandar el envase no descoloca la
    // porción, que se queda en los gramos que el propio envase declaraba.
    const food = expectComplete(normalizeProduct(solidoConTablaEnMl, testContext()));
    expect(food.baseUnit).toBe('g');
    expect(food.servings).toEqual([{ id: 'serving-2', label: '125 g', amountInBaseUnit: 125 }]);
  });

  it('el envase entero pesa más que la ración cuando ambos hablan', () => {
    // Con la señal de masa añadida, el orden en que se miran los dos campos deja
    // de ser indiferente: antes solo podía decidir `quantity` si decía volumen.
    // Una lata de 330 ml con una ración declarada en gramos sigue siendo bebida.
    const producto = offProductSchema.parse({ quantity: '330 ml', serving_size: '20 g' });
    expect(readBaseUnit(producto)).toBe('ml');
  });

  it('lee las abreviaturas largas de masa sin quedarse en la primera letra', () => {
    // Fija el orden de la alternancia: si `g` se probara antes que `gr`, el
    // límite de palabra fallaría ante la `r` y el producto caería en la tabla.
    for (const quantity of ['500 gr', '500 gramos', '1 kg', '250g']) {
      expect(readBaseUnit(offProductSchema.parse({ quantity }))).toBe('g');
    }
  });
});

describe('porciones', () => {
  it('construye la porción en la unidad base del alimento', () => {
    const food = expectComplete(normalizeProduct(cocaColaZero, testContext()));
    expect(food.baseUnit).toBe('ml');
    expect(food.servings).toEqual([
      { id: 'serving-2', label: '1 can (330 ml)', amountInBaseUnit: 330 },
    ]);
  });

  it('no ofrece porción cuando la fuente no declara ninguna', () => {
    // El aceite trae `serving_quantity: null`. Inventar una porción de cien
    // mililitros porque `serving_size` dice `"100"` sería adivinar.
    const food = expectComplete(normalizeProduct(aceiteOliva, testContext()));
    expect(food.servings).toEqual([]);
  });

  it('construye una etiqueta legible cuando la fuente solo da el número', () => {
    const result = normalizeProduct(
      { code: '1234567890', product_name: 'Prueba', serving_size: '30', serving_quantity: 30 },
      testContext(),
    );
    expect(result.kind).toBe('needsCompletion');
    if (result.kind !== 'needsCompletion') {
      return;
    }
    expect(result.draft.servings[0]?.label).toBe('30 g');
  });
});

/*
 * ---------------------------------------------------------------------------
 * Identidad y procedencia.
 * ---------------------------------------------------------------------------
 */
describe('identidad del alimento', () => {
  const food = expectComplete(normalizeProduct(cocaColaZero, testContext()));

  it('prefiere el nombre en castellano', () => {
    expect(food.name).toBe('Coca-Cola zero azúcar');
  });

  it('se queda con la primera marca de la lista', () => {
    expect(food.brand).toBe('Coca-Cola');
  });

  it('guarda de dónde salió y cuándo', () => {
    expect(food.source).toEqual({
      kind: 'openFoodFacts',
      barcode: '5449000131805',
      fetchedAt: FETCHED_AT,
    });
  });

  it('nace sin ninguna cifra puesta a mano', () => {
    // La lista de D-002 empieza vacía: todo lo que hay ahora viene de la fuente.
    expect(food.completion.userFilled).toEqual([]);
  });

  it('deja los micronutrientes vacíos, que son trabajo de la fase 2', () => {
    expect(food.per100.micros).toEqual({});
  });

  it('usa el reloj inyectado para las marcas de tiempo de persistencia', () => {
    expect(food.createdAt).toBe(FETCHED_AT);
    expect(food.updatedAt).toBe(FETCHED_AT);
  });
});

/*
 * ---------------------------------------------------------------------------
 * Lo que no se puede leer.
 * ---------------------------------------------------------------------------
 */
describe('productos ilegibles', () => {
  it.each([
    ['no es un objeto', null],
    ['es una lista', []],
    ['es un número', 42],
  ])('descarta lo que %s', (_caso, raw) => {
    expect(normalizeProduct(raw, testContext()).kind).toBe('unreadable');
  });

  it('descarta un producto sin código de barras', () => {
    expect(normalizeProduct({ product_name: 'Sin código' }, testContext()).kind).toBe('unreadable');
  });

  it('descarta un producto sin nombre utilizable', () => {
    const result = normalizeProduct({ code: '1234567890', product_name: '  ' }, testContext());
    expect(result.kind).toBe('unreadable');
  });

  it('no descarta un producto por no traer campos que no necesitamos', () => {
    // Regresión: con `serving_quantity: z.unknown()` sin `.optional()`, Zod trata
    // la clave como obligatoria y este producto, que es perfectamente utilizable,
    // se caía entero por un campo opcional que ni siquiera leemos si falta.
    const result = normalizeProduct(
      {
        code: '1234567890',
        product_name: 'Producto mínimo',
        nutriments: {
          'energy-kcal_100g': 100,
          proteins_100g: 1,
          carbohydrates_100g: 2,
          fat_100g: 3,
        },
      },
      testContext(),
    );
    expect(result.kind).toBe('complete');
  });

  it('nunca lanza, ni con la entrada más hostil', () => {
    // La decisión D-002 dice que la normalización no lanza excepciones. Aquí se
    // comprueba con valores que romperían cualquier lectura descuidada.
    for (const raw of [undefined, null, '', 0, [], {}, { code: 5 }, { nutriments: 'no' }]) {
      expect(() => normalizeProduct(raw, testContext())).not.toThrow();
    }
  });
});

/*
 * ---------------------------------------------------------------------------
 * Una página entera de resultados.
 * ---------------------------------------------------------------------------
 */
describe('normalizeProducts', () => {
  it('reparte cada producto en su montón sin que uno malo tire la página', () => {
    const context = testContext();
    const resultado = normalizeProducts(
      [cocaColaZero, limao, evian, 'basura', aceiteOliva],
      context,
    );

    expect(resultado.foods).toHaveLength(3);
    expect(resultado.drafts).toHaveLength(1);
    expect(resultado.unreadable).toBe(1);
    expect(resultado.drafts[0]?.missing).toEqual(['carbohydrates']);
  });

  it('devuelve una página vacía sin quejarse si no hay nada', () => {
    expect(normalizeProducts([], testContext())).toEqual({
      foods: [],
      drafts: [],
      unreadable: 0,
    });
  });
});
