/**
 * Error de invariante del dominio: una condición que el código da por cierta y
 * que, si falla, indica un fallo de programación, no una entrada inválida del
 * usuario. Tener su propia clase permite distinguirlo al capturar.
 */
export class InvariantError extends Error {
  override readonly name = 'InvariantError';
}

/**
 * Lanza si la condición es falsa.
 *
 * El tipo de retorno `asserts condition` es una firma de aserción: le dice al
 * compilador que, si esta función vuelve sin lanzar, `condition` es verdadera.
 * A partir de la llamada, TypeScript estrecha los tipos como si hubiera un `if`.
 */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new InvariantError(message);
  }
}
