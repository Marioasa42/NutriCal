import { handleUsdaSearch } from '../_lib/usda-handlers.js';
import { usdaBucket } from '../_lib/rate-limit.js';

/** GET /api/usda/search?q=lentils */
export function GET(request: Request): Promise<Response> {
  return handleUsdaSearch(request, { bucket: usdaBucket, now: Date.now, fetchImpl: fetch });
}
