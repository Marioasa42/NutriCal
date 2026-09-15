/**
 * La API de Shape Detection (`BarcodeDetector`) no está en `lib.dom.d.ts` de
 * TypeScript: es experimental y solo Chrome/Edge la traen. Esta es la
 * declaración mínima que este proyecto necesita, no la API completa -por
 * ejemplo, faltan `cornerPoints` y `boundingBox`, que aquí no se usan-.
 *
 * Requisito 7 de `CLAUDE.md`: por eso `BarcodeScanner.tsx` comprueba
 * `'BarcodeDetector' in window` en tiempo de ejecución antes de construir uno
 * -esta declaración solo satisface al compilador, no implica que el
 * navegador la tenga de verdad.
 */
interface DetectedBarcode {
  readonly rawValue: string;
}

declare class BarcodeDetector {
  constructor(options?: { formats?: readonly string[] });
  detect(source: CanvasImageSource): Promise<readonly DetectedBarcode[]>;
}
