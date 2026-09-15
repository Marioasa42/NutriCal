/**
 * La versión de `package.json`, sustituida en tiempo de build por
 * `vite.config.ts` (`define: { __APP_VERSION__ }`).
 *
 * Este archivo es el único que toca la variable global `__APP_VERSION__`: el
 * resto del proyecto importa `APP_VERSION` de aquí, nunca la global directa.
 */
export const APP_VERSION: string = __APP_VERSION__;
