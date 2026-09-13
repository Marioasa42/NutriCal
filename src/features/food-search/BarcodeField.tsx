import { useState, type SubmitEventHandler } from 'react';
import { useNavigate } from 'react-router';

import type { LocalDate } from '@/domain/time/local-date';
import { BARCODE_MAX_DIGITS, BARCODE_MIN_DIGITS, normalizeBarcode } from '@contracts/barcode';

/**
 * Teclear un código de barras a mano.
 *
 * Este formulario no resuelve nada: normaliza lo que se ha escrito y navega a
 * `/dia/:date/codigo/:barcode`, que es donde vive la resolución. La separación
 * es lo que permite que en la fase 3 el botón de la cámara se ponga justo aquí
 * al lado y haga exactamente lo mismo, sin tocar la pantalla de destino.
 *
 * Y es el requisito de degradación elegante cumplido por orden de construcción:
 * teclear el código es el camino que existe primero, y la cámara será un atajo
 * hacia él y no una vía paralela que haya que mantener aparte (D-012).
 */
export function BarcodeField({ date }: { date: LocalDate }) {
  const navigate = useNavigate();
  const [value, setValue] = useState('');

  // No se valida aquí para bloquear el envío. La pantalla de destino ya tiene
  // su rama `invalid`, que explica qué forma debe tener el código sin gastar
  // ninguna petición. Repetir la comprobación en el formulario solo añadiría un
  // segundo sitio donde el mensaje puede quedarse desactualizado.
  const submit: SubmitEventHandler<HTMLFormElement> = (event) => {
    event.preventDefault();
    const barcode = normalizeBarcode(value);
    if (barcode !== '') {
      void navigate(`/dia/${date}/codigo/${encodeURIComponent(barcode)}`);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-1 border-t border-slate-200 pt-4">
      <label htmlFor="barcode" className="text-sm font-medium text-slate-700">
        ¿Tienes el código de barras?
      </label>
      <div className="flex gap-2">
        <input
          id="barcode"
          name="barcode"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
          // `inputMode` saca el teclado numérico en el móvil, que es donde se
          // teclea un código mirando el envase. No es `type="number"`: eso
          // trae flechas de incremento, permite notación científica y trata el
          // código como una cantidad, que no lo es.
          inputMode="numeric"
          autoComplete="off"
          placeholder={`${BARCODE_MIN_DIGITS} a ${BARCODE_MAX_DIGITS} dígitos`}
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Buscar
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Puedes copiarlo con los espacios tal y como viene en el envase.
      </p>
    </form>
  );
}
