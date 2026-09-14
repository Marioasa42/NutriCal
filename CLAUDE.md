# Proyecto: seguimiento nutricional (PWA) (NutriCal)

## Contexto sobre mí
Soy desarrollador junior. Vengo de PHP, Laravel y JavaScript vanilla. TypeScript y
React son nuevos para mí. Este proyecto es para mi portfolio: tendré que defender
cada decisión técnica en una entrevista, así que necesito entender el código, no
solo tenerlo funcionando.

## Qué construimos
Una PWA para registrar comidas y ejercicio, con seguimiento de calorías,
macronutrientes y micronutrientes (minerales y vitaminas). Funciona sin conexión
y sin necesidad de crear cuenta. Los objetivos diarios son totalmente editables
por el usuario, a diferencia de las apps que los bloquean tras una suscripción.

## Stack
- Vite + React + TypeScript en modo estricto
- TanStack Query (datos del servidor), Zustand o useReducer (estado de UI)
- Zod (validación de respuestas de API), React Hook Form (formularios)
- Dexie.js sobre IndexedDB (persistencia local)
- Recharts (gráficas), Tailwind CSS (estilos)
- Vitest + React Testing Library, Playwright (un flujo completo al final)
- Despliegue en Vercel; Supabase (Auth + Postgres) solo desde la fase 4

## Fuentes de datos
- Open Food Facts: gratuita, sin clave, búsqueda por texto y por código de barras.
  Datos incompletos e inconsistentes; hay que normalizarlos.
- USDA FoodData Central: requiere clave, para micronutrientes. La clave va SIEMPRE
  en una función serverless de Vercel, nunca en el frontend.
- Valores de referencia diarios: de fuentes oficiales (EFSA para Europa, NIH ODS).
  Van en un archivo de configuración con su fuente citada, y son editables.

## Decisiones de arquitectura NO NEGOCIABLES
Están razonadas. Si crees que alguna es un error, dímelo y discutámoslo antes de
cambiarla, pero no las cambies por tu cuenta.

1. **Unidades canónicas**: internamente todo en gramos y kilocalorías. La conversión
   ocurre solo en la capa de presentación. Usa tipos con marca (branded types) para
   que el compilador impida mezclar gramos con kilocalorías.
2. **Instantánea de nutrientes**: al registrar una comida se copian los valores
   nutricionales en el propio registro. Nunca se guarda solo una referencia al
   producto externo, porque si la fuente corrige sus datos cambiaría mi historial.
3. **Fechas locales**: un "día" es una cadena `YYYY-MM-DD` calculada en la zona
   horaria del usuario. Nunca un instante UTC.
4. **IDs generados en el cliente**: UUID v4, nunca autoincrementales, para que la
   sincronización de la fase 4 sea posible.
5. **Local primero**: la app funciona entera sin backend y sin cuenta. Supabase solo
   entra en la fase 4 y solo para sincronizar entre dispositivos. El modo local
   sigue siendo el predeterminado después.
6. **Sin cuenta obligatoria**: nadie debe crear una cuenta para usar la app. Es
   requisito de producto (es una demo de portfolio) y el argumento diferencial
   frente a las apps de suscripción.
7. **Degradación elegante**: toda API del navegador que no esté en todos los
   sitios (cámara, BarcodeDetector) necesita alternativa. El escaneo de códigos
   siempre debe poder hacerse tecleando el código a mano.

## Requisitos de seguridad y salud
- Aviso visible de que la app no es consejo médico.
- Límite inferior razonable en los objetivos de calorías; sin rachas, insignias ni
  recompensas que premien comer menos. Nada que refuerce conductas restrictivas.
- Cuando llegue Supabase: Row Level Security activada en todas las tablas y
  verificada con un test antes de dar la fase por terminada.
