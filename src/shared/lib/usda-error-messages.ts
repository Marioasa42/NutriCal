import { UsdaApiError, type UsdaErrorCode } from '@/services/usda/client';

/**
 * De un código de error de USDA a algo que se pueda leer y hacer.
 *
 * Calcado de `off-error-messages.ts`, con el texto propio de esta fuente: la
 * razón de que sean dos archivos y no uno parametrizado es la misma que ya
 * explica `usda/client.ts` sobre `UsdaErrorCode` frente a `OffErrorCode`, y
 * aquí se nota además en el propio texto, que nombra a la fuente por su
 * nombre en cada mensaje.
 */
export interface UsdaErrorMessage {
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
    title: 'USDA FoodData Central no responde',
    detail:
      'El fallo no está en tu conexión, está en la fuente de datos. Suele durar poco: prueba otra vez en un momento.',
    canRetry: true,
  },
  upstream_timeout: {
    title: 'La búsqueda ha tardado demasiado',
    detail:
      'USDA FoodData Central no ha contestado a tiempo. Vuelve a intentarlo; si sigue igual, prueba con menos palabras.',
    canRetry: true,
  },
  rate_limited: {
    title: 'Demasiadas búsquedas seguidas',
    detail:
      'Hemos llegado al tope de búsquedas por minuto que nos ponemos nosotros mismos. Espera un momento antes de seguir.',
    canRetry: false,
  },
  upstream_rate_limited: {
    title: 'USDA FoodData Central nos ha frenado',
    detail:
      'La fuente de datos limita cuántas consultas admite por hora y hemos llegado a su tope. Espera antes de volver a buscar.',
    canRetry: false,
  },
  invalid_request: {
    title: 'Esa búsqueda no vale',
    detail: 'Prueba a escribirla de otra manera.',
    canRetry: false,
  },
  not_found: {
    title: 'No existe',
    detail: 'USDA FoodData Central no conoce eso.',
    canRetry: false,
  },
  malformed_response: {
    title: 'Nos hemos hecho un lío',
    detail:
      'La respuesta ha llegado en un formato que no esperábamos. Es un fallo nuestro, no tuyo. Puedes volver a intentarlo.',
    canRetry: true,
  },
  server_misconfigured: {
    title: 'Hay un problema en el servidor',
    detail:
      'No es un fallo de USDA FoodData Central ni de tu conexión: falta corregir la configuración del servidor. Reintentarlo no lo va a arreglar.',
    canRetry: false,
  },
} as const satisfies Record<UsdaErrorCode, UsdaErrorMessage>;

/** Igual que en OFF: los dos únicos códigos cuyo texto cambia con los segundos de espera. */
const WAITING_DETAIL: Partial<Record<UsdaErrorCode, (seconds: number) => string>> = {
  rate_limited: (seconds) =>
    `Hemos llegado al tope de búsquedas por minuto que nos ponemos nosotros mismos. Vuelve a intentarlo dentro de ${String(seconds)} segundos.`,
  upstream_rate_limited: (seconds) =>
    `La fuente de datos limita cuántas consultas admite por hora y hemos llegado a su tope. Vuelve a intentarlo dentro de ${String(seconds)} segundos.`,
};

const UNKNOWN: UsdaErrorMessage = {
  title: 'Algo ha ido mal',
  detail: 'No sabemos qué ha pasado. Puedes volver a intentarlo.',
  canRetry: true,
};

export function describeUsdaError(error: unknown): UsdaErrorMessage {
  if (!(error instanceof UsdaApiError)) {
    return UNKNOWN;
  }

  const message = MESSAGES[error.code];

  const waiting = WAITING_DETAIL[error.code];
  if (waiting !== undefined && error.retryAfterSeconds !== undefined) {
    return { ...message, detail: waiting(error.retryAfterSeconds) };
  }

  return message;
}
