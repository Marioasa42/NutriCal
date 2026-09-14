# NutriCal

Aplicación web progresiva para registrar comidas y ejercicio, con seguimiento de
calorías, macronutrientes y micronutrientes. Funciona sin conexión y sin necesidad
de crear una cuenta. Los objetivos diarios son totalmente editables.

**Demo:** https://nutri-cal-git-main-marioasa42-8732.vercel.app/

> **Esto no es consejo médico.** NutriCal es una herramienta de registro personal.
> No sustituye la valoración de un profesional sanitario.

## Estado

Fase 1 completada: ya se puede buscar un alimento en Open Food Facts por nombre
o por código de barras, registrarlo en un día con su porción, editarlo, borrarlo
y ver los totales del día en calorías y macronutrientes. Todo se guarda en el
propio dispositivo, sin cuenta y sin servidor.

Los micronutrientes, los objetivos editables y el funcionamiento sin conexión
llegan en las fases 2 y 3. El plan por fases está en `CLAUDE.md` y las
decisiones técnicas, con sus alternativas descartadas, en `DECISIONS.md`.

Hay un botón para cargar datos de ejemplo en cualquier día, porque cada
previsualización vive en su propio origen y arranca con la base de datos vacía.
Los datos de ejemplo se cargan y se borran a mano: nunca se mezclan con los
tuyos sin que lo pidas.

## Puesta en marcha

Necesitas Node 24 o superior.

```bash
npm install
npm run dev
```

`npm run dev` sirve el frontend **y** las funciones de `api/` en el mismo
servidor y el mismo puerto: no hace falta `vercel dev`, ni un segundo proceso,
ni una cuenta de Vercel para poder buscar un alimento en local. Un plugin de
Vite (`vite.config.ts`) intercepta las peticiones a `/api/*`, localiza el
archivo de `api/` que le corresponde y llama a su función `GET` con un objeto
`Request` de verdad, tal y como haría Vercel en producción. Los detalles y las
alternativas descartadas están en `DECISIONS.md`, entrada D-051.

Para que las búsquedas de micronutrientes (USDA FoodData Central) funcionen en
local, copia `.env.example` a `.env.local` y rellena `USDA_API_KEY` con una
clave gratuita de https://fdc.nal.usda.gov/api-key-signup. Sin ella, esas
búsquedas fallan con un error controlado en lugar de un fallo confuso; Open
Food Facts no necesita clave y funciona sin este paso.

## Scripts

| Script                 | Qué hace                                              |
| ---------------------- | ----------------------------------------------------- |
| `npm run dev`          | Servidor de desarrollo con recarga en caliente.        |
| `npm run build`        | Comprueba tipos y genera la versión de producción.     |
| `npm run preview`      | Sirve en local lo que se generó con `build`.           |
| `npm run typecheck`    | Solo la comprobación de tipos.                         |
| `npm run lint`         | ESLint con reglas basadas en información de tipos.     |
| `npm run format`       | Aplica Prettier a todo el proyecto.                    |
| `npm run format:check` | Comprueba el formato sin modificar archivos.           |
| `npm test`             | Ejecuta la batería de tests una vez.                   |
| `npm run test:watch`   | Tests en modo continuo mientras programas.             |

La integración continua ejecuta estos cinco pasos en cada push y cada pull
request: formato, lint, tipos, tests y build.

## TypeScript en modo estricto

Además de `strict`, el proyecto activa dos opciones que no vienen de serie y que
cambian bastante cómo se escribe el código.

**`noUncheckedIndexedAccess`.** Sin ella, acceder a una posición de un array
devuelve el tipo del elemento y TypeScript te deja usarlo directamente, aunque esa
posición no exista. Con ella, `alimentos[0]` pasa a ser `Food | undefined` y tienes
que comprobarlo antes de usarlo. Es exactamente el fallo que aparece cuando una
búsqueda no devuelve resultados y el código asume que sí.

**`exactOptionalPropertyTypes`.** Sin ella, una propiedad declarada como
`sugars?: Grams` admite dos cosas distintas: que la clave no esté, o que esté
valiendo `undefined`. Con ella, solo admite la primera. Esto importa aquí más de lo
normal porque el proyecto usa la ausencia de una clave para decir "la fuente no
aporta este dato", y necesita que esa señal sea inequívoca. Ver `DECISIONS.md`,
entrada D-001.

## Estructura de carpetas

La organización es por dominio, no por tipo de archivo. No hay una carpeta
`components` ni una carpeta `hooks` con todo dentro.

