/**
 * Lo que el navegador cree que es tu zona horaria y tu idioma.
 *
 * Desde D-043 esto **no** es la zona horaria de la aplicación: es solo la
 * propuesta inicial con la que se crea el perfil la primera vez. A partir de ahí
 * manda `Profile.timeZone`, y se lee con `useTimeZone()`.
 *
 * La diferencia importa en el caso que hace falta que importe: si tu perfil dice
 * Europe/Madrid y abres la aplicación desde Nueva York, tu diario tiene que
 * seguir partiendo los días como en Madrid. Preguntando al navegador cada vez, un
 * viaje te reescribiría a qué día pertenece la cena.
 *
 * Sigue viviendo aislada, y ahora con más motivo: es el único punto de todo el
 * proyecto donde se le pregunta al navegador por estas dos cosas, y solo debe
 * llamarlo quien crea un perfil.
 */

/** La zona horaria que declara el navegador, en formato IANA. */
export function browserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** El idioma que declara el navegador. Se cae a español, que es el de la interfaz. */
export function browserLocale(): string {
  return navigator.language || 'es-ES';
}

/**
 * La lista de zonas horarias que conoce el navegador, o `undefined` si no la
 * sabe dar.
 *
 * `Intl.supportedValuesOf` no está en todas partes, y la decisión 7 del proyecto
 * dice que toda API que no esté en todos los sitios necesita alternativa. Aquí la
 * alternativa es escribir la zona a mano, igual que el escaneo de códigos siempre
 * se puede teclear. Devolver `undefined` y no una lista vacía es lo que permite a
 * la pantalla distinguir "no hay zonas" de "no sé cuáles hay".
 */
export function supportedTimeZones(): readonly string[] | undefined {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return undefined;
  }
}

/**
 * Comprueba que una zona horaria existe de verdad.
 *
 * Hace falta porque la zona puede llegar tecleada a mano por la alternativa de
 * arriba, y una zona inválida no da un error visible: hace que
 * `Intl.DateTimeFormat` lance en el momento de calcular un día, que es lejos de
 * donde se escribió y difícil de relacionar con la causa.
 */
export function isValidTimeZone(value: string): boolean {
  if (value.trim() === '') {
    return false;
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
