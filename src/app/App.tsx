import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';

import { createQueryClient } from '@/app/query-client';
import { router } from '@/app/router';
import { ProfileProvider } from '@/features/profile/ProfileProvider';

/**
 * La raíz de la aplicación: los proveedores y nada más.
 *
 * El cliente de consultas se crea fuera del componente, a propósito. Si se
 * creara dentro, cada renderizado de `App` fabricaría uno nuevo y tiraría la
 * caché entera; con React 19 y `StrictMode`, que monta dos veces en desarrollo,
 * el fallo aparecería enseguida y sería difícil de leer.
 *
 * `ProfileProvider` va dentro de `QueryClientProvider`, porque lee el perfil con
 * `useQuery`, y fuera de `RouterProvider`, porque las rutas (`TodayRedirect`,
 * `DayPage`) necesitan `useTimeZone()` disponible antes de decidir nada (D-043).
 */
const queryClient = createQueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ProfileProvider>
        <RouterProvider router={router} />
      </ProfileProvider>
    </QueryClientProvider>
  );
}
