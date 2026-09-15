import { handleUsdaSearch } from '../_lib/usda-handlers.js';
import { usdaBucket } from '../_lib/rate-limit.js';

/**
 * Fijado a propósito (D-056): esta función lee `process.env.USDA_API_KEY`, y
 * el runtime Edge de Vercel no garantiza el mismo `process` de Node. Sin esto
 * escrito, cuál de los dos runtimes se usa queda a criterio del despliegue.
 */
export const config = { runtime: 'nodejs' };

/** GET /api/usda/search?q=lentils */
export function GET(request: Request): Promise<Response> {
  return handleUsdaSearch(request, { bucket: usdaBucket, now: Date.now, fetchImpl: fetch });
}
