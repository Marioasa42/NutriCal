import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import type { LocalDate } from '@/domain/time/local-date';
import {
  createReadingConfirmer,
  type DecodedRead,
} from '@/features/food-search/barcode-confirmation';
import { stopMediaStream } from '@/features/food-search/camera-stream';
import { isValidBarcode } from '@contracts/barcode';
import type { DecodeHintType, Result } from '@zxing/library';

/**
 * Escanear un código de barras con la cámara.
 *
 * No resuelve nada por sí mismo: en cuanto `barcode-confirmation.ts` da un
 * código por bueno, navega a `/dia/:date/codigo/:barcode`, exactamente igual
 * que `BarcodeField.tsx` con la entrada manual. Es la promesa comprobable de
 * D-032: ni `BarcodeField.tsx` ni `BarcodePage.tsx` se tocan para que esto
 * funcione.
 *
 * Requisito 7 (degradación elegante): `BarcodeDetector` es nativo del
 * navegador pero no está en todos (Safari no lo trae). Si existe, se usa
 * directamente; si no, se carga `@zxing/library` con un `import()` perezoso,
 * solo al abrir el visor, para no engordar el paquete principal con una
 * librería que la mayoría de visitas nunca va a necesitar. La entrada manual
 * sigue siendo un camino siempre visible, no algo que sustituya a esto.
 */

/** Los formatos de `BarcodeDetector` que interesan: los mismos que acepta `isValidBarcode`. */
const NATIVE_BARCODE_FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf'] as const;

type StopScanning = () => void;

async function startNativeDetector(
  video: HTMLVideoElement,
  onRead: (read: DecodedRead) => void,
): Promise<StopScanning> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'environment' },
  });
  video.srcObject = stream;
  await video.play();

  const detector = new BarcodeDetector({ formats: NATIVE_BARCODE_FORMATS });
  let cancelled = false;
  let frameId = 0;

  const tick = () => {
    if (cancelled) {
      return;
    }
    void detector
      .detect(video)
      .then((detections) => {
        const [first] = detections;
        if (first !== undefined) {
          onRead({ value: first.rawValue });
        }
      })
      // Un fotograma sin ningún código legible no es un fallo: es la mayoría
      // de los fotogramas. Se ignora y se prueba con el siguiente.
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) {
          frameId = requestAnimationFrame(tick);
        }
      });
  };
  frameId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(frameId);
    stopMediaStream(stream);
  };
}

async function startZxingDecoder(
  video: HTMLVideoElement,
  onRead: (read: DecodedRead) => void,
): Promise<StopScanning> {
  const { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType } =
    await import('@zxing/library');

  const hints = new Map<DecodeHintType, unknown>([
    [
      DecodeHintType.POSSIBLE_FORMATS,
      [
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
        BarcodeFormat.UPC_E,
        BarcodeFormat.ITF,
      ],
    ],
  ]);
  const reader = new BrowserMultiFormatReader(hints);

  // El tipo publicado del callback dice `(result: Result, error?: Exception)`,
  // pero la implementación real (`BrowserCodeReader.decodeContinuously`)
  // llama con `null` en ambos casos según cuál haya salido bien. Se anota el
  // parámetro como `Result | null` a propósito, no por exceso de cautela.
  await reader.decodeFromVideoDevice(null, video, (result: Result | null) => {
    if (result !== null) {
      onRead({ value: result.getText() });
    }
  });

  return () => {
    reader.reset();
  };
}

export function BarcodeScanner({ date }: { date: LocalDate }) {
  const navigate = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const video = videoRef.current;
    if (video === null) {
      return;
    }

    let stop: StopScanning | undefined;
    // Un objeto, no un `let` suelto: `cancelled = true` solo ocurre dentro de
    // la función de limpieza que se cierra sobre esta variable, y con un
    // `let` el compilador no ve esa reasignación posible mientras la IIFE de
    // abajo sigue en marcha, así que estrecha el tipo a `false` para siempre
    // y el linter marca las comprobaciones de más abajo como redundantes.
    // Con una propiedad de objeto no hay ese estrechamiento.
    const cancellation = { cancelled: false };
    const confirmer = createReadingConfirmer();

    const handleRead = (read: DecodedRead) => {
      const confirmed = confirmer.accept(read);
      // La regla compartida cliente/servidor de D-031, la misma que ya aplica
      // `BarcodePage.tsx` a lo tecleado a mano. Un valor confirmado que no la
      // cumple se descarta como si no se hubiera leído: sin navegar, sin
      // aviso, se sigue mirando.
      if (confirmed !== undefined && isValidBarcode(confirmed)) {
        setIsOpen(false);
        void navigate(`/dia/${date}/codigo/${encodeURIComponent(confirmed)}`);
      }
    };

    setError(undefined);
    void (async () => {
      try {
        const started =
          'BarcodeDetector' in window
            ? await startNativeDetector(video, handleRead)
            : await startZxingDecoder(video, handleRead);
        if (cancellation.cancelled) {
          started();
          return;
        }
        stop = started;
        setIsActive(true);
      } catch {
        if (!cancellation.cancelled) {
          setError(
            'No se pudo abrir la cámara. Comprueba el permiso, o teclea el código a mano abajo.',
          );
        }
      }
    })();

    // Única función de limpieza para las tres vías de cierre (botón, cambio
    // de ruta, desmontaje): React la ejecuta igual en las tres, así que no
    // hay tres sitios que puedan desincronizarse. `stopMediaStream` (en el
    // camino nativo) y `reader.reset()` (en zxing) son lo que de verdad
    // libera la cámara; sin esto se quedaría encendida gastando batería.
    return () => {
      cancellation.cancelled = true;
      setIsActive(false);
      stop?.();
    };
  }, [isOpen, date, navigate]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
        }}
        className="self-start rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
      >
        {isOpen ? 'Cerrar la cámara' : 'Escanear con la cámara'}
      </button>

      {isOpen ? (
        <div className="flex flex-col gap-2">
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-video w-full max-w-sm rounded-lg border border-slate-300 bg-slate-950 object-cover"
          />
          {!isActive && error === undefined ? (
            <p className="text-xs text-slate-500">Abriendo la cámara…</p>
          ) : null}
          {error !== undefined ? <p className="text-xs text-red-700">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
