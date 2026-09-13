import { describe, expect, it } from 'vitest';

import {
  BARCODE_MAX_DIGITS,
  BARCODE_MIN_DIGITS,
  isValidBarcode,
  normalizeBarcode,
} from './barcode.js';

describe('isValidBarcode', () => {
  it('acepta códigos de entre 8 y 14 dígitos', () => {
    expect(isValidBarcode('12345678')).toBe(true);
    expect(isValidBarcode('8410128750121')).toBe(true);
    expect(isValidBarcode('12345678901234')).toBe(true);
  });

  it('rechaza longitudes fuera de rango', () => {
    expect(isValidBarcode('1234567')).toBe(false);
    expect(isValidBarcode('123456789012345')).toBe(false);
    expect(isValidBarcode('')).toBe(false);
  });

  it('rechaza cualquier cosa que no sean dígitos', () => {
    // Sin esta validación, texto arbitrario acabaría dentro de la ruta de una
    // petición saliente de la función serverless.
    expect(isValidBarcode('841012875012a')).toBe(false);
    expect(isValidBarcode('../../etc/passwd')).toBe(false);
    expect(isValidBarcode('8410128750121?x=1')).toBe(false);
    expect(isValidBarcode('841 012 875')).toBe(false);
  });

  it('los límites son los que dicen las constantes', () => {
    // Guarda de la propia regla: si alguien cambia una constante y no la otra,
    // o toca la expresión regular a mano, esto lo dice.
    expect(isValidBarcode('9'.repeat(BARCODE_MIN_DIGITS))).toBe(true);
    expect(isValidBarcode('9'.repeat(BARCODE_MIN_DIGITS - 1))).toBe(false);
    expect(isValidBarcode('9'.repeat(BARCODE_MAX_DIGITS))).toBe(true);
    expect(isValidBarcode('9'.repeat(BARCODE_MAX_DIGITS + 1))).toBe(false);
  });

  it('no comprueba el dígito de control, y es a propósito', () => {
    // 8410128750121 con el último dígito cambiado deja de ser un EAN-13 válido
    // y aquí se acepta igual. Open Food Facts tiene códigos internos de tienda
    // que no cumplen ningún esquema, y rechazarlos dejaría sin registrar
    // productos que la fuente sí conoce.
    expect(isValidBarcode('8410128750129')).toBe(true);
  });
});

describe('normalizeBarcode', () => {
  it('quita los espacios con los que viene impreso en el envase', () => {
    expect(normalizeBarcode('8 410128 750121')).toBe('8410128750121');
  });

  it('quita también los guiones', () => {
    expect(normalizeBarcode('8410-1287-50121')).toBe('8410128750121');
  });

  it('deja intacto lo que ya está limpio', () => {
    expect(normalizeBarcode('8410128750121')).toBe('8410128750121');
  });

  it('no convierte en válido lo que no lo es', () => {
    // Limpia la escritura, no relaja la regla.
    expect(isValidBarcode(normalizeBarcode('84a-101'))).toBe(false);
  });
});
