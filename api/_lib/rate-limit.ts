/**
 * Limitador de ritmo de cubo de fichas.
 *
 * El cubo tiene una capacidad y se rellena a un ritmo constante. Cada petición
 * gasta una ficha; si no quedan, se rechaza. A diferencia de un contador por
 * ventana fija, absorbe ráfagas cortas sin permitir un ritmo sostenido mayor del
 * pactado.
 *
 * AVISO IMPORTANTE, ya recogido en la decisión D-013: esto es de mejor esfuerzo.
 * El estado vive en memoria y sobrevive entre invocaciones calientes de la misma
 * instancia, pero varias instancias no se coordinan. La defensa real contra el
 * abuso son las tres capas juntas: Dexie en el dispositivo, la caché compartida
 * de la red de distribución, y este limitador como último recurso. Un límite
 * global exacto necesitaría estado compartido, y eso se decidirá si el tráfico
 * llega a justificarlo.
 *
 * El reloj entra por parámetro para que los tests no dependan del tiempo real.
 */
export interface TokenBucket {
  /** Gasta una ficha si hay. Devuelve si se permite la petición. */
  tryTake(now: number): boolean;
  /** Segundos que faltan para que haya una ficha disponible. */
  retryAfterSeconds(now: number): number;
  /** Fichas disponibles ahora mismo, para tests y diagnóstico. */
  available(now: number): number;
}

export function createTokenBucket(options: {
  capacity: number;
  refillPerMinute: number;
}): TokenBucket {
  const { capacity, refillPerMinute } = options;
  const refillPerMs = refillPerMinute / 60_000;

  let tokens = capacity;
  let lastRefillAt: number | undefined;

  function refill(now: number): void {
    if (lastRefillAt === undefined) {
      lastRefillAt = now;
      return;
    }
    const elapsed = Math.max(0, now - lastRefillAt);
    tokens = Math.min(capacity, tokens + elapsed * refillPerMs);
    lastRefillAt = now;
  }

  return {
    tryTake(now) {
      refill(now);
      if (tokens < 1) {
        return false;
      }
      tokens -= 1;
      return true;
    },
    retryAfterSeconds(now) {
      refill(now);
      if (tokens >= 1) {
        return 0;
      }
      return Math.ceil((1 - tokens) / refillPerMs / 1000);
    },
    available(now) {
      refill(now);
      return tokens;
    },
  };
}

/*
 * Límites deliberadamente por debajo de los que documenta Open Food Facts, que
 * son diez peticiones por minuto para la búsqueda y cien para el producto. Nos
 * quedamos cortos a propósito porque en Vercel la dirección IP es compartida:
 * pasarse no nos bloquearía solo a nosotros.
 */
export const searchBucket = createTokenBucket({ capacity: 6, refillPerMinute: 6 });
export const productBucket = createTokenBucket({ capacity: 30, refillPerMinute: 60 });
