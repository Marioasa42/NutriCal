# Registro de decisiones

Cada entrada documenta una decisión técnica relevante: qué se decidió, por qué, y
qué alternativa se descartó. Sirve de material para el README y para preparar
entrevistas. Las entradas no se reescriben: si una decisión cambia, se añade una
nueva y la anterior pasa a estado `sustituida por D-XXX`.

## Formato

```
## D-XXX Título en una línea
- **Fecha**: YYYY-MM-DD
- **Fase**: número de fase del proyecto
- **Estado**: propuesta | aceptada | sustituida por D-XXX
- **Contexto**: el problema concreto, en una o dos frases.
- **Decisión**: qué se hace.
- **Por qué**: el motivo que la sostiene.
- **Alternativa descartada**: qué más se consideró y por qué no.
- **Consecuencias**: lo que esto obliga a hacer o impide más adelante. Opcional.
```

---

## D-001 Un nutriente desconocido se representa con la clave ausente, no con `null`
- **Fecha**: 2026-09-12
- **Fase**: 0
- **Estado**: aceptada
- **Contexto**: Open Food Facts devuelve productos con nutrientes que faltan. "No
  se sabe" es un estado distinto de "vale cero" y hay que poder distinguirlos.
- **Decisión**: los nutrientes no obligatorios son propiedades opcionales. Si la
  clave falta, el dato es desconocido. Si la clave está, el valor es real. Nunca
  se escribe `undefined` de forma explícita.
- **Por qué**: con `exactOptionalPropertyTypes` activado, el compilador garantiza
  que no existan dos formas de decir lo mismo. Un cero deja de poder colarse como
  sustituto silencioso de un dato que no tenemos.
- **Alternativa descartada**: `Grams | null` para cada nutriente. Convive mal con
  las propiedades opcionales, deja dos representaciones del mismo estado y obliga
  a comprobar ambas en cada lectura.
- **Consecuencias**: los totales diarios de un nutriente deben informar de cuántos
  registros no aportaban ese dato, en vez de sumar como si fueran cero.

## D-002 `Macros` mantiene un núcleo obligatorio; lo que falta se completa a mano y deja constancia
- **Fecha**: 2026-09-12
- **Fase**: 0
- **Estado**: aceptada
- **Contexto**: energía, proteínas, hidratos y grasas son obligatorios en `Macros`,
  así que un producto incompleto no puede convertirse en `Food`. Pero rechazar sin
  más un código de barras válido es mal producto.
- **Decisión**: la normalización no lanza excepciones, devuelve una unión
  discriminada `NormalizationResult` con dos ramas: `complete` con el `Food`, o
  `needsCompletion` con un `FoodDraft` que lleva `Partial<Macros>` y la lista de
  claves que faltan. La interfaz pide esos campos a la persona usuaria. El `Food`
  resultante guarda un `NutrientCompletion` con las claves que rellenó a mano, y
  `FoodSnapshot` lo copia, de modo que la interfaz puede marcar esas cifras como
  estimaciones incluso meses después.
- **Por qué**: separa dos ejes que no son el mismo: el origen del registro, que
  sigue siendo `openFoodFacts`, y la autoría de cada cifra concreta. `Macros`
  queda estricto y los consumidores no heredan comprobaciones extra.
- **Alternativa descartada**: (a) hacer opcionales las cuatro macros del núcleo,
  que traslada el problema a toda la aplicación y vuelve poco fiables los totales;
  (b) envolver cada cifra en un objeto con valor y procedencia, que contamina toda
  la aritmética y anula la ergonomía de los tipos con marca; (c) guardar macros de
  fuente y macros de usuario en paralelo y fusionarlas al leer, que repite un
  cálculo en cada lectura y reintroduce dos fuentes de verdad; (d) un booleano de
  "completado a mano", sin granularidad para señalar qué número es estimado.

## D-003 El registro de comida guarda la instantánea y la porción, no los totales escalados
- **Fecha**: 2026-09-12
- **Fase**: 0
- **Estado**: aceptada
- **Contexto**: la decisión 2 de CLAUDE.md exige que el historial no dependa de la
  fuente externa. Quedaba elegir qué se copia exactamente en el registro.
