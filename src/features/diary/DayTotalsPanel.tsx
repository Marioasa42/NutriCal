import type { DayTotals } from '@/domain/diary/day';
import { OPTIONAL_MACRO_KEYS } from '@/domain/nutrition/macros';
import { MACRO_LABELS, formatEnergy, formatGrams } from '@/shared/lib/nutrient-format';
import { NutrientValue } from '@/shared/ui/NutrientValue';

/**
 * Los totales del día.
 *
 * Aquí es donde D-026 se cobra: los cuatro macronutrientes obligatorios existen
 * en todos los registros, porque `Macros` es estricto y nada llega a ser un
 * alimento sin ellos, así que se enseñan a secas. Los opcionales no: si tres de
 * tus cinco comidas no traían fibra, el total de fibra es un mínimo conocido y
 * no un total, y enseñarlo igual que uno completo sería mentir por omisión.
 *
 * El recuento se le pasa a `NutrientValue` y es él quien decide cómo marcarlo.
 * Esta pantalla no puede olvidarse de la marca porque no es cosa suya.
 */
export function DayTotalsPanel({ totals, entryCount }: { totals: DayTotals; entryCount: number }) {
  const { macros, unknown } = totals;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-2 text-sm font-medium text-slate-700">Total del día</h2>
      <dl>
        <NutrientValue label={MACRO_LABELS.energy} value={formatEnergy(macros.energy)} />
        <NutrientValue label={MACRO_LABELS.protein} value={formatGrams(macros.protein)} />
        <NutrientValue
          label={MACRO_LABELS.carbohydrates}
          value={formatGrams(macros.carbohydrates)}
        />
        <NutrientValue label={MACRO_LABELS.fat} value={formatGrams(macros.fat)} />

        {OPTIONAL_MACRO_KEYS.map((key) => {
          const value = macros[key];
          const missing = unknown[key] ?? 0;

          // Que la clave no esté significa que ningún registro aportaba el dato.
          // Se dice, en lugar de callar la fila: una fila que desaparece parece
          // un cero, y un cero es una medida que aquí no tenemos.
          if (value === undefined) {
            return (
              <NutrientValue
                key={key}
                label={MACRO_LABELS[key]}
                value="sin datos"
                unknown={{ missing, total: entryCount }}
              />
            );
          }

          return (
            <NutrientValue
              key={key}
              label={MACRO_LABELS[key]}
              value={formatGrams(value)}
              unknown={{ missing, total: entryCount }}
            />
          );
        })}
      </dl>
    </section>
  );
}
