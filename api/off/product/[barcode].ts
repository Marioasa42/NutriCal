import { handleProduct } from '../../_lib/handlers.js';
import { productBucket } from '../../_lib/rate-limit.js';

/** GET /api/off/product/8410128750121 */
export function GET(request: Request): Promise<Response> {
  return handleProduct(request, { bucket: productBucket, now: Date.now, fetchImpl: fetch });
}
