/**
 * Cuándo dar por bueno un código leído por la cámara.
 *
 * Con mala luz o el código en mal ángulo, un lector puede decodificar un
 * valor plausible pero equivocado en un único fotograma, y eso llevaría en
 * silencio a la ficha de otro producto, sin ningún error visible. La regla es
 * la misma para `BarcodeDetector` y para `@zxing/library` -viven en
 * `BarcodeScanner.tsx`, esto es solo la decisión de cuándo confiar en lo que
 * han leído-: si la fuente da una medida de confianza, se usa esa; si no
 * (que es el caso normal hoy: ni la API nativa ni el resultado por defecto de
 * zxing la exponen), hacen falta varias lecturas idénticas seguidas antes de
 * confiar en el valor.
 */

/** Un fotograma decodificado, venga de `BarcodeDetector` o de zxing. */
export interface DecodedRead {
  readonly value: string;
  /** 0 a 1. `undefined` si la fuente no la da, que es el caso de hoy en las dos. */
  readonly confidence?: number;
}

/**
 * Tres lecturas iguales seguidas. Ni una (un solo fotograma torcido bastaría
 * para navegar al producto equivocado) ni demasiadas (retrasaría sin motivo
 * un código bien leído a la primera).
 */
const REQUIRED_CONSECUTIVE_READS = 3;

/** Umbral para confiar directamente en una medida de confianza, si la hay. */
const MIN_CONFIDENCE = 0.8;

export interface ReadingConfirmer {
  /**
   * Procesa un fotograma. Devuelve el código en cuanto se puede dar por
   * bueno, y `undefined` mientras tanto. Un mismo valor ya confirmado no
   * vuelve a confirmarse en los fotogramas siguientes: si no, un código
   * quieto delante de la cámara "se confirmaría" en cada fotograma, sin fin.
   */
  accept(read: DecodedRead): string | undefined;
}

export function createReadingConfirmer(): ReadingConfirmer {
  let lastValue: string | undefined;
  let streak = 0;
  let confirmedValue: string | undefined;

  return {
    accept(read: DecodedRead): string | undefined {
      if (read.value === confirmedValue) {
        return undefined;
      }

      if (read.confidence !== undefined) {
        if (read.confidence < MIN_CONFIDENCE) {
          return undefined;
        }
        confirmedValue = read.value;
        return read.value;
      }

      streak = read.value === lastValue ? streak + 1 : 1;
      lastValue = read.value;

      if (streak < REQUIRED_CONSECUTIVE_READS) {
        return undefined;
      }
      confirmedValue = read.value;
      return read.value;
    },
  };
}
