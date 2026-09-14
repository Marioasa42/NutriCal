import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NutriCalDatabase } from '@/data/db';
import { createDiaryRepository } from '@/data/repositories/diary';
import { createFoodRepository } from '@/data/repositories/foods';
import { createSeeder } from '@/data/seed';
import { dayTotals } from '@/domain/diary/totals';
import { aDate, anInstant } from '@/test/factories';

/**
 * El sembrado se prueba porque es, de paso, la prueba de humo de la capa de
 * datos: si escribe y retira usando los repositorios de verdad, es que el camino
 * de escritura completo funciona (D-016).
 */
describe('datos de ejemplo', () => {
  let database: NutriCalDatabase;
  let seeder: ReturnType<typeof createSeeder>;
  let diary: ReturnType<typeof createDiaryRepository>;
  let foods: ReturnType<typeof createFoodRepository>;

  beforeEach(async () => {
    database = new NutriCalDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
    seeder = createSeeder(database);
    diary = createDiaryRepository(database);
    foods = createFoodRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('escribe registros en el día que se le pide', async () => {
    await seeder.load(aDate('2026-09-14'));

    const meals = await diary.mealsOn(aDate('2026-09-14'));
    expect(meals).toHaveLength(4);
    expect(await diary.mealsOn(aDate('2026-09-13'))).toHaveLength(0);
  });

  it('sembrar dos veces no duplica nada', async () => {
    await seeder.load(aDate());
    await seeder.load(aDate());

    expect(await diary.mealsOn(aDate())).toHaveLength(4);
    expect(await foods.all()).toHaveLength(4);
  });

  it('retirar escribe lápidas, no borra filas', async () => {
    await seeder.load(aDate());
    await seeder.unload(anInstant('2026-09-14T20:00:00.000Z'));

    expect(await diary.mealsOn(aDate())).toHaveLength(0);
    expect(await foods.all()).toHaveLength(0);

    // Las filas siguen ahí con su fecha de borrado, que es lo que la
    // sincronización de la fase 4 necesitará para propagar el borrado (D-006).
    const raw = await database.mealEntries.toArray();
    expect(raw).toHaveLength(4);
    expect(raw.every((row) => row.isDeleted === 1)).toBe(true);
    expect(raw.every((row) => row.deletedAt === '2026-09-14T20:00:00.000Z')).toBe(true);
  });

  it('se puede volver a sembrar después de retirarlo', async () => {
    await seeder.load(aDate());
    await seeder.unload();
    await seeder.load(aDate());

    expect(await diary.mealsOn(aDate())).toHaveLength(4);
    expect(await seeder.isLoaded()).toBe(true);
  });

  it('sabe si está puesto', async () => {
    expect(await seeder.isLoaded()).toBe(false);
    await seeder.load(aDate());
    expect(await seeder.isLoaded()).toBe(true);
    await seeder.unload();
    expect(await seeder.isLoaded()).toBe(false);
  });

  it('el día sembrado tiene nutrientes incompletos, a propósito', async () => {
    await seeder.load(aDate());
    const totals = dayTotals(await diary.mealsOn(aDate()), []);

    // El pollo no trae azúcares ni fibra, así que el total del día llega con su
    // recuento de lo que falta y la pantalla tiene que enseñarlo (D-024, D-026).
    expect(totals.unknown.sugars).toBeGreaterThan(0);
    expect(totals.unknown.fiber).toBeGreaterThan(0);

    // Las cuatro obligatorias nunca aparecen en `unknown`.
    expect(totals.unknown.energy).toBeUndefined();
    expect(totals.unknown.protein).toBeUndefined();
  });
});
