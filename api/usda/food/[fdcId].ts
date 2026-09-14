import { handleUsdaFood } from '../../_lib/usda-handlers.js';
import { usdaBucket } from '../../_lib/rate-limit.js';

/** GET /api/usda/food/173410 */
export function GET(request: Request): Promise<Response> {
  return handleUsdaFood(request, { bucket: usdaBucket, now: Date.now, fetchImpl: fetch });
}
