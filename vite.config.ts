/// <reference types="vitest/config" />
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * `npm run dev` sirve el frontend y NADA MÁS: Vite no ejecuta `api/`, así que
 * hasta ahora cualquier búsqueda fallaba en local con un 404 disfrazado de
 * página de la propia aplicación (la reescritura de `vercel.json` cae a
 * `index.html` para cualquier ruta que no reconozca, así que el error ni
 * siquiera se veía claro). D-051 explica por qué la solución es este plugin y
 * no otra cosa.
 *
 * La idea es pequeña a propósito: cuando una petición del propio servidor de
 * desarrollo de Vite empieza por `/api/`, se localiza el archivo de `api/`
 * que le corresponde (mismo criterio de carpetas que usa Vercel: un segmento
 * literal o, si no existe, uno entre corchetes), se carga con
 * `server.ssrLoadModule` -que es Vite transformando TypeScript, no Node
 * ejecutándolo tal cual-, y se llama a su función `GET` con un objeto
 * `Request` de verdad. Los archivos de `api/` ya están escritos así, con la
 * firma estándar `(request: Request) => Promise<Response>` que exige Vercel,
 * así que no hace falta adaptar nada del lado de `api/`: esto es solo un
 * puente.
 */

const API_ROOT = fileURLToPath(new URL('./api', import.meta.url));

/** El primer archivo `[algo].ts` de una carpeta, si lo hay. */
function findDynamicRouteFile(dir: string): string | undefined {
  if (!existsSync(dir)) {
    return undefined;
  }
  const match = readdirSync(dir).find((name) => /^\[.+\]\.ts$/.test(name));
  return match === undefined ? undefined : path.join(dir, match);
}

/**
 * De una ruta como `/api/usda/food/173410` al archivo que la sirve,
 * `api/usda/food/[fdcId].ts`. Un segmento literal (`off`, `search`) manda
 * sobre uno dinámico; el dinámico solo se prueba en el último tramo, porque
 * hoy ningún archivo de `api/` anida una carpeta dinámica dentro de otra.
 * Si algún día hiciera falta, esta función es el único sitio que tocar.
 */
function resolveApiHandlerFile(pathname: string): string | undefined {
  const segments = pathname.split('/').filter((segment) => segment !== '');
  if (segments[0] !== 'api') {
    return undefined;
  }

  let dir = API_ROOT;
  const rest = segments.slice(1);

  for (const [index, segment] of rest.entries()) {
    const isLast = index === rest.length - 1;

    if (!isLast) {
      const nextDir = path.join(dir, segment);
      if (!existsSync(nextDir)) {
        return undefined;
      }
      dir = nextDir;
      continue;
    }

    const staticFile = path.join(dir, `${segment}.ts`);
    return existsSync(staticFile) ? staticFile : findDynamicRouteFile(dir);
  }

  return undefined;
}

/**
 * El puente entre el servidor de Vite y las funciones de `api/`.
 *
 * `apply: 'serve'` porque esto es una comodidad de desarrollo y no debe
 * ejecutarse jamás durante `vite build`: en producción, quien sirve `api/` es
 * Vercel, con su propio entorno y su propia memoria por invocación. De hecho
 * este simulador es MÁS generoso que la Vercel real en un punto concreto y
 * conviene no olvidarlo: `server.ssrLoadModule` cachea el módulo entre
 * peticiones mientras el servidor de desarrollo siga vivo, así que el cubo de
 * fichas de `rate-limit.ts` sí comparte memoria aquí, cosa que D-041
 * documentó que NO pasa en producción. Para probar de verdad un límite de
 * ritmo hace falta el despliegue real, no este puente.
 */
function localApiFunctions(): Plugin {
  return {
    name: 'local-api-functions',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url;
        if (!url?.startsWith('/api/')) {
          next();
          return;
        }

        const pathname = url.split('?')[0] ?? url;
        const filePath = resolveApiHandlerFile(pathname);
        if (filePath === undefined) {
          next();
          return;
        }

        void (async () => {
          try {
            const mod: Record<string, unknown> = await server.ssrLoadModule(filePath);
            const method = (req.method ?? 'GET').toUpperCase();
            const handler = mod[method] as ((request: Request) => Promise<Response>) | undefined;
            if (typeof handler !== 'function') {
              res.statusCode = 405;
              res.end();
              return;
            }

            const headers = new Headers();
            for (const [key, value] of Object.entries(req.headers)) {
              if (typeof value === 'string') {
                headers.set(key, value);
              }
            }

            const request = new Request(new URL(url, 'http://localhost'), { method, headers });
            const response = await handler(request);

            res.statusCode = response.status;
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });
            res.end(Buffer.from(await response.arrayBuffer()));
          } catch (error) {
            next(error instanceof Error ? error : new Error(String(error)));
          }
        })();
      });
    },
  };
}

