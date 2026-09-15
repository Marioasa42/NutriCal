import { z } from 'zod';

import type { FoodSource } from '@/domain/food/food';
import type {
  ExerciseEntryId,
  FoodId,
  GoalsId,
  MealEntryId,
  ProfileId,
  ServingId,
} from '@/domain/identity/ids';
import { OPTIONAL_MACRO_KEYS, REQUIRED_MACRO_KEYS } from '@/domain/nutrition/macros';
import { MICRONUTRIENT_IDS, unitOf } from '@/domain/nutrition/micronutrients';
import { instant, localDate } from '@/domain/time/local-date';
import {
  EXPORT_SCHEMA_VERSION,
  type ExportEnvelope,
  type ExportPayload,
} from '@/domain/transfer/export';
import {
  grams,
  kilocalories,
  micrograms,
  milligrams,
  milliliters,
  minutes,
} from '@/domain/units/units';
import { invariant } from '@/shared/lib/invariant';

/**
 * Validar y reconstruir un archivo de exportación.
 *
 * Es la frontera más peligrosa del proyecto para D-025: un archivo importado
 * es entrada externa (pudo tocarse a mano, venir de una versión antigua de la
 * aplicación, o estar corrupto) y aun así tiene que acabar convertido en las
 * mismas magnitudes con marca -`Grams`, `Kilocalories`...- que usa el resto
 * del dominio. La regla de este archivo es que NINGÚN número ni cadena se
 * afirma con `as` directamente: cada campo con marca pasa por su constructor
 * real (`grams`, `kilocalories`, `localDate`, `instant`, de `units.ts` y
 * `local-date.ts`), y ese constructor es quien decide si el valor vale.
 *
 * `fromConstructor` envuelve esa llamada dentro de un `.transform()` de Zod:
 * si el constructor lanza (número negativo, fecha imposible...), el fallo se
 * convierte en un error de validación de Zod en vez de en una excepción
 * suelta, y el resto del archivo se sigue comprobando en la misma pasada.
 */
function fromConstructor<In, Out>(build: (value: In) => Out) {
  return (value: In, ctx: z.RefinementCtx): Out | typeof z.NEVER => {
    try {
      return build(value);
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: error instanceof Error ? error.message : String(error),
      });
      return z.NEVER;
    }
  };
}

const gramsSchema = z.number().transform(fromConstructor(grams));
const kilocaloriesSchema = z.number().transform(fromConstructor(kilocalories));
const milligramsSchema = z.number().transform(fromConstructor(milligrams));
const microgramsSchema = z.number().transform(fromConstructor(micrograms));
const millilitersSchema = z.number().transform(fromConstructor(milliliters));
const minutesSchema = z.number().transform(fromConstructor(minutes));
const localDateSchema = z.string().transform(fromConstructor(localDate));
const instantSchema = z.string().transform(fromConstructor(instant));

