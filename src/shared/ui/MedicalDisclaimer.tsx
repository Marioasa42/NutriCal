/**
 * Aviso obligatorio: la aplicación no da consejo médico. Vive en `shared/ui`
 * porque se muestra en varias pantallas, no solo en el inicio.
 */
export function MedicalDisclaimer() {
  return (
    <aside
      role="note"
      className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
    >
      <p className="font-medium">Esto no es consejo médico</p>
      <p className="mt-1">
        NutriCal es una herramienta de registro personal. No sustituye la valoración de un
        profesional sanitario. Si tienes dudas sobre tu alimentación o tu salud, consulta a tu
        médico o a un dietista-nutricionista.
      </p>
    </aside>
  );
}
