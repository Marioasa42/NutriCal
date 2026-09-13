import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-start gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Aquí no hay nada</h1>
      <p className="text-slate-600">Esta dirección no corresponde a ninguna pantalla.</p>
      <Link to="/" className="font-medium text-emerald-700 underline underline-offset-4">
        Ir al día de hoy
      </Link>
    </div>
  );
}
