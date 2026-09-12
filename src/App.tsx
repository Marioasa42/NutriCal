import { MedicalDisclaimer } from '@/shared/ui/MedicalDisclaimer';

/**
 * Esqueleto de la aplicación. La fase 0 solo necesita algo que compile, se
 * despliegue y muestre el aviso legal. Las pantallas reales llegan en la fase 1.
 */
export default function App() {
  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">NutriCal</h1>
          <p className="text-slate-600">
            Seguimiento de comidas, ejercicio y micronutrientes. Funciona sin conexión y sin cuenta.
          </p>
        </header>
        <MedicalDisclaimer />
      </main>
    </div>
  );
}
