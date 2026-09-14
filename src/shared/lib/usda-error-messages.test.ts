import { describe, expect, it } from 'vitest';

import { UsdaApiError } from '@/services/usda/client';
import { describeUsdaError } from '@/shared/lib/usda-error-messages';

describe('describeUsdaError', () => {
  it('no da el mismo mensaje sin conexión que con la fuente caída', () => {
    const offline = describeUsdaError(new UsdaApiError('network', 'x'));
    const upstream = describeUsdaError(new UsdaApiError('upstream_error', 'x'));

    expect(offline.title).not.toBe(upstream.title);
    expect(offline.detail).not.toBe(upstream.detail);
  });

  it('no ofrece reintentar cuando reintentar empeora las cosas', () => {
    expect(describeUsdaError(new UsdaApiError('rate_limited', 'x')).canRetry).toBe(false);
    expect(describeUsdaError(new UsdaApiError('invalid_request', 'x')).canRetry).toBe(false);
  });

  it('ofrece reintentar cuando puede funcionar', () => {
    expect(describeUsdaError(new UsdaApiError('network', 'x')).canRetry).toBe(true);
    expect(describeUsdaError(new UsdaApiError('upstream_timeout', 'x')).canRetry).toBe(true);
  });

  it('dice cuántos segundos esperar cuando el servidor lo dice', () => {
    const withHint = describeUsdaError(
      new UsdaApiError('rate_limited', 'x', { retryAfterSeconds: 34 }),
    );
    expect(withHint.detail).toContain('34 segundos');

    const upstreamHint = describeUsdaError(
      new UsdaApiError('upstream_rate_limited', 'x', { retryAfterSeconds: 3600 }),
    );
    expect(upstreamHint.detail).toContain('3600 segundos');
  });

  it('distingue nuestro límite del de la fuente', () => {
    const ours = describeUsdaError(new UsdaApiError('rate_limited', 'x'));
    const theirs = describeUsdaError(new UsdaApiError('upstream_rate_limited', 'x'));

    expect(ours.canRetry).toBe(false);
    expect(theirs.canRetry).toBe(false);
    expect(ours.title).not.toBe(theirs.title);
    expect(ours.detail).not.toBe(theirs.detail);
  });

  it('sobrevive a algo que no es un error nuestro', () => {
    expect(describeUsdaError(new TypeError('vaya')).title).toBeTruthy();
    expect(describeUsdaError(undefined).title).toBeTruthy();
  });
});
