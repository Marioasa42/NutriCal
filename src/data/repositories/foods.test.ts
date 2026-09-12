import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NutriCalDatabase } from '@/data/db';
import { createFoodRepository } from '@/data/repositories/foods';
import { anInstant, makeFood } from '@/test/factories';

describe('repositorio de alimentos', () => {
  let database: NutriCalDatabase;
  let foods: ReturnType<typeof createFoodRepository>;

  beforeEach(async () => {
    // Una base de datos nueva por test: los tests no comparten estado y pueden
    // ejecutarse en cualquier orden.
    database = new NutriCalDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
    foods = createFoodRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('guarda y recupera por identificador', async () => {
    const apple = makeFood({ name: 'Manzana' });
    await foods.save(apple);

    const found = await foods.byId(apple.id);
    expect(found?.name).toBe('Manzana');
  });

  it('conserva el perfil nutricional tal cual se guardó', async () => {
    const apple = makeFood({ energyKcal: 52 });
    await foods.save(apple);

    const found = await foods.byId(apple.id);
    expect(found?.per100.macros.energy).toBe(52);
    expect(found?.per100.micros.vitaminC).toBe(4.6);
  });

  it('devuelve indefinido para un identificador que no existe', async () => {
    const ghost = makeFood();
    expect(await foods.byId(ghost.id)).toBeUndefined();
  });

  describe('lápidas', () => {
    it('deja de devolver un alimento borrado', async () => {
      const apple = makeFood();
      await foods.save(apple);
      await foods.remove(apple.id, anInstant('2026-09-13T09:00:00.000Z'));

      expect(await foods.byId(apple.id)).toBeUndefined();
    });

    it('no elimina la fila: escribe la fecha de borrado', async () => {
      const apple = makeFood();
      await foods.save(apple);
      await foods.remove(apple.id, anInstant('2026-09-13T09:00:00.000Z'));

      const withTombstone = await foods.byIdIncludingDeleted(apple.id);
      expect(withTombstone).toBeDefined();
      expect(withTombstone?.deletedAt).toBe('2026-09-13T09:00:00.000Z');
    });

    it('actualiza también updatedAt al borrar, para que el borrado se pueda ordenar', async () => {
      const apple = makeFood({ createdAt: anInstant('2026-09-12T10:00:00.000Z') });
      await foods.save(apple);
      await foods.remove(apple.id, anInstant('2026-09-13T09:00:00.000Z'));

      const withTombstone = await foods.byIdIncludingDeleted(apple.id);
      expect(withTombstone?.updatedAt).toBe('2026-09-13T09:00:00.000Z');
    });

    it('borrar algo que no existe no lanza', async () => {
      const ghost = makeFood();
      await expect(foods.remove(ghost.id)).resolves.toBeUndefined();
    });

    it('los borrados quedan fuera de la búsqueda y del listado', async () => {
      const alive = makeFood({ name: 'Manzana' });
      const dead = makeFood({ name: 'Manzana asada' });
      await foods.saveMany([alive, dead]);
      await foods.remove(dead.id);

      expect(await foods.all()).toHaveLength(1);
      expect((await foods.searchByName('manzana')).map((food) => food.name)).toEqual(['Manzana']);
    });
  });

  describe('búsqueda por código de barras', () => {
    it('encuentra el alimento por su código exacto', async () => {
      const yogurt = makeFood({ name: 'Yogur natural', barcode: '8410128750121' });
      await foods.saveMany([yogurt, makeFood({ name: 'Pan', barcode: '8480000123456' })]);

      const found = await foods.byBarcode('8410128750121');
      expect(found?.name).toBe('Yogur natural');
    });

    it('no encuentra un alimento borrado', async () => {
      const yogurt = makeFood({ barcode: '8410128750121' });
      await foods.save(yogurt);
      await foods.remove(yogurt.id);

      expect(await foods.byBarcode('8410128750121')).toBeUndefined();
    });

    it('devuelve indefinido para un código desconocido', async () => {
      await foods.save(makeFood({ barcode: '8410128750121' }));
      expect(await foods.byBarcode('0000000000000')).toBeUndefined();
    });
  });

  describe('búsqueda por texto', () => {
    beforeEach(async () => {
      await foods.saveMany([
        makeFood({ name: 'Plátano de Canarias' }),
        makeFood({ name: 'Yogur natural', brand: 'Danone' }),
        makeFood({ name: 'Pan integral' }),
      ]);
    });

    it('encuentra por subcadena, no solo por prefijo', async () => {
      const found = await foods.searchByName('natural');
      expect(found.map((food) => food.name)).toEqual(['Yogur natural']);
    });

    it('ignora mayúsculas y acentos', async () => {
      expect(await foods.searchByName('platano')).toHaveLength(1);
      expect(await foods.searchByName('PLÁTANO')).toHaveLength(1);
    });

    it('busca también en la marca', async () => {
      const found = await foods.searchByName('danone');
      expect(found.map((food) => food.name)).toEqual(['Yogur natural']);
    });

    it('devuelve vacío cuando no hay coincidencias', async () => {
      expect(await foods.searchByName('solomillo')).toEqual([]);
    });

    it('devuelve vacío para una consulta en blanco', async () => {
      expect(await foods.searchByName('   ')).toEqual([]);
    });

    it('respeta el límite de resultados', async () => {
      const found = await foods.searchByName('a', 2);
      expect(found.length).toBeLessThanOrEqual(2);
    });

    it('recalcula el texto de búsqueda al volver a guardar', async () => {
      const food = makeFood({ name: 'Pan blanco' });
      await foods.save(food);
      await foods.save({ ...food, name: 'Pan de centeno' });

      expect(await foods.searchByName('blanco')).toEqual([]);
      expect((await foods.searchByName('centeno')).map((item) => item.name)).toEqual([
        'Pan de centeno',
      ]);
    });
  });

  describe('frontera con el almacenamiento', () => {
    it('lo que devuelve el repositorio no lleva campos internos de IndexedDB', async () => {
      const apple = makeFood();
      await foods.save(apple);

      const found = await foods.byId(apple.id);
      expect(found).toEqual(apple);
      expect(Object.keys(found ?? {})).not.toContain('isDeleted');
      expect(Object.keys(found ?? {})).not.toContain('searchText');
    });

    it('un alimento borrado conserva la bandera y la fecha coherentes entre sí', async () => {
      const apple = makeFood();
      await foods.save(apple);
      await foods.remove(apple.id, anInstant('2026-09-13T09:00:00.000Z'));

      const raw = await database.foods.get(apple.id);
      expect(raw?.isDeleted).toBe(1);
      expect(raw?.deletedAt).toBe('2026-09-13T09:00:00.000Z');
    });
  });
});
