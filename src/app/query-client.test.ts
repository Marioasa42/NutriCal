import { describe, expect, it } from 'vitest';

import { shouldRetryOffQuery, shouldRetryQuery, shouldRetryUsdaQuery } from '@/app/query-client';
import { OffApiError } from '@/services/off/client';
import { UsdaApiError } from '@/services/usda/client';

const error = (code: ConstructorParameters<typeof OffApiError>[0]) => new OffApiError(code, 'x');
const usdaError = (code: ConstructorParameters<typeof UsdaApiError>[0]) =>
  new UsdaApiError(code, 'x');

describe('shouldRetryOffQuery', () => {
  it('reintenta lo que puede arreglarse solo', () => {
    expect(shouldRetryOffQuery(0, error('network'))).toBe(true);
    expect(shouldRetryOffQuery(0, error('upstream_error'))).toBe(true);
    expect(shouldRetryOffQuery(0, error('upstream_timeout'))).toBe(true);
  });

  it('nunca reintenta un límite de ritmo, venga de donde venga', () => {
    // El más importante de todos: insistir contra el límite de Open Food Facts
    // gasta los intentos de todo el mundo que comparta la IP de Vercel (D-013).
    expect(shouldRetryOffQuery(0, error('rate_limited'))).toBe(false);

    // Este es el que faltaba y costó siete 502 en cuarenta segundos (D-040). El
    // límite de la fuente llegaba como `upstream_error`, que sí se reintenta, así
    // que cada rechazo suyo producía dos peticiones más contra ella.
    expect(shouldRetryOffQuery(0, error('upstream_rate_limited'))).toBe(false);
  });

  it('no reintenta lo que va a responder igual', () => {
    expect(shouldRetryOffQuery(0, error('invalid_request'))).toBe(false);
    expect(shouldRetryOffQuery(0, error('not_found'))).toBe(false);
    expect(shouldRetryOffQuery(0, error('malformed_response'))).toBe(false);
  });

  it('se rinde a un solo reintento', () => {
    // Bajado de dos a uno tras medir la carga saliente real (D-040). Dos intentos
    // en total: el original y uno más.
    expect(shouldRetryOffQuery(0, error('network'))).toBe(true);
    expect(shouldRetryOffQuery(1, error('network'))).toBe(false);
  });

  it('no reintenta un error que no sea nuestro', () => {
    // Si no pasó por el cliente de Open Food Facts, es un fallo de programación
    // y repetirlo solo repetiría el fallo.
    expect(shouldRetryOffQuery(0, new TypeError('undefined is not a function'))).toBe(false);
    expect(shouldRetryOffQuery(0, 'algo')).toBe(false);
  });

  it('no reintenta un error de USDA: son tipos distintos aunque compartan el nombre del código', () => {
    expect(shouldRetryOffQuery(0, usdaError('network'))).toBe(false);
  });
});

describe('shouldRetryUsdaQuery', () => {
  it('reintenta lo mismo que OFF, pero solo para sus propios errores', () => {
    expect(shouldRetryUsdaQuery(0, usdaError('network'))).toBe(true);
    expect(shouldRetryUsdaQuery(0, usdaError('upstream_error'))).toBe(true);
    expect(shouldRetryUsdaQuery(0, usdaError('upstream_timeout'))).toBe(true);
  });

  it('nunca reintenta un límite de ritmo, sea nuestro o de la fuente', () => {
    expect(shouldRetryUsdaQuery(0, usdaError('rate_limited'))).toBe(false);
    expect(shouldRetryUsdaQuery(0, usdaError('upstream_rate_limited'))).toBe(false);
  });

  it('un error de OFF no cuenta como un error de USDA', () => {
    expect(shouldRetryUsdaQuery(0, error('network'))).toBe(false);
  });

  it('se rinde a un solo reintento', () => {
    expect(shouldRetryUsdaQuery(0, usdaError('network'))).toBe(true);
    expect(shouldRetryUsdaQuery(1, usdaError('network'))).toBe(false);
  });
});

describe('shouldRetryQuery', () => {
  it('es la política real del QueryClient: reintenta lo de las dos fuentes', () => {
    expect(shouldRetryQuery(0, error('network'))).toBe(true);
    expect(shouldRetryQuery(0, usdaError('network'))).toBe(true);
  });

  it('no reintenta lo que no sea un error de ninguna de las dos fuentes', () => {
    // Antes de que existiera USDA, esto pasaba por casualidad: una consulta
    // local de Dexie nunca lanza un OffApiError, así que siempre daba `false`.
    // Con dos fuentes hacía falta comprobarlo a propósito.
    expect(shouldRetryQuery(0, new TypeError('undefined is not a function'))).toBe(false);
  });
});
