import { describe, expect, it } from 'vitest';

import { isSearchable, normalizeForSearch } from '@/shared/lib/text';

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
    // Importa para la caché de la función serverless: si no se normaliza, estas
    // dos búsquedas piden dos entradas distintas a Open Food Facts.
    expect(normalizeForSearch(' LECHE Semidesnatada ')).toBe(
      normalizeForSearch('leche  semidesnatada'),
    );
  });
});

describe('isSearchable', () => {
  it('exige al menos tres caracteres útiles', () => {
    expect(isSearchable('le')).toBe(false);
    expect(isSearchable('lec')).toBe(true);
  });

  it('no cuenta los espacios sobrantes como caracteres', () => {
    expect(isSearchable('  a  ')).toBe(false);
  });
});
