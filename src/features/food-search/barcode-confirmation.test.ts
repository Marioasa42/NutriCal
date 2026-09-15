import { describe, expect, it } from 'vitest';

import { createReadingConfirmer } from '@/features/food-search/barcode-confirmation';

const CODE = '8410128750121';
const OTHER = '8410128750138';

describe('createReadingConfirmer', () => {
  it('no confirma con una única lectura', () => {
    const confirmer = createReadingConfirmer();
    expect(confirmer.accept({ value: CODE })).toBeUndefined();
  });

  it('confirma al tercer fotograma idéntico seguido', () => {
    const confirmer = createReadingConfirmer();
    expect(confirmer.accept({ value: CODE })).toBeUndefined();
    expect(confirmer.accept({ value: CODE })).toBeUndefined();
    expect(confirmer.accept({ value: CODE })).toBe(CODE);
  });

  it('una lectura distinta en medio reinicia la racha (mala luz, un fotograma torcido)', () => {
    const confirmer = createReadingConfirmer();
    expect(confirmer.accept({ value: CODE })).toBeUndefined();
    expect(confirmer.accept({ value: CODE })).toBeUndefined();
    // El fotograma torcido: un valor distinto, plausible pero equivocado.
    expect(confirmer.accept({ value: OTHER })).toBeUndefined();
    // Vuelve el código correcto: hace falta otra racha completa, no se arrastra la anterior.
    expect(confirmer.accept({ value: CODE })).toBeUndefined();
    expect(confirmer.accept({ value: CODE })).toBeUndefined();
    expect(confirmer.accept({ value: CODE })).toBe(CODE);
  });

  it('no vuelve a confirmar el mismo valor en los fotogramas siguientes', () => {
    const confirmer = createReadingConfirmer();
    confirmer.accept({ value: CODE });
    confirmer.accept({ value: CODE });
    expect(confirmer.accept({ value: CODE })).toBe(CODE);
    // El código sigue delante de la cámara: no hay una segunda confirmación.
    expect(confirmer.accept({ value: CODE })).toBeUndefined();
    expect(confirmer.accept({ value: CODE })).toBeUndefined();
  });

  it('confía directamente en una medida de confianza alta, sin esperar repeticiones', () => {
    const confirmer = createReadingConfirmer();
    expect(confirmer.accept({ value: CODE, confidence: 0.95 })).toBe(CODE);
  });

  it('no confía en una medida de confianza baja, aunque se repita', () => {
    const confirmer = createReadingConfirmer();
    expect(confirmer.accept({ value: CODE, confidence: 0.3 })).toBeUndefined();
    expect(confirmer.accept({ value: CODE, confidence: 0.3 })).toBeUndefined();
    expect(confirmer.accept({ value: CODE, confidence: 0.3 })).toBeUndefined();
  });
});
