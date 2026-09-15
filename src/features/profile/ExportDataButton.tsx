import { useState } from 'react';

import { exporter } from '@/domain/transfer/export-all';
import { exportFileName } from '@/features/profile/export-file';

type ExportStatus = 'idle' | 'exporting' | 'error';

/**
 * Descargar todo lo guardado en un archivo JSON.
 *
 * `exporter.exportAll()` (`domain/transfer/export-all.ts`) hace todo el
 * trabajo de verdad -leer los cinco repositorios, incluidas las lápidas-;
 * esto solo convierte el resultado en un archivo y dispara la descarga con el
 * patrón estándar del navegador (`Blob` + `<a download>`), sin ninguna
 * dependencia nueva.
 */
export function ExportDataButton() {
  const [status, setStatus] = useState<ExportStatus>('idle');

  async function handleClick() {
    setStatus('exporting');
    try {
      const envelope = await exporter.exportAll();
      const blob = new Blob([JSON.stringify(envelope, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url;
        link.download = exportFileName(envelope.exportedAt);
        link.click();
      } finally {
        URL.revokeObjectURL(url);
      }
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-700">Exportar tus datos</h2>
      <p className="text-sm text-slate-500">
        Descarga un archivo con todo lo que has registrado: comidas, ejercicio, objetivos, perfil y
        tu catálogo de alimentos. Sirve para guardar una copia o para llevarla a otro dispositivo.
      </p>
      <button
        type="button"
        onClick={() => {
          void handleClick();
        }}
        disabled={status === 'exporting'}
        className="self-start rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-slate-300"
      >
        {status === 'exporting' ? 'Exportando…' : 'Exportar datos'}
      </button>
      {status === 'error' ? (
        <p className="text-sm text-red-700">No se ha podido exportar. Inténtalo de nuevo.</p>
      ) : null}
    </div>
  );
}