- **Decisión**: `MealEntry` guarda un `FoodSnapshot` con el perfil nutricional por
  cien unidades base y una `ResolvedPortion`. Los totales los calcula una función
  pura, cubierta con tests.
- **Por qué**: cumple el aislamiento de la fuente externa igual de bien y evita
  mantener dos copias del mismo dato que puedan divergir tras un cambio en la
  fórmula de escalado.
- **Alternativa descartada**: guardar también los totales ya escalados. Consultar
  el día sería más rápido, pero duplica la verdad y un error de escalado quedaría
  congelado en los registros antiguos sin posibilidad de corregirlo.

## D-004 Los objetivos diarios se versionan por fecha de entrada en vigor
- **Fecha**: 2026-09-12
- **Fase**: 0
- **Estado**: aceptada
- **Contexto**: si los objetivos son un único registro mutable, subir hoy el
  objetivo de calorías reescribe si cumpliste o no en marzo.
- **Decisión**: `DailyGoals` lleva `effectiveFrom: LocalDate`. El objetivo de un
  día es el registro vigente más reciente cuya fecha de entrada en vigor sea menor
  o igual a ese día.
- **Por qué**: es barato ahora y caro después. Añadir historial una vez hay datos
  reales obliga a inventar retroactivamente desde cuándo valía cada objetivo.
- **Alternativa descartada**: un único registro mutable de objetivos. Más simple,
  pero falsea el historial y haría inútiles las gráficas de cumplimiento.

## D-005 La coherencia entre unidad base y porciones se cierra con una unión discriminada
- **Fecha**: 2026-09-12
- **Fase**: 0
- **Estado**: aceptada
- **Contexto**: con `Quantity = Grams | Milliliters` se podía construir un
  alimento con unidad base en mililitros y porciones en gramos, y compilaba.
- **Decisión**: `Food` es la unión de `MassFood` y `VolumeFood`, discriminadas por
  `baseUnit`, sobre una base común. `ServingOption<Q extends Quantity>` es
  genérico en la cantidad. `MealEntry` usa el mismo patrón para emparejar la
  instantánea con su porción.
- **Por qué**: el estrechamiento por el campo discriminante es idiomático y legible,
  no propaga parámetros genéricos a todas las firmas, produce errores de compilador
  comprensibles y encaja con `z.discriminatedUnion` y con Dexie sin ceremonia.
- **Alternativa descartada**: `Food<U extends BaseUnit>` con un tipo condicional.
  Es más preciso sobre el papel, pero el parámetro genérico se propaga a toda
  función, esquema y componente, y para hablar de "un alimento cualquiera" hace
  falta igualmente la unión, porque `Food<BaseUnit>` distribuye el condicional y
  vuelve a admitir la mezcla. Se paga el coste de los genéricos sin quitar la unión.
- **Consecuencias**: añadir una tercera unidad base obliga a añadir una rama.
  Es aceptable: no hay una tercera unidad prevista.

## D-006 Todas las entidades persistidas llevan lápida de borrado
- **Fecha**: 2026-09-12
- **Fase**: 0
- **Estado**: aceptada
- **Contexto**: sin marca de borrado, la sincronización de la fase 4 no puede
  distinguir un registro que nunca existió en un dispositivo de uno que se borró,
  y los registros eliminados resucitarían al sincronizar.
- **Decisión**: una base `Persisted` aporta `createdAt`, `updatedAt` y
  `deletedAt?: Instant`. Borrar es escribir `deletedAt`. Toda consulta del
  repositorio excluye los registros con lápida salvo que pida explícitamente
  incluirlos. La exportación sí las incluye, para que el borrado se propague.
- **Por qué**: el borrado pasa a ser un hecho con fecha, replicable y ordenable,
  en lugar de una ausencia que no se puede transmitir.
- **Alternativa descartada**: borrado físico de la fila, con una tabla aparte de
  borrados pendientes. Duplica la lógica de acceso a datos y deja una ventana en
  la que la fila ya no está pero el borrado todavía no se ha registrado.