/**
 * Los identificadores no tienen un constructor que valide y marque una cadena
 * ya existente: `newFoodId()` y compañía (`identity/ids.ts`) SOLO generan uno
 * nuevo con `crypto.randomUUID()`, porque en el resto de la aplicación un
 * identificador siempre nace aquí, nunca llega de fuera. La importación es la
 * primera vez que hace falta lo contrario -conservar el identificador tal
 * cual, para que la fusión por id (D-052) compare la fila correcta-, así que
 * estas seis funciones son la excepción, confinada a este archivo y
 * documentada, con el mismo patrón que `stored.ts` ya usa para `fromStored`:
 * una comprobación explícita antes de cada `as`, nunca un `as` a pelo.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, typeName: string): void {
  invariant(UUID_PATTERN.test(value), `${typeName}: se esperaba un UUID, se recibió "${value}"`);
}

const asFoodId = (value: string): FoodId => {
  assertUuid(value, 'FoodId');
  return value as FoodId;
};
const asServingId = (value: string): ServingId => {
  assertUuid(value, 'ServingId');
  return value as ServingId;
};
const asMealEntryId = (value: string): MealEntryId => {
  assertUuid(value, 'MealEntryId');
  return value as MealEntryId;
};
const asExerciseEntryId = (value: string): ExerciseEntryId => {
  assertUuid(value, 'ExerciseEntryId');
  return value as ExerciseEntryId;
};
const asGoalsId = (value: string): GoalsId => {
  assertUuid(value, 'GoalsId');
  return value as GoalsId;
};
const asProfileId = (value: string): ProfileId => {
  assertUuid(value, 'ProfileId');
  return value as ProfileId;
};

const foodIdSchema = z.string().transform(fromConstructor(asFoodId));
const servingIdSchema = z.string().transform(fromConstructor(asServingId));
const mealEntryIdSchema = z.string().transform(fromConstructor(asMealEntryId));
const exerciseEntryIdSchema = z.string().transform(fromConstructor(asExerciseEntryId));
const goalsIdSchema = z.string().transform(fromConstructor(asGoalsId));
const profileIdSchema = z.string().transform(fromConstructor(asProfileId));

const macroKeySchema = z.enum([...REQUIRED_MACRO_KEYS, ...OPTIONAL_MACRO_KEYS]);

const macrosSchema = z.object({
  energy: kilocaloriesSchema,
  protein: gramsSchema,
  carbohydrates: gramsSchema,
  fat: gramsSchema,
  sugars: gramsSchema.optional(),
  saturatedFat: gramsSchema.optional(),
  fiber: gramsSchema.optional(),
  salt: gramsSchema.optional(),
});

/**
 * `as z.ZodType<Micronutrients>` aquí no es lo mismo que un `as` sobre un
 * valor: es una anotación sobre el ESQUEMA, construido a partir del mismo
 * catálogo (`MICRONUTRIENTS`) que define el tipo, para no escribir 22 campos
 * a mano y que se puedan desincronizar. El valor que de verdad atraviesa esta
 * frontera pasa por `milligramsSchema`/`microgramsSchema`, que sí son
 * constructores de verdad.
 */
const micronutrientsSchema = z.object(
  Object.fromEntries(
    MICRONUTRIENT_IDS.map((id) => [
      id,
      (unitOf(id) === 'mg' ? milligramsSchema : microgramsSchema).optional(),
    ]),
  ),
);

const nutrientCompletionSchema = z.object({
  userFilled: z.array(macroKeySchema),
  completedAt: instantSchema.optional(),
});

const foodSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('openFoodFacts'), barcode: z.string(), fetchedAt: instantSchema }),
  z.object({
    kind: z.literal('usda'),
    fdcId: z.number().int().positive(),
    fetchedAt: instantSchema,
  }),
  z.object({ kind: z.literal('custom') }),
]) satisfies z.ZodType<FoodSource>;

const massServingSchema = z.object({
  id: servingIdSchema,
  label: z.string(),
  amountInBaseUnit: gramsSchema,
});
const volumeServingSchema = z.object({
  id: servingIdSchema,
  label: z.string(),
  amountInBaseUnit: millilitersSchema,
});

const nutrientProfileSchema = z.object({ macros: macrosSchema, micros: micronutrientsSchema });

const foodBaseFields = {
  id: foodIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  deletedAt: instantSchema.optional(),
  name: z.string(),
  brand: z.string().optional(),
  source: foodSourceSchema,
  per100: nutrientProfileSchema,
  completion: nutrientCompletionSchema,
};

const massFoodSchema = z.object({
  ...foodBaseFields,
  baseUnit: z.literal('g'),
  servings: z.array(massServingSchema),
});
const volumeFoodSchema = z.object({
  ...foodBaseFields,
  baseUnit: z.literal('ml'),
  servings: z.array(volumeServingSchema),
});

/** `Food` es `MassFood | VolumeFood` (D-005): el discriminante es `baseUnit`. */
const foodSchema = z.discriminatedUnion('baseUnit', [massFoodSchema, volumeFoodSchema]);

