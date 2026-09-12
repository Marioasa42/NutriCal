import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { NutriCalDatabase } from '@/data/db';
import { createGoalsRepository, createProfileRepository } from '@/data/repositories/settings';
import { aDate, makeGoals, makeProfile } from '@/test/factories';

describe('repositorio de objetivos', () => {
  let database: NutriCalDatabase;
  let goals: ReturnType<typeof createGoalsRepository>;

  beforeEach(async () => {
    database = new NutriCalDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
    goals = createGoalsRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('guarda varias versiones en lugar de sobrescribir', async () => {
    await goals.save(makeGoals({ effectiveFrom: aDate('2026-01-01'), energyKcal: 2000 }));
    await goals.save(makeGoals({ effectiveFrom: aDate('2026-06-01'), energyKcal: 2400 }));

    expect(await goals.allVersions()).toHaveLength(2);
  });

  it('devuelve la versión vigente en la fecha consultada, no la última', async () => {
    await goals.save(makeGoals({ effectiveFrom: aDate('2026-01-01'), energyKcal: 2000 }));
    await goals.save(makeGoals({ effectiveFrom: aDate('2026-06-01'), energyKcal: 2400 }));

    // Marzo se mira con los objetivos de enero, aunque en junio se cambiaran.
    // Este es el motivo entero de la decisión D-004.
    const inMarch = await goals.effectiveOn(aDate('2026-03-15'));
    expect(inMarch?.energy).toBe(2000);

    const inJuly = await goals.effectiveOn(aDate('2026-07-15'));
    expect(inJuly?.energy).toBe(2400);
  });

  it('devuelve la versión que entra en vigor ese mismo día', async () => {
    await goals.save(makeGoals({ effectiveFrom: aDate('2026-06-01'), energyKcal: 2400 }));

    const onTheDay = await goals.effectiveOn(aDate('2026-06-01'));
    expect(onTheDay?.energy).toBe(2400);
  });

  it('devuelve indefinido para una fecha anterior a cualquier versión', async () => {
    await goals.save(makeGoals({ effectiveFrom: aDate('2026-06-01') }));

    expect(await goals.effectiveOn(aDate('2025-12-31'))).toBeUndefined();
  });

  it('ignora las versiones borradas al calcular la vigente', async () => {
    await goals.save(makeGoals({ effectiveFrom: aDate('2026-01-01'), energyKcal: 2000 }));
    const mistake = makeGoals({ effectiveFrom: aDate('2026-06-01'), energyKcal: 2400 });
    await goals.save(mistake);
    await goals.remove(mistake.id);

    const inJuly = await goals.effectiveOn(aDate('2026-07-15'));
    expect(inJuly?.energy).toBe(2000);
  });

  it('ordena las versiones de la más reciente a la más antigua', async () => {
    await goals.save(makeGoals({ effectiveFrom: aDate('2026-01-01') }));
    await goals.save(makeGoals({ effectiveFrom: aDate('2026-06-01') }));
    await goals.save(makeGoals({ effectiveFrom: aDate('2026-03-01') }));

    const versions = await goals.allVersions();
    expect(versions.map((version) => version.effectiveFrom)).toEqual([
      '2026-06-01',
      '2026-03-01',
      '2026-01-01',
    ]);
  });
});

describe('repositorio de perfil', () => {
  let database: NutriCalDatabase;
  let profiles: ReturnType<typeof createProfileRepository>;

  beforeEach(async () => {
    database = new NutriCalDatabase(`test-${crypto.randomUUID()}`);
    await database.open();
    profiles = createProfileRepository(database);
  });

  afterEach(async () => {
    await database.delete();
  });

  it('no hay perfil hasta que se guarda uno', async () => {
    expect(await profiles.current()).toBeUndefined();
  });

  it('guarda y recupera el perfil con su zona horaria', async () => {
    await profiles.save(makeProfile({ timeZone: 'Europe/Madrid' }));

    const current = await profiles.current();
    expect(current?.timeZone).toBe('Europe/Madrid');
    expect(current?.display.energyUnit).toBe('kcal');
  });

  it('guardar dos veces el mismo perfil lo reemplaza', async () => {
    const profile = makeProfile();
    await profiles.save(profile);
    await profiles.save({ ...profile, locale: 'ca-ES' });

    const current = await profiles.current();
    expect(current?.locale).toBe('ca-ES');
  });
});