- **Consecuencias**: IndexedDB no indexa claves ausentes, así que en la fase 1 el
  filtro de lápidas irá en el predicado de la consulta y no en un índice. Si el
  rendimiento lo pide, se revisará con un índice compuesto y un valor centinela.

## D-007 La exportación JSON lleva envoltorio con `schemaVersion` propio
- **Fecha**: 2026-09-12
- **Fase**: 0
- **Estado**: aceptada
- **Contexto**: un archivo exportado hoy debe poder importarse dentro de un año,
  cuando el modelo haya cambiado.
- **Decisión**: el archivo es un `ExportEnvelope` con `schemaVersion`,
  `exportedAt`, `appVersion` y los datos dentro de `data`. La constante
  `EXPORT_SCHEMA_VERSION` es independiente del número de versión de Dexie. La
  importación valida con Zod y aplica una cadena de migraciones de versión n a n+1.
- **Por qué**: la versión de Dexie describe la forma del almacén local y cambia por
  motivos internos como añadir un índice. La versión del archivo es un contrato
  con el exterior. Atarlas obligaría a subir el formato del archivo cada vez que
  se toca un índice.
- **Alternativa descartada**: reutilizar la versión de Dexie como versión del
  archivo. Menos conceptos, pero acopla un detalle de almacenamiento a un formato
  público y rompe la compatibilidad de los archivos sin motivo real.

## D-008 Los minutos también son un tipo con marca
- **Fecha**: 2026-09-12
- **Fase**: 0
- **Estado**: aceptada
- **Contexto**: `durationMinutes: number` en el registro de ejercicio rompía la
  coherencia con el resto de magnitudes del dominio.
- **Decisión**: existe `Minutes = Brand<number, 'Minutes'>` y el registro de
  ejercicio lo usa.
- **Por qué**: el cálculo por MET de la fase 5 multiplica minutos por peso y por
  un coeficiente. Que los minutos sean un tipo distinto impide pasar segundos o
  kilocalorías por error en esa fórmula.
- **Alternativa descartada**: dejarlo como `number`. Sería una excepción sin motivo
  en un dominio donde todas las demás magnitudes van marcadas.

## D-009 npm como gestor de paquetes y Tailwind desde la fase 0
- **Fecha**: 2026-09-12
- **Fase**: 0
- **Estado**: aceptada
- **Decisión**: npm con su lockfile, y Tailwind CSS instalado ya en la fase 0
  aunque todavía no haya pantallas.
- **Por qué**: npm viene con Node, el cacheo en GitHub Actions es una línea y hay
  una herramienta menos que justificar. Tailwind es infraestructura de proyecto:
  configurarlo con la aplicación vacía evita tocar la configuración base cuando ya
  existan pantallas reales.
- **Alternativa descartada**: pnpm, más rápido y con menos consumo de disco, pero
  añade un paso de instalación en CI sin resolver ningún problema que tengamos hoy.

## D-010 React Router desde la fase 1, con el día del diario en la URL
- **Fecha**: 2026-09-12
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: la aplicación podría empezar con una sola vista y estado local
  para decidir qué se muestra.
- **Decisión**: se usa React Router desde el principio y el día del diario forma
  parte de la ruta, por ejemplo `/dia/2026-09-13`.
- **Por qué**: el día es el estado principal de la aplicación y pertenece a la
  URL. Así funciona el botón de atrás, se puede guardar un día en marcadores o
  compartirlo, y la fase 3 encuentra las rutas ya definidas cuando haya que
  decidir qué se guarda en caché sin conexión.
- **Alternativa descartada**: una vista única con estado local. Menos piezas hoy,
  pero obliga a reestructurar la navegación justo cuando llegue la PWA, que es el
  peor momento para tocarla.

## D-011 `useReducer` con contexto para el estado de interfaz, no Zustand
- **Fecha**: 2026-09-12
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: los datos que vienen de fuera los gestiona TanStack Query. Queda
  el estado propio de la interfaz, que en la fase 1 es poco: el diálogo abierto,
  el texto de búsqueda y el registro que se está editando.
