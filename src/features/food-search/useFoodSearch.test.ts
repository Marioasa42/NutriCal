import { describe, expect, it } from 'vitest';

import { toSearchViewState, type SearchQuerySnapshot } from '@/features/food-search/useFoodSearch';
import type { FoodSearchPage } from '@/services/off';
import { makeFood } from '@/test/factories';

/**
 * Solo la función pura. El hook que la usa no se prueba: lo único suyo es
 * conectar `useQuery` con esto, y probar eso sería probar TanStack Query.
 */

const emptyPage = (query = 'leche'): FoodSearchPage => ({
  query,
  page: 1,
  total: 0,
  foods: [],
  drafts: [],
  unreadable: 0,
});

const snapshot = (overrides: Partial<SearchQuerySnapshot> = {}): SearchQuerySnapshot => ({
  enabled: true,
  fetchStatus: 'idle',
  isError: false,
  error: null,
  data: undefined,
  query: 'leche',
  ...overrides,
});

describe('toSearchViewState', () => {
  it('con la consulta apagada está inactiva, no cargando', () => {
    // El caso que justifica que esto sea una función y no tres ternarios en el
    // componente. En TanStack Query v5 una consulta con `enabled: false` se
    // queda en `status: 'pending'` para siempre: mirando solo `isPending` se
    // vería un indicador de carga eterno para una petición que nunca se hizo.
    expect(toSearchViewState(snapshot({ enabled: false, fetchStatus: 'idle' })).kind).toBe('idle');
  });

  it('distingue estar sin conexión de estar cargando', () => {
    // `paused` es lo que hace TanStack Query cuando el navegador dice que no hay
    // red: no lanza la petición y espera. No es un fallo y no se reintenta.
    expect(toSearchViewState(snapshot({ fetchStatus: 'paused' })).kind).toBe('offline');
    expect(toSearchViewState(snapshot({ fetchStatus: 'fetching' })).kind).toBe('loading');
  });

  it('un error gana a la espera, porque ya sabemos que no hay nada que esperar', () => {
    const state = toSearchViewState(snapshot({ isError: true, error: new Error('vaya') }));
    expect(state.kind).toBe('error');
  });

  it('una página sin alimentos ni borradores es "sin resultados"', () => {
    const state = toSearchViewState(snapshot({ data: emptyPage('kale morado') }));
    expect(state).toEqual({ kind: 'empty', query: 'leche' });
  });

  it('una página con solo borradores sí tiene resultados', () => {
    // Los borradores cuentan: son productos que existen y que se van a poder
    // completar. Tratarlos como "sin resultados" escondería la mitad de Open
    // Food Facts.
    const page: FoodSearchPage = {
      ...emptyPage(),
      total: 1,
      drafts: [
        {
          name: 'Galletas sin datos',
          source: { kind: 'custom' },
          baseUnit: 'g',
          macros: {},
          micros: {},
          servings: [],
          missing: ['protein', 'fat'],
        },
      ],
    };
    expect(toSearchViewState(snapshot({ data: page })).kind).toBe('results');
  });

  it('una página con alimentos completos tiene resultados', () => {
    const page: FoodSearchPage = { ...emptyPage(), total: 1, foods: [makeFood()] };
    const state = toSearchViewState(snapshot({ data: page }));
    expect(state).toEqual({ kind: 'results', page });
  });
});