- Ninguna clave de API en el cliente. Ningún secreto en el repositorio.
- **Nunca accedas a almacenes de secretos.** No leas ni uses credenciales del
  gestor de credenciales de git, del llavero del sistema, de variables de entorno
  con secretos, de archivos de configuración de herramientas ni de ningún otro
  almacén, aunque falte una herramienta y el uso parezca inofensivo. El motivo es
  el alcance: un token guardado suele servir para todas mis cuentas y repositorios,
  no solo para el que tenemos delante, y quiero que cada permiso sea explícito y
  no heredado. Si te falta una herramienta o un permiso para completar una tarea,
  dilo y detente ahí. Usar una herramienta ya autenticada, como `gh`, sí está
  bien: lo prohibido es leer o manejar el secreto.

## Convenciones de git
- **Nombre de rama**: `fase-<n>/paso-<n><letra opcional>-<descripcion-corta>`, en
  español, en minúsculas y separado por guiones. Ejemplo:
  `fase-1/paso-3-escalado-y-totales`.
- El trabajo que no pertenece a un paso concreto usa `fase-<n>/<descripcion-corta>`.
- En el nombre de la rama no van acentos ni eñes, para no depender de la
  codificación del terminal. En el resto del texto sí.
- Las ramas antiguas en inglés (`feat/phase-1-...`) se quedan como están. No se
  reescribe el historial ya fusionado.
- Cada pull request tiene como base `main`, y `main` tiene que estar
  actualizado antes de crear la rama. **Nunca encadenes ramas** (una rama
  creada sobre otra rama sin fusionar, en vez de sobre `main`), ni siquiera
  para un paso que depende del anterior. Si un paso depende de otro que
  todavía no está fusionado, dímelo y decido si lo fusiono antes de que
  empieces o si esperamos. El motivo no es de estilo: cuando un PR se fusiona
  con "squash and merge", el commit que llega a `main` tiene un hash distinto
  del commit original de esa rama, así que una rama hija que arrastrara ese
  commit original ya no comparte historia real con el nuevo `main`. La
  primera fusión, o el primer intento de traer `main` a esa rama, puede
  entonces marcar como conflicto algo que en realidad ya estaba resuelto, y
  cualquier resolución a mano en ese punto arriesga con duplicar bloques de
  código enteros en vez de sustituirlos. Es justo lo que ocurrió el
  2026-09-14 con las ramas apiladas de la fase 2: más de una hora perdida
  arreglando en tres pull requests distintos un conflicto que no era real,
  solo apariencia de conflicto por historias divergentes.

## Fases (no adelantes trabajo de fases futuras)
0. Preparación: proyecto, linter, tests, CI, tipos del dominio, deploy vacío.
1. Núcleo: búsqueda en Open Food Facts, registro diario, calorías y macros, Dexie.
2. Micronutrientes: USDA vía serverless, panel con gráficas, objetivos editables.
3. PWA: service worker, offline, escaneo de códigos, export/import JSON.
4. Cuentas: Supabase Auth (Google + enlace mágico), sincronización, RLS.
5. Cierre: ejercicio con valores MET, recetas, Playwright, accesibilidad, README.

## Cómo quiero que trabajes
- **Una fase a la vez.** No escribas código de fases posteriores ni "por si acaso".
- **Explica antes de escribir.** Para cada tarea no trivial: primero el enfoque y
  las alternativas descartadas (en 3 o 4 líneas), y solo entonces el código.
- **Enséñame TypeScript.** Cuando uses algo que un principiante no conocería
  (uniones discriminadas, genéricos, `satisfies`, tipos con marca), explícalo en
  una frase. No lo des por sabido.
- **Cambios pequeños y revisables.** Prefiero varios pasos que pueda leer a un
  volcado de 500 líneas. Para cambios grandes, propón el plan y espera mi visto bueno.
- **Tests donde importan**: escalado de porciones, suma de nutrientes, conversión de
  unidades y cálculo de fechas. No tests de componentes de UI por sistema.
- **Pregunta si algo es ambiguo** en lugar de elegir por mí y seguir.
- **Nada de dependencias nuevas sin justificarlo.** Si una librería añade poco sobre
  lo que ya hay, dilo.
- **Registra decisiones.** Al terminar cada tarea relevante, añade una entrada breve
  a `DECISIONS.md`: qué decidí, por qué y qué alternativa descarté. Lo usaré para
  el README y para preparar entrevistas.
- Español para explicaciones y comentarios; inglés para nombres de código.