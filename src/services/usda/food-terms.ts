import type { FoodSource } from '@/domain/food/food';
import { normalizeForSearch } from '@contracts/text';

/**
 * Glosario español → inglés de alimentos frescos y básicos, para USDA
 * FoodData Central.
 *
 * ## Esto no es una tabla oficial, y hay que decirlo así
 *
 * A diferencia de `reference-intakes.ts`, que cita una fila concreta de una
 * tabla oficial de la National Academies, este archivo no cita ninguna
 * fuente porque no hay ninguna que citar: es una lista curada a mano, de
 * unos noventa alimentos comunes, para resolver un problema muy concreto.
 * FDC es un catálogo en inglés sin ningún campo traducido, y sin esto una
 * búsqueda en español como "manzana" no encuentra la fruta -encuentra, en el
 * mejor de los casos, nada, y en el peor, un refresco de marca que lleva
 * "MANZANA" en el nombre por motivos de marketing bilingüe (comprobado
 * contra la API real: 62 resultados, todos "Branded", cero fruta).
 *
 * Es a propósito incompleta. Cubre fruta, verdura, legumbres, cereales,
 * carne, pescado, lácteos y básicos de despensa: las categorías donde el
 * hueco de USDA frente a Open Food Facts es real (D-049). No es un
 * traductor general, y no lo pretende: un término que no está aquí se manda
 * tal cual se escribió, sin bloquear ni inventar nada (D-001 aplicado a
 * texto, no a una cifra, pero el principio es el mismo: ante la duda, no
 * fingir un dato que no se tiene).
 *
 * Varias entradas repiten el mismo alimento en inglés con más de una palabra
 * en español a propósito: "patata" (España) y "papa" (América Latina) para
 * "potato", "aguacate" y "palta" para "avocado", "fresa" y "frutilla" para
 * "strawberry". El español no es una sola variedad.
 */
export interface FoodTerm {
  readonly es: string;
  readonly en: string;
}

