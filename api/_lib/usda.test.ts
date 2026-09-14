import { describe, expect, it } from 'vitest';

import {
  MissingApiKeyError,
  buildFoodUrl,
  buildSearchUrl,
  isValidFdcId,
  normalizeQuery,
  requireApiKey,
} from './usda.js';

describe('la clave de la API', () => {
  it('se lee de la variable de entorno declarada', () => {
    expect(requireApiKey({ USDA_API_KEY: 'una-clave-de-mentira' })).toBe('una-clave-de-mentira');
  });

  it('lanza un error propio si la variable falta o está vacía', () => {
    // No se deja pasar la petición a FDC sin clave: eso respondería con un
    // error de autenticación indistinguible de cualquier otro fallo del
    // proveedor, y quien lea el registro perdería el motivo real, que es un
    // despliegue mal configurado.
    expect(() => requireApiKey({})).toThrow(MissingApiKeyError);
    expect(() => requireApiKey({ USDA_API_KEY: '' })).toThrow(MissingApiKeyError);
  });

  it('el mensaje del error no expone ningún valor, solo el nombre de la variable', () => {
    try {
      requireApiKey({ USDA_API_KEY: 'secreto-que-no-debe-salir' });
      requireApiKey({});
    } catch (error) {
      expect((error as Error).message).not.toContain('secreto-que-no-debe-salir');
      expect((error as Error).message).toContain('USDA_API_KEY');
    }
  });
});

describe('construcción de la URL de búsqueda', () => {
  it('lleva la clave, la consulta y el tamaño de página', () => {
    const url = new URL(buildSearchUrl('lentejas', 'clave-123', 25));
    expect(url.searchParams.get('api_key')).toBe('clave-123');
    expect(url.searchParams.get('query')).toBe('lentejas');
    expect(url.searchParams.get('pageSize')).toBe('25');
  });

  it('normaliza la consulta: recorta y colapsa espacios repetidos', () => {
    const a = buildSearchUrl('  lentejas   pardinas ', 'clave', 1);
    const b = buildSearchUrl('lentejas pardinas', 'clave', 1);
    expect(new URL(a).searchParams.get('query')).toBe(new URL(b).searchParams.get('query'));
  });

  it('llama solo a FDC, nunca a otro dominio, y a la ruta completa', () => {
    // Este test es el que detectó que la barra inicial de una ruta relativa
    // se comía "/fdc/v1" de la base: comprobar solo el dominio no lo habría
    // pillado, porque el dominio seguía siendo el correcto.
    const url = new URL(buildSearchUrl('lentejas', 'clave', 1));
    expect(url.hostname).toBe('api.nal.usda.gov');
    expect(url.pathname).toBe('/fdc/v1/foods/search');
  });
});

describe('construcción de la URL de un alimento', () => {
  it('pone el fdcId en la ruta y la clave en la consulta', () => {
    const url = new URL(buildFoodUrl(173410, 'clave-123'));
    expect(url.pathname).toBe('/fdc/v1/food/173410');
    expect(url.searchParams.get('api_key')).toBe('clave-123');
  });

  it('pide el formato abreviado, sin el cual los alimentos de marca no traen el número de nutriente', () => {
    // Comprobado contra la API real: el formato por defecto no da forma
    // usable para los alimentos "Branded", que son la mayoría de una
    // búsqueda. Ver el comentario de `buildFoodUrl`.
    const url = new URL(buildFoodUrl(173410, 'clave-123'));
    expect(url.searchParams.get('format')).toBe('abridged');
  });
});

describe('validación del fdcId', () => {
  it('acepta un entero positivo', () => {
    expect(isValidFdcId('173410')).toBe(true);
    expect(isValidFdcId('1')).toBe(true);
  });

  it('rechaza lo que no es un entero positivo', () => {
    expect(isValidFdcId('')).toBe(false);
    expect(isValidFdcId('0')).toBe(false);
    expect(isValidFdcId('-5')).toBe(false);
    expect(isValidFdcId('12.5')).toBe(false);
    expect(isValidFdcId('abc')).toBe(false);
    expect(isValidFdcId('173410; DROP TABLE')).toBe(false);
  });
});

describe('normalización de la consulta', () => {
  it('recorta y colapsa espacios, sin tocar acentos ni mayúsculas', () => {
    // A diferencia de `normalizeForSearch` de OFF, aquí no hace falta comparar
    // "Plátano" con "platano": FDC no tiene el mismo problema de caché
    // compartida por búsquedas textuales equivalentes que documentó D-013,
    // porque el límite es por clave de API, no por término buscado.
    expect(normalizeQuery('  lentejas   pardinas  ')).toBe('lentejas pardinas');
  });
});
