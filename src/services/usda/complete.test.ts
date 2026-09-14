import { describe, expect, it } from 'vitest';

import { instant } from '@/domain/time/local-date';
import { makeFood } from '@/test/factories';
import { mergeUsdaDetailIntoCatalogFood } from '@/services/usda/complete';

const UPDATED_AT = instant('2026-09-14T18:00:00.000Z');

describe('mergeUsdaDetailIntoCatalogFood', () => {
  it('conserva la identidad del alimento del catálogo', () => {
    const catalogFood = makeFood({ name: 'Lentejas', fdcId: 173410 });
    const detail = makeFood({ name: 'Lentejas, crudas', fdcId: 173410 });

    const merged = mergeUsdaDetailIntoCatalogFood(catalogFood, detail, UPDATED_AT);

    expect(merged.id).toBe(catalogFood.id);
    expect(merged.createdAt).toBe(catalogFood.createdAt);
    expect(merged.source).toEqual(catalogFood.source);
  });

  it('toma el perfil nutricional de la ficha, no del catálogo', () => {
    const catalogFood = makeFood({ fdcId: 173410, energyKcal: 100 });
    const detail = makeFood({ fdcId: 173410, energyKcal: 353 });

    const merged = mergeUsdaDetailIntoCatalogFood(catalogFood, detail, UPDATED_AT);

    expect(merged.per100).toEqual(detail.per100);
  });

  it('actualiza updatedAt al instante dado', () => {
    const merged = mergeUsdaDetailIntoCatalogFood(makeFood(), makeFood(), UPDATED_AT);
    expect(merged.updatedAt).toBe(UPDATED_AT);
  });

  it('prefiere el nombre y la marca de la ficha', () => {
    const catalogFood = { ...makeFood({ name: 'Lentejas' }), brand: 'Marca de la búsqueda' };
    const detail = { ...makeFood({ name: 'Lentejas, crudas' }), brand: 'Marca de la ficha' };

    const merged = mergeUsdaDetailIntoCatalogFood(catalogFood, detail, UPDATED_AT);

    expect(merged.name).toBe('Lentejas, crudas');
    expect(merged.brand).toBe('Marca de la ficha');
  });

  it('conserva la marca del catálogo si la ficha no trae ninguna', () => {
    const catalogFood = { ...makeFood(), brand: 'Marca de la búsqueda' };
    const detail = makeFood();

    const merged = mergeUsdaDetailIntoCatalogFood(catalogFood, detail, UPDATED_AT);

    expect(merged.brand).toBe('Marca de la búsqueda');
  });
});
