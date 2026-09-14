import type { FoodDraft } from '@/domain/food/draft';
import type { Food } from '@/domain/food/food';
import type { FoodId } from '@/domain/identity/ids';
import type { LocalDate } from '@/domain/time/local-date';
import { DraftCard, FoodCard } from '@/features/food-search/FoodResultCard';
import { AddToDiaryLink, CompleteDraftLink } from '@/features/food-search/ResultActions';
import type { FoodSearchPage } from '@/services/off';

/**
 * Lo que ya tienes en el catálogo, mientras tecleas (D-041).
 *
 * Sale antes que los resultados de la fuente, y no por cortesía: lo que ya has
 * usado alguna vez es lo que más probablemente vuelvas a registrar, y además es
 * lo único que se puede enseñar sin conexión.
 */
export function CatalogResults({
  foods,
  searched,
  date,
}: {
  foods: readonly Food[];
  searched: boolean;
  date: LocalDate;
}) {
  if (!searched) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
        En tu catálogo
      </h2>

      {foods.length === 0 ? (
        // Se dice, en lugar de no pintar nada: una sección que desaparece deja
        // sin respuesta a quien está mirando si lo tiene ya guardado.
        <p className="text-sm text-slate-500">
          Todavía no tienes nada con ese nombre. Búscalo en Open Food Facts y pasará a estar aquí.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {foods.map((food) => (
            <FoodCard
              key={food.id}
              food={food}
              action={<AddToDiaryLink date={date} food={food} />}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * La lista de resultados de la fuente.
 *
 * Los completos van primero y los incompletos después, en la misma lista. No es
 * un orden por calidad de los datos por gusto: quien busca quiere registrar algo,
 * y lo que puede registrar sin trabajo extra debe estar arriba.
 *
 * `knownIds` son los que ya se están enseñando arriba, en el catálogo. Se
 * descuentan en vez de repetirse: `adopt` devuelve el alimento guardado cuando
 * el código de barras ya se conocía (D-034), así que el mismo producto llega con
 * el mismo identificador por las dos vías, y verlo dos veces en la misma
 * pantalla parece un fallo de la aplicación.
 */
export function SearchResults({
  page,
  date,
  knownIds,
}: {
  page: FoodSearchPage;
  date: LocalDate;
  knownIds?: ReadonlySet<FoodId>;
}) {
  const fresh = knownIds === undefined ? page.foods : page.foods.filter((f) => !knownIds.has(f.id));
  const alreadyKnown = page.foods.length - fresh.length;
  const shown = fresh.length + page.drafts.length;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-slate-500">
        {shown} de {page.total} resultados
      </p>

      <ul className="flex flex-col gap-3">
        {fresh.map((food) => (
          <FoodCard key={food.id} food={food} action={<AddToDiaryLink date={date} food={food} />} />
        ))}
        {page.drafts.map((draft) => (
          <DraftCard
            key={draftKey(draft)}
            draft={draft}
            action={<CompleteDraftLink date={date} draft={draft} />}
          />
        ))}
      </ul>

      {alreadyKnown > 0 ? <AlreadyKnownNote count={alreadyKnown} /> : null}
      {page.unreadable > 0 ? <UnreadableNote count={page.unreadable} /> : null}
    </div>
  );
}

/** Lo que la fuente devolvió y ya se está enseñando arriba, en el catálogo. */
function AlreadyKnownNote({ count }: { count: number }) {
  return (
    <p className="text-sm text-slate-500">
      {count === 1
        ? 'Un resultado más ya estaba en tu catálogo y se enseña arriba.'
        : `${count} resultados más ya estaban en tu catálogo y se enseñan arriba.`}
    </p>
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
