import { QueryClient } from '@tanstack/react-query';

import { OffApiError, type OffErrorCode } from '@/services/off/client';

/**
 * La configuración de TanStack Query, con su política de reintentos.
 *
 * Los valores por defecto de la librería están pensados para una API propia sin
 * límite de ritmo. La nuestra no lo es: Open Food Facts permite diez búsquedas
 * por minuto y por dirección IP, y en Vercel esa dirección la compartimos con
 * quien sea (D-013). Cada opción de aquí abajo existe para gastar menos
 * peticiones, no por gusto.
 */

/**
 * Fallos que pueden desaparecer solos si se insiste.
 *
 * El resto no: `rate_limited` empeora al reintentar, porque cada intento cuenta
 * contra el mismo límite que acabamos de agotar; `invalid_request` y
 * `not_found` darán exactamente la misma respuesta; y `malformed_response`
 * significa que nuestro propio contrato no se cumple, que es un fallo nuestro y
 * no se arregla pidiéndolo otra vez.
 */
const RETRYABLE_CODES: readonly OffErrorCode[] = ['network', 'upstream_error', 'upstream_timeout'];

/** Dos reintentos, no los tres del valor por defecto. Ver el comentario de arriba. */
const MAX_RETRIES = 2;

/**
 * Se escribe como función suelta, y no en línea dentro del objeto de opciones,
 * para poder probarla sin montar un `QueryClient` ni renderizar nada.
 *
 * `error` llega como `unknown` porque TanStack Query no sabe qué lanzan nuestras
 * funciones. `instanceof` hace de guarda de tipo: dentro del `if`, TypeScript ya
 * sabe que `error` tiene `code`. Un error que no sea nuestro no se reintenta,
 * porque si ni siquiera pasó por el cliente de Open Food Facts, lo más probable
 * es que sea un fallo de programación y repetirlo no lo arreglará.
 */
export function shouldRetryOffQuery(failureCount: number, error: unknown): boolean {
  if (failureCount >= MAX_RETRIES) {
    return false;
  }
  return error instanceof OffApiError && RETRYABLE_CODES.includes(error.code);
}

/** Cinco minutos: la ficha de un producto no cambia mientras se teclea. */
const STALE_TIME_MS = 5 * 60 * 1000;

/** Media hora en memoria: volver atrás a una búsqueda reciente no debe costar red. */
const GC_TIME_MS = 30 * 60 * 1000;

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE_TIME_MS,
        gcTime: GC_TIME_MS,
        retry: shouldRetryOffQuery,

        // Apagados los dos porque son los que más peticiones invisibles gastan.
        // Volver a la pestaña o recuperar la conexión no es motivo para repetir
        // una búsqueda: el resultado no ha cambiado y el límite de ritmo sí se
        // nota. Ojo, esto no afecta a las consultas que quedaron en pausa por
        // falta de red; esas se reanudan solas y así debe ser, porque nunca
        // llegaron a hacerse.
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
      },
    },
  });
}
