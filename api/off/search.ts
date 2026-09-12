import { handleSearch } from '../_lib/handlers.js';
import { searchBucket } from '../_lib/rate-limit.js';

/** GET /api/off/search?q=leche&page=1 */
export function GET(request: Request): Promise<Response> {
  return handleSearch(request, { bucket: searchBucket, now: Date.now, fetchImpl: fetch });
}
