/*
 * Producto real de Open Food Facts, capturado el 2026-09-13 de
 * https://world.openfoodfacts.org/api/v2/product/3068320115245.json?fields=code,product_name,product_name_es,brands,quantity,serving_size,serving_quantity,nutriments,nutrition_data_per,image_front_small_url
 *
 * El contraste exacto de la Coca-Cola: aqui la fibra SI existe y vale cero, y es
 * la sal la que falta. Ademas la energia vale cero legitimamente, que es el caso
 * que rompe cualquier comprobacion del tipo `if (!kcal)`.
 *
 * Recortado: de `nutriments` se conservan solo las claves `_100g` y `_unit` de
 * los nutrientes que la fase 1 lee. El recorte nunca anade una clave que no
 * viniera, de modo que las ausencias del producto original siguen siendo
 * ausencias aqui, que es justo lo que estos fixtures tienen que demostrar.
 *
 * El tipo es `unknown` a proposito: obliga a que el test lo haga pasar por la
 * misma validacion que una respuesta de verdad, en lugar de colarlo ya tipado.
 */
export const evian: unknown = {
  code: '3068320115245',
  product_name: 'Natural mineral water',
  brands: 'Evian',
  quantity: '1.25L',
  serving_size: '1 L',
  serving_quantity: 1000,
  nutrition_data_per: '100ml',
  image_front_small_url:
    'https://images.openfoodfacts.org/images/products/306/832/011/5245/front_en.4.200.jpg',
  nutriments: {
    energy_100g: 0,
    energy_unit: 'kJ',
    'energy-kcal_100g': 0,
    'energy-kcal_unit': 'kcal',
    'energy-kj_100g': 0,
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
    fiber_100g: 0,
    fiber_unit: 'g',
  },
};
