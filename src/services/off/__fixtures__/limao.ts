/*
 * Producto real de Open Food Facts, capturado el 2026-09-13 de
 * https://world.openfoodfacts.org/api/v2/product/5603533200005.json?fields=code,product_name,product_name_es,brands,quantity,serving_size,serving_quantity,nutriments,nutrition_data_per,image_front_small_url
 *
 * Incompleto de verdad: falta `carbohydrates_100g`, que es una macro obligatoria,
 * asi que este producto tiene que salir por la rama `needsCompletion`. Los
 * azucares tampoco estan. Tabla declarada por 100 ml.
 *
 * Recortado: de `nutriments` se conservan solo las claves `_100g` y `_unit` de
 * los nutrientes que la fase 1 lee. El recorte nunca anade una clave que no
 * viniera, de modo que las ausencias del producto original siguen siendo
 * ausencias aqui, que es justo lo que estos fixtures tienen que demostrar.
 *
 * El tipo es `unknown` a proposito: obliga a que el test lo haga pasar por la
 * misma validacion que una respuesta de verdad, en lugar de colarlo ya tipado.
 */
export const limao: unknown = {
  code: '5603533200005',
  product_name: 'Limão',
  brands: 'Frize',
  quantity: '25 cl',
  serving_size: '250 ml',
  serving_quantity: 250,
  nutrition_data_per: '100ml',
  image_front_small_url:
    'https://images.openfoodfacts.org/images/products/560/353/320/0005/front_pt.77.200.jpg',
  nutriments: {
    energy_100g: 5,
    energy_unit: 'kJ',
    'energy-kcal_100g': 1,
    'energy-kcal_unit': 'kcal',
    'energy-kj_100g': 5,
    'energy-kj_unit': 'kJ',
    proteins_100g: 0.05,
    proteins_unit: 'g',
    fat_100g: 0,
    fat_unit: 'g',
    salt_100g: 0.16,
    salt_unit: 'g',
    sodium_100g: 0.064,
    sodium_unit: 'g',
  },
};
