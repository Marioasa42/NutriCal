import { Navigate } from 'react-router';

import { today } from '@/domain/time/local-date';
import { useTimeZone } from '@/features/profile/profile-context';

/**
 * La raíz no es una pantalla: manda al día de hoy.
 *
 * `replace` en vez de una entrada nueva del historial, para que el botón de
 * atrás desde el diario salga de la aplicación en lugar de rebotar contra esta
 * redirección una y otra vez.
 *
 * El día se calcula en la zona horaria del perfil, no del navegador (D-043). Es
 * la decisión 3 de CLAUDE.md aplicada al primer sitio donde se nota: a las 00:30
 * en Madrid, "hoy" ya es el día siguiente aunque en Londres todavía no lo sea, y
 * eso tiene que seguir siendo así aunque quien viaja abra la aplicación desde
 * Nueva York.
 */
export function TodayRedirect() {
  const timeZone = useTimeZone();
  return <Navigate to={`/dia/${today(timeZone)}`} replace />;
}
