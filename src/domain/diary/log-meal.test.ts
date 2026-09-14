import { describe, expect, it } from 'vitest';

import { createMealEntry, type LogMealContext } from '@/domain/diary/log-meal';
import { entryTotals } from '@/domain/diary/totals';
import type { VolumeFood } from '@/domain/food/food';
import { newServingId, type MealEntryId, type ServingId } from '@/domain/identity/ids';
import { instant, localDate } from '@/domain/time/local-date';
import { grams, kilocalories, milliliters } from '@/domain/units/units';
import { aDate, anInstant, makeFood } from '@/test/factories';

/**
 * Registrar es el momento en que se copia la instantánea. Estos tests vigilan
 * las dos promesas que sostiene esa copia: que el historial deja de depender de
 * la fuente (D-003) y que la porción no puede salir en una unidad distinta a la
 * del alimento (D-005).
 */

const CAPTURED_AT = instant('2026-09-14T08:30:00.000Z');

/** Reloj e identificadores fijos: sin esto no se puede comparar el registro entero. */
const fixedContext: LogMealContext = {
  now: () => CAPTURED_AT,
  newMealEntryId: () => 'entry-fijo' as MealEntryId,
};

const aVolumeFood = (): VolumeFood => ({
  id: makeFood().id,
  name: 'Leche entera',
  source: { kind: 'custom' },
  baseUnit: 'ml',
  per100: {
    macros: {
      energy: kilocalories(64),
      protein: grams(3.1),
      carbohydrates: grams(4.7),
      fat: grams(3.6),
    },
    micros: {},
  },
  completion: { userFilled: [] },
  servings: [{ id: newServingId(), label: 'Un vaso', amountInBaseUnit: milliliters(250) }],
  createdAt: anInstant(),
  updatedAt: anInstant(),
});

describe('createMealEntry', () => {
  it('copia el perfil nutricional dentro del registro', () => {
    const food = makeFood({ energyKcal: 52 });
    const result = createMealEntry(
      { food, date: aDate(), slot: 'breakfast', choice: { kind: 'baseUnit', amount: 150 } },
      fixedContext,
    );
    if (result.kind !== 'created') throw new Error('se esperaba un registro');

    // La instantánea, no una referencia: esto es lo que hace que corregir el
    // alimento del catálogo no toque el registro ya escrito.
    expect(result.entry.food.per100).toEqual(food.per100);
    expect(result.entry.food.foodId).toBe(food.id);
    expect(result.entry.food.capturedAt).toBe(CAPTURED_AT);
  });

  it('el registro sobrevive a que el alimento de origen cambie después', () => {
    const food = makeFood({ energyKcal: 52 });
    const result = createMealEntry(
      { food, date: aDate(), slot: 'lunch', choice: { kind: 'baseUnit', amount: 100 } },
      fixedContext,
    );
    if (result.kind !== 'created') throw new Error('se esperaba un registro');

    // La fuente "corrige" sus datos: se construye el alimento otra vez con otra
    // cifra y el mismo identificador. El registro ya escrito no puede enterarse.
    const corrected = makeFood({ id: food.id, energyKcal: 999 });
    expect(corrected.per100.macros.energy).not.toBe(result.entry.food.per100.macros.energy);
    expect(entryTotals(result.entry).macros.energy).toBe(kilocalories(52));
  });

  it('guarda la elección tal cual, además de su equivalencia en unidades base', () => {
    const food = makeFood();
    const serving = food.servings[0];
    if (serving === undefined) throw new Error('la fábrica debe traer una porción');

    const result = createMealEntry(
      {
        food,
        date: aDate(),
        slot: 'snack',
        choice: { kind: 'serving', servingId: serving.id, count: 0.5 },
      },
      fixedContext,
    );
    if (result.kind !== 'created') throw new Error('se esperaba un registro');

    // Las dos cosas: la elección porque es lo que la persona entiende y querrá
    // volver a ver al editar, y la equivalencia porque es lo que usa el cálculo.
    expect(result.entry.portion.selection).toEqual({
      kind: 'serving',
      servingId: serving.id,
      count: 0.5,
    });
    expect(result.entry.portion.amountInBaseUnit).toBe(grams(91));
  });

  it('pone la unidad del alimento, no la que traiga el formulario', () => {
    const result = createMealEntry(
      {
        food: aVolumeFood(),
        date: aDate(),
        slot: 'dinner',
        choice: { kind: 'baseUnit', amount: 200 },
      },
      fixedContext,
    );
    if (result.kind !== 'created') throw new Error('se esperaba un registro');

    // El formulario mandó un 200 pelado. Quien decide que son mililitros es el
    // alimento, y por eso un formulario no puede meter gramos en una bebida.
    expect(result.entry.food.baseUnit).toBe('ml');
    expect(result.entry.portion.amountInBaseUnit).toBe(milliliters(200));
    expect(entryTotals(result.entry).macros.energy).toBe(kilocalories(128));
  });

  it('rechaza una cantidad que no se puede servir en vez de lanzar', () => {
    const food = makeFood();
    for (const amount of [0, -5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = createMealEntry(
        { food, date: aDate(), slot: 'breakfast', choice: { kind: 'baseUnit', amount } },
        fixedContext,
      );
      // Una cantidad mal tecleada es entrada de la persona usuaria, no un fallo
      // de programación: sale por una rama con nombre y la pantalla la explica.
      expect(result.kind, String(amount)).toBe('invalidAmount');
    }
  });

  it('rechaza una ración que el alimento no tiene', () => {
    const result = createMealEntry(
      {
        food: makeFood(),
        date: aDate(),
        slot: 'breakfast',
        choice: { kind: 'serving', servingId: 'no-existe' as ServingId, count: 1 },
      },
      fixedContext,
    );
    expect(result).toEqual({ kind: 'unknownServing', servingId: 'no-existe' });
  });

  it('rechaza un número de raciones imposible', () => {
    const food = makeFood();
    const serving = food.servings[0];
    if (serving === undefined) throw new Error('la fábrica debe traer una porción');

    const result = createMealEntry(
      {
        food,
        date: aDate(),
        slot: 'breakfast',
        choice: { kind: 'serving', servingId: serving.id, count: 0 },
      },
      fixedContext,
    );
    expect(result).toEqual({ kind: 'invalidCount', count: 0 });
  });

  it('el día del registro es el que se le pasa, no el del reloj', () => {
    // El reloj marca el 14; el registro es del día 12 porque así lo pidió la
    // pantalla. Un día del diario es una decisión local, nunca una consecuencia
    // del instante en que se escribió.
    const result = createMealEntry(
      {
        food: makeFood(),
        date: localDate('2026-09-12'),
        slot: 'dinner',
        choice: { kind: 'baseUnit', amount: 100 },
      },
      fixedContext,
    );
    if (result.kind !== 'created') throw new Error('se esperaba un registro');

    expect(result.entry.date).toBe('2026-09-12');
    expect(result.entry.createdAt).toBe(CAPTURED_AT);
  });

  it('nace vivo y con las dos marcas de tiempo iguales', () => {
    const result = createMealEntry(
      {
        food: makeFood(),
        date: aDate(),
        slot: 'breakfast',
        choice: { kind: 'baseUnit', amount: 100 },
      },
      fixedContext,
    );
    if (result.kind !== 'created') throw new Error('se esperaba un registro');

    expect(result.entry.deletedAt).toBeUndefined();
    expect(result.entry.updatedAt).toBe(result.entry.createdAt);
  });
});
