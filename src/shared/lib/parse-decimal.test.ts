import { describe, expect, it } from 'vitest';

import { parseDecimal } from '@/shared/lib/parse-decimal';

describe('parseDecimal', () => {
  it('acepta la coma como separador decimal', () => {
    // Es el separador del idioma en el que está la aplicación, y el mismo con
    // el que se enseñan las cifras (D-030).
    expect(parseDecimal('1,5')).toBe(1.5);
    expect(parseDecimal('0,4')).toBe(0.4);
  });

  it('acepta también el punto', () => {
    expect(parseDecimal('1.5')).toBe(1.5);
  });

  it('no cuenta los espacios de alrededor', () => {
    expect(parseDecimal('  150  ')).toBe(150);
  });

  it('un campo vacío no es un cero', () => {
    // `Number('')` vale cero, y ese es justo el fallo que este módulo evita: un
    // campo sin rellenar se guardaría como una porción de cero gramos.
    expect(parseDecimal('')).toBeNaN();
    expect(parseDecimal('   ')).toBeNaN();
  });

  it('lo que no es un número se queda en NaN', () => {
    // No lanza: quien decide qué hacer con un número imposible es el dominio,
    // que ya tiene una rama con nombre para eso.
    expect(parseDecimal('dos')).toBeNaN();
    expect(parseDecimal('1,2,3')).toBeNaN();
  });

  it('deja pasar el cero y los negativos, que no son asunto suyo', () => {
    expect(parseDecimal('0')).toBe(0);
    expect(parseDecimal('-5')).toBe(-5);
  });
});
