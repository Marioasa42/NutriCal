// @vitest-environment jsdom
import { QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createQueryClient } from '@/app/query-client';
import { db } from '@/data/db';
import { foodRepository } from '@/data/repositories/foods';
import { SearchPage } from '@/features/food-search/SearchPage';
import { invariant } from '@/shared/lib/invariant';
import { makeFood } from '@/test/factories';

/**
 * El único test de componente de toda la suite, y tiene que justificarse, porque
 * CLAUDE.md dice expresamente que no se prueban componentes de interfaz por
 * sistema.
 *
 * Lo que se prueba aquí no es que salgan unos textos: es la garantía de
 * comportamiento que sostiene D-041, que **teclear no genera tráfico de red**.
 * Esa garantía no vive en ninguna función pura que se pueda probar por separado
 * —nace de cómo la pantalla conecta dos consultas distintas con dos disparadores
 * distintos— y es exactamente la que se rompió antes: el debounce parecía
 * suficiente hasta que se midió en producción. Un test que cuente peticiones es
 * lo único que avisa si alguien vuelve a enchufar la búsqueda remota al texto
 * que se está tecleando.
 *
 * Se teclea con `fireEvent` y no con `@testing-library/user-event`, que sería lo
 * habitual, para no añadir una dependencia por un solo archivo: disparar un
 * `change` por letra reproduce lo que importa aquí, que es que el estado cambia
 * una vez por pulsación.
 */

function renderSearch() {
  const calls: string[] = [];
  vi.stubGlobal('fetch', (input: RequestInfo | URL) => {
    // Solo llamamos con una cadena, pero el tipo de `fetch` admite tres formas y
    // `String()` sobre un `Request` daría "[object Object]" sin avisar.
    calls.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    return Promise.resolve(
      new Response(JSON.stringify({ query: 'x', page: 1, count: 0, products: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });

  render(
    <QueryClientProvider client={createQueryClient()}>
      <MemoryRouter initialEntries={['/dia/2026-09-14/buscar']}>
        <Routes>
          <Route path="/dia/:date/buscar" element={<SearchPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { calls };
}

const field = () => screen.getByLabelText('Nombre del alimento');

/** Teclea letra a letra, disparando un cambio por pulsación como haría el navegador. */
function type(text: string) {
  for (let i = 1; i <= text.length; i += 1) {
    fireEvent.change(field(), { target: { value: text.slice(0, i) } });
  }
}

/** Intro dentro de un campo de un formulario es exactamente esto. */
const pressEnter = () => {
  const form = field().closest('form');
  // El linter prohíbe tanto `as` como `!`, y hace bien: si el campo dejara de
  // estar dentro de un formulario, Intro dejaría de buscar y el test tiene que
  // decirlo con esas palabras en vez de fallar con un "null" sin contexto.
  invariant(form !== null, 'el campo de búsqueda tiene que vivir dentro de un formulario');
  fireEvent.submit(form);
};

describe('SearchPage', () => {
  beforeEach(async () => {
    await db.foods.clear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('teclear no sale a la red ni una sola vez', async () => {
    const { calls } = renderSearch();

    type('leche entera');

    // Doce pulsaciones, diez de ellas por encima del mínimo de tres letras. Con
    // la versión anterior esto producía entre una y nueve peticiones según lo
    // deprisa que se tecleara. Ahora son cero, y no "pocas": ninguna.
    await waitFor(() => {
      expect(screen.getByDisplayValue('leche entera')).toBeDefined();
    });
    expect(calls).toEqual([]);
  });

  it('la búsqueda en la fuente sale al pulsar Intro, y una sola vez', async () => {
    const { calls } = renderSearch();

    type('leche entera');
    pressEnter();

    await waitFor(() => {
      expect(calls).toHaveLength(1);
    });
  });

  it('sale con el texto normalizado, que es la clave de caché de verdad', async () => {
    const { calls } = renderSearch();

    type('  Plátano  ');
    pressEnter();

    // Sin esto, "Plátano" y "platano" son dos entradas de caché distintas en la
    // red de distribución de Vercel, y las dos fallan (D-041).
    await waitFor(() => {
      expect(calls[0]).toBe('/api/off/search?q=platano');
    });
  });

  it('lo que ya está en el catálogo se ve mientras se teclea, sin red', async () => {
    await foodRepository.save(makeFood({ name: 'Leche entera' }));
    const { calls } = renderSearch();

    type('leche');

    expect(await screen.findByText('Leche entera')).toBeDefined();
    expect(calls).toEqual([]);
  });

  it('con menos de tres letras no se puede buscar en la fuente', () => {
    renderSearch();

    type('le');

    expect(screen.getByRole('button', { name: 'Buscar en Open Food Facts' })).toHaveProperty(
      'disabled',
      true,
    );
  });
});
