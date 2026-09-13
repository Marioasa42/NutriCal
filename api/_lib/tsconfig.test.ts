import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import * as ts from 'typescript';

/**
 * Contrato de configuración de las funciones serverless.
 *
 * Vercel no conoce `tsconfig.api.json`. Lee `tsconfig.json` y compila la carpeta
 * `api` con lo que encuentre ahí. Cuando ese archivo no declaraba ninguna opción
 * de compilación, Vercel cayó en sus propios valores por defecto, con una
 * biblioteca anterior a ES2022, y el despliegue falló por un método de array que
 * en nuestra configuración existía sin problema.
 *
 * Estos tests fijan el reparto: las opciones viven en la raíz y el proyecto de
 * la API solo las hereda. Un invariante sin test no es un invariante.
 */

function readTsconfig(path: string): Record<string, unknown> {
  // Los tsconfig llevan comentarios, así que no valen con JSON.parse. Se usa el
  // propio analizador de TypeScript, que ya es una dependencia del proyecto.
  const parsed = ts.parseConfigFileTextToJson(path, readFileSync(path, 'utf8'));
  expect(parsed.error, `${path} no es un JSON de configuración válido`).toBeUndefined();
  return parsed.config as Record<string, unknown>;
}

const root = readTsconfig('tsconfig.json');
const api = readTsconfig('tsconfig.api.json');

function asOptions(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null ? { ...value } : undefined;
}

/** Convierte "ES2023" o "es2023" en el número 2023, o falla diciendo por qué. */
function ecmascriptYear(value: unknown, name: string): number {
  if (typeof value !== 'string') {
    throw new Error(`tsconfig.json debe declarar \`${name}\` como cadena`);
  }
  const year = Number(value.replace(/^es/i, ''));
  if (!Number.isFinite(year)) {
    throw new Error(`No se pudo leer el año de ECMAScript en \`${name}\`: "${value}"`);
  }
  return year;
}

const rootOptions = asOptions(root.compilerOptions);
const apiOptions = asOptions(api.compilerOptions);

describe('tsconfig.json, que es el que lee Vercel', () => {
  it('declara opciones de compilación', () => {
    expect(rootOptions).toBeDefined();
  });

  it('fija una biblioteca con ES2022 o posterior', () => {
    // `Array.prototype.at` y `Object.hasOwn` son de ES2022. Sin esto, el código
    // compila en local y falla al desplegar.
    const lib = rootOptions?.lib;
    if (!Array.isArray(lib)) {
      throw new Error('tsconfig.json debe declarar `lib` como lista');
    }
    expect(ecmascriptYear(lib[0], 'lib[0]')).toBeGreaterThanOrEqual(2022);
  });

  it('fija un target con ES2022 o posterior', () => {
    expect(ecmascriptYear(rootOptions?.target, 'target')).toBeGreaterThanOrEqual(2022);
  });

  it('mantiene el rigor del resto del proyecto', () => {
    expect(rootOptions?.strict).toBe(true);
    expect(rootOptions?.noUncheckedIndexedAccess).toBe(true);
    expect(rootOptions?.exactOptionalPropertyTypes).toBe(true);
  });

  it('declara los tipos de Node, que es donde corren las funciones', () => {
    expect(rootOptions?.types).toEqual(['node']);
  });
});

describe('tsconfig.api.json', () => {
  it('hereda de la raíz en lugar de repetir opciones', () => {
    expect(api.extends).toBe('./tsconfig.json');
  });

  it('no declara ninguna opción propia salvo el archivo de caché', () => {
    // Si alguien añadiera aquí `target` o `lib`, el CI comprobaría una cosa y
    // Vercel compilaría otra. Ese fue exactamente el fallo.
    expect(Object.keys(apiOptions ?? {})).toEqual(['tsBuildInfoFile']);
  });

  it('apunta a la carpeta de las funciones y al contrato compartido', () => {
    // `contracts` está aquí a propósito: es la carpeta de las reglas que el
    // cliente y el servidor tienen que cumplir igual, y el proyecto de la API
    // la comprueba con SU resolución de módulos, la de Node. La aplicación la
    // incluye también con la suya. Que las dos la compilen es lo que garantiza
    // que un archivo del contrato sigue siendo consumible por las dos puntas.
    expect(api.include).toEqual(['api', 'contracts']);
  });
});

describe('la raíz sigue construyendo todos los proyectos', () => {
  it('referencia la aplicación, la configuración y la API', () => {
    const references = (root.references ?? []) as { path: string }[];
    const paths = references.map((reference) => reference.path);
    expect(paths).toContain('./tsconfig.app.json');
    expect(paths).toContain('./tsconfig.node.json');
    expect(paths).toContain('./tsconfig.api.json');
  });
});
