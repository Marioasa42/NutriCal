import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { profileRepository } from '@/data/repositories/settings';
import { newProfileId } from '@/domain/identity/ids';
import { createProfile, type Profile } from '@/domain/profile/profile';
import { now } from '@/domain/time/local-date';
import { browserLocale, browserTimeZone } from '@/shared/lib/time-zone';

/** Las claves del perfil. Empiezan por `db` como todo lo que sale de Dexie. */
export const profileKeys = {
  current: ['db', 'profile'] as const,
};

const LOCAL = { networkMode: 'always' } as const;

/**
 * Devuelve el perfil, creándolo la primera vez.
 *
 * Que crear y leer sean la misma operación es deliberado: si fueran dos, habría
 * un instante en que la aplicación tiene que decidir qué hacer sin perfil, y ese
 * caso acabaría teniendo su propia rama en cada pantalla. Aquí no existe: o hay
 * perfil o hay un error, nunca "todavía no".
 */
export async function ensureProfile(): Promise<Profile> {
  const existing = await profileRepository.current();
  if (existing !== undefined) {
    return existing;
  }

  const fresh = createProfile({
    id: newProfileId(),
    timeZone: browserTimeZone(),
    locale: browserLocale(),
    at: now(),
  });
  await profileRepository.save(fresh);
  return fresh;
}

/**
 * El perfil, leído una sola vez al arrancar.
 *
 * `staleTime: Infinity` porque esto no caduca solo: cambia únicamente cuando
 * alguien lo edita, y entonces la mutación invalida la clave. Sin esto, cada
 * pantalla que se montara volvería a leer de Dexie para obtener exactamente lo
 * mismo.
 */
export function useProfileQuery() {
  return useQuery({
    queryKey: profileKeys.current,
    queryFn: ensureProfile,
    staleTime: Infinity,
    ...LOCAL,
  });
}

/**
 * Guardar cambios del perfil.
 *
 * Invalida en lugar de escribir en la caché a mano, igual que el resto de
 * mutaciones del proyecto: lo que queda en pantalla es lo que hay en disco.
 * Aquí importa más que en otros sitios, porque de este objeto cuelga qué día es
 * "hoy" en toda la aplicación.
 */
export function useSaveProfile() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (profile: Profile) => profileRepository.save(profile),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: profileKeys.current });
    },
    ...LOCAL,
  });
}
