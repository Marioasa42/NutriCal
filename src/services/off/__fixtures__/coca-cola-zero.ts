/*
 * Producto real de Open Food Facts, capturado el 2026-09-13 de
 * https://world.openfoodfacts.org/api/v2/product/5449000131805.json?fields=code,product_name,product_name_es,brands,quantity,serving_size,serving_quantity,nutriments,nutrition_data_per,image_front_small_url
 *
 * Ceros legitimos en cuatro nutrientes a la vez (proteinas, hidratos, grasas y
 * azucares) conviviendo con una ausencia real: no existe ninguna clave de fibra.
 * Ademas la tabla se declara por 100 g aunque el envase sean 330 ml.
 *
 * Recortado: de `nutriments` se conservan solo las claves `_100g` y `_unit` de
 * los nutrientes que la fase 1 lee. El recorte nunca anade una clave que no
 * viniera, de modo que las ausencias del producto original siguen siendo
 * ausencias aqui, que es justo lo que estos fixtures tienen que demostrar.
 *
 * El tipo es `unknown` a proposito: obliga a que el test lo haga pasar por la
 * misma validacion que una respuesta de verdad, en lugar de colarlo ya tipado.
 */
export const cocaColaZero: unknown = {
  code: '5449000131805',
  product_name: 'Coca-Cola Zero Azúcar',
  product_name_es: 'Coca-Cola zero azúcar',
  brands: 'Coca-Cola',
  quantity: '330ml',
  serving_size: '1 can (330 ml)',
  serving_quantity: 330,
  nutrition_data_per: '100g',
  image_front_small_url:
    'https://images.openfoodfacts.org/images/products/544/900/013/1805/front_en.797.200.jpg',
  nutriments: {
    energy_100g: 0.9,
    energy_unit: 'kJ',
    'energy-kcal_100g': 0.2,
    'energy-kcal_unit': 'kcal',
    'energy-kj_100g': 0.9,
    'energy-kj_unit': 'kJ',
    proteins_100g: 0,
    proteins_unit: 'g',
    carbohydrates_100g: 0,
    carbohydrates_unit: 'g',
    fat_100g: 0,
    fat_unit: 'g',
    sugars_100g: 0,
    sugars_unit: 'g',
    'saturated-fat_100g': 0,
    'saturated-fat_unit': 'g',
    salt_100g: 0.02,
    salt_unit: 'g',
    sodium_100g: 0.008,
    sodium_unit: 'g',
  },
};