```
src/
  domain/        Tipos y reglas puras. No importa React, ni red, ni base de datos.
    brand.ts       Mecanismo de los tipos con marca.
    units/         Gramos, mililitros, kilocalorías, miligramos, microgramos, minutos.
    identity/      Identificadores UUID, uno por entidad.
    time/          Fecha local YYYY-MM-DD e instante absoluto.
    nutrition/     Macronutrientes y catálogo de micronutrientes.
    food/          Alimento, porciones, origen del dato, borrador incompleto.
    diary/         Registro de comida, registro de ejercicio, resumen del día.
    goals/         Objetivos diarios versionados.
    profile/       Perfil, datos corporales, preferencias de presentación.
    persistence/   Campos comunes de toda entidad guardada, incluida la lápida.
    transfer/      Formato del archivo de exportación.
  features/      Un caso de uso por carpeta, con su interfaz, su estado y sus datos.
    food-search/   Buscar por nombre o por código, y completar lo que la fuente no aporta.
    diary/         Registrar, editar y borrar, y los totales del día.
  data/          Dexie y repositorios. Envuelve y desenvuelve las entidades.
  shared/        Lo que no tiene un dueño claro: componentes y utilidades comunes.
  app/           Arranque, rutas, providers y layout.

api/             Funciones serverless de Vercel. Proyecto de TypeScript aparte.
  _lib/          Lógica probable: URLs, caché, límite de ritmo, handlers.
  off/           Rutas públicas: búsqueda y producto de Open Food Facts.

contracts/       Las reglas que el navegador y el servidor cumplen igual, una sola vez.
```

`contracts/` no es un cajón de utilidades compartidas: solo entra aquí lo que,
si se separase en dos copias, rompería el trato entre las dos puntas. Hoy son
dos archivos, la validación del código de barras y la normalización del texto de
búsqueda. Ver `DECISIONS.md`, entradas D-031 y D-033.

La carpeta `api` no importa nada de `src`. Es otro desplegable, con otro entorno
de ejecución y su propio `tsconfig`. El intermediario existe porque Open Food
Facts exige una cabecera de identificación que el navegador no deja fijar, y
porque su límite de peticiones es por dirección IP y en Vercel esa dirección se
comparte. Ver `DECISIONS.md`, entrada D-013.

El motivo es que el trabajo llega por funcionalidad, no por tipo de archivo.
Añadir el escaneo de códigos de barras toca una carpeta, no cinco repartidas por
el árbol. Y mantener `domain` sin dependencias de React ni de entrada y salida
significa que las reglas de negocio se prueban sin montar nada y sobreviven
intactas a un cambio de interfaz o de almacenamiento.

## Tests

Vitest, con foco en lo que de verdad puede dar un resultado incorrecto sin que se
note: conversión de unidades, cálculo de fechas locales, escalado de porciones y
suma de nutrientes. No se prueban componentes de interfaz por sistema.

El caso más ilustrativo está en `src/domain/time/local-date.test.ts`: el mismo
instante es un día distinto según la zona horaria, y por eso un día del diario es
una cadena local y nunca un instante UTC.

## Decisiones que conviene conocer antes de leer el código

1. **Unidades canónicas con tipos con marca.** Internamente todo va en gramos y
   kilocalorías, y el compilador impide mezclarlas. La conversión a otras unidades
   ocurre solo al pintar.
2. **Instantánea de nutrientes.** Al registrar una comida se copian sus valores
   nutricionales dentro del registro. Si la fuente externa corrige sus datos, tu
   historial no cambia.
3. **Fechas locales.** Un día es `YYYY-MM-DD` en tu zona horaria, nunca un instante
   UTC.
4. **Identificadores generados en el cliente.** UUID v4, para que la sincronización
   entre dispositivos sea posible sin un servidor que reparta números.
5. **Local primero y sin cuenta obligatoria.** La aplicación funciona entera sin
   backend. Las cuentas llegan en la fase 4 y solo para sincronizar.

El razonamiento completo de cada una, con las alternativas descartadas, está en
`DECISIONS.md`.

## Fuentes de datos

- **Open Food Facts.** Gratuita y sin clave. Búsqueda por texto y por código de
  barras. Sus datos son incompletos e inconsistentes, así que se normalizan al
  entrar.
- **USDA FoodData Central.** Para micronutrientes. Requiere clave, que vive siempre
  en una función serverless y nunca en el navegador.
- **Valores de referencia diarios.** De fuentes oficiales europeas y
  estadounidenses, citadas en el archivo de configuración y editables.

## Licencia

Proyecto personal de portfolio.
