import type { ProfileId } from '@/domain/identity/ids';
import type { Persisted } from '@/domain/persistence/persisted';
import type { Instant, LocalDate } from '@/domain/time/local-date';

/**
 * Sexo biológico, necesario solo para la fórmula de Mifflin-St Jeor. `unspecified`
 * existe porque nadie está obligado a declararlo: en ese caso la aplicación no
 * sugiere objetivo y los fija la persona usuaria.
 */
export type Sex = 'female' | 'male' | 'unspecified';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';

/**
 * Datos corporales, todos opcionales en bloque. Sin ellos la aplicación funciona
 * igual, solo que no propone un objetivo de partida.
 */
export interface BodyMetrics {
  readonly heightCm: number;
  readonly weightKg: number;
  readonly birthDate: LocalDate;
  readonly sex: Sex;
  readonly activityLevel: ActivityLevel;
}

/** Preferencias que solo afectan a cómo se pinta, nunca a cómo se guarda. */
export interface DisplayPreferences {
  readonly massUnit: 'metric' | 'imperial';
  readonly energyUnit: 'kcal' | 'kJ';
  readonly firstDayOfWeek: 'monday' | 'sunday';
}

export interface Profile extends Persisted {
  readonly id: ProfileId;
  readonly displayName?: string;
  /** Identificador IANA, por ejemplo "Europe/Madrid". Define qué es un día. */
  readonly timeZone: string;
  readonly locale: string;
  readonly display: DisplayPreferences;
  readonly body?: BodyMetrics;
  /** Cuándo se leyó y aceptó el aviso de que esto no es consejo médico. */
  readonly disclaimerAcceptedAt?: Instant;
}

/** Solo se puede sugerir un objetivo si hay datos y un sexo declarado. */
export const canSuggestGoals = (profile: Profile): boolean =>
  profile.body !== undefined && profile.body.sex !== 'unspecified';

/**
 * Crea el perfil inicial.
 *
 * Existe porque la zona horaria pasa a leerse de aquí y no del navegador
 * (D-043), y para leerla de aquí tiene que haber un "aquí". Se crea solo, en el
 * primer arranque, sin preguntar nada: exigir un formulario antes de poder usar
 * la aplicación sería una cuenta con otro nombre, y la decisión 6 del proyecto
 * dice que nadie tiene que registrarse para usar esto.
 *
 * Los valores iniciales se toman del navegador, que es lo que acertará casi
 * siempre, y a partir de ahí mandan los del perfil. Es la diferencia entre un
 * valor por defecto y una fuente de verdad: el navegador propone una vez, el
 * perfil decide siempre.
 *
 * El cuerpo (`body`) se queda fuera a propósito. Solo hace falta para sugerir
 * objetivos, son datos sensibles, y no se piden hasta que sirvan para algo.
 */
export function createProfile(options: {
  id: ProfileId;
  timeZone: string;
  locale: string;
  at: Instant;
}): Profile {
  const { id, timeZone, locale, at } = options;
  return {
    id,
    timeZone,
    locale,
    display: { massUnit: 'metric', energyUnit: 'kcal', firstDayOfWeek: 'monday' },
    createdAt: at,
    updatedAt: at,
  };
}
