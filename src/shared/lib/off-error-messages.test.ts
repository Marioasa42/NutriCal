import { describe, expect, it } from 'vitest';

import { OffApiError } from '@/services/off/client';
import { describeOffError } from '@/shared/lib/off-error-messages';

describe('describeOffError', () => {
  it('no da el mismo mensaje sin conexión que con la fuente caída', () => {
    // El requisito de fondo: la acción que se espera de quien lee es distinta.
    // Si el problema es tu red, la respuesta es recuperarla; si es de Open Food
    // Facts, la respuesta es esperar. Decirle a alguien que revise su wifi
    // cuando su wifi está bien es hacerle perder el tiempo.
    const offline = describeOffError(new OffApiError('network', 'x'));
    const upstream = describeOffError(new OffApiError('upstream_error', 'x'));

    expect(offline.title).not.toBe(upstream.title);
    expect(offline.detail).not.toBe(upstream.detail);
  });

  it('no ofrece reintentar cuando reintentar empeora las cosas', () => {
    expect(describeOffError(new OffApiError('rate_limited', 'x')).canRetry).toBe(false);
    expect(describeOffError(new OffApiError('invalid_request', 'x')).canRetry).toBe(false);
  });

  it('ofrece reintentar cuando puede funcionar', () => {
    expect(describeOffError(new OffApiError('network', 'x')).canRetry).toBe(true);
    expect(describeOffError(new OffApiError('upstream_timeout', 'x')).canRetry).toBe(true);
  });

  it('dice cuántos segundos esperar cuando el servidor lo dice', () => {
    const withHint = describeOffError(
      new OffApiError('rate_limited', 'x', { retryAfterSeconds: 34 }),
    );
    expect(withHint.detail).toContain('34 segundos');
  });

  it('sobrevive a algo que no es un error nuestro', () => {
    expect(describeOffError(new TypeError('vaya')).title).toBeTruthy();
    expect(describeOffError(undefined).title).toBeTruthy();
  });
});
