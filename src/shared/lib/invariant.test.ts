import { describe, expect, it } from 'vitest';

import { InvariantError, invariant } from '@/shared/lib/invariant';

describe('invariant', () => {
  it('no hace nada cuando la condición se cumple', () => {
    expect(() => {
      invariant(true, 'no debería lanzar');
    }).not.toThrow();
  });

  it('lanza InvariantError con el mensaje recibido', () => {
    expect(() => {
      invariant(false, 'las calorías no pueden ser negativas');
    }).toThrow(InvariantError);
    expect(() => {
      invariant(false, 'las calorías no pueden ser negativas');
    }).toThrow('las calorías no pueden ser negativas');
  });

  it('estrecha el tipo tras la llamada', () => {
    const findName = (): string | undefined => 'manzana';
    const name = findName();
    invariant(name !== undefined, 'falta el nombre');
    // Si la firma de aserción no funcionase, `name.length` no compilaría.
    expect(name.length).toBe(7);
  });
});
