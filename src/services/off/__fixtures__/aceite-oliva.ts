/*
 * Producto real de Open Food Facts, capturado el 2026-09-13 de
 * https://world.openfoodfacts.org/api/v2/product/8480000047403.json?fields=code,product_name,product_name_es,brands,quantity,serving_size,serving_quantity,nutriments,nutrition_data_per,image_front_small_url
 *
 * Solido de alta densidad energetica con ceros reales en proteinas e hidratos.
 * `serving_quantity` es `null`, asi que no hay porcion que ofrecer. La tabla va
 * por 100 ml pese a ser un aceite: 91 g de grasa solo cuadran por volumen.
 *
 * Recortado: de `nutriments` se conservan solo las claves `_100g` y `_unit` de
 * los nutrientes que la fase 1 lee. El recorte nunca anade una clave que no
 * viniera, de modo que las ausencias del producto original siguen siendo
 * ausencias aqui, que es justo lo que estos fixtures tienen que demostrar.
 *
 * El tipo es `unknown` a proposito: obliga a que el test lo haga pasar por la
 * misma validacion que una respuesta de verdad, en lugar de colarlo ya tipado.
 */
export const aceiteOliva: unknown = {
  code: '8480000047403',
  product_name: 'Aceite de oliva virgen extra',
  product_name_es: 'Aceite de oliva virgen extra',
  brands: 'Hacendado',
  quantity: '1 l',
  serving_size: '100',
  serving_quantity: null,
  nutrition_data_per: '100ml',
  image_front_small_url:
    'https://images.openfoodfacts.org/images/products/848/000/004/7403/front_en.13.200.jpg',
  nutriments: {
    energy_100g: 3442,
    energy_unit: 'kJ',
    'energy-kcal_100g': 822,
    'energy-kcal_unit': 'kcal',
    'energy-kj_100g': 3442,
    'energy-kj_unit': 'kJ',
    proteins_100g: 0,
    proteins_unit: 'g',
    carbohydrates_100g: 0,
    carbohydrates_unit: 'g',
    fat_100g: 91,
    fat_unit: 'g',
    sugars_100g: 0,
    sugars_unit: 'g',
    'saturated-fat_100g': 13,
    'saturated-fat_unit': 'g',
    fiber_100g: 0,
    fiber_unit: 'g',
    salt_100g: 0,
    salt_unit: 'g',
    sodium_100g: 0,
    sodium_unit: 'g',
  },
};
