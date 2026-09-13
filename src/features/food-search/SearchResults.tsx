import type { FoodDraft } from '@/domain/food/draft';
import { DraftCard, FoodCard } from '@/features/food-search/FoodResultCard';
import type { FoodSearchPage } from '@/services/off';

/**
 * La lista de resultados.
 *
 * Los completos van primero y los incompletos después, en la misma lista. No es
 * un orden por calidad de los datos por gusto: quien busca quiere registrar algo,
 * y lo que puede registrar sin trabajo extra debe estar arriba.
 */
export function SearchResults({ page }: { page: FoodSearchPage }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-500">
        {page.foods.length + page.drafts.length} de {page.total} resultados
      </p>

      <ul className="flex flex-col gap-3">
        {page.foods.map((food) => (
          <FoodCard key={food.id} food={food} />
        ))}
        {page.drafts.map((draft) => (
          <DraftCard key={draftKey(draft)} draft={draft} />
        ))}
      </ul>

      {page.unreadable > 0 ? <UnreadableNote count={page.unreadable} /> : null}
    </div>
  );
}

/**
 * Un borrador no tiene identificador propio: todavía no es un `Food` y no se ha
 * guardado nada. El código de barras sirve de clave cuando lo hay, que es casi
 * siempre en resultados de Open Food Facts, y el nombre cubre el resto.
 */
function draftKey(draft: FoodDraft): string {
  // `switch` sobre el campo discriminante: dentro de cada rama TypeScript ya
  // sabe qué campos existen, y la regla `switch-exhaustiveness-check` del linter
  // obliga a añadir una rama aquí si algún día `FoodSource` gana un origen nuevo.
  switch (draft.source.kind) {
    case 'openFoodFacts':
      return draft.source.barcode;
    case 'usda':
      return `usda:${draft.source.fdcId}`;
    case 'custom':
      return `custom:${draft.name}`;
  }
}

/**
 * Filas que la fuente devolvió tan rotas que ni se pudieron leer (D-019).
 *
 * Se dice, en lugar de callarlo, porque si no el recuento de arriba no cuadra
 * con lo que se ve y parece que la aplicación ha perdido resultados.
 */
function UnreadableNote({ count }: { count: number }) {
  return (
    <p className="text-sm text-slate-500">
      {count === 1
        ? 'Un resultado más venía con datos ilegibles y se ha descartado.'
        : `${count} resultados más venían con datos ilegibles y se han descartado.`}
    </p>
  );
}