const foodSnapshotBaseFields = {
  foodId: foodIdSchema,
  name: z.string(),
  brand: z.string().optional(),
  source: foodSourceSchema,
  per100: nutrientProfileSchema,
  completion: nutrientCompletionSchema,
  capturedAt: instantSchema,
};

const massFoodSnapshotSchema = z.object({
  ...foodSnapshotBaseFields,
  baseUnit: z.literal('g'),
  servings: z.array(massServingSchema),
});
const volumeFoodSnapshotSchema = z.object({
  ...foodSnapshotBaseFields,
  baseUnit: z.literal('ml'),
  servings: z.array(volumeServingSchema),
});

const massPortionSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('baseUnit'), amount: gramsSchema }),
  z.object({ kind: z.literal('serving'), servingId: servingIdSchema, count: z.number() }),
]);
const volumePortionSelectionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('baseUnit'), amount: millilitersSchema }),
  z.object({ kind: z.literal('serving'), servingId: servingIdSchema, count: z.number() }),
]);

const massResolvedPortionSchema = z.object({
  selection: massPortionSelectionSchema,
  amountInBaseUnit: gramsSchema,
});
const volumeResolvedPortionSchema = z.object({
  selection: volumePortionSelectionSchema,
  amountInBaseUnit: millilitersSchema,
});

const mealEntryBaseFields = {
  id: mealEntryIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  deletedAt: instantSchema.optional(),
  date: localDateSchema,
  slot: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  note: z.string().optional(),
};

/**
 * `MealEntry` empareja `food` y `portion` por unidad base (D-005), y ese
 * emparejamiento no vive en un único campo discriminante de nivel superior,
 * así que no encaja en `z.discriminatedUnion`: es una unión sencilla de dos
 * formas completas, y Zod prueba la de masa antes que la de volumen.
 */
const mealEntrySchema = z.union([
  z.object({
    ...mealEntryBaseFields,
    food: massFoodSnapshotSchema,
    portion: massResolvedPortionSchema,
  }),
  z.object({
    ...mealEntryBaseFields,
    food: volumeFoodSnapshotSchema,
    portion: volumeResolvedPortionSchema,
  }),
]);

const energySourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }),
  z.object({ kind: z.literal('met'), met: z.number() }),
]);

const exerciseEntrySchema = z.object({
  id: exerciseEntryIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  deletedAt: instantSchema.optional(),
  date: localDateSchema,
  activityLabel: z.string(),
  durationMinutes: minutesSchema,
  energy: kilocaloriesSchema,
  energySource: energySourceSchema,
  note: z.string().optional(),
});

const goalOriginSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('manual') }),
  z.object({ kind: z.literal('suggested'), formula: z.literal('mifflin-st-jeor') }),
]);

const dailyGoalsSchema = z.object({
  id: goalsIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  deletedAt: instantSchema.optional(),
  effectiveFrom: localDateSchema,
  energy: kilocaloriesSchema,
  protein: gramsSchema,
  carbohydrates: gramsSchema,
  fat: gramsSchema,
  fiber: gramsSchema.optional(),
  micros: micronutrientsSchema,
  origin: goalOriginSchema,
});

const bodyMetricsSchema = z.object({
  heightCm: z.number(),
  weightKg: z.number(),
  birthDate: localDateSchema,
  sex: z.enum(['female', 'male', 'unspecified']),
  activityLevel: z.enum(['sedentary', 'light', 'moderate', 'active', 'veryActive']),
});

const displayPreferencesSchema = z.object({
  massUnit: z.enum(['metric', 'imperial']),
  energyUnit: z.enum(['kcal', 'kJ']),
  firstDayOfWeek: z.enum(['monday', 'sunday']),
});

const profileSchema = z.object({
  id: profileIdSchema,
  createdAt: instantSchema,
  updatedAt: instantSchema,
  deletedAt: instantSchema.optional(),
  displayName: z.string().optional(),
  timeZone: z.string(),
  locale: z.string(),
  display: displayPreferencesSchema,
  body: bodyMetricsSchema.optional(),
  disclaimerAcceptedAt: instantSchema.optional(),
});

