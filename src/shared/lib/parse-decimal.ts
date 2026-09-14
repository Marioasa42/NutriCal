/**
 * Un número tecleado en un campo de texto, en español.
 *
 * Existe por una diferencia pequeña con consecuencias grandes: en español el
 * separador decimal es la coma, y `Number('1,5')` es `NaN`. Sin esta conversión,
 * teclear "1,5" raciones daría un error de "eso no es una cantidad" a alguien
 * que ha escrito exactamente lo que su idioma le dice que escriba. La aplicación
 * ya enseña las cifras con coma (D-030), así que aceptarla al leer es lo
 * coherente.
 *
 * Devuelve `NaN` para lo que no sea un número, incluido el campo vacío. `NaN` no
 * es un fallo que haya que capturar aquí: es lo que las funciones del dominio ya
 * saben rechazar por su rama con nombre, así que este módulo se queda en lo suyo,
 * que es convertir texto, y no decide qué es aceptable.
 *
 * `Number('')` vale cero, y ese es el caso que obliga a comprobar el vacío
 * aparte: un campo sin rellenar se leería como un cero perfectamente válido y el
 * formulario guardaría una porción de cero gramos sin quejarse.
 */
export function parseDecimal(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') {
    return Number.NaN;
  }
  return Number(trimmed.replace(',', '.'));
}
