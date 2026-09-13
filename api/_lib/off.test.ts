import { describe, expect, it } from 'vitest';

// Único punto donde el proyecto de la API mira dentro del frontend, y es un
// test: sirve precisamente para vigilar que las dos copias no se separen.
import { normalizeForSearch as normalizeInApp } from '../../src/shared/lib/text.js';
import { USER_AGENT, buildProductUrl, buildSearchUrl, normalizeQuery, parsePage } from './off.js';
import { normalizeForSearch as normalizeInApi } from './text.js';

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

describe('paridad con la normalización del navegador', () => {
  it('las dos implementaciones coinciden', () => {
    // La función serverless no importa código de `src` a propósito: es otro
    // proyecto y otro entorno. Este test evita que las dos copias se separen.
    const cases = [
      '  LECHE Semidesnatada ',
      'Plátano de Canarias',
      'yogur   natural',
      'Piña',
      'Melocotón en almíbar',
      '',
    ];

    for (const value of cases) {
      expect(normalizeInApi(value), value).toBe(normalizeInApp(value));
      expect(normalizeQuery(value), value).toBe(normalizeInApp(value));
    }
  });
});