- **Decisión**: `useReducer` con contexto de React. Sin dependencia externa.
- **Por qué**: una librería de estado global resuelve problemas que todavía no
  tenemos. Añadirla ahora sería difícil de defender en una entrevista.
- **Alternativa descartada**: Zustand desde el principio, que evita un cambio
  posterior y se maneja mejor cuando el estado crece.
- **Consecuencias**: criterio explícito para cambiar de idea, para no quedar
  atrapado en la decisión. Si aparece estado de interfaz compartido por ramas
  distintas del árbol de componentes, o si el contexto provoca renderizados
  medibles en las gráficas, se migra a Zustand y se añade una decisión nueva.

## D-012 La búsqueda por código de barras tecleado se adelanta a la fase 1
- **Fecha**: 2026-09-12
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: el plan situaba el escaneo de códigos en la fase 3, pero teclear
  un código a mano no es escanear.
- **Decisión**: la fase 1 incluye buscar por código de barras escrito. La fase 3
  añade solo la cámara y la detección automática.
- **Por qué**: es la misma API y una consulta más simple que la búsqueda por
  texto. Además, el requisito de degradación elegante exige que siempre se pueda
  teclear el código: si esa vía es la alternativa cuando no hay cámara, conviene
  que sea la primera que existe y no la última.
- **Alternativa descartada**: dejarlo todo para la fase 3, más fiel al plan
  escrito, pero deja sin probar hasta el final el camino que debe funcionar
  siempre.

## D-013 Open Food Facts se consulta a través de una función serverless propia
- **Fecha**: 2026-09-12
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: sus condiciones de uso exigen una cabecera `User-Agent`
  identificativa con nombre de aplicación, versión y contacto, y el navegador no
  permite fijar esa cabecera desde JavaScript. Además el límite de búsqueda es de
  diez peticiones por minuto y por dirección IP, con aviso explícito de no usarlo
  para buscar mientras se teclea. En Vercel la IP es compartida, así que un abuso
  afectaría a terceros.
- **Decisión**: dos funciones serverless, `/api/off/search` y
  `/api/off/product/[barcode]`, son el único punto que habla con Open Food Facts.
  Añaden el `User-Agent` correcto, normalizan la clave de caché, piden solo los
  campos necesarios y devuelven cabeceras de caché para que la red de
  distribución de Vercel guarde la respuesta. El frontend habla solo con esta API,
  con espera de 400 ms tras dejar de teclear, cancelación de la petición anterior
  y un mínimo de tres caracteres. Todo alimento consultado se guarda en Dexie y la
  búsqueda mira primero en local.
- **Por qué**: la caché vive delante de la función, no dentro, porque una función
  serverless no conserva estado entre invocaciones. Indexada por URL en la red de
  distribución, la respuesta se comparte entre todos los visitantes, de modo que
  la segunda consulta del mismo producto ni siquiera ejecuta nuestro código.
  `stale-while-revalidate` sirve la copia anterior mientras se refresca. Y es la
  misma capa que la fase 2 necesitará para esconder la clave de USDA, así que
  montarla ahora no es trabajo adelantado, es no montarla dos veces.
- **Alternativa descartada**: (a) llamar a Open Food Facts desde el navegador, que
  incumple sus condiciones y arriesga el bloqueo de una IP compartida; (b) un mapa
  en memoria dentro de la función como caché principal, que muere al enfriarse la
  instancia y no se comparte entre instancias; (c) cachear solo en Dexie, que
  protege un dispositivo pero no la dirección IP común a todos los visitantes;
  (d) Redis o un almacén de clave y valor desde el primer día, que funciona pero
  añade servicio, secreto y latencia para hacer peor lo que la red de distribución
  ya hace; (e) empaquetar una copia estática del catálogo, demasiado pesada y
  condenada a envejecer.
- **Consecuencias**: el límite de ritmo propio será de mejor esfuerzo, con un
  contador en memoria por instancia caliente, y devolverá el código de estado de
  demasiadas peticiones con cabecera de reintento. No es un límite global exacto.
  Si el tráfico lo justificara, la vía es un contador de ventana deslizante en un
  almacén compartido, y se registrará como decisión propia en ese momento.

