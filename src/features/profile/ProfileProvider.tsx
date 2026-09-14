import type { ReactNode } from 'react';

import { useProfileQuery } from '@/features/profile/queries';
import { ProfileContext } from '@/features/profile/profile-context';

/**
 * El perfil, disponible en cualquier pantalla y de forma síncrona.
 *
 * Los hooks de lectura (`useProfile`, `useTimeZone`) viven en
 * `profile-context.ts` y no aquí: este archivo exporta un componente, y el
 * linter exige que un archivo así no exporte también funciones sueltas.
 *
 * ## Por qué hace falta un proveedor y no basta un hook
 *
 * Hasta D-043, la zona horaria se le preguntaba al navegador con una llamada
 * **síncrona** en medio del renderizado: `today(currentTimeZone())`. Leer el
 * perfil es **asíncrono**, porque sale de IndexedDB. Cambiar lo uno por lo otro
 * no era la línea que anunciaba el comentario de `time-zone.ts`.
 *
 * La salida es leerlo una sola vez al arrancar y no pintar el árbol hasta
 * tenerlo. A cambio de unos milisegundos de espera —es disco local, no red—,
 * todo lo que hay debajo puede seguir preguntando la zona horaria de forma
 * síncrona y sin ramas de "todavía no lo sé" repartidas por la interfaz.
 *
 * La alternativa era un `useQuery` con el valor del navegador como dato inicial,
 * que no espera nada. Se descartó por el caso que importa: si tu perfil dice
 * Madrid y abres la aplicación desde Nueva York, esa versión pintaría primero el
 * día equivocado y saltaría al correcto: `TodayRedirect` ya te habría llevado al
 * día de ayer o de mañana.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { data: profile, isPending, isError, error } = useProfileQuery();

  if (isPending) {
    return <Booting>Abriendo tu diario…</Booting>;
  }

  if (isError) {
    return (
      <Booting>
        No hemos podido abrir el almacenamiento de este dispositivo, así que la aplicación no puede
        arrancar. Si estás en una ventana privada, puede que esté bloqueado.
        {error instanceof Error ? <ErrorDetail message={error.message} /> : null}
      </Booting>
    );
  }

  return <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>;
}

function Booting({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-50 p-6">
      <p aria-live="polite" className="max-w-md text-center text-slate-600">
        {children}
      </p>
    </div>
  );
}

function ErrorDetail({ message }: { message: string }) {
  return <span className="mt-2 block text-xs text-slate-400">{message}</span>;
}