export const FOOD_TERMS: readonly FoodTerm[] = [
  // Fruta
  { es: 'manzana', en: 'apple' },
  { es: 'manzanas', en: 'apple' },
  { es: 'plátano', en: 'banana' },
  { es: 'plátanos', en: 'banana' },
  { es: 'banana', en: 'banana' },
  { es: 'bananas', en: 'banana' },
  { es: 'naranja', en: 'orange' },
  { es: 'naranjas', en: 'orange' },
  { es: 'pera', en: 'pear' },
  { es: 'peras', en: 'pear' },
  { es: 'uva', en: 'grape' },
  { es: 'uvas', en: 'grape' },
  { es: 'fresa', en: 'strawberry' },
  { es: 'fresas', en: 'strawberry' },
  { es: 'frutilla', en: 'strawberry' },
  { es: 'frutillas', en: 'strawberry' },
  { es: 'sandía', en: 'watermelon' },
  { es: 'melón', en: 'melon' },
  { es: 'piña', en: 'pineapple' },
  { es: 'mango', en: 'mango' },
  { es: 'limón', en: 'lemon' },
  { es: 'lima', en: 'lime' },
  { es: 'cereza', en: 'cherry' },
  { es: 'cerezas', en: 'cherry' },
  { es: 'ciruela', en: 'plum' },
  { es: 'melocotón', en: 'peach' },
  { es: 'durazno', en: 'peach' },
  { es: 'albaricoque', en: 'apricot' },
  { es: 'kiwi', en: 'kiwifruit' },
  { es: 'papaya', en: 'papaya' },
  { es: 'granada', en: 'pomegranate' },
  { es: 'higo', en: 'fig' },
  { es: 'coco', en: 'coconut' },
  { es: 'arándano', en: 'blueberry' },
  { es: 'arándanos', en: 'blueberry' },
  { es: 'frambuesa', en: 'raspberry' },
  { es: 'mora', en: 'blackberry' },
  { es: 'aguacate', en: 'avocado' },
  { es: 'palta', en: 'avocado' },
  { es: 'guayaba', en: 'guava' },
  { es: 'mandarina', en: 'tangerine' },

  // Verdura
  { es: 'zanahoria', en: 'carrot' },
  { es: 'zanahorias', en: 'carrot' },
  { es: 'brócoli', en: 'broccoli' },
  { es: 'espinaca', en: 'spinach' },
  { es: 'espinacas', en: 'spinach' },
  { es: 'lechuga', en: 'lettuce' },
  { es: 'tomate', en: 'tomato' },
  { es: 'tomates', en: 'tomato' },
  { es: 'jitomate', en: 'tomato' },
  { es: 'pepino', en: 'cucumber' },
  { es: 'cebolla', en: 'onion' },
  { es: 'cebollas', en: 'onion' },
  { es: 'ajo', en: 'garlic' },
  { es: 'patata', en: 'potato' },
  { es: 'patatas', en: 'potato' },
  { es: 'papa', en: 'potato' },
  { es: 'papas', en: 'potato' },
  { es: 'batata', en: 'sweet potato' },
  { es: 'boniato', en: 'sweet potato' },
  { es: 'camote', en: 'sweet potato' },
  { es: 'calabaza', en: 'pumpkin' },
  { es: 'calabacín', en: 'zucchini' },
  { es: 'pimiento', en: 'pepper' },
  { es: 'pimientos', en: 'pepper' },
  { es: 'berenjena', en: 'eggplant' },
  { es: 'apio', en: 'celery' },
  { es: 'coliflor', en: 'cauliflower' },
  { es: 'col', en: 'cabbage' },
  { es: 'repollo', en: 'cabbage' },
  { es: 'judía verde', en: 'green bean' },
  { es: 'ejote', en: 'green bean' },
  { es: 'guisante', en: 'pea' },
  { es: 'guisantes', en: 'pea' },
  { es: 'arveja', en: 'pea' },
  { es: 'arvejas', en: 'pea' },
  { es: 'maíz', en: 'corn' },
  { es: 'elote', en: 'corn' },
  { es: 'remolacha', en: 'beet' },
  { es: 'rábano', en: 'radish' },
  { es: 'espárrago', en: 'asparagus' },
  { es: 'espárragos', en: 'asparagus' },
  { es: 'champiñón', en: 'mushroom' },
  { es: 'champiñones', en: 'mushroom' },
  { es: 'hongo', en: 'mushroom' },
  { es: 'alcachofa', en: 'artichoke' },

  // Legumbres y cereales
  { es: 'lenteja', en: 'lentil' },
  { es: 'lentejas', en: 'lentil' },
  { es: 'garbanzo', en: 'chickpea' },
  { es: 'garbanzos', en: 'chickpea' },
  { es: 'frijol', en: 'bean' },
  { es: 'frijoles', en: 'bean' },
  { es: 'judía', en: 'bean' },
  { es: 'judías', en: 'bean' },
  { es: 'alubia', en: 'bean' },
  { es: 'alubias', en: 'bean' },
  { es: 'soja', en: 'soybean' },
  { es: 'soya', en: 'soybean' },
  { es: 'arroz', en: 'rice' },
  { es: 'avena', en: 'oats' },
  { es: 'trigo', en: 'wheat' },
  { es: 'quinua', en: 'quinoa' },
  { es: 'quinoa', en: 'quinoa' },
  { es: 'cebada', en: 'barley' },

  // Carne, pescado, lácteos, huevo
  { es: 'pollo', en: 'chicken' },
  { es: 'res', en: 'beef' },
  { es: 'carne de res', en: 'beef' },
  { es: 'ternera', en: 'beef' },
  { es: 'cerdo', en: 'pork' },
  { es: 'cordero', en: 'lamb' },
  { es: 'pavo', en: 'turkey' },
  { es: 'pescado', en: 'fish' },
  { es: 'salmón', en: 'salmon' },
  { es: 'atún', en: 'tuna' },
  { es: 'camarón', en: 'shrimp' },
  { es: 'camarones', en: 'shrimp' },
  { es: 'gamba', en: 'shrimp' },
  { es: 'gambas', en: 'shrimp' },
  { es: 'huevo', en: 'egg' },
  { es: 'huevos', en: 'egg' },
  { es: 'leche', en: 'milk' },
  { es: 'queso', en: 'cheese' },
  { es: 'yogur', en: 'yogurt' },
  { es: 'yogurt', en: 'yogurt' },
  { es: 'mantequilla', en: 'butter' },

  // Frutos secos y básicos de despensa
  { es: 'almendra', en: 'almond' },
  { es: 'almendras', en: 'almond' },
  { es: 'nuez', en: 'walnut' },
  { es: 'nueces', en: 'walnut' },
  { es: 'cacahuete', en: 'peanut' },
  { es: 'cacahuetes', en: 'peanut' },
  { es: 'maní', en: 'peanut' },
  { es: 'anacardo', en: 'cashew' },
  { es: 'anacardos', en: 'cashew' },
  { es: 'pistacho', en: 'pistachio' },
  { es: 'pistachos', en: 'pistachio' },
  { es: 'azúcar', en: 'sugar' },
  { es: 'sal', en: 'salt' },
  { es: 'aceite', en: 'oil' },
  { es: 'miel', en: 'honey' },
  { es: 'pan', en: 'bread' },
  { es: 'harina', en: 'flour' },
];