## D-014 Campos de almacenamiento derivados: `isDeleted` y `searchText`
- **Fecha**: 2026-09-12
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: IndexedDB no indexa los registros cuya clave de índice está
  ausente. Como una entidad viva no tiene `deletedAt`, un índice sobre ese campo
  dejaría fuera justo los registros que siempre queremos consultar. La primera
  versión del repositorio resolvía el filtro en memoria tras la lectura: el
  índice por fecha sí acotaba a un día, pero de ese día se leían también las
  filas con lápida, y las consultas que recorren la tabla entera, como el listado
  de alimentos o las versiones de objetivos, leían todo. Además el texto de
  búsqueda se normalizaba en cada consulta y por cada fila.
- **Decisión**: la capa de datos envuelve cada entidad antes de escribirla en un
  tipo `Stored<T>` que añade `isDeleted` con valor 0 o 1, siempre presente y
  derivado de `deletedAt` en un único punto. Los alimentos añaden además
  `searchText`, el nombre y la marca ya normalizados, calculado al escribir. Los
  índices de consulta empiezan todos por la bandera: `[isDeleted+date]`,
  `[isDeleted+date+slot]`, `[isDeleted+source.barcode]`,
  `[isDeleted+effectiveFrom]`. Al leer se desenvuelve, de modo que el dominio y
  el archivo de exportación nunca ven estos campos.
- **Por qué**: excluir lo borrado deja de ser un filtro posterior a la lectura y
  pasa a formar parte de la consulta, así que las filas con lápida ni se leen.
  Mantener la bandera fuera de `Persisted` evita contaminar el dominio con un
  detalle de almacenamiento, y derivarla en un solo sitio impide que la bandera y
  la fecha se contradigan. Se hace ahora, antes del primer despliegue, porque
  cambiar el esquema cuando ya hay datos cuesta una migración.
- **Alternativa descartada**: (a) guardar `deletedAt` con un valor centinela como
  cadena vacía en lugar de ausente, que rompe la regla de D-001 de que ausente
  significa desconocido y mete un valor falso en el dominio; (b) añadir
  `isDeleted` directamente a `Persisted`, que mezcla almacenamiento y dominio y
  crea dos fuentes de verdad sobre lo mismo; (c) mover las filas borradas a una
  tabla de papelera, que duplica la lógica de escritura y complica la
  exportación; (d) dejarlo con el filtro en memoria, aceptable hoy por volumen
  pero que se paga justo cuando ya no se puede cambiar barato.
- **Consecuencias**: la lectura por clave primaria sigue comprobando la bandera en
  memoria, porque devuelve una sola fila y no hay nada que un índice pueda
  ahorrar. Y el desenvoltorio usa una aserción de tipo, confinada a un solo
  archivo, porque quitar una propiedad de una unión discriminada no se expresa en
  el sistema de tipos sin repetir la unión entera.

## D-015 La versión del esquema de Dexie se congela al desplegar
- **Fecha**: 2026-09-12
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: el esquema de Dexie no es un archivo de configuración cualquiera.
  Describe la forma de una base de datos que vive en el navegador de otra
  persona, fuera de nuestro alcance, y que puede llevar meses sin abrirse.
- **Decisión**: desde el momento en que una versión del esquema llega a un
  despliegue que alguien puede abrir, esa declaración queda congelada y no se
  edita nunca más. Cualquier cambio posterior, incluido añadir un índice, exige
  una llamada nueva a `version(n + 1).stores(...)` con su `upgrade(...)` si hace
  falta transformar datos. Las declaraciones antiguas se quedan en el archivo
  para siempre, porque Dexie las necesita para saber cómo llevar una base de
  datos vieja hasta la actual. En la práctica el punto de congelación es la
  fusión a `main`, ya que las previsualizaciones viven en otro origen y por tanto
  en otra base de datos.
