import { describe, expect, it } from 'vitest';

import { createTokenBucket } from './rate-limit.js';

describe('cubo de fichas', () => {
  it('permite tantas peticiones seguidas como capacidad tenga', () => {
    const bucket = createTokenBucket({ capacity: 3, refillPerMinute: 3 });
    const t0 = 1_000_000;

    expect(bucket.tryTake(t0)).toBe(true);
    expect(bucket.tryTake(t0)).toBe(true);
    expect(bucket.tryTake(t0)).toBe(true);
    expect(bucket.tryTake(t0)).toBe(false);
  });

  it('se rellena con el paso del tiempo', () => {
    const bucket = createTokenBucket({ capacity: 2, refillPerMinute: 60 });
    const t0 = 1_000_000;

    bucket.tryTake(t0);
    bucket.tryTake(t0);
    expect(bucket.tryTake(t0)).toBe(false);

    // A sesenta por minuto, una ficha por segundo.
    expect(bucket.tryTake(t0 + 1000)).toBe(true);
  });

  it('no acumula más fichas que su capacidad', () => {
    const bucket = createTokenBucket({ capacity: 2, refillPerMinute: 60 });
    const t0 = 1_000_000;

    bucket.tryTake(t0);
    // Una hora después seguiría teniendo dos, no sesenta.
    expect(bucket.available(t0 + 3_600_000)).toBe(2);
  });

  it('dice cuántos segundos faltan para la siguiente ficha', () => {
    const bucket = createTokenBucket({ capacity: 1, refillPerMinute: 6 });
    const t0 = 1_000_000;

    bucket.tryTake(t0);
    // A seis por minuto, una ficha cada diez segundos.
    expect(bucket.retryAfterSeconds(t0)).toBe(10);
    expect(bucket.retryAfterSeconds(t0 + 5000)).toBe(5);
  });

  it('devuelve cero segundos de espera cuando quedan fichas', () => {
    const bucket = createTokenBucket({ capacity: 2, refillPerMinute: 6 });
    expect(bucket.retryAfterSeconds(1_000_000)).toBe(0);
  });

  it('un reloj que va hacia atrás no regala fichas', () => {
    const bucket = createTokenBucket({ capacity: 1, refillPerMinute: 60 });
    const t0 = 1_000_000;

    bucket.tryTake(t0);
    expect(bucket.tryTake(t0 - 60_000)).toBe(false);
  });
});
