import { describe, expect, it } from 'vitest';

import { normalizeForSearch } from './text.js';

/**
 * Estos casos vivían en `src/shared/lib/text.test.ts` y se mudan con la función.
 * El test que comparaba las dos implementaciones desaparece con la migración:
 * ya no hay dos implementaciones que puedan separarse.
 */
describe('normalizeForSearch', () => {
  it('pasa a minúsculas y recorta', () => {
    expect(normalizeForSearch('  Manzana  ')).toBe('manzana');
  });

  it('quita los acentos', () => {
    expect(normalizeForSearch('Plátano')).toBe('platano');
    expect(normalizeForSearch('Melocotón en almíbar')).toBe('melocoton en almibar');
  });

  it('también reduce la eñe, a propósito', () => {
    // La descomposición Unicode trata la eñe como ene más tilde, así que la
    // normalización la reduce. Se mantiene porque para buscar es lo deseable:
    // quien teclee "pina colada" en un teclado sin eñe debe encontrarla. Solo
    // afecta a la comparación, nunca a lo que se muestra en pantalla.
    expect(normalizeForSearch('Piña')).toBe('pina');
    expect(normalizeForSearch('pina')).toBe(normalizeForSearch('piña'));
  });

  it('colapsa los espacios repetidos', () => {
    expect(normalizeForSearch('yogur   natural')).toBe('yogur natural');
  });

  it('hace equivalentes dos escrituras de la misma consulta', () => {
    // Es la propiedad que sostiene el trato entre las dos puntas: con ella, la
    // clave de caché del navegador y la URL que construye la función serverless
    // coinciden para las dos escrituras, y las dos cachés aciertan a la vez.
    expect(normalizeForSearch(' LECHE Semidesnatada ')).toBe(
      normalizeForSearch('leche  semidesnatada'),
    );
  });

  it('deja en blanco lo que solo eran espacios', () => {
    expect(normalizeForSearch('   ')).toBe('');
  });
});
