import { describe, expect, it } from 'vitest';

import { isValidTimeZone } from '@/shared/lib/time-zone';

/**
 * `isValidTimeZone` es la única defensa contra una zona horaria mal tecleada
 * (la alternativa de la decisión 7 de CLAUDE.md cuando el navegador no sabe dar
 * una lista). Sin ella, un valor inválido no falla aquí: falla más tarde y
 * lejos, dentro de `Intl.DateTimeFormat`, en el momento de calcular un día.
 */
describe('isValidTimeZone', () => {
  it('acepta una zona IANA real', () => {
    expect(isValidTimeZone('Europe/Madrid')).toBe(true);
    expect(isValidTimeZone('America/New_York')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('rechaza una cadena vacía o solo espacios', () => {
    expect(isValidTimeZone('')).toBe(false);
    expect(isValidTimeZone('   ')).toBe(false);
  });

  it('rechaza algo que no es una zona horaria', () => {
    expect(isValidTimeZone('patata')).toBe(false);
    expect(isValidTimeZone('Europe/Nowhere')).toBe(false);
  });

  it('rechaza una zona con un continente inventado', () => {
    // A diferencia de la mayúscula/minúscula, que `Intl` normaliza por su
    // cuenta, un continente que no existe en la base de datos IANA sí falla.
    expect(isValidTimeZone('Narnia/Cair_Paravel')).toBe(false);
  });
});
