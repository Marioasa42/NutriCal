import { handleSearch } from '../_lib/handlers.js';
import { searchBucket } from '../_lib/rate-limit.js';

/**
 * Fijado por consistencia con `api/usda/` (D-056), no porque esta función lo
 * necesite hoy: Open Food Facts no lee ninguna variable de entorno. Pero si
 * algún día ganara una, quedaría expuesta al mismo fallo que tuvo USDA si el
 * runtime por defecto fuera Edge, así que se fija aquí también, antes de que
 * haga falta.
 */
export const config = { runtime: 'nodejs' };

/** GET /api/off/search?q=leche&page=1 */
export function GET(request: Request): Promise<Response> {
  return handleSearch(request, { bucket: searchBucket, now: Date.now, fetchImpl: fetch });
}