- **Por qué**: editar una versión ya publicada deja las instalaciones existentes
  con un esquema que la aplicación cree tener pero que en ese navegador nunca se
  aplicó. El fallo no aparece en desarrollo, donde uno borra la base y sigue, sino
  en el dispositivo de quien llevaba tiempo usando la aplicación, que es el peor
  sitio posible para descubrirlo.
- **Alternativa descartada**: borrar y recrear la base cuando cambia el esquema.
  Es trivial de implementar y destruye los datos de la persona usuaria, lo que en
  una aplicación local primero y sin cuenta significa destruirlos sin copia.
- **Consecuencias**: cada cambio de esquema necesita un test que abra una base de
  datos en la versión anterior, la migre y compruebe que los datos siguen ahí.

## D-016 El sembrado de datos de ejemplo se adelanta al paso 2 o 3 de la fase 1
- **Fecha**: 2026-09-12
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: el sembrado estaba planificado para el último paso de la fase 1,
  junto a la pantalla del día. Pero cada previsualización de Vercel vive en su
  propio origen, y como IndexedDB está aislada por origen, toda previsualización
  arranca con la base de datos vacía. Una pantalla vacía es lo primero que ve
  quien abre el enlace de un pull request o la demo del portfolio.
- **Decisión**: el sembrado llega en el paso 2 o 3, en cuanto exista un alimento
  que sembrar, con un botón para cargar los datos de ejemplo y otro para
  borrarlos. Los datos sembrados son entidades normales del dominio, con sus
  identificadores y sus lápidas, no un atajo que escriba directamente en las
  tablas.
- **Por qué**: adelantarlo no añade trabajo, solo lo reordena, y hace que cada
  previsualización se pueda enseñar con contenido en lugar de con una pantalla en
  blanco. Además obliga a que los repositorios sirvan para escribir de verdad
  desde el primer momento, lo que es una prueba de humo de la capa de datos.
- **Alternativa descartada**: dejarlo en el último paso, más fiel al plan pero
  con previsualizaciones vacías durante toda la fase; y precargar datos de
  ejemplo automáticamente al abrir la aplicación, que mezcla datos falsos con los
  de la persona usuaria sin que lo haya pedido.

## D-017 La comprobación de tipos cubre los dos proyectos, y las opciones viven en la raíz
- **Fecha**: 2026-09-12
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: el proyecto tiene dos compilaciones de TypeScript distintas, la
  aplicación del navegador y las funciones serverless. `tsconfig.json` seguía el
  patrón de solución: `files: []` más referencias, sin ninguna opción de
  compilación propia. Con esa forma, `tsc -b` compilaba las tres partes con sus
  opciones correctas y la integración continua daba verde, pero Vercel no conoce
  `tsconfig.api.json`: lee `tsconfig.json`, no encontraba opciones y caía en sus
  propios valores por defecto, con una biblioteca anterior a ES2022. El
  despliegue falló por `Array.prototype.at`, que en nuestra configuración existía
  sin problema. Dos comprobaciones de los mismos archivos con opciones distintas,
  y solo una se ejecutaba antes de desplegar.
- **Decisión**: las opciones de compilación de las funciones serverless viven en
  `tsconfig.json`, que es el archivo que leen las herramientas externas.
  `tsconfig.api.json` las hereda con `extends` y no declara ninguna propia salvo
  la ruta del archivo de caché. La integración continua ejecuta además un paso
  explícito `typecheck:api`, y un test de contrato comprueba que la raíz declare
  target y biblioteca de ES2022 o posterior, que mantenga el rigor del resto del
  proyecto y que el proyecto de la API no reintroduzca opciones propias.
- **Por qué**: el fallo no fue que faltara una comprobación, sino que había dos
  fuentes de verdad para la misma compilación. Con `extends`, lo que verifica la
  integración continua es literalmente lo mismo que compila Vercel, así que la
  divergencia deja de ser posible. El paso explícito cubre el otro agujero: si
  alguien quita la referencia de la raíz, `tsc -b` dejaría de mirar la carpeta
  `api` en silencio.
