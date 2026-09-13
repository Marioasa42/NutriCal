/**
 * La zona horaria de la persona usuaria, en un solo sitio.
 *
 * De momento la pregunta al navegador. El dominio ya tiene `UserProfile.timeZone`
 * (D-003 y siguientes lo dan por hecho), pero todavía no hay ninguna pantalla que
 * lo escriba, así que no hay nada que leer. En la fase 2, cuando exista el perfil
 * editable, esta función pasará a leer de ahí y a caer al navegador solo si el
 * perfil no dice nada.
 *
 * Vive aislada precisamente para que ese cambio sea de una línea y no una
 * cacería de llamadas a `Intl` repartidas por la interfaz. Ninguna otra parte de
 * la aplicación debe preguntar la zona horaria por su cuenta.
 */
export function currentTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
