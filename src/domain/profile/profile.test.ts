import { describe, expect, it } from 'vitest';

import { createProfile } from '@/domain/profile/profile';
import { newProfileId } from '@/domain/identity/ids';
import { instant } from '@/domain/time/local-date';

/**
 * `createProfile` es el "aquí" del que D-043 dice que hace falta para leer la
 * zona horaria: existe solo para que haya un perfil desde el primer arranque,
 * sin pedirle nada a quien usa la aplicación.
 */
describe('createProfile', () => {
  const at = instant('2026-09-14T10:00:00.000Z');

  it('usa exactamente lo que se le pasa, sin inventar nada', () => {
    const profile = createProfile({
      id: newProfileId(),
      timeZone: 'Europe/Madrid',
      locale: 'es-ES',
      at,
    });

    expect(profile.timeZone).toBe('Europe/Madrid');
    expect(profile.locale).toBe('es-ES');
    expect(profile.createdAt).toBe(at);
    expect(profile.updatedAt).toBe(at);
  });

  it('no trae datos corporales: son sensibles y no se piden hasta que hagan falta', () => {
    const profile = createProfile({ id: newProfileId(), timeZone: 'UTC', locale: 'es-ES', at });
    expect(profile.body).toBeUndefined();
  });

  it('no trae aceptación del aviso médico: eso lo decide una pantalla, no la creación', () => {
    const profile = createProfile({ id: newProfileId(), timeZone: 'UTC', locale: 'es-ES', at });
    expect(profile.disclaimerAcceptedAt).toBeUndefined();
  });

  it('trae preferencias de presentación razonables por defecto', () => {
    const profile = createProfile({ id: newProfileId(), timeZone: 'UTC', locale: 'es-ES', at });
    expect(profile.display).toEqual({
      massUnit: 'metric',
      energyUnit: 'kcal',
      firstDayOfWeek: 'monday',
    });
  });
});
