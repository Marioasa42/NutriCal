import { describe, expect, it } from 'vitest';

import { instant } from '@/domain/time/local-date';
import {
  displayFoodName,
  glossUsdaFoodName,
  translateSearchTerm,
} from '@/services/usda/food-terms';

const FETCHED_AT = instant('2026-01-01T00:00:00.000Z');

describe('translateSearchTerm', () => {
  it('traduce un término del glosario', () => {
    expect(translateSearchTerm('manzana')).toBe('apple');
  });

  it('no distingue mayúsculas ni acentos, igual que la búsqueda de OFF', () => {
    expect(translateSearchTerm('Manzana')).toBe('apple');
    expect(translateSearchTerm('MANZANA')).toBe('apple');
    expect(translateSearchTerm('mánzana')).toBe('apple');
  });

  it('el plural del glosario traduce a la misma palabra que el singular', () => {
    expect(translateSearchTerm('manzanas')).toBe('apple');
  });

  it('resuelve el caso real que motivó esto: "manzana" encuentra la fruta', () => {
    // Verificado contra la API real: sin traducir, "manzana" da 62
    // resultados, todos refrescos de marca con "MANZANA" en el nombre por
    // marketing bilingüe, cero fruta.
    expect(translateSearchTerm('manzana')).toBe('apple');
  });

  it('un término que no está en el glosario se manda tal cual, recortado', () => {
    expect(translateSearchTerm('  quinotos  ')).toBe('quinotos');
    expect(translateSearchTerm('broccoli')).toBe('broccoli');
  });

  it('cubre las variantes regionales del mismo alimento', () => {
    expect(translateSearchTerm('patata')).toBe('potato');
    expect(translateSearchTerm('papa')).toBe('potato');
    expect(translateSearchTerm('aguacate')).toBe('avocado');
    expect(translateSearchTerm('palta')).toBe('avocado');
  });
});

describe('glossUsdaFoodName', () => {
  it('encuentra la pista a partir de la primera palabra del nombre', () => {
    expect(glossUsdaFoodName('Apples, raw, with skin')).toBe('manzana');
    expect(glossUsdaFoodName('Broccoli, raw')).toBe('brócoli');
  });

  it('dobla un plural regular en inglés cuando el singular sí está en el glosario', () => {
    // FDC encabeza casi todo en plural ("Apples", "Carrots"); el glosario
    // guarda el inglés en singular.
    expect(glossUsdaFoodName('Carrots, raw')).toBe('zanahoria');
    expect(glossUsdaFoodName('Tomatoes, red, ripe, raw')).toBe('tomate');
  });

  it('sin coincidencia, no da ninguna pista en vez de adivinar', () => {
    expect(glossUsdaFoodName('Babyfood, apples with ham, strained')).toBeUndefined();
    expect(glossUsdaFoodName('')).toBeUndefined();
  });

  it('cuando el mismo alimento tiene varios términos en español, gana el primero del glosario', () => {
    // "potato" aparece con "patata" antes que con "papa" en FOOD_TERMS.
    expect(glossUsdaFoodName('Potatoes, raw, skin')).toBe('patata');
  });
});

describe('displayFoodName', () => {
  it('añade la pista entre paréntesis para un alimento de USDA', () => {
    const name = displayFoodName({
      name: 'Apples, raw, with skin',
      source: { kind: 'usda', fdcId: 1, fetchedAt: FETCHED_AT },
    });
    expect(name).toBe('Apples, raw, with skin (manzana)');
  });

  it('el nombre de la fuente va siempre primero y entero', () => {
    const name = displayFoodName({
      name: 'Apples, raw, with skin',
      source: { kind: 'usda', fdcId: 1, fetchedAt: FETCHED_AT },
    });
    expect(name.startsWith('Apples, raw, with skin')).toBe(true);
  });

  it('sin pista reconocida, devuelve el nombre de USDA sin tocar', () => {
    const name = displayFoodName({
      name: 'Babyfood, apples with ham, strained',
      source: { kind: 'usda', fdcId: 1, fetchedAt: FETCHED_AT },
    });
    expect(name).toBe('Babyfood, apples with ham, strained');
  });

  it('nunca traduce el nombre de un alimento que no es de USDA', () => {
    const name = displayFoodName({
      name: 'Apples, raw, with skin',
      source: { kind: 'openFoodFacts', barcode: '123', fetchedAt: FETCHED_AT },
    });
    expect(name).toBe('Apples, raw, with skin');
  });

  it('tampoco toca un alimento creado a mano', () => {
    const name = displayFoodName({ name: 'Apples, raw, with skin', source: { kind: 'custom' } });
    expect(name).toBe('Apples, raw, with skin');
  });
});
