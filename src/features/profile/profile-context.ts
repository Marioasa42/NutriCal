import { createContext, use } from 'react';

import type { Profile } from '@/domain/profile/profile';

/**
 * El contexto y sus hooks de lectura, separados de `ProfileProvider.tsx`.
 *
 * No es un capricho de organización: el linter exige que un archivo que exporta
 * un componente (por Fast Refresh) no exporte también funciones sueltas. Aquí
 * viven `useProfile` y `useTimeZone`, que no son componentes.
 */
export const ProfileContext = createContext<Profile | undefined>(undefined);

/**
 * El perfil actual. Nunca es `undefined` para quien está debajo del proveedor.
 *
 * `use` es la forma de React 19 de leer un contexto; hace lo mismo que
 * `useContext` y además se puede llamar dentro de una condición. Si el contexto
 * viene vacío es que alguien ha montado un componente fuera del proveedor, y eso
 * sí es un fallo de programación: se lanza, en lugar de devolver un perfil
 * inventado que escondería el error hasta que alguien se preguntara por qué su
 * diario cambia de día solo.
 */
export function useProfile(): Profile {
  const profile = use(ProfileContext);
  if (profile === undefined) {
    throw new Error('useProfile: hay que estar dentro de <ProfileProvider>.');
  }
  return profile;
}

/**
 * La zona horaria de la persona usuaria. **El único sitio del que se lee.**
 *
 * Define qué es un día en todo el proyecto (decisión 3 de CLAUDE.md), así que
 * ninguna pantalla debe preguntarle al navegador por su cuenta.
 */
export function useTimeZone(): string {
  return useProfile().timeZone;
}
