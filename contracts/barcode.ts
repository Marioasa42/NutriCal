/**
 * La regla de qué es un código de barras válido, en un único lugar.
 *
 * Este archivo no pertenece al navegador ni a las funciones serverless: es el
 * contrato que las dos puntas tienen que cumplir de forma idéntica. El servidor
 * lo usa para rechazar una petición inválida antes de construir una URL
 * saliente; el cliente lo usa para no llegar a hacer esa petición. Si la regla
 * viviera copiada en los dos sitios, el día que cambiara una copia el cliente
 * gastaría peticiones que el servidor va a rechazar, o peor, dejaría de mandar
 * códigos que el servidor sí acepta.
 *
 * No tiene importaciones. Es lo que le permite ser consumido por dos proyectos
 * de TypeScript con resoluciones de módulos distintas sin arrastrar nada.
 */

/** Un EAN-8 es el más corto que nos interesa. */
export const BARCODE_MIN_DIGITS = 8;

/** Un ITF-14 es el más largo. Por encima ya no es un código de producto. */
export const BARCODE_MAX_DIGITS = 14;

const ONLY_DIGITS = /^\d+$/;

/**
 * Un código de barras es solo dígitos, entre 8 y 14.
 *
 * Deliberadamente NO se comprueba el dígito de control. Un EAN-13 lo tiene y se
 * podría verificar, pero este rango cubre también EAN-8, UPC-A e ITF-14, que no
 * lo calculan igual, y Open Food Facts contiene códigos internos de tienda que
 * no cumplen ninguno de esos esquemas. Rechazar aquí un código que la fuente sí
 * conoce sería peor que gastar la petición: dejaría al usuario sin poder
 * registrar un producto que existe, y sin entender por qué.
 */
export function isValidBarcode(value: string): boolean {
  // La longitud se comprueba aparte, y no dentro de la expresión regular con
  // `{8,14}`, para que las constantes de arriba sean de verdad la única fuente:
  // construir el patrón interpolándolas obliga a escapar la barra invertida
  // dentro de una plantilla de cadena, que es fácil de escribir mal y produce un
  // patrón que compila y no valida nada.
  return (
    ONLY_DIGITS.test(value) &&
    value.length >= BARCODE_MIN_DIGITS &&
    value.length <= BARCODE_MAX_DIGITS
  );
}

/**
 * Deja el código como lo espera la validación: sin espacios ni guiones.
 *
 * En el envase el código viene impreso separado en grupos, `8 410128 750121`, y
 * copiarlo tal cual no debería ser un error. Esto es cortesía del cliente, no
 * una relajación de la regla: `isValidBarcode` sigue exigiendo solo dígitos, y
 * el servidor sigue validando estricto porque lo que le llega ya pasó por aquí.
 * Aflojar la frontera para aceptar guiones sería abrir la puerta por comodidad.
 */
export function normalizeBarcode(value: string): string {
  return value.replace(/[\s-]/g, '');
}
