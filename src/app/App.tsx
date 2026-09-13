import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router';

import { createQueryClient } from '@/app/query-client';
import { router } from '@/app/router';

/**
 * La raíz de la aplicación: los dos proveedores y nada más.
 *
 * El cliente de consultas se crea fuera del componente, a propósito. Si se
 * creara dentro, cada renderizado de `App` fabricaría uno nuevo y tiraría la
 * caché entera; con React 19 y `StrictMode`, que monta dos veces en desarrollo,
 * el fallo aparecería enseguida y sería difícil de leer.
 */
const queryClient = createQueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}
