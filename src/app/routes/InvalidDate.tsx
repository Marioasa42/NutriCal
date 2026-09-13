import { Link } from 'react-router';

/**
 * Una fecha que no existe no se corrige en silencio.
 *
 * Redirigir a hoy sería más cómodo de escribir y peor de usar: si has llegado
 * aquí desde un marcador mal copiado, ver el día de hoy sin más te hace creer
 * que el marcador funcionaba. Se dice qué ha pasado y se ofrece la salida.
 *
 * Lo usan el diario y la búsqueda, porque las dos rutas llevan el día en la URL
 * y las dos pueden recibir cualquier cosa en su sitio.
 */
export function InvalidDate({ raw }: { raw: string }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Esa fecha no existe</h1>
      <p className="text-slate-600">
        <code className="rounded bg-slate-200 px-1.5 py-0.5 text-sm">{raw}</code> no es un día del
        calendario. Las fechas del diario se escriben como año-mes-día, por ejemplo 2026-09-13.
      </p>
      <Link to="/" className="font-medium text-emerald-700 underline underline-offset-4">
        Ir al día de hoy
      </Link>
    </div>
  );
}