/**
 * De español a inglés, para construir la consulta que de verdad sale hacia
 * USDA. Se indexa con `normalizeForSearch` (minúsculas, sin acentos), el
 * mismo criterio que ya usa la búsqueda de OFF, así que "Manzana",
 * "manzana" y "MANZANA" encuentran la misma entrada.
 */
const SEARCH_TRANSLATIONS: ReadonlyMap<string, string> = new Map(
  FOOD_TERMS.map((term) => [normalizeForSearch(term.es), term.en]),
);

/**
 * Traduce lo que se va a buscar en USDA, si el glosario conoce el término.
 *
 * Si no lo conoce, se manda el texto tal cual se escribió, recortado y nada
 * más: no se fuerza a minúsculas ni se le quitan los acentos, porque puede
 * ser ya una palabra en inglés y forzarla no ayuda a encontrarla ni la
 * empeora. El resultado de esta función es exactamente lo que hay que
 * enseñar a quien busca como "lo que se ha buscado de verdad": mostrar una
 * cosa y buscar otra sería quitarle el sentido a que se pueda ver.
 */
export function translateSearchTerm(query: string): string {
  const translated = SEARCH_TRANSLATIONS.get(normalizeForSearch(query));
  return translated ?? query.trim();
}

/**
 * De inglés a español, para la palabra que encabeza el nombre de un
 * alimento de USDA ("Apples" en "Apples, raw, with skin").
 *
 * Un mismo alimento en español puede tener más de un término (patata/papa),
 * así que esta dirección no puede ser el mismo mapa invertido sin más:
 * necesita UN español por cada inglés, y gana el primero que aparezca en
 * `FOOD_TERMS`, que es por eso el término más neutro de los que se repiten.
 */
const NAME_GLOSSES: ReadonlyMap<string, string> = (() => {
  const map = new Map<string, string>();
  for (const term of FOOD_TERMS) {
    const key = term.en.toLowerCase();
    if (!map.has(key)) {
      map.set(key, term.es);
    }
  }
  return map;
})();

/**
 * Busca en el glosario la palabra que abre el nombre en inglés de un
 * alimento de USDA.
 *
 * Solo se mira la primera palabra antes de la primera coma ("Apples" de
 * "Apples, raw, with skin"), nunca la frase entera: traducir "raw" o "with
 * skin" palabra por palabra sin saber colocarlas bien en español produciría
 * una frase que suena a traducido a máquina, y ese no es el problema que
 * esto intenta resolver. Es una pista sobre QUÉ alimento es, no una
 * traducción completa de su descripción.
 *
 * Se prueba primero la palabra tal cual, y si no está, se prueba quitándole
 * una "s" o una "es" final: FDC casi siempre encabeza sus nombres en plural
 * ("Apples", "Carrots"), y el glosario guarda el inglés en singular. No es
 * una regla general de plurales del inglés, es la mínima que hace falta para
 * los plurales regulares que aparecen en la práctica; un plural irregular
 * que no encaje simplemente no encuentra pista, y eso es preferible a
 * adivinar mal.
 */
export function glossUsdaFoodName(description: string): string | undefined {
  const head = description.split(',')[0]?.trim().toLowerCase();
  if (head === undefined || head === '') {
    return undefined;
  }

  const direct = NAME_GLOSSES.get(head);
  if (direct !== undefined) {
    return direct;
  }
  if (head.endsWith('es')) {
    const singular = NAME_GLOSSES.get(head.slice(0, -2));
    if (singular !== undefined) {
      return singular;
    }
  }
  if (head.endsWith('s')) {
    const singular = NAME_GLOSSES.get(head.slice(0, -1));
    if (singular !== undefined) {
      return singular;
    }
  }
  return undefined;
}

/**
 * El nombre que se enseña para un alimento, con su pista en español al lado
 * si la fuente es USDA y el glosario reconoce la primera palabra.
 *
 * El nombre de la fuente va siempre primero y siempre entero: es el dato de
 * verdad, el que guarda la instantánea de D-003, y no desaparece nunca
 * detrás de una traducción. La pista, cuando la hay, va después y entre
 * paréntesis, como una nota, no como un reemplazo. Para cualquier otra
 * fuente (Open Food Facts, un alimento creado a mano) esta función devuelve
 * el nombre tal cual: la pista solo tiene sentido donde el nombre está en un
 * idioma distinto del de la aplicación.
 */
export function displayFoodName(entity: {
  readonly name: string;
  readonly source: FoodSource;
}): string {
  if (entity.source.kind !== 'usda') {
    return entity.name;
  }
  const gloss = glossUsdaFoodName(entity.name);
  return gloss === undefined ? entity.name : `${entity.name} (${gloss})`;
}
