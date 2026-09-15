import { z } from 'zod';

/**
 * Vocabulario de error compartido por todas nuestras funciones serverless.
 *
 * Vivía dentro de `services/off/schemas.ts`, y se muda aquí porque deja de ser
 * verdad que solo lo hable Open Food Facts: `api/_lib/http.ts` define un único
 * `ErrorCode` para las dos fuentes (D-047), así que USDA responde exactamente
 * la misma envoltura de error que OFF. Si esta lista se hubiera copiado dentro
 * de `services/usda/`, habría dos copias que sincronizar a mano, que es
 * precisamente el desliz que ya pasó una vez (D-040 añadió
 * `upstream_rate_limited` a `ErrorCode` y a esta lista, pero por poco se olvida
 * la segunda; ver la comprobación de sincronía en `off/client.ts` y
 * `usda/client.ts`).
 *
 * Esta lista tiene que llevar TODOS los miembros de `ErrorCode` de
 * `api/_lib/http.ts`. Es una lista cerrada de Zod, así que un código que
 * produzcan las funciones y falte aquí no da un error ruidoso: hace que la
 * envoltura entera no valide y el cliente se caiga a adivinar el código por el
 * estado HTTP, que es peor que fallar, porque el error sigue llegando y llega
 * con el nombre equivocado.
 */
export const API_ERROR_CODES = [
  'invalid_request',
  'not_found',
  'rate_limited',
  'upstream_rate_limited',
  'upstream_error',
  'upstream_timeout',
  'server_misconfigured',
] as const;

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
  }),
});
