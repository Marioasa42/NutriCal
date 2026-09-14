import { describe, expect, it } from 'vitest';

import { isSearchable } from '@/shared/lib/text';

/**
 * Los casos de `normalizeForSearch` se mudaron a `contracts/text.test.ts` con la
 * función. Aquí queda lo que sigue siendo una decisión del navegador.
 */
describe('isSearchable', () => {
  it('exige al menos tres caracteres útiles', () => {
    expect(isSearchable('le')).toBe(false);
    expect(isSearchable('lec')).toBe(true);
  });

  it('no cuenta los espacios sobrantes como caracteres', () => {
    expect(isSearchable('  a  ')).toBe(false);
  });

  it('tampoco cuenta los acentos como un carácter aparte', () => {
    // La normalización descompone la letra acentuada en letra y acento antes de
    // borrarlo, así que "añ" no debe colar como tres caracteres.
    expect(isSearchable('añ')).toBe(false);
  });
});
