import { useEffect, useState } from 'react';

/**
 * Devuelve el valor recibido, pero con retraso: solo cambia cuando pasan
 * `delayMs` sin que llegue uno nuevo.
 *
 * Es genérico en `T`, así que sirve para cualquier tipo y devuelve exactamente
 * el mismo que se le pasa: si le das un `string`, te devuelve un `string`, no un
 * `unknown` que haya que volver a comprobar. Un genérico es un parámetro de la
 * función, solo que en vez de un valor es un tipo.
 *
 * Lo importante es la función que devuelve el `useEffect`. React la ejecuta
 * antes de volver a lanzar el efecto y al desmontar el componente, y aquí lo que
 * hace es cancelar el temporizador anterior. Sin esa línea, teclear diez letras
 * dejaría diez temporizadores vivos y los diez terminarían disparando: el
 * retraso no retrasaría nada, solo llegaría todo tarde y en fila. Es la parte
 * que de verdad puede romperse, y por eso tiene test.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debounced;
}
