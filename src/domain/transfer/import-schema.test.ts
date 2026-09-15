import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NutriCalDatabase } from '@/data/db';
import { createDiaryRepository } from '@/data/repositories/diary';
import { createFoodRepository } from '@/data/repositories/foods';
import { createGoalsRepository, createProfileRepository } from '@/data/repositories/settings';
import { EXPORT_SCHEMA_VERSION } from '@/domain/transfer/export';
import { createExporter } from '@/domain/transfer/export-all';
import { parseExportEnvelope } from '@/domain/transfer/import-schema';
import {
  anInstant,
  makeExerciseEntry,
  makeFood,
  makeGoals,
  makeMealEntry,
  makeProfile,
} from '@/test/factories';

describe('parseExportEnvelope', () => {
  let database: NutriCalDatabase;

  beforeEach(async () => {
    database = new NutriCalDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
  });

  afterEach(async () => {
    await database.delete();
  });

  it('reconstruye un archivo real, incluidas sus magnitudes con marca', async () => {
    const foods = createFoodRepository(database);
    const diary = createDiaryRepository(database);
    const goals = createGoalsRepository(database);
    const profile = createProfileRepository(database);
    const exporter = createExporter(database);

    await profile.save(makeProfile());
    await goals.save(makeGoals());
    await foods.save(makeFood());
    await diary.saveMeal(makeMealEntry());
    await diary.saveExercise(makeExerciseEntry());

    const envelope = await exporter.exportAll();

    // `JSON.parse(JSON.stringify(...))` simula lo que de verdad pasa por un
    // archivo: las magnitudes con marca se serializan como números pelados,
    // exactamente lo que recibiría `parseExportEnvelope` al leer un archivo
    // de disco de verdad.
    const raw: unknown = JSON.parse(JSON.stringify(envelope));
    const parsed = parseExportEnvelope(raw);

    expect(parsed).toEqual(envelope);
  });

  it('rechaza una magnitud fuera de rango sin llegar a construirla', async () => {
    const foods = createFoodRepository(database);
    const profile = createProfileRepository(database);
    const exporter = createExporter(database);

    await profile.save(makeProfile());
    await foods.save(makeFood());

    const envelope = await exporter.exportAll();
    const raw = JSON.parse(JSON.stringify(envelope)) as {
      data: { foods: { per100: { macros: { protein: number } } }[] };
    };
    // Un archivo corrupto o tocado a mano: proteína negativa.
    const firstFood = raw.data.foods[0];
    if (firstFood !== undefined) {
      firstFood.per100.macros.protein = -5;
    }

    expect(() => parseExportEnvelope(raw)).toThrow(/formato esperado/);
  });

  it('rechaza un schemaVersion más nuevo del que la aplicación entiende', () => {
    const future = {
      schemaVersion: EXPORT_SCHEMA_VERSION + 1,
      exportedAt: anInstant(),
      appVersion: '0.1.0',
      data: {},
    };

    expect(() => parseExportEnvelope(future)).toThrow(/versión más nueva/);
  });

  it('rechaza un archivo sin la forma mínima de una envoltura', () => {
    expect(() => parseExportEnvelope({ nada: 'que ver' })).toThrow();
    expect(() => parseExportEnvelope('esto no es ni un objeto')).toThrow();
  });
});
