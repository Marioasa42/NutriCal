/**
 * Un `fetch` de mentira para los tests.
 *
 * Sigue el mismo patrón que las funciones serverless: la dependencia entra por
 * parámetro, así que no hay que sustituir ninguna variable global ni acordarse de
 * restaurarla después. Además apunta lo que recibe, que es como se comprueba a
 * qué URL se llamó y qué señal de cancelación se entregó.
 */

export interface FakeCall {
  readonly url: string;
  readonly init: RequestInit | undefined;
}

export interface FakeFetch {
  readonly fetchImpl: typeof fetch;
  readonly calls: readonly FakeCall[];
}

/** La URL de una petición, sea cual sea de las tres formas que admite `fetch`. */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  return input instanceof URL ? input.href : input.url;
}

export function createFakeFetch(responder: () => Response): FakeFetch {
  const calls: FakeCall[] = [];
  const fetchImpl: typeof fetch = (input, init) => {
    calls.push({ url: urlOf(input), init });
    try {
      return Promise.resolve(responder());
    } catch (error) {
      // Un `responder` que lanza simula que la petición ni sale, que es lo que
      // pasa sin conexión. El rechazo tiene que llegar como promesa, igual que
      // en el `fetch` de verdad.
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  };
  return { fetchImpl, calls };
}

/** Respuesta JSON con el tipo de contenido correcto. */
export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { 'content-type': 'application/json', ...init.headers },
  });
}