- **Alternativa descartada**: (a) evitar `Array.prototype.at` y usar indexación
  manual, que arregla este error concreto y deja el problema de fondo intacto
  para el siguiente método de ES2022 que se use; (b) duplicar las opciones en la
  raíz y en el proyecto de la API, que es justo la divergencia que causó el
  fallo; (c) convertir la aplicación en proyecto compuesto para que la raíz
  pudiera tener archivos propios y referencias a la vez, lo que obliga a emitir
  declaraciones en un proyecto que solo comprueba tipos.
- **Consecuencias**: cualquier opción nueva para las funciones serverless se
  añade en la raíz, nunca en `tsconfig.api.json`. Y toda comprobación que deba
  proteger un despliegue tiene que ejecutarse con la misma configuración que usa
  ese despliegue, no con una equivalente.

## D-018 Ausente, cero y basura son tres lecturas distintas en la frontera
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: la decisión D-001 dice cómo se representa un nutriente
  desconocido dentro del dominio, pero no quién decide si lo es. Esa decisión se
  toma al leer la respuesta de Open Food Facts, que para un mismo campo envía
  números, cadenas con coma decimal, cadenas vacías, nulos y ausencias. Y casi
  todas las formas cómodas de escribir esa lectura destruyen justo la distinción
  que hay que conservar: `valor || undefined` convierte un cero real en
  desconocido, `Number(valor) || 0` convierte un desconocido en cero, y
  `Number('')` vale cero, así que un campo que la fuente dejó en blanco se
  convierte en un cero perfectamente creíble.
- **Decisión**: una sola función, `parseNutrientValue`, devuelve una unión
  discriminada de tres ramas: `value` con el número, `absent` cuando la fuente no
  aporta el dato, y `unusable` cuando aporta algo que no es una medida. La
  conversión de cadena a número se hace comparando antes contra una expresión
  regular, nunca delegando en `Number`. Solo la rama `value` produce una magnitud
  del dominio; las otras dos omiten la clave.
- **Por qué**: el cero nunca pasa por una comprobación de veracidad, que es el
  único punto donde se pierde la diferencia. Tres ramas y no dos porque `"N/A"` y
  una clave ausente no son el mismo hecho: en el dominio acaban igual, pero
  separarlas permite demostrar con un test que el dato se descartó a propósito, y
  deja la puerta abierta a avisar de que la fuente traía basura en lugar de
  callar. Los tests lo fijan con productos reales: la Coca-Cola Zero trae cuatro
  ceros legítimos y ninguna clave de fibra, y el agua mineral trae exactamente lo
  contrario, fibra a cero y la sal ausente. No hay ninguna lista de nutrientes
  que falten siempre: se decide producto a producto.
- **Alternativa descartada**: (a) una función que devuelva `number | undefined`,
  que junta "no viene" con "viene mal" y no se puede probar por separado; (b)
  dejar que Zod ponga valores por defecto con `.default(0)`, que es literalmente
  la puerta por la que un desconocido se convierte en cero, y además silenciosa;
  (c) normalizar todo a `null` como hace la fuente, que reintroduce las dos
  representaciones del mismo estado que D-001 prohíbe.
- **Consecuencias**: cualquier fuente futura, USDA incluida en la fase 2, entra
  por este mismo lector o replica sus tres ramas. Y la energía se lee con la
  misma regla: `energy-kcal_100g: 0` gana sobre la clave de kilojulios porque
  cero es un valor, no una ausencia.

## D-019 Validación con dos rigores: estricta nuestra envoltura, permisiva la fuente
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: la respuesta que llega al navegador tiene dos capas con dueños
  distintos. La envoltura (`query`, `page`, `count`, `products`) la escribimos
  nosotros en `api/_lib/handlers.ts`. El producto que va dentro lo escribe Open
  Food Facts. Aplicarles el mismo rigor es equivocarse en una de las dos.
- **Decisión**: la envoltura se valida estricta con Zod y un desajuste lanza
  `malformed_response`. El producto se valida con un objeto abierto y campos
  tolerantes, y se valida uno a uno: un producto ilegible se aparta en un
  contador y los demás de la misma página siguen su camino. Ningún esquema del
  archivo usa `.default()`, `.catch()` ni coerción.
