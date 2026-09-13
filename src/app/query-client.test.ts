import { describe, expect, it } from 'vitest';

import { shouldRetryOffQuery } from '@/app/query-client';
import { OffApiError } from '@/services/off/client';

const error = (code: ConstructorParameters<typeof OffApiError>[0]) => new OffApiError(code, 'x');

describe('shouldRetryOffQuery', () => {
  it('reintenta lo que puede arreglarse solo', () => {
    expect(shouldRetryOffQuery(0, error('network'))).toBe(true);
    expect(shouldRetryOffQuery(0, error('upstream_error'))).toBe(true);
    expect(shouldRetryOffQuery(0, error('upstream_timeout'))).toBe(true);
  });

  it('nunca reintenta un límite de ritmo', () => {
    // El más importante de todos: insistir contra el límite de Open Food Facts
    // gasta los intentos de todo el mundo que comparta la IP de Vercel (D-013).
    expect(shouldRetryOffQuery(0, error('rate_limited'))).toBe(false);
  });

  it('no reintenta lo que va a responder igual', () => {
    expect(shouldRetryOffQuery(0, error('invalid_request'))).toBe(false);
    expect(shouldRetryOffQuery(0, error('not_found'))).toBe(false);
    expect(shouldRetryOffQuery(0, error('malformed_response'))).toBe(false);
  });

  it('se rinde a los dos intentos', () => {
    expect(shouldRetryOffQuery(1, error('network'))).toBe(true);
    expect(shouldRetryOffQuery(2, error('network'))).toBe(false);
  });

  it('no reintenta un error que no sea nuestro', () => {
    // Si no pasó por el cliente de Open Food Facts, es un fallo de programación
    // y repetirlo solo repetiría el fallo.
    expect(shouldRetryOffQuery(0, new TypeError('undefined is not a function'))).toBe(false);
    expect(shouldRetryOffQuery(0, 'algo')).toBe(false);
  });
});