/**
 * El service worker cachea solo el *app shell* (JS, CSS, HTML, iconos): lo que
 * hace falta para que la aplicación cargue sin red. No cachea `/api/off` ni
 * `/api/usda` a propósito. Buscar un producto nuevo sin conexión no tiene
 * sentido -no hay nada que buscar-, y las dos búsquedas ya saben mostrar un
 * estado "sin conexión" propio (`fetchStatus === 'paused'` de TanStack Query,
 * en `useFoodSearch.ts` y `useUsdaFoodSearch.ts`): lo que faltaba para verlo
 * era que la página en sí cargara offline, no que la API respondiera offline.
 *
 * `navigateFallback` (activado por defecto en el modo `generateSW`) hace que
 * cualquier ruta de la SPA -`/dia/:date`, `/ajustes`, etc.- sirva
 * `index.html` cuando no hay red, sin tener que enumerar aquí el árbol de
 * `src/app/router.tsx`. `navigateFallbackDenylist` excluye `/api/.*`
 * explícitamente: sin esto, una petición a `/api/off/search` sin conexión
 * recibiría el HTML de la aplicación en vez de fallar como una petición de
 * red normal, y esa respuesta no sería un JSON válido - rompería la
 * detección de "sin conexión" en vez de activarla.
 */
function pwaPlugin(): Plugin[] {
  return VitePWA({
    registerType: 'autoUpdate',
    workbox: {
      navigateFallbackDenylist: [/^\/api\//],
    },
    manifest: {
      name: 'NutriCal',
      short_name: 'NutriCal',
      description:
        'Registro de comidas, ejercicio, calorías, macronutrientes y micronutrientes. Sin cuenta y sin conexión.',
      lang: 'es',
      start_url: '/',
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#047857',
      icons: [
        { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      ],
    },
  });
}
/* La versión de la aplicación, para `appVersion` en el archivo exportado
 * (`domain/transfer/export.ts`) - solo un dato de diagnóstico en el archivo,
 * nunca algo de lo que dependa la importación. Se lee aquí, en tiempo de
 * build, con `node:fs`, y se sustituye por una cadena literal con `define`:
 * la alternativa, `import packageJson from '../package.json'`, metería en el
 * paquete del navegador el `package.json` entero -nombres de dependencias,
 * scripts- por un solo campo.
 */
const APP_VERSION = (
  JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf-8')) as {
    version: string;
  }
).version;

export default defineConfig(({ mode }) => {
  /*
   * Las funciones de `api/` leen `process.env` directamente
   * (`requireApiKey` en `api/_lib/usda.ts`), no `import.meta.env`: es lo que
   * harán de verdad en Vercel. Vite solo vuelca en `import.meta.env` las
   * variables con prefijo `VITE_`, así que aquí hay que ir a buscarlas aparte.
   * `loadEnv` con prefijo vacío lee `.env` y `.env.local` completos, y se
   * copian a `process.env` con `??=` para no pisar una variable que ya viniera
   * del entorno real (por ejemplo, de la propia Vercel al hacer `vite build`
   * en su infraestructura).
   */
  const env = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(env)) {
    process.env[key] ??= value;
  }

  return {
    plugins: [react(), tailwindcss(), localApiFunctions(), ...pwaPlugin()],
    define: {
      __APP_VERSION__: JSON.stringify(APP_VERSION),
    },
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
        // Las funciones serverless importan esta misma carpeta con una ruta
        // relativa y extensión `.js`, porque corren como módulos de Node y no
        // pasan por aquí. El alias es solo comodidad del lado del navegador.
        '@contracts': fileURLToPath(new URL('./contracts', import.meta.url)),
      },
    },
    test: {
      // El dominio es código puro: no necesita DOM. Cuando la fase 1 traiga
      // componentes, se añadirá un entorno jsdom solo para esos archivos.
      environment: 'node',
      include: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'api/**/*.test.ts',
        'contracts/**/*.test.ts',
      ],
      setupFiles: ['src/test/setup.ts'],
      restoreMocks: true,
      // La zona horaria se fija a UTC a propósito. Sin esto, la suite hereda la
      // del equipo: en Madrid pasarían tests que en la CI, que corre en UTC,
      // fallarían. Con la zona fijada, cualquier dependencia accidental del reloj
      // local falla en todas partes o en ninguna.
      env: { TZ: 'UTC' },
    },
  };
});
