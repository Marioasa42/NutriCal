import { createBrowserRouter } from 'react-router';

import { DayPage } from '@/app/routes/DayPage';
import { NotFoundPage } from '@/app/routes/NotFoundPage';
import { RootLayout } from '@/app/routes/RootLayout';
import { TodayRedirect } from '@/app/routes/TodayRedirect';
import { SearchPage } from '@/features/food-search/SearchPage';

/**
 * El mapa de rutas, en un archivo aparte del que monta la aplicación.
 *
 * Separarlo no es manía de ordenar: la fase 3 tiene que decidir qué direcciones
 * se guardan en caché para funcionar sin conexión, y esa decisión se toma
 * leyendo esta lista. Si las rutas estuvieran repartidas entre componentes,
 * habría que reconstruirla a mano y se olvidaría alguna.
 *
 * `Component` en lugar de `element`: se pasa el componente, no un elemento ya
 * creado, y así React Router decide cuándo instanciarlo. Es también la forma que
 * admite carga diferida sin reescribir la ruta, si algún día hace falta.
 */
export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      { index: true, Component: TodayRedirect },
      { path: 'dia/:date', Component: DayPage },
      { path: 'dia/:date/buscar', Component: SearchPage },
      { path: '*', Component: NotFoundPage },
    ],
  },
]);
