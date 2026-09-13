import { describe, expect, it } from 'vitest';

import {
  toBarcodeViewState,
  type BarcodeQuerySnapshot,
} from '@/features/food-search/useBarcodeLookup';
import type { FoodDraft } from '@/domain/food/draft';
import { anInstant, makeFood } from '@/test/factories';

const VALID = '8410128750121';

const snapshot = (overrides: Partial<BarcodeQuerySnapshot> = {}): BarcodeQuerySnapshot => ({
  barcode: VALID,
  fetchStatus: 'idle',
  isError: false,
  error: null,
  data: undefined,
  ...overrides,
});

describe('toBarcodeViewState', () => {
  it('rechaza un código inválido antes que ninguna otra cosa', () => {
    // Es la mitad del cliente de la regla compartida: el servidor rechazaría
    // esto igual, pero para saberlo habría que gastar la petición.
    expect(toBarcodeViewState(snapshot({ barcode: 'patata' })).kind).toBe('invalid');
    expect(toBarcodeViewState(snapshot({ barcode: '123' })).kind).toBe('invalid');
    expect(toBarcodeViewState(snapshot({ barcode: '' })).kind).toBe('invalid');
  });

  it('un código inválido gana incluso a un error en curso', () => {
    // Si el código no vale, decir "Open Food Facts no responde" sería mentir
    // sobre de quién es el problema.
    const state = toBarcodeViewState(
      snapshot({ barcode: 'patata', isError: true, error: new Error('vaya') }),
    );
    expect(state.kind).toBe('invalid');
  });

  it('distingue sin conexión de cargando, igual que la búsqueda', () => {
    expect(toBarcodeViewState(snapshot({ fetchStatus: 'paused' })).kind).toBe('offline');
    expect(toBarcodeViewState(snapshot({ fetchStatus: 'fetching' })).kind).toBe('loading');
  });

  it('separa un código que la fuente no conoce de uno que devuelve roto', () => {
    // La distinción viene de `services/off` desde el paso 2b, y esta pantalla
    // es la primera que la cobra: "no lo tenemos" y "lo tenemos pero no lo
    // entendemos" llevan a sitios distintos.
    const notFound = toBarcodeViewState(snapshot({ data: { kind: 'notFound' } }));
    expect(notFound).toEqual({ kind: 'notFound', barcode: VALID });

    const unreadable = toBarcodeViewState(
      snapshot({ data: { kind: 'unreadable', reason: 'sin nombre' } }),
    );
    expect(unreadable).toEqual({ kind: 'unreadable', reason: 'sin nombre' });
  });

  it('pasa el alimento completo tal cual', () => {
    const food = makeFood();
    const state = toBarcodeViewState(snapshot({ data: { kind: 'complete', food } }));
    expect(state).toEqual({ kind: 'complete', food });
  });

  it('pasa el borrador tal cual, sin convertirlo en un fallo', () => {
    // Un producto al que le faltan macros no es un error, es un caso de uso
    // (D-002). Aquí eso significa una rama propia, no la de error.
    // `fetchedAt` es un `Instant`, un tipo con marca: una cadena cualquiera no
    // encaja, hay que construirla con su constructor. Por eso `anInstant()` y
    // no un literal, y por eso `tsc` cazó esto aunque los tests pasaran: Vitest
    // transpila sin comprobar tipos.
    const draft: FoodDraft = {
      name: 'Galletas sin datos',
      source: { kind: 'openFoodFacts', barcode: VALID, fetchedAt: anInstant() },
      baseUnit: 'g',
      macros: {},
      micros: {},
      servings: [],
      missing: ['protein', 'fat'],
    };
    const state = toBarcodeViewState(snapshot({ data: { kind: 'needsCompletion', draft } }));
    expect(state.kind).toBe('needsCompletion');
  });
});
