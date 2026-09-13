import { OffApiError, type OffErrorCode } from '@/services/off/client';

/**
 * De un código de error a algo que se pueda leer y hacer.
 *
 * Cada mensaje tiene que dejar claro qué se espera de quien lo lee, y por eso
 * `network` y `upstream_error` no pueden decir lo mismo aunque las dos sean
 * "no hay resultados por un fallo". Si el problema es tu conexión, la acción es
 * recuperarla; si el problema es de Open Food Facts, la acción es esperar, y
 * decirle a alguien que revise su wifi cuando su wifi está bien es hacerle
 * perder el tiempo.
 *
 * `canRetry` dice si el botón de reintentar tiene sentido. En `rate_limited` y
 * en `invalid_request` no lo tiene: uno empeora al insistir y el otro va a
 * responder exactamente igual.
 */
export interface OffErrorMessage {
  readonly title: string;
  readonly detail: string;
  readonly canRetry: boolean;
}

const MESSAGES = {
  network: {
    title: 'No hemos podido conectar',
    detail:
      'La búsqueda no ha llegado a salir. Puede ser tu conexión o algo entre medias. Comprueba que tienes red y vuelve a intentarlo.',
    canRetry: true,
  },
  upstream_error: {
    title: 'Open Food Facts no responde',
    detail:
      'El fallo no está en tu conexión, está en la fuente de datos. Suele durar poco: prueba otra vez en un momento.',
    canRetry: true,
  },
  upstream_timeout: {
    title: 'La búsqueda ha tardado demasiado',
    detail:
      'Open Food Facts no ha contestado a tiempo. Vuelve a intentarlo; si sigue igual, prueba con menos palabras.',
    canRetry: true,
  },
  rate_limited: {
    title: 'Demasiadas búsquedas seguidas',
    detail:
      'Open Food Facts limita cuántas búsquedas se pueden hacer por minuto y hemos llegado al tope. Espera un momento antes de seguir.',
    canRetry: false,
  },
  invalid_request: {
    title: 'Esa búsqueda no vale',
    detail: 'Prueba a escribirla de otra manera.',
    canRetry: false,
  },
  not_found: {
    title: 'No existe',
    detail: 'Open Food Facts no conoce eso.',
    canRetry: false,
  },
  malformed_response: {
    title: 'Nos hemos hecho un lío',
    detail:
      'La respuesta ha llegado en un formato que no esperábamos. Es un fallo nuestro, no tuyo. Puedes volver a intentarlo.',
    canRetry: true,
  },
} as const satisfies Record<OffErrorCode, OffErrorMessage>;

/** Para lo que no es un error nuestro: casi siempre un fallo de programación. */
const UNKNOWN: OffErrorMessage = {
  title: 'Algo ha ido mal',
  detail: 'No sabemos qué ha pasado. Puedes volver a intentarlo.',
  canRetry: true,
};

export function describeOffError(error: unknown): OffErrorMessage {
  if (!(error instanceof OffApiError)) {
    return UNKNOWN;
  }

  const message = MESSAGES[error.code];

  // El único caso en el que el servidor nos dice cuánto esperar. Merece la pena
  // decirlo: "espera un momento" y "espera 34 segundos" no se leen igual.
  if (error.code === 'rate_limited' && error.retryAfterSeconds !== undefined) {
    return {
      ...message,
      detail: `Open Food Facts limita cuántas búsquedas se pueden hacer por minuto y hemos llegado al tope. Vuelve a intentarlo dentro de ${error.retryAfterSeconds} segundos.`,
    };
  }

  return message;
}
