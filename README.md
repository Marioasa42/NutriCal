# NutriCal

Aplicación web progresiva para registrar comidas y ejercicio, con seguimiento de
calorías, macronutrientes y micronutrientes. Funciona sin conexión y sin necesidad
de crear una cuenta. Los objetivos diarios son totalmente editables.

> **Esto no es consejo médico.** NutriCal es una herramienta de registro personal.
> No sustituye la valoración de un profesional sanitario.

## Estado

Fase 0 completada: preparación del proyecto, tipos del dominio y verificación
automática. Todavía no hay funcionalidad de usuario. El plan por fases está en
`CLAUDE.md` y las decisiones técnicas en `DECISIONS.md`.

## Puesta en marcha

Necesitas Node 24 o superior.

```bash
npm install
npm run dev
```

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
  shared/        Lo que no tiene un dueño claro: componentes y utilidades comunes.
  app/           Arranque, rutas, providers y layout.
```

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
