import { describe, expect, it } from 'vitest';

import { ALIVE, DELETED, fromStored, fromStoredFood, toStored, toStoredFood } from '@/data/stored';
import { anInstant, makeFood, makeMealEntry } from '@/test/factories';

describe('envoltorio de almacenamiento', () => {
  it('marca como viva una entidad sin lápida', () => {
    expect(toStored(makeMealEntry()).isDeleted).toBe(ALIVE);
  });

  it('marca como borrada una entidad con lápida', () => {
    const entry = makeMealEntry({ deletedAt: anInstant('2026-09-13T09:00:00.000Z') });
    expect(toStored(entry).isDeleted).toBe(DELETED);
  });

  it('la bandera se deriva siempre de deletedAt, nunca se escribe a mano', () => {
    // Esta es la garantía que impide que los dos campos se contradigan.
    const alive = makeMealEntry();
    const dead = makeMealEntry({ deletedAt: anInstant('2026-09-13T09:00:00.000Z') });
    expect(toStored(alive).isDeleted).toBe(ALIVE);
    expect(toStored(dead).isDeleted).toBe(DELETED);
  });

  it('no deja rastro del campo de almacenamiento al leer', () => {
    // Importa para la exportación: el archivo JSON describe el dominio, no la
    // forma interna de IndexedDB. Ver las decisiones D-007 y D-014.
    const restored = fromStored(toStored(makeMealEntry()));
    expect(Object.keys(restored)).not.toContain('isDeleted');
  });

  it('la ida y vuelta devuelve exactamente la entidad original', () => {
    const entry = makeMealEntry();
    expect(fromStored(toStored(entry))).toEqual(entry);
  });
});

describe('envoltorio de alimentos', () => {
  it('calcula el texto de búsqueda al guardar', () => {
    const stored = toStoredFood(makeFood({ name: 'Plátano de Canarias' }));
    expect(stored.searchText).toBe('platano de canarias');
  });

  it('incluye la marca en el texto de búsqueda', () => {
    const stored = toStoredFood(makeFood({ name: 'Yogur natural', brand: 'Danone' }));
    expect(stored.searchText).toBe('yogur natural danone');
  });

  it('no deja espacios sobrantes cuando no hay marca', () => {
    const stored = toStoredFood(makeFood({ name: 'Pan' }));
    expect(stored.searchText).toBe('pan');
  });

  it('la ida y vuelta no arrastra ni la bandera ni el texto de búsqueda', () => {
    const food = makeFood({ name: 'Manzana', brand: 'Golden' });
    const restored = fromStoredFood(toStoredFood(food));

    expect(Object.keys(restored)).not.toContain('isDeleted');
    expect(Object.keys(restored)).not.toContain('searchText');
    expect(restored).toEqual(food);
  });
});
