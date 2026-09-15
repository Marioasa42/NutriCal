import { useRef, useState } from 'react';

import type { ExportEnvelope } from '@/domain/transfer/export';
import { importer, type ImportSummary } from '@/domain/transfer/import-all';
import { parseExportEnvelope } from '@/domain/transfer/import-schema';

/**
 * Importar un archivo exportado.
 *
 * En dos pasos, nunca uno: elegir el archivo solo lo valida y enseña un
 * resumen ("se insertarán 4, se actualizarán 2 con datos más recientes, 1 se
 * conserva tal cual"); escribir de verdad es una segunda pulsación aparte.
 * Es la transparencia que pide D-052 aplicado a la importación: nadie debería
 * enterarse de que su historial cambió solo después de que ya hubiera
 * cambiado.
 *
 * `parseExportEnvelope` (`import-schema.ts`) ya hizo todo el trabajo de
 * D-025 -cada magnitud reconstruida con su constructor, nunca afirmada-;
 * este componente solo sabe de estados de pantalla.
 */
type ImportState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'reading' }
  | { readonly kind: 'ready'; readonly envelope: ExportEnvelope; readonly summary: ImportSummary }
  | { readonly kind: 'importing' }
  | { readonly kind: 'done'; readonly summary: ImportSummary }
  | { readonly kind: 'error'; readonly message: string };

export function ImportDataButton() {
  const [state, setState] = useState<ImportState>({ kind: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setState({ kind: 'reading' });
    try {
      const text = await file.text();
      const raw: unknown = JSON.parse(text);
      const envelope = parseExportEnvelope(raw);
      const summary = await importer.preview(envelope);
      setState({ kind: 'ready', envelope, summary });
    } catch (error) {
      setState({
        kind: 'error',
        message: error instanceof Error ? error.message : 'No se ha podido leer el archivo.',
      });
    }
  }

  async function handleConfirm(envelope: ExportEnvelope) {
    setState({ kind: 'importing' });
    try {
      const summary = await importer.importAll(envelope);
      setState({ kind: 'done', summary });
    } catch {
      setState({
        kind: 'error',
        message: 'No se ha podido escribir la importación. No se ha cambiado nada.',
      });
    }
  }

  function reset() {
    setState({ kind: 'idle' });
    if (inputRef.current !== null) {
      inputRef.current.value = '';
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-sm font-medium text-slate-700">Importar datos</h2>
      <p className="text-sm text-slate-500">
        Restaura o combina un archivo exportado antes. Se fusiona por registro: nada se pierde si tu
        versión aquí es más reciente que la del archivo.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        className="sr-only"
        id="import-file"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file !== undefined) {
            void handleFile(file);
          }
        }}
      />

      {state.kind === 'idle' || state.kind === 'error' ? (
        <label
          htmlFor="import-file"
          className="w-fit cursor-pointer rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-900"
        >
          Elegir archivo
        </label>
      ) : null}

      {state.kind === 'reading' ? (
        <p className="text-sm text-slate-500">Leyendo el archivo…</p>
      ) : null}

      {state.kind === 'ready' ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-slate-700">{describeSummary(state.summary)} ¿Continuar?</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                void handleConfirm(state.envelope);
              }}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Confirmar importación
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {state.kind === 'importing' ? <p className="text-sm text-slate-500">Importando…</p> : null}

      {state.kind === 'done' ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-emerald-700">
            Importación completa. {describeSummary(state.summary)}
          </p>
          <button
            type="button"
            onClick={reset}
            className="w-fit text-sm font-medium text-emerald-700 underline underline-offset-4"
          >
            Importar otro archivo
          </button>
        </div>
      ) : null}

      {state.kind === 'error' ? <p className="text-sm text-red-700">{state.message}</p> : null}
    </div>
  );
}

function describeSummary(summary: ImportSummary): string {
  const parts: string[] = [];
  if (summary.inserted > 0) {
    parts.push(`${summary.inserted} ${summary.inserted === 1 ? 'nuevo' : 'nuevos'}`);
  }
  if (summary.updated > 0) {
    parts.push(
      `${summary.updated} ${summary.updated === 1 ? 'actualizado' : 'actualizados'} con datos más recientes`,
    );
  }
  if (summary.keptLocal > 0) {
    parts.push(
      `${summary.keptLocal} ${summary.keptLocal === 1 ? 'conservado' : 'conservados'} tal cual, porque tu versión es más reciente`,
    );
  }
  if (parts.length === 0) {
    return 'El archivo no trae ningún registro.';
  }
  return `Se enseña el balance: ${parts.join(', ')}.`;
}
