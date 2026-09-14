import { useState } from 'react';
import { Link } from 'react-router';

import { now } from '@/domain/time/local-date';
import { useProfile } from '@/features/profile/profile-context';
import { useSaveProfile } from '@/features/profile/queries';
import { browserTimeZone, isValidTimeZone, supportedTimeZones } from '@/shared/lib/time-zone';

/**
 * Ajustes: de momento, solo lo que decide qué es un día.
 *
 * La zona horaria está aquí y no escondida porque desde D-043 es la que parte tu
 * diario en días. Si viajas, o si el navegador acierta mal, esto es lo que hay
 * que poder corregir; antes no había forma, porque se le preguntaba al navegador
 * en cada renderizado.
 *
 * Los datos corporales NO están aquí todavía. Solo hacen falta para sugerir
 * objetivos, que llega más adelante en la fase 2, y son datos sensibles que no
 * se piden hasta que sirvan para algo.
 */
export function SettingsPage() {
  const profile = useProfile();
  const save = useSaveProfile();

  const [timeZone, setTimeZone] = useState(profile.timeZone);
  const zones = supportedTimeZones();

  const valid = isValidTimeZone(timeZone);
  const changed = timeZone !== profile.timeZone;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link to="/" className="text-sm font-medium text-emerald-700 underline underline-offset-4">
          ← Volver al diario
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Ajustes</h1>
      </div>

      <Link
        to="/ajustes/objetivos"
        className="text-sm font-medium text-emerald-700 underline underline-offset-4"
      >
        Objetivos diarios →
      </Link>

      <form
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!valid || !changed) {
            return;
          }
          save.mutate({ ...profile, timeZone, updatedAt: now() });
        }}
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="time-zone" className="text-sm font-medium text-slate-700">
            Zona horaria
          </label>
          <p className="text-sm text-slate-500">
            Decide a qué día pertenece cada comida. Una cena a las 00:30 en Madrid es del día
            siguiente; en Nueva York, del mismo.
          </p>

          {/*
            Si el navegador sabe dar la lista, se elige; si no, se teclea. Es la
            decisión 7 del proyecto aplicada a `Intl.supportedValuesOf`, que no
            está en todas partes: la misma regla que obliga a poder teclear un
            código de barras cuando no hay cámara.
          */}
          {zones === undefined ? (
            <input
              id="time-zone"
              type="text"
              value={timeZone}
              onChange={(event) => {
                setTimeZone(event.target.value);
              }}
              placeholder="Europe/Madrid"
              autoComplete="off"
              spellCheck={false}
              aria-describedby="time-zone-help"
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            />
          ) : (
            <select
              id="time-zone"
              value={timeZone}
              onChange={(event) => {
                setTimeZone(event.target.value);
              }}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200"
            >
              {/* La del perfil puede no estar en la lista si se tecleó en otro
                  dispositivo o si la base de husos del navegador es más vieja.
                  Se añade para que abrir los ajustes no la cambie sin avisar. */}
              {zones.includes(timeZone) ? null : <option value={timeZone}>{timeZone}</option>}
              {zones.map((zone) => (
                <option key={zone} value={zone}>
                  {zone}
                </option>
              ))}
            </select>
          )}

          <p id="time-zone-help" className="text-xs text-slate-500">
            {zones === undefined
              ? `Escríbela en formato IANA, como "Europe/Madrid". Tu navegador dice ${browserTimeZone()}.`
              : `Tu navegador dice ${browserTimeZone()}.`}
          </p>

          {valid ? null : (
            <p className="text-sm text-red-700">
              Esa zona horaria no existe. Revisa que esté escrita como «Europe/Madrid».
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={!valid || !changed || save.isPending}
            className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800 disabled:bg-slate-300"
          >
            Guardar
          </button>
          <span aria-live="polite" className="text-sm text-slate-500">
            {save.isError ? 'No se ha podido guardar.' : null}
            {save.isSuccess && !changed ? 'Guardado.' : null}
          </span>
        </div>
      </form>
    </div>
  );
}
