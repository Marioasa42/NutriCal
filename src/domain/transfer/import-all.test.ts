import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { NutriCalDatabase } from '@/data/db';
import { createFoodRepository } from '@/data/repositories/foods';
import { createProfileRepository } from '@/data/repositories/settings';
import { newFoodId } from '@/domain/identity/ids';
import { EXPORT_SCHEMA_VERSION, type ExportEnvelope } from '@/domain/transfer/export';
import { createImporter } from '@/domain/transfer/import-all';
import {
  anInstant,
  makeExerciseEntry,
  makeFood,
  makeGoals,
  makeMealEntry,
  makeProfile,
} from '@/test/factories';

function envelopeOf(data: ExportEnvelope['data']): ExportEnvelope {
  return {
    schemaVersion: EXPORT_SCHEMA_VERSION,
    exportedAt: anInstant('2026-09-15T09:00:00.000Z'),
    appVersion: '0.1.0',
    data,
  };
}

describe('createImporter', () => {
  let database: NutriCalDatabase;
  let importer: ReturnType<typeof createImporter>;
  let foods: ReturnType<typeof createFoodRepository>;
  let profile: ReturnType<typeof createProfileRepository>;

  beforeEach(async () => {
    database = new NutriCalDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
    importer = createImporter(database);
    foods = createFoodRepository(database);
    profile = createProfileRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('inserta lo que no existía', async () => {
    const summary = await importer.importAll(
      envelopeOf({
        profile: makeProfile(),
        goals: [makeGoals()],
        foods: [makeFood()],
        mealEntries: [makeMealEntry()],
        exerciseEntries: [makeExerciseEntry()],
      }),
    );

    expect(summary).toEqual({ inserted: 5, updated: 0, keptLocal: 0 });
    expect(await foods.all()).toHaveLength(1);
  });

  it('gana la versión más reciente cuando el id ya existe', async () => {
    const id = newFoodId();
    const older = makeFood({
      id,
      name: 'Manzana',
      createdAt: anInstant('2026-09-01T00:00:00.000Z'),
    });
    await foods.save(older);

    const newer = {
      ...makeFood({ id, name: 'Manzana Fuji' }),
      updatedAt: anInstant('2026-09-10T00:00:00.000Z'),
    };

    const summary = await importer.importAll(
      envelopeOf({
        profile: makeProfile(),
        goals: [],
        foods: [newer],
        mealEntries: [],
        exerciseEntries: [],
      }),
    );

    expect(summary).toEqual({ inserted: 1, updated: 1, keptLocal: 0 });
    const stored = await foods.byId(id);
    expect(stored?.name).toBe('Manzana Fuji');
  });

  it('conserva la fila local si es más reciente que la del archivo', async () => {
    const id = newFoodId();
    const localVersion = {
      ...makeFood({ id, name: 'Manzana local, más nueva' }),
      updatedAt: anInstant('2026-09-14T00:00:00.000Z'),
    };
    await foods.save(localVersion);

    const olderFromFile = {
      ...makeFood({ id, name: 'Manzana del archivo, más vieja' }),
      updatedAt: anInstant('2026-09-01T00:00:00.000Z'),
    };

    const summary = await importer.importAll(
      envelopeOf({
        profile: makeProfile(),
        goals: [],
        foods: [olderFromFile],
        mealEntries: [],
        exerciseEntries: [],
      }),
    );

    expect(summary).toEqual({ inserted: 1, updated: 0, keptLocal: 1 });
    const stored = await foods.byId(id);
    expect(stored?.name).toBe('Manzana local, más nueva');
  });

  it('importar el mismo archivo dos veces no duplica ni actualiza nada la segunda vez', async () => {
    const envelope = envelopeOf({
      profile: makeProfile(),
      goals: [makeGoals()],
      foods: [makeFood()],
      mealEntries: [],
      exerciseEntries: [],
    });

    await importer.importAll(envelope);
    const second = await importer.importAll(envelope);

    expect(second).toEqual({ inserted: 0, updated: 0, keptLocal: 3 });
    expect(await foods.all()).toHaveLength(1);
  });

  it('preview no escribe nada', async () => {
    const summary = await importer.preview(
      envelopeOf({
        profile: makeProfile(),
        goals: [],
        foods: [makeFood()],
        mealEntries: [],
        exerciseEntries: [],
      }),
    );

    expect(summary).toEqual({ inserted: 2, updated: 0, keptLocal: 0 });
    expect(await foods.all()).toHaveLength(0);
    expect(await profile.current()).toBeUndefined();
  });

  it('una importación que falla a mitad no deja nada escrito', async () => {
    const failure = new Error('fallo simulado a mitad de la importación');
    const putSpy = vi.spyOn(database.mealEntries, 'put').mockRejectedValueOnce(failure);

    await expect(
      importer.importAll(
        envelopeOf({
          profile: makeProfile(),
          goals: [makeGoals()],
          foods: [makeFood()],
          mealEntries: [makeMealEntry()],
          exerciseEntries: [makeExerciseEntry()],
        }),
      ),
    ).rejects.toThrow(failure);

    // Ninguna de las cinco tablas conserva nada, ni siquiera las que no
    // fallaron: es la transacción entera la que se deshace, no solo la fila
    // que rompió.
    expect(await database.profile.toArray()).toHaveLength(0);
    expect(await database.goals.toArray()).toHaveLength(0);
    expect(await database.foods.toArray()).toHaveLength(0);
    expect(await database.mealEntries.toArray()).toHaveLength(0);
    expect(await database.exerciseEntries.toArray()).toHaveLength(0);

    putSpy.mockRestore();
  });
});
