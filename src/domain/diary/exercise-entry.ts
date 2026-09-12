import type { ExerciseEntryId } from '@/domain/identity/ids';
import type { Persisted } from '@/domain/persistence/persisted';
import type { LocalDate } from '@/domain/time/local-date';
import type { Kilocalories, Minutes } from '@/domain/units/units';

/**
 * De dónde sale el gasto energético, como unión discriminada.
 *
 * En la fase 1 solo existe la rama manual. La rama por MET, que es el múltiplo
 * del metabolismo basal de cada actividad, llega en la fase 5. Dejar el tipo
 * preparado no es adelantar trabajo: es evitar una migración de datos cuando
 * los registros manuales ya existan.
 */
export type EnergySource =
  { readonly kind: 'manual' } | { readonly kind: 'met'; readonly met: number };

export interface ExerciseEntry extends Persisted {
  readonly id: ExerciseEntryId;
  readonly date: LocalDate;
  readonly activityLabel: string;
  readonly durationMinutes: Minutes;
  readonly energy: Kilocalories;
  readonly energySource: EnergySource;
  readonly note?: string;
}
