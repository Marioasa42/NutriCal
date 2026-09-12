import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NutriCalDatabase } from '@/data/db';
import { createDiaryRepository } from '@/data/repositories/diary';
import { aDate, anInstant, makeExerciseEntry, makeMealEntry } from '@/test/factories';

describe('repositorio del diario', () => {
  let database: NutriCalDatabase;
  let diary: ReturnType<typeof createDiaryRepository>;

  beforeEach(async () => {
    database = new NutriCalDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
    diary = createDiaryRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  describe('comidas de un día', () => {
    it('devuelve solo las del día pedido', async () => {
      await diary.saveMeals([
        makeMealEntry({ date: aDate('2026-09-12') }),
        makeMealEntry({ date: aDate('2026-09-12') }),
        makeMealEntry({ date: aDate('2026-09-13') }),
      ]);

      expect(await diary.mealsOn(aDate('2026-09-12'))).toHaveLength(2);
      expect(await diary.mealsOn(aDate('2026-09-13'))).toHaveLength(1);
    });

    it('devuelve vacío para un día sin registros', async () => {
      expect(await diary.mealsOn(aDate('2026-01-01'))).toEqual([]);
    });

    it('ordena por momento de creación', async () => {
      await diary.saveMeals([
        makeMealEntry({ slot: 'dinner', createdAt: anInstant('2026-09-12T21:00:00.000Z') }),
        makeMealEntry({ slot: 'breakfast', createdAt: anInstant('2026-09-12T08:00:00.000Z') }),
      ]);

      const meals = await diary.mealsOn(aDate('2026-09-12'));
      expect(meals.map((meal) => meal.slot)).toEqual(['breakfast', 'dinner']);
    });

    it('filtra por momento del día usando el índice compuesto', async () => {
      await diary.saveMeals([
        makeMealEntry({ slot: 'breakfast' }),
        makeMealEntry({ slot: 'dinner' }),
        makeMealEntry({ slot: 'dinner' }),
      ]);

      expect(await diary.mealsOnSlot(aDate('2026-09-12'), 'dinner')).toHaveLength(2);
      expect(await diary.mealsOnSlot(aDate('2026-09-12'), 'lunch')).toHaveLength(0);
    });

    it('excluye las comidas borradas', async () => {
      const kept = makeMealEntry({ slot: 'breakfast' });
      const removed = makeMealEntry({ slot: 'lunch' });
      await diary.saveMeals([kept, removed]);
      await diary.removeMeal(removed.id);

      const meals = await diary.mealsOn(aDate('2026-09-12'));
      expect(meals.map((meal) => meal.slot)).toEqual(['breakfast']);
      expect(await diary.mealById(removed.id)).toBeUndefined();
    });
  });

  describe('instantánea del alimento', () => {
    it('el registro conserva los valores nutricionales, no una referencia', async () => {
      const entry = makeMealEntry();
      await diary.saveMeal(entry);

      const stored = await diary.mealById(entry.id);
      // El registro sigue sabiendo qué comiste aunque el alimento de origen
      // desaparezca del catálogo o la fuente externa corrija sus datos.
      expect(stored?.food.per100.macros.energy).toBe(52);
      expect(stored?.food.foodId).toBe(entry.food.foodId);
      expect(stored?.portion.amountInBaseUnit).toBe(150);
    });
  });

  describe('ejercicio', () => {
    it('guarda y recupera por día', async () => {
      await diary.saveExercise(makeExerciseEntry({ date: aDate('2026-09-12') }));
      await diary.saveExercise(makeExerciseEntry({ date: aDate('2026-09-14') }));

      expect(await diary.exerciseOn(aDate('2026-09-12'))).toHaveLength(1);
      expect(await diary.exerciseOn(aDate('2026-09-13'))).toEqual([]);
    });

    it('conserva los minutos y la energía como los guardó', async () => {
      const walk = makeExerciseEntry({ durationMin: 45, energyKcal: 180 });
      await diary.saveExercise(walk);

      const stored = await diary.exerciseById(walk.id);
      expect(stored?.durationMinutes).toBe(45);
      expect(stored?.energy).toBe(180);
    });

    it('excluye el ejercicio borrado', async () => {
      const walk = makeExerciseEntry();
      await diary.saveExercise(walk);
      await diary.removeExercise(walk.id);

      expect(await diary.exerciseOn(aDate('2026-09-12'))).toEqual([]);
      expect(await diary.exerciseById(walk.id)).toBeUndefined();
    });
  });

  describe('días con registros', () => {
    it('reúne comidas y ejercicio sin repetir, en orden', async () => {
      await diary.saveMeals([
        makeMealEntry({ date: aDate('2026-09-14') }),
        makeMealEntry({ date: aDate('2026-09-12') }),
      ]);
      await diary.saveExercise(makeExerciseEntry({ date: aDate('2026-09-12') }));

      expect(await diary.datesWithEntries()).toEqual(['2026-09-12', '2026-09-14']);
    });

    it('no cuenta un día cuyos registros están todos borrados', async () => {
      const only = makeMealEntry({ date: aDate('2026-09-20') });
      await diary.saveMeal(only);
      await diary.removeMeal(only.id);

      expect(await diary.datesWithEntries()).toEqual([]);
    });
  });
});