const exportPayloadSchema = z.object({
  profile: profileSchema,
  goals: z.array(dailyGoalsSchema),
  foods: z.array(foodSchema),
  mealEntries: z.array(mealEntrySchema),
  exerciseEntries: z.array(exerciseEntrySchema),
});

/**
 * Solo la envoltura: `schemaVersion` decide qué esquema aplicarle a `data`
 * ANTES de intentar validarlo con la forma completa, así que aquí `data` es
 * todavía `unknown` a propósito.
 */
const envelopeShellSchema = z.object({
  schemaVersion: z.number().int().positive(),
  exportedAt: z.unknown(),
  appVersion: z.unknown(),
  data: z.unknown(),
});

/**
 * Un migrador lleva `data` de su versión a la siguiente. Hoy solo existe la
 * versión 1 de `EXPORT_SCHEMA_VERSION` (D-007) y no hace falta ningún
 * migrador: el mapa está vacío a propósito, listo para crecer con una entrada
 * `1: (data) => ...` el día que exista una versión 2.
 */
const MIGRATIONS: ReadonlyMap<number, (data: unknown) => unknown> = new Map();

function summarizeZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
    .join('; ');
}

/**
 * Valida un archivo de exportación de principio a fin y lo reconstruye a un
 * `ExportEnvelope` con todas sus magnitudes ya marcadas. Lanza un `Error` con
 * un mensaje legible -nunca deja escapar un `ZodError` crudo- si el archivo no
 * tiene la forma esperada, si trae una magnitud fuera de rango, o si su
 * `schemaVersion` es una que esta aplicación todavía no sabe migrar.
 */
export function parseExportEnvelope(raw: unknown): ExportEnvelope {
  const shell = envelopeShellSchema.parse(raw);

  if (shell.schemaVersion > EXPORT_SCHEMA_VERSION) {
    throw new Error(
      `Este archivo es de una versión más nueva (${shell.schemaVersion}) que la que esta aplicación entiende (${EXPORT_SCHEMA_VERSION}). Actualiza la aplicación antes de importarlo.`,
    );
  }

  let data: unknown = shell.data;
  for (let version = shell.schemaVersion; version < EXPORT_SCHEMA_VERSION; version += 1) {
    const migrate = MIGRATIONS.get(version);
    if (migrate === undefined) {
      throw new Error(
        `No hay forma de migrar la versión ${version} de este archivo a la versión actual (${EXPORT_SCHEMA_VERSION}).`,
      );
    }
    data = migrate(data);
  }

  try {
    const parsed = exportPayloadSchema.parse(data);
    const exportedAt = instantSchema.parse(shell.exportedAt);
    const appVersion = z.string().parse(shell.appVersion);

    /*
     * El cast de esta línea no afirma nada sobre datos sin comprobar: cuando
     * se llega aquí, cada magnitud ya pasó por `grams`/`kilocalories`/etc.,
     * cada fecha por `localDate`/`instant`, y cada identificador por su
     * función de marcado. Lo único que separa el tipo que infiere Zod del
     * `ExportPayload` real es una diferencia de TypeScript, no de datos: con
     * `exactOptionalPropertyTypes`, un campo opcional ausente es `clave?: T`
     * (la clave puede faltar), pero Zod infiere `clave: T | undefined` (la
     * clave siempre está, a veces con `undefined`) para cualquier `.optional()`
     * dentro de un objeto - aunque en tiempo de ejecución, si el campo faltaba
     * en el JSON, Zod tampoco llega a escribir esa clave en el resultado.
     * Es la misma distinción, y la misma solución -un cast confinado y
     * documentado-, que `fromStored` ya usa en `data/stored.ts`.
     */
    const payload = parsed as ExportPayload;

    return { schemaVersion: EXPORT_SCHEMA_VERSION, exportedAt, appVersion, data: payload };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`El archivo no tiene el formato esperado (${summarizeZodError(error)}).`, {
        cause: error,
      });
    }
    throw error;
  }
}
