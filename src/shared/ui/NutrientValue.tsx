/**
 * La única forma de enseñar la cifra de un nutriente.
 *
 * Existe porque D-026 lo exige por escrito: siempre que se muestre un nutriente
 * cuyo `unknown` sea mayor que cero, junto a la cifra tiene que verse sobre
 * cuántos registros se calculó, y esa regla no se puede cumplir a base de
 * acordarse en cada pantalla. Quien pinta la cifra recibe el recuento y decide;
 * quien llama no puede olvidarse de ponerlo porque no es cosa suya.
 *
 * Lleva dos marcas distintas y conviene no confundirlas:
 *
 * - `unknown` dice que el total se calculó sobre parte de los registros, porque
 *   los demás no aportaban ese nutriente. La cifra es un mínimo conocido, no un
 *   total (D-024, D-026).
 * - `estimated` dice que esa cifra la tecleó la persona usuaria porque la fuente
 *   no la aportaba (D-002). La cifra es completa, pero no viene de la fuente.
 *
 * Una puede darse sin la otra, y las dos a la vez también.
 */

export interface UnknownCount {
  /** Cuántos registros no aportaban este nutriente. */
  readonly missing: number;
  /** Cuántos registros se sumaron en total. */
  readonly total: number;
}

export interface NutrientValueProps {
  readonly label: string;
  /** Ya formateada: el redondeo ocurre en `nutrient-format` y solo ahí (D-023). */
  readonly value: string;
  readonly estimated?: boolean;
  readonly unknown?: UnknownCount;
}

/**
 * La forma de la marca de `unknown` la deja abierta D-026 a propósito: fija que
 * tiene que estar, no cómo se ve. Aquí se elige la más literal de las que esa
 * decisión mencionaba, "sobre N de M registros", porque se entiende sin
 * aprender nada y no depende de que nadie pase el ratón por encima ni despliegue
 * un detalle. Queda anotada como D-035, pendiente de revisión.
 *
 * Exportada porque el panel de micronutrientes de la fase 2 (D-050) la
 * reutiliza tal cual para sus barras: es la misma regla, "no se puede enseñar
 * un nutriente sin su recuento", así que tenía que ser el mismo componente y
 * no una segunda copia que pudiera divergir de esta.
 */
export function UnknownNote({ missing, total }: UnknownCount) {
  const counted = total - missing;
  return (
    <span className="text-xs font-normal text-amber-800">
      sobre {counted} de {total} {total === 1 ? 'registro' : 'registros'}
    </span>
  );
}

/** Lo rellenó una persona, no la fuente. `title` para quien se pare a mirar. */
function EstimatedBadge() {
  return (
    <span
      title="Esta cifra la rellenaste a mano porque la fuente no la aportaba."
      className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
    >
      estimación
    </span>
  );
}

export function NutrientValue({ label, value, estimated = false, unknown }: NutrientValueProps) {
  // Un recuento de cero no se enseña: significa que todos los registros
  // aportaban el dato, así que la cifra es un total completo y añadir "sobre 5
  // de 5" sería ruido que enseña a ignorar la marca cuando sí importa.
  const incomplete = unknown !== undefined && unknown.missing > 0;

  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="flex items-baseline gap-2 text-right">
        {incomplete ? <UnknownNote {...unknown} /> : null}
        {estimated ? <EstimatedBadge /> : null}
        <span className={`font-medium ${incomplete ? 'text-amber-900' : 'text-slate-900'}`}>
          {value}
        </span>
      </dd>
    </div>
  );
}
