import { describe, expect, it } from 'vitest';

import { normalizeForSearch } from '../../contracts/text.js';
import { USER_AGENT, buildProductUrl, buildSearchUrl, normalizeQuery, parsePage } from './off.js';

describe('identificación ante Open Food Facts', () => {
  it('declara nombre, versión y contacto', () => {
    // Sus condiciones de uso lo exigen, y el navegador no puede fijar esta
    // cabecera. Es el motivo entero de que exista la función serverless.
    expect(USER_AGENT).toMatch(/^NutriCal\/\d+\.\d+\.\d+ \(\+https:\/\/.+\)$/);
  });

  it('no incluye ningún correo personal', () => {
    expect(USER_AGENT).not.toMatch(/@/);
  });
});

describe('construcción de la URL de búsqueda', () => {
  it('normaliza la consulta para que dos escrituras compartan caché', () => {
    const a = buildSearchUrl('  LECHE Semidesnatada ', 1);
    const b = buildSearchUrl('leche  semidesnatada', 1);
    expect(a).toBe(b);
  });

  it('pide solo los campos que usamos', () => {
    const url = new URL(buildSearchUrl('leche', 1));
    expect(url.searchParams.get('fields')).toContain('nutriments');
    expect(url.searchParams.get('fields')).toContain('product_name');
  });

  it('escapa los caracteres especiales de la consulta', () => {
    const url = buildSearchUrl('leche & nata', 1);
    expect(url).not.toContain(' ');
    expect(new URL(url).searchParams.get('search_terms')).toBe('leche & nata');
  });

  it('lleva la página pedida', () => {
    expect(new URL(buildSearchUrl('leche', 3)).searchParams.get('page')).toBe('3');
  });
});

describe('construcción de la URL de producto', () => {
  it('pone el código en la ruta y los campos en la consulta', () => {
    const url = new URL(buildProductUrl('8410128750121'));
    expect(url.pathname).toBe('/api/v2/product/8410128750121.json');
    expect(url.searchParams.get('fields')).toContain('nutriments');
  });
});

describe('página pedida', () => {
  it('usa la primera cuando no se indica nada', () => {
    expect(parsePage(null)).toBe(1);
    expect(parsePage('')).toBe(1);
  });

  it('recorta en lugar de fallar ante valores imposibles', () => {
    expect(parsePage('0')).toBe(1);
    expect(parsePage('-5')).toBe(1);
    expect(parsePage('abc')).toBe(1);
    expect(parsePage('9999')).toBe(20);
  });
});

describe('normalización de la consulta', () => {
  it('es exactamente la del contrato compartido', () => {
    // Ya no hay dos implementaciones que comparar: hay una, en `contracts/`, y
    // `normalizeQuery` es el nombre con el que esta capa la usa. Lo que este
    // test vigila es que siga siendo esa y no una variante local, porque la
    // clave de caché de la red de distribución depende de ello (D-033).
    for (const value of ['  LECHE Semidesnatada ', 'Plátano de Canarias', 'Piña', '']) {
      expect(normalizeQuery(value), value).toBe(normalizeForSearch(value));
    }
  });
});
