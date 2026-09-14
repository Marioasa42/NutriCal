import type { FoodDraft } from '@/domain/food/draft';
import type { Food } from '@/domain/food/food';
import type { FoodId } from '@/domain/identity/ids';
import type { LocalDate } from '@/domain/time/local-date';
import { DraftCard, FoodCard } from '@/features/food-search/FoodResultCard';
import { CompleteDraftLink, FoodAction } from '@/features/food-search/ResultActions';
import type { FoodSearchPage } from '@/services/off';
import type { UsdaSearchPage } from '@/services/usda';

/** Los micronutrientes de USDA solo llegan al completar (D-048): se avisa en la propia tarjeta. */
const USDA_MICROS_NOTE = 'Los micronutrientes se completan al añadir esta comida al diario.';

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
            <ResultCard key={food.id} date={date} food={food} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Un alimento de USDA sin micronutrientes todavía es el caso normal, no un
 * fallo: solo la ficha detallada los trae (D-048). Se avisa en la propia
 * tarjeta, coherente con D-029: un borrador incompleto explica qué le falta
 * en el propio resultado, en vez de dejar que parezca un fallo de la
 * aplicación. Una vez completado (al añadirlo una primera vez), el alimento
 * guardado ya trae micronutrientes y el aviso deja de mostrarse solo.
 */
function usdaMicrosNote(food: Food): string | undefined {
  return food.source.kind === 'usda' && Object.keys(food.per100.micros).length === 0
    ? USDA_MICROS_NOTE
    : undefined;
}

/**
 * Una tarjeta de resultado con su acción y su aviso, si le toca uno.
 *
 * Las tres listas de esta pantalla (el catálogo, los resultados de OFF y los
 * de USDA) pueden mezclar alimentos de cualquier fuente y necesitan
 * exactamente esto mismo, así que vive en un solo sitio en vez de en tres.
 */
function ResultCard({ date, food }: { date: LocalDate; food: Food }) {
  const note = usdaMicrosNote(food);
  return (
    <FoodCard
      food={food}
      action={<FoodAction date={date} food={food} />}
      {...(note !== undefined ? { note } : {})}
    />
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
          <ResultCard key={food.id} date={date} food={food} />
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

/**
 * La lista de resultados de USDA FoodData Central.
 *
 * Calcada de `SearchResults`, con una diferencia real: `UsdaSearchPage` no
 * trae un "total" de resultados (la API de búsqueda de FDC no lo da con el
 * mismo significado que el `count` de OFF), así que no hay una cifra de "X de
 * Y" que mostrar, solo cuántos se enseñan.
 */
export function UsdaSearchResults({
  page,
  date,
  knownIds,
}: {
  page: UsdaSearchPage;
  date: LocalDate;
  knownIds?: ReadonlySet<FoodId>;
}) {
  const fresh = knownIds === undefined ? page.foods : page.foods.filter((f) => !knownIds.has(f.id));
  const alreadyKnown = page.foods.length - fresh.length;

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-3">
        {fresh.map((food) => (
          <ResultCard key={food.id} date={date} food={food} />
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
