import { Link, Outlet } from 'react-router';

import { MedicalDisclaimer } from '@/shared/ui/MedicalDisclaimer';

/**
 * El marco común de todas las pantallas: cabecera, aviso legal y hueco.
 *
 * `<Outlet />` es donde React Router mete la ruta hija que toque. Tenerlo en un
 * diseño compartido, en vez de repetir la cabecera en cada pantalla, es lo que
 * hace que el aviso médico no se pueda olvidar en una pantalla nueva: es
 * requisito del proyecto que esté visible, y aquí lo está por construcción.
 */
export function RootLayout() {
  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link to="/" className="text-xl font-semibold tracking-tight">
            NutriCal
          </Link>
          <Link
            to="/ajustes"
            className="text-sm font-medium text-slate-600 underline underline-offset-4 hover:text-slate-900"
          >
            Ajustes
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-8">
        <Outlet />
      </main>

      <footer className="mx-auto w-full max-w-2xl px-4 pb-8">
        <MedicalDisclaimer />
      </footer>
    </div>
  );
}
