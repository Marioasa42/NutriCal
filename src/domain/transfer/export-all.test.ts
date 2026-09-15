import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NutriCalDatabase } from '@/data/db';
import { createDiaryRepository } from '@/data/repositories/diary';
import { createFoodRepository } from '@/data/repositories/foods';
import { createGoalsRepository, createProfileRepository } from '@/data/repositories/settings';
import { EXPORT_SCHEMA_VERSION } from '@/domain/transfer/export';
import { createExporter } from '@/domain/transfer/export-all';
import {
  aDate,
  anInstant,
  makeExerciseEntry,
  makeFood,
  makeGoals,
  makeMealEntry,
  makeProfile,
} from '@/test/factories';

describe('exportAll', () => {
  let database: NutriCalDatabase;
  let exporter: ReturnType<typeof createExporter>;
  let foods: ReturnType<typeof createFoodRepository>;
  let diary: ReturnType<typeof createDiaryRepository>;
  let goals: ReturnType<typeof createGoalsRepository>;
  let profile: ReturnType<typeof createProfileRepository>;

  beforeEach(async () => {
    database = new NutriCalDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
    exporter = createExporter(database);
    foods = createFoodRepository(database);
    diary = createDiaryRepository(database);
    goals = createGoalsRepository(database);
    profile = createProfileRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('incluye todas las filas de cada tabla, con lápidas', async () => {
    await profile.save(makeProfile());

    const [aliveFood, deletedFood] = [
      makeFood(),
      makeFood({ deletedAt: anInstant('2026-09-13T00:00:00.000Z') }),
    ];
    await foods.saveMany([aliveFood, deletedFood]);

    await goals.save(makeGoals({ effectiveFrom: aDate('2026-09-01') }));
    await goals.save(
      makeGoals({
        effectiveFrom: aDate('2026-09-05'),
        deletedAt: anInstant('2026-09-06T00:00:00.000Z'),
      }),
    );

    await diary.saveMeal(makeMealEntry());
    await diary.saveMeal(makeMealEntry({ deletedAt: anInstant('2026-09-13T00:00:00.000Z') }));

    await diary.saveExercise(makeExerciseEntry());
    await diary.saveExercise(
      makeExerciseEntry({ deletedAt: anInstant('2026-09-13T00:00:00.000Z') }),
    );

    const envelope = await exporter.exportAll(() => anInstant('2026-09-15T09:00:00.000Z'));

    expect(envelope.schemaVersion).toBe(EXPORT_SCHEMA_VERSION);
    expect(envelope.exportedAt).toBe('2026-09-15T09:00:00.000Z');
    expect(typeof envelope.appVersion).toBe('string');

    expect(envelope.data.foods).toHaveLength(2);
    expect(envelope.data.goals).toHaveLength(2);
    expect(envelope.data.mealEntries).toHaveLength(2);
    expect(envelope.data.exerciseEntries).toHaveLength(2);

    // Las lápidas viajan de verdad, no se filtran (D-006).
    expect(envelope.data.foods.some((food) => food.deletedAt !== undefined)).toBe(true);
    expect(envelope.data.goals.some((goal) => goal.deletedAt !== undefined)).toBe(true);
    expect(envelope.data.mealEntries.some((entry) => entry.deletedAt !== undefined)).toBe(true);
    expect(envelope.data.exerciseEntries.some((entry) => entry.deletedAt !== undefined)).toBe(true);
  });

  it('falla en lugar de exportar sin perfil', async () => {
    // `ProfileProvider` garantiza un perfil antes de que arranque la
    // aplicación; llegar aquí sin uno es un error de programación, no un caso
    // de uso a manejar en silencio.
    await expect(exporter.exportAll()).rejects.toThrow('No hay perfil que exportar.');
  });
});