- **Por qué**: si la envoltura no cuadra, el error es nuestro y tiene que doler,
  porque nadie más lo va a encontrar. Si un producto no cuadra, el error es de la
  fuente y no debería costarle a quien busca los otros diecinueve resultados de
  la página. El aislamiento por producto es lo que convierte "OFF es
  inconsistente" en un problema acotado en vez de en una búsqueda rota.
- **Alternativa descartada**: (a) un solo esquema estricto para todo, donde un
  producto raro tumba la búsqueda entera; (b) un solo esquema permisivo para
  todo, que deja de detectar nuestros propios errores justo donde sí podemos
  arreglarlos; (c) validar a mano con guardias de tipo, que es el mismo trabajo
  escrito dos veces, una para el tipo y otra para la comprobación.
- **Consecuencias**: se añade Zod como dependencia. Se justifica porque la
  frontera con la red es el único sitio donde entra `unknown` en la aplicación y
  porque el mismo esquema sirve de tipo y de comprobación; si solo hiciera falta
  para un sitio, no entraría.

## D-020 La unidad base la decide el envase, no la tabla nutricional
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: hay que decidir si un alimento es `MassFood` o `VolumeFood`, y la
  fuente da señales que se contradicen. La Coca-Cola Zero declara
  `nutrition_data_per: "100g"`, se envasa en `"330ml"` y su `serving_quantity` de
  330 son mililitros.
- **Decisión**: manda el envase. Si `quantity` o `serving_size` indican volumen,
  el alimento es `VolumeFood`. `nutrition_data_per` se consulta solo como segunda
  señal, para los productos que no declaran envase. Ante la duda, gramos.
- **Por qué**: la unidad base describe el alimento, no la tabla. Lo que se envasa
  en mililitros es un líquido y sus porciones vienen en mililitros. Si ganara la
  tabla, ese producto quedaría declarado en gramos con una porción que en
  realidad son mililitros: exactamente la mezcla que la decisión D-005 existe
  para impedir, solo que colada por dentro en forma de número suelto en vez de
  por el sistema de tipos. La diferencia entre "por 100 g" y "por 100 ml" en una
  bebida son décimas por la densidad; la incoherencia entre la unidad base y sus
  porciones sería un error de verdad.
- **Alternativa descartada**: (a) hacer caso a `nutrition_data_per`, que es el
  campo que suena correcto y produce el alimento incoherente descrito arriba;
  (b) guardar la base declarada aparte y convertir al leer, que exige una
  densidad por producto que la fuente no da; (c) rechazar los productos cuyas
  señales se contradicen, que descartaría media estantería de bebidas.

## D-021 El cliente lanza un error tipado; un producto que no existe no es un error
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: el cliente puede fallar de siete maneras distintas, entre las
  cinco que ya nombran nuestras funciones serverless y las dos que solo existen
  en el navegador: quedarse sin red y recibir una respuesta que no cumple nuestro
  propio contrato.
- **Decisión**: una clase `OffApiError` con un campo `code`, que se lanza. Un
  código de barras que la fuente no conoce NO viaja por ahí: es un resultado
  normal, `{ kind: 'notFound' }`. Y una cancelación sube intacta, sin envolver.
- **Por qué**: es lo que TanStack Query espera de forma nativa en el paso
  siguiente, donde lo que se lanza acaba en `error` y lo que se devuelve acaba en
  `data`. Reutilizar los códigos de `api/_lib/http.ts` hace que el frontend y las
  funciones hablen el mismo vocabulario. La cancelación se deja pasar tal cual
  porque cancelar no es fallar: TanStack Query reconoce el `AbortError` por el
  nombre y envolverlo lo convertiría en un error de verdad, que además se
  reintentaría.
- **Alternativa descartada**: devolver una unión discriminada y no lanzar nunca.
  El compilador obligaría a tratar cada rama, que es tentador, pero habría que
  envolverla en un lanzador para que TanStack Query distinga éxito de fallo, y
  acabarían conviviendo las dos formas de decir lo mismo.
