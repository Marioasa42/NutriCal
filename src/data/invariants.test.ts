import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NutriCalDatabase } from '@/data/db';
import { createDiaryRepository } from '@/data/repositories/diary';
import { createFoodRepository } from '@/data/repositories/foods';
import { createGoalsRepository, createProfileRepository } from '@/data/repositories/settings';
import { ALIVE, DELETED, type DeletedFlag } from '@/data/stored';
import type { Instant } from '@/domain/time/local-date';
import {
  anInstant,
  makeExerciseEntry,
  makeFood,
  makeGoals,
  makeMealEntry,
  makeProfile,
} from '@/test/factories';

/**
 * El invariante de la decisión D-014: `isDeleted` y `deletedAt` nunca pueden
 * contradecirse, porque el primero se deriva del segundo en un único punto.
 *
 * Este archivo recorre todos los caminos de escritura de todos los repositorios
 * y comprueba las filas en crudo, tal como quedaron en IndexedDB. Un invariante
 * que solo está escrito en un comentario no es un invariante.
 */

interface Tombstoned {
  readonly isDeleted: DeletedFlag;
  readonly deletedAt?: Instant;
}

function expectConsistent(rows: readonly Tombstoned[], context: string): void {
  expect(rows.length, `${context}: no se escribió ninguna fila`).toBeGreaterThan(0);
  for (const row of rows) {
    const expected = row.deletedAt === undefined ? ALIVE : DELETED;
    expect(row.isDeleted, `${context}: la bandera contradice a deletedAt`).toBe(expected);
  }
}

describe('coherencia entre isDeleted y deletedAt', () => {
  let database: NutriCalDatabase;
  let foods: ReturnType<typeof createFoodRepository>;
  let diary: ReturnType<typeof createDiaryRepository>;
  let goals: ReturnType<typeof createGoalsRepository>;
  let profiles: ReturnType<typeof createProfileRepository>;

  beforeEach(async () => {
    database = new NutriCalDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
    foods = createFoodRepository(database);
    diary = createDiaryRepository(database);
    goals = createGoalsRepository(database);
    profiles = createProfileRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  /** Todas las filas de todas las tablas, sin desenvolver. */
  async function allRows(): Promise<readonly Tombstoned[]> {
    const [foodRows, mealRows, exerciseRows, goalRows, profileRows] = await Promise.all([
      database.foods.toArray(),
      database.mealEntries.toArray(),
      database.exerciseEntries.toArray(),
      database.goals.toArray(),
      database.profile.toArray(),
    ]);
    return [...foodRows, ...mealRows, ...exerciseRows, ...goalRows, ...profileRows];
  }

  it('se cumple al guardar por todos los caminos de escritura', async () => {
    await foods.save(makeFood({ name: 'Manzana' }));
    await foods.saveMany([makeFood({ name: 'Pera' }), makeFood({ name: 'Uva' })]);
    await diary.saveMeal(makeMealEntry());
    await diary.saveMeals([makeMealEntry(), makeMealEntry()]);
    await diary.saveExercise(makeExerciseEntry());
    await goals.save(makeGoals());
    await profiles.save(makeProfile());

    const rows = await allRows();
    expect(rows).toHaveLength(9);
    expectConsistent(rows, 'guardado');
    expect(rows.every((row) => row.isDeleted === ALIVE)).toBe(true);
  });

  it('se cumple al borrar por todos los caminos de borrado', async () => {
    const food = makeFood();
    const meal = makeMealEntry();
    const exercise = makeExerciseEntry();
    const goal = makeGoals();
    await foods.save(food);
    await diary.saveMeal(meal);
    await diary.saveExercise(exercise);
    await goals.save(goal);

    const at = anInstant('2026-09-13T09:00:00.000Z');
    await foods.remove(food.id, at);
    await diary.removeMeal(meal.id, at);
    await diary.removeExercise(exercise.id, at);
    await goals.remove(goal.id, at);

    const rows = await allRows();
    expect(rows).toHaveLength(4);
    expectConsistent(rows, 'borrado');
    expect(rows.every((row) => row.isDeleted === DELETED)).toBe(true);
  });

  it('se cumple al guardar una entidad que ya trae lápida', async () => {
    // Es el caso de la importación de un archivo exportado: los borrados vienen
    // dentro y se escriben directamente, sin pasar por el camino de borrado.
    const at = anInstant('2026-09-13T09:00:00.000Z');
    await foods.save(makeFood({ deletedAt: at }));
    await diary.saveMeals([makeMealEntry({ deletedAt: at }), makeMealEntry()]);
    await goals.save(makeGoals({ deletedAt: at }));

    const rows = await allRows();
    expectConsistent(rows, 'importación');
    expect(rows.filter((row) => row.isDeleted === DELETED)).toHaveLength(3);
  });

  it('se cumple al revivir una entidad quitándole la lápida', async () => {
    const at = anInstant('2026-09-13T09:00:00.000Z');
    const buried = makeFood({ deletedAt: at });
    await foods.save(buried);

    const { deletedAt: _gone, ...revived } = buried;
    await foods.save(revived);

    const rows = await allRows();
    expectConsistent(rows, 'resurrección');
    expect(rows[0]?.isDeleted).toBe(ALIVE);
    expect(await foods.byId(buried.id)).toBeDefined();
  });

  it('borrar dos veces no deja la bandera a medias', async () => {
    const food = makeFood();
    await foods.save(food);
    await foods.remove(food.id, anInstant('2026-09-13T09:00:00.000Z'));
    await foods.remove(food.id, anInstant('2026-09-14T09:00:00.000Z'));

    const rows = await allRows();
    expectConsistent(rows, 'doble borrado');
    expect(rows[0]?.deletedAt).toBe('2026-09-14T09:00:00.000Z');
  });

  it('la bandera sigue siendo coherente tras editar una entidad viva', async () => {
    const food = makeFood({ name: 'Pan blanco' });
    await foods.save(food);
    await foods.save({ ...food, name: 'Pan de centeno' });

    const rows = await allRows();
    expect(rows).toHaveLength(1);
    expectConsistent(rows, 'edición');
  });
});
