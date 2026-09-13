// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDebouncedValue } from '@/shared/hooks/useDebouncedValue';

/**
 * El único test de la suite que necesita DOM, y por eso lo pide en la primera
 * línea en lugar de cambiar el entorno de todos: el dominio no debe pagar el
 * arranque de jsdom.
 *
 * Se prueba el hook y no un componente. Testing Library entra en el proyecto
 * para esto, para lógica con estado y reloj, no para abrir la puerta a probar
 * botones y textos por sistema.
 */
describe('useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // La limpieza automática de Testing Library solo se activa con `globals`
    // encendido en Vitest, y aquí está apagado. Sin esta llamada cada `render`
    // dejaría su contenedor colgando de `document.body`, y el día que haya dos
    // archivos con DOM uno vería los restos del otro.
    cleanup();
    vi.useRealTimers();
  });

  it('devuelve el valor inicial sin esperar', () => {
    const { result } = renderHook(() => useDebouncedValue('leche', 400));
    expect(result.current).toBe('leche');
  });

  it('no cambia hasta que pasa el retraso completo', () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 400), {
      initialProps: { value: 'lec' },
    });

    rerender({ value: 'leche' });
    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(result.current).toBe('lec');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe('leche');
  });

  it('cancela el temporizador anterior en cada cambio', () => {
    // El test que justifica la función de limpieza del efecto. Se teclean tres
    // letras seguidas, cada una antes de que venza la anterior. Si el
    // temporizador viejo no se cancelara, a los 400 ms del primero el valor
    // saltaría a "le" y luego iría pasando por los intermedios. Con la
    // cancelación solo sobrevive el último y solo se emite una vez.
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 400), {
      initialProps: { value: 'l' },
    });

    rerender({ value: 'le' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'lec' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    rerender({ value: 'lech' });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Han pasado 600 ms desde el primer cambio y el valor sigue sin moverse,
    // porque nunca hubo 400 ms de calma.
    expect(result.current).toBe('l');

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('lech');
  });

  it('no deja temporizadores vivos al desmontar', () => {
    const { unmount } = renderHook(({ value }) => useDebouncedValue(value, 400), {
      initialProps: { value: 'leche' },
    });

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
