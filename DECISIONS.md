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
- **Estado**: sustituida por D-039
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

## D-022 La unidad base la decide la primera señal del envase, sea de masa o de volumen
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: D-020 dejó escrito que manda el envase y que `nutrition_data_per`
  se consulta "solo como segunda señal, para los productos que no declaran
  envase". El código no decía eso. `readBaseUnit` buscaba únicamente volumen en el
  envase y, si no lo encontraba, miraba la tabla. Pero "el envase no dice
  volumen" y "el envase no dice nada" no son el mismo hecho: un sólido con
  `quantity: "500 g"` y `nutrition_data_per: "100ml"`, que es un error de
  transcripción corriente en la fuente, salía declarado en mililitros con una
  porción que el envase había dado en gramos. El daño es exactamente el que D-020
  existe para evitar, solo que en la dirección que nadie había probado.
- **Decisión**: se añade `MASS_IN_PACKAGE` junto a `VOLUME_IN_PACKAGE` y el envase
  se lee buscando las dos señales. Gana la primera que aparezca, mirando
  `quantity` antes que `serving_size`. La tabla declarada solo decide cuando el
  envase no aporta ninguna de las dos. Ante la duda, gramos, como antes.
- **Por qué**: la asimetría no era una decisión, era un descuido: la heurística se
  escribió mirando el caso de la Coca-Cola, donde el error de la fuente va de
  sólido declarado a líquido real, y nunca se probó el camino contrario. El
  arreglo no cambia D-020, la cumple. Y el caso es más grave que el original:
  cuando la incoherencia es "por 100 g" frente a "por 100 ml" en una bebida, la
  diferencia son décimas por la densidad; cuando el envase declara la porción en
  gramos y el alimento acaba en mililitros, el número de la porción es correcto y
  su unidad es mentira, y la instantánea de D-003 lo congela en el historial.
- **Alternativa descartada**: (a) dejar el código como estaba y escribir el test
  afirmando `'ml'`, que documenta como intencionado un comportamiento que
  contradice una decisión ya escrita; (b) comparar las dos señales y rechazar el
  producto cuando se contradicen, que es lo que D-020 ya descartó porque
  descartaría media estantería; (c) fiarse solo de `quantity` e ignorar
  `serving_size`, que perdería los productos que no declaran envase entero.
- **Consecuencias**: el orden de las alternativas dentro de cada expresión
  regular pasa a ser funcional, no estético: `gramos?` y `gr` van antes que `g`
  porque si no el límite de palabra choca con la letra siguiente y la señal se
  pierde. Hay un test que lo fija. Y el orden en que se miran `quantity` y
  `serving_size` también decide ahora, cosa que antes solo ocurría si uno de los
  dos hablaba de volumen; también tiene su test.

## D-023 El dominio no redondea; el redondeo es de presentación y ocurre una sola vez
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: escalar una porción produce decimales largos casi siempre. Media
  manzana son 91 g y eso da 47,32 kcal; un tercio de ración da 60,666... g. La
  tentación es redondear en el escalado, porque el número feo nace ahí.
- **Decisión**: ni el escalado ni la suma redondean. Los totales viajan con todos
  sus decimales y el redondeo se aplica en la capa de presentación, una sola vez,
  sobre la cifra que se va a enseñar.
- **Por qué**: redondear en el dominio hace que el total de un día dependa de en
  cuántos trozos se calculó. Tres registros de 33,3 kcal redondeados a 33 suman
  99; sin redondear suman 99,9 y se enseñan como 100. El segundo número es el
  correcto, y el primero además cambia si mañana se parte la comida en dos
  registros en vez de uno. Es la misma razón por la que las unidades canónicas
  viven en el dominio y la conversión vive en la presentación: el cálculo se hace
  con la cifra exacta y el formato se decide al final.
- **Alternativa descartada**: (a) redondear a dos decimales en el escalado, que
  parece inofensivo y mete el error de agrupación descrito arriba; (b) trabajar
  con enteros en centésimas, al estilo de los céntimos en dinero, que elimina el
  error de la coma flotante pero obliga a convertir en cada lectura y escritura y
  resuelve un problema que en nutrición no tenemos: aquí nadie cuadra un balance
  al céntimo, y una décima de gramo de fibra no le importa a nadie.
- **Consecuencias**: los tests del dominio comparan con `toBeCloseTo` cuando el
  resultado no es exacto en binario, y nunca con una cifra ya redondeada. Cuando
  llegue la interfaz habrá que decidir con cuántos decimales se enseña cada
  nutriente, y esa decisión se registrará aparte.

## D-024 Un nutriente que solo aportan algunos registros se suma igual, y el total viaja con el recuento
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: D-001 dejó dicho que los totales diarios deben informar de
  cuántos registros no aportaban cada nutriente, pero no qué se hace con la suma
  mientras tanto. Si dos de tus cinco comidas traen fibra, hay tres respuestas
  posibles: sumar las dos, no enseñar nada, o sumar tratando las otras tres como
  cero.
- **Decisión**: se suman las que hay, el resultado se devuelve, y junto a él va
  `unknown`, un recuento de cuántos registros no aportaban ese nutriente. Un
  nutriente que no aporta nadie se omite del total y aparece en el recuento con
  el número total de registros. Un cero declarado cuenta como dato conocido y no
  entra nunca en el recuento. Las cuatro macros obligatorias no pueden aparecer
  en `unknown`, porque `Macros` es estricto y ningún alimento llega a serlo sin
  ellas (D-002).
- **Por qué**: un mínimo conocido informa y una ausencia no. "Al menos 5 g de
  fibra, y dos comidas sin datos" es una frase útil; una casilla vacía no lo es,
  y "5 g de fibra" a secas es mentira. Sumar ceros por lo que falta es la única
  opción de las tres que produce un número indistinguible de un total completo,
  que es exactamente lo que D-001 existe para impedir.
- **Alternativa descartada**: (a) omitir el nutriente entero si algún registro no
  lo aporta, que en la práctica dejaría casi todos los micronutrientes en blanco,
  porque Open Food Facts rara vez los trae todos; (b) tratar la ausencia como
  cero, descrito arriba; (c) devolver por cada nutriente un objeto con el valor y
  su fiabilidad, que contamina toda la aritmética posterior, que es lo mismo que
  D-002 ya descartó para las macros.
- **Consecuencias**: `DayTotals.unknown` es un dato de primera, no un detalle: la
  interfaz de la fase 2, cuando dibuje el panel de micronutrientes, tiene que
  enseñarlo junto a cada barra o el panel entero engaña.

## D-025 Resolver una porción devuelve una unión discriminada, no lanza
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: `resolvePortion` traduce lo que eligió la persona usuaria a su
  equivalencia en unidades base. Puede no poder hacerlo: el `servingId` elegido
  puede no existir entre las raciones de la instantánea, o el número de raciones
  puede no ser un número que se pueda servir.
- **Decisión**: devuelve `PortionResolution`, una unión de tres ramas:
  `resolved`, `unknownServing` e `invalidCount`. No lanza nunca.
- **Por qué**: no es por el dato corrupto teórico, que con los datos escritos por
  la propia aplicación no debería ocurrir. Es por la fase 3: al importar un
  archivo JSON entra información externa que nadie de aquí ha escrito, y puede
  traer perfectamente un `servingId` que no existe. Con una excepción, un solo
  registro malo de un archivo importado tumbaría la pantalla del día entera; con
  una unión, ese registro se enseña como problemático y los demás del día se
  siguen viendo. Es el mismo aislamiento por elemento que D-019 aplica a los
  productos de una página de búsqueda, por el mismo motivo: un fallo en un dato
  que no controlamos no puede costarle al resto.
- **Alternativa descartada**: (a) lanzar una excepción, descrito arriba; (b)
  devolver `undefined`, que junta "esa ración no existe" con "ese número no vale"
  y deja a quien llama sin poder decir cuál de las dos cosas pasó; (c) resolver a
  cero cuando algo no cuadra, que convierte un error en un registro de cero
  calorías que parece legítimo y falsea el día en silencio.
- **Consecuencias**: se comprueba `count` pero no `amount`, y la asimetría es
  deliberada: `count` es un `number` pelado que nadie ha validado nunca, mientras
  que `amount` ya es una magnitud con marca y por tanto pasó por su constructor,
  que rechaza lo negativo y lo no finito. Volver a comprobarlo aquí sería
  desconfiar del sistema de tipos que el proyecto entero da por bueno. Cuando la
  fase 3 escriba el importador, la validación de Zod tiene que reconstruir las
  magnitudes con esos constructores y no afirmar la marca sobre un número crudo,
  o esa garantía se pierde.

## D-026 Un nutriente con `unknown` mayor que cero nunca se enseña como una cifra a secas
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: D-001 dijo de pasada que los totales diarios deben informar de
  cuántos registros no aportaban cada nutriente. D-024 decidió la mitad
  aritmética: se suma lo que hay y el total viaja con `unknown`, el recuento de
  los registros que no aportaban el dato. Ninguna de las dos dice qué obliga eso
  a la interfaz, y sin esa parte el recuento existe en el modelo y no llega a la
  pantalla, que es donde tenía que servir para algo.
- **Decisión**: siempre que se muestre un nutriente cuyo `unknown` sea mayor que
  cero, junto a la cifra tiene que verse sobre cuántos registros se calculó. Una
  cifra sola, sin esa marca, es un error de presentación y no una cuestión de
  gusto. La marca es responsabilidad del componente que enseña el nutriente, no
  de quien lo llama: quien pinta la cifra recibe el recuento y decide, para que
  una pantalla nueva no pueda olvidarse de ponerla. Se aplica igual a las macros
  opcionales de la fase 1 (fibra, azúcares, grasa saturada, sal) que al panel de
  micronutrientes de la fase 2, y también a cualquier cifra que salga de la
  aplicación hacia fuera. Las cuatro macros obligatorias no entran nunca aquí,
  porque `Macros` es estricto y no pueden aparecer en `unknown` (D-002, D-024).
- **Por qué**: un total con `unknown` mayor que cero es un mínimo conocido, no un
  total. Enseñarlo igual que uno completo lo convierte en un total a los ojos de
  quien lo lee, y entonces la decisión de D-024 se vuelve en contra: sumar solo
  lo que hay produce un número más bajo que el real, y sin la marca ese número
  bajo parece exacto. Es peor que sumar ceros por lo que falta, que era la opción
  que D-024 descartó por producir "un número indistinguible de un total
  completo". Sin esta regla llegamos por la ruta larga al mismo sitio que
  queríamos evitar.
- **Alternativa descartada**: (a) dejarlo como criterio de diseño no escrito, que
  es exactamente lo que ya falló una vez: D-001 lo mencionó dentro de otra
  entrada y hubo que volver a decidirlo entero en D-024; (b) esconder el
  nutriente cuando `unknown` sea mayor que cero, que es la opción (a) de D-024
  disfrazada de presentación y dejaría casi todos los micronutrientes en blanco;
  (c) enseñar la cifra y poner el recuento solo en un detalle desplegable, que
  hace que el número engañe a quien no despliega, que son casi todos.
- **Consecuencias**: la interfaz necesita un componente compartido para enseñar
  un nutriente, porque la regla no se puede cumplir a base de acordarse en cada
  sitio. Cuando llegue el panel de la fase 2, ninguna barra puede dibujarse sin
  su recuento. Queda pendiente y se decidirá aparte la forma concreta de la
  marca: si el recuento se enseña como "sobre 3 de 5 registros", como un signo
  junto a la cifra, o de otra manera. Lo que esta decisión fija es que tiene que
  estar, no cómo se ve.

## D-027 Carpetas `app/` y `features/`, y el mapa de rutas en un archivo propio
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: hasta ahora solo había código sin interfaz, repartido en
  `domain/`, `data/`, `services/` y `shared/`. La primera pantalla obliga a
  decidir dónde vive lo que junta una vista con su lógica.
- **Decisión**: dos carpetas nuevas. `app/` es el arranque y la navegación: los
  proveedores, el mapa de rutas y las pantallas de marco (diario, redirección a
  hoy, fecha inválida, 404). `features/<nombre>/` es una funcionalidad completa
  con su pantalla, sus componentes y sus hooks, empezando por
  `features/food-search/`. Las cuatro carpetas anteriores no se tocan, y la
  dirección de las dependencias es de fuera hacia dentro: `features` puede
  importar de `shared`, `services` y `domain`, y nunca al revés. El mapa de rutas
  vive en `app/router.tsx` y en ningún otro sitio.
- **Por qué**: agrupar por funcionalidad y no por tipo de archivo hace que
  añadir la pantalla de micronutrientes de la fase 2 sea crear una carpeta, no
  tocar cinco. Y el mapa de rutas en un solo archivo no es manía de ordenar: la
  fase 3 tiene que decidir qué direcciones se guardan en caché para funcionar
  sin conexión, y esa lista se lee de ahí; repartida entre componentes habría
  que reconstruirla a mano y se olvidaría alguna.
- **Alternativa descartada**: (a) carpetas por tipo, `components/`, `hooks/`,
  `pages/`, que es lo más común y lo que peor envejece: con cinco fases, cada
  cambio toca archivos lejanos entre sí y ninguna carpeta cuenta de qué va la
  aplicación; (b) meter las pantallas dentro de `shared/ui`, que confundiría lo
  reutilizable con lo que se usa una sola vez.
- **Consecuencias**: `src/App.tsx` desaparece y pasa a `src/app/App.tsx`.
  `vercel.json` añade la reescritura a `index.html`, sin la cual un enlace
  directo a `/dia/2026-09-13` daría 404 en producción; excluye `/api` para no
  tapar las funciones serverless. El día que una funcionalidad necesite algo de
  otra, se sube a `shared/` en vez de importarse en cruzado.

## D-028 La política de reintentos de TanStack Query se escribe contra `OffErrorCode`
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: TanStack Query reintenta tres veces por defecto, con espera
  creciente, ante cualquier error. Está pensado para una API propia sin límite
  de ritmo. La nuestra no lo es.
- **Decisión**: `retry` es una función que mira el `code` del `OffApiError`. Se
  reintenta como mucho dos veces y solo lo transitorio: `network`,
  `upstream_error` y `upstream_timeout`. No se reintenta nunca `rate_limited`,
  `invalid_request`, `not_found` ni `malformed_response`. Un error que no sea un
  `OffApiError` tampoco se reintenta. `refetchOnWindowFocus` y
  `refetchOnReconnect` quedan apagados, `staleTime` en cinco minutos y `gcTime`
  en treinta. La función se escribe suelta y exportada, no en línea dentro del
  objeto de opciones, para poder probarla sin montar un cliente ni renderizar.
- **Por qué**: el peor caso es justo el que la configuración por defecto empeora.
  Open Food Facts permite diez búsquedas por minuto y por dirección IP, y en
  Vercel esa dirección la compartimos (D-013): ante un `rate_limited`, tres
  reintentos automáticos gastan tres intentos más del cupo de todo el mundo por
  un error que por definición no se arregla insistiendo. Los otros tres códigos
  que no se reintentan van a responder exactamente lo mismo, o son un fallo
  nuestro de contrato que no se cura repitiendo la pregunta. Y los refetch
  automáticos son peticiones que nadie pidió: la ficha de un producto no cambia
  porque vuelvas a la pestaña.
- **Alternativa descartada**: (a) dejar los valores por defecto, descrito arriba;
  (b) apagar los reintentos del todo, que es seguro pero convierte un corte de
  red de dos segundos en un error a la cara cuando bastaba con volver a
  preguntar; (c) decidir el reintento mirando el estado HTTP en vez del código
  propio, que obligaría a repetir aquí la traducción que `client.ts` ya hace y
  dejaría dos sitios que mantener sincronizados.
- **Consecuencias**: añadir un código a `OffErrorCode` obliga a decidir aquí si
  se reintenta, y el `satisfies Record<OffErrorCode, ...>` del mapa de mensajes
  obliga además a escribirle un texto. Las dos cosas fallan en compilación, no en
  producción.

## D-029 Estar sin conexión y fallar el servidor son dos estados distintos, y ninguno es "cargando"
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: la pantalla de búsqueda tiene que dibujar bastante más que una
  lista. Hecho a ojo, esto acaba en un ternario con "cargando" y "error", y todo
  lo demás cayendo en el caso bueno.
- **Decisión**: los estados se declaran como una unión discriminada,
  `SearchViewState`, con seis ramas: `idle`, `loading`, `offline`, `error`,
  `empty` y `results`. La unión la calcula una función pura,
  `toSearchViewState`, que recibe una instantánea de la consulta y no depende de
  React, y la pantalla solo hace un `switch` sobre `kind`. El texto se busca con
  400 ms de retraso desde la última tecla y un mínimo de tres caracteres, que se
  lee de `MIN_SEARCH_LENGTH` y es el mismo número que ya usa `searchFoods` para
  no salir a la red. El texto ya estabilizado se refleja en la URL con `replace`.
- **Por qué**: son tres cosas que se hacen mal si no se deciden antes. La primera
  es que en TanStack Query v5 una consulta apagada con `enabled: false` se queda
  en `status: 'pending'` para siempre, así que dibujar el cargando mirando solo
  `isPending` produce un indicador eterno para una petición que nunca se hizo;
  hay que mirar `fetchStatus`, que es un eje distinto. La segunda es que estar
  sin conexión no es un error: con el modo de red por defecto la petición ni se
  intenta, la consulta queda en `paused` y se reanuda sola al volver la red, así
  que ahí no va un botón de reintentar porque no hay nada que reintentar. Y la
  tercera es que "no hay red" y "Open Food Facts no responde" piden acciones
  distintas de quien lee: recuperar la conexión o esperar. Decirle a alguien que
  revise su wifi cuando su wifi está bien es hacerle perder el tiempo. Sacar la
  función del componente es lo que permite probar las tres sin renderizar nada.
- **Alternativa descartada**: (a) ternarios en el componente, descrito arriba;
  (b) juntar `offline` con `error`, que ahorra una rama y da el mensaje
  equivocado justo cuando menos ayuda; (c) dejar el texto de búsqueda solo en
  estado local, sin URL, que se escribe en dos líneas menos pero pierde la
  búsqueda al recargar; (d) escribir la URL sin `replace`, que llenaría el
  historial de una entrada por letra y haría que el botón de atrás deshiciera la
  palabra en vez de volver al diario.
- **Consecuencias**: los borradores de D-002 se enseñan en la lista, no se
  esconden, y con su carencia explicada por su nombre y el anuncio de cuándo se
  podrá arreglar. Un resultado apagado y sin motivo parece un fallo de la
  aplicación y no una decisión, y eso vale para cualquier elemento inerte que se
  añada más adelante. La cancelación de la petición anterior no se escribe:
  TanStack Query aborta la que está en vuelo al cambiar la clave de caché, y el
  cliente ya acepta el `signal` y deja subir el `AbortError` sin envolverlo desde
  el paso 2b.

## D-030 Los decimales de cada magnitud, y dónde ocurre el redondeo
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: D-023 dejó dicho que el dominio no redondea y que el redondeo es
  de presentación y ocurre una sola vez, y dejó pendiente con cuántos decimales
  se enseña cada nutriente.
- **Decisión**: la energía sin decimales; los gramos con uno. El formato vive en
  `shared/lib/nutrient-format.ts` y usa `Intl.NumberFormat` con configuración
  regional española, así que el separador decimal es la coma. Es el único sitio
  de la aplicación donde se redondea.
- **Por qué**: nadie decide nada con 247,3 kcal que no decidiera con 247, y en
  cambio el primer decimal de un gramo sí distingue en cantidades pequeñas: 0,4 g
  de sal y 0,0 g no son lo mismo, y con cero decimales las dos serían "0 g". Que
  el redondeo esté en un único módulo es lo que hace verificable la promesa de
  D-023: si aparece un `toFixed` en cualquier otro archivo, es un error.
- **Alternativa descartada**: (a) un decimal también en la energía, que añade
  ruido sin añadir información; (b) redondear en el dominio al escalar, que ya
  descartó D-023 porque hace que el total del día dependa de en cuántos trozos se
  calculó.
- **Consecuencias**: los micronutrientes de la fase 2 se miden en miligramos y
  microgramos y necesitarán su propia regla, que se añadirá aquí. Y las cifras
  que se enseñen con `unknown` mayor que cero siguen necesitando su recuento al
  lado (D-026): el formato decide cómo se escribe el número, no si el número
  puede ir solo.

## D-031 `contracts/`: las reglas que el cliente y el servidor cumplen igual viven una sola vez
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: la validación del código de barras, entre 8 y 14 dígitos, vivía
  en `api/_lib/off.ts`. El cliente necesita la misma regla para no gastar una
  petición en algo que el servidor va a rechazar, y el proyecto ya tenía un
  precedente para ese problema: `normalizeForSearch` está copiada en
  `api/_lib/text.ts` y en `src/shared/lib/text.ts`, con un test que compara las
  dos implementaciones para que no se separen.
- **Decisión**: una carpeta nueva en la raíz, `contracts/`, hermana de `src/` y
  de `api/`, con `contracts/barcode.ts` como primer habitante. Los dos proyectos
  de TypeScript la incluyen y la compilan, cada uno con su resolución de módulos:
  la de Node en el de la API, que la importa con ruta relativa y extensión
  `.js`, y la de empaquetador en el de la aplicación, que la importa con el
  alias `@contracts/`. El nombre no es `shared` porque ya existe
  `src/shared/`, y dos carpetas iguales a distinta altura es una trampa para
  quien lea el repositorio dentro de seis meses.
- **Alcance, y esto es la mitad de la decisión**: `contracts/` es solo para
  reglas que el cliente y el servidor tienen que cumplir de forma idéntica.
  Nunca un cajón de utilidades compartidas. La prueba para admitir algo aquí es
  concreta: si las dos copias se separasen, ¿se rompería el trato entre las dos
  puntas? Si la respuesta es no, no entra. Sin esta frase, dentro de tres meses
  la carpeta tendría media biblioteca dentro.
- **Por qué**: el criterio anterior, escrito en la cabecera de
  `api/_lib/text.ts`, decía que la función serverless no debe depender del
  código del navegador. Sigue siendo cierto y esta decisión lo respeta:
  `contracts/` no es código del navegador. Lo que le pasaba a ese criterio es
  que estaba incompleto, no que fuera erróneo: contemplaba dos ubicaciones
  posibles, la del cliente y la del servidor, y había una tercera que no
  pertenece a ninguna de las dos puntas. Con dos copias, el día que una cambiara
  el cliente gastaría peticiones que el servidor rechaza, o dejaría de mandar
  códigos que el servidor sí acepta, y ninguno de los dos fallos se ve al
  probar cada lado por separado.
- **Alternativa descartada**: (a) dos copias con un test que las compare, que es
  el precedente y funciona, pero paga con un test permanente lo que aquí se
  arregla con un archivo; (b) poner el archivo dentro de `api/_lib/` y que el
  navegador importe de ahí, que no tiene riesgo de despliegue y es verificable
  en local, pero invierte la dirección de las dependencias y deja el frontend
  colgando de la carpeta del servidor; (c) publicar el contrato como paquete de
  espacio de trabajo, que resuelve lo mismo y añade un gestor de monorrepo a un
  proyecto con dos carpetas.
- **Consecuencias**: la incógnita es Vercel, y conviene dejarla escrita. Su
  empaquetado de las funciones tiene que seguir una importación relativa que sale
  de `api/`, y D-017 existe justamente porque una vez dimos por hecho que Vercel
  se comportaba como la integración continua. La verificación es el despliegue de
  vista previa del pull request; si fallara, la salida es `includeFiles` en
  `vercel.json` y, si tampoco, volver a las dos copias. `normalizeForSearch`
  sigue duplicada de momento, a propósito: se migra en un cambio aparte, para
  que si la vista previa falla lo haga por una sola cosa. El comentario de
  `api/_lib/text.ts` queda pendiente de actualizar en esa migración.

## D-032 La resolución de un código de barras es una ruta, y esa ruta es el único punto de entrada
- **Fecha**: 2026-09-13
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: D-012 adelantó a la fase 1 la búsqueda por código de barras
  tecleado, dejando para la fase 3 solo la cámara y la detección automática.
  Eso obliga a decidir hoy la forma que tendrá que reutilizar el escáner mañana.
- **Decisión**: resolver un código es una pantalla con dirección propia,
  `/dia/:date/codigo/:barcode`. El formulario donde se teclea no resuelve nada:
  normaliza lo escrito y navega. En la fase 3, el escáner detectará una cadena y
  navegará a la misma ruta, sin tocar la pantalla de destino, ni el hook, ni las
  ramas de resultado. La pantalla tiene ocho ramas, y tres son suyas: `invalid`,
  que aplica la regla de D-031 sin gastar petición; `notFound`, que es un código
  que la fuente no conoce; y `unreadable`, que es un producto que la fuente
  devuelve roto.
- **Por qué**: quien produce un código de barras no debe saber qué pasa después.
  Con una función a la que se llama, el escáner de la fase 3 tendría que conocer
  el estado interno de la pantalla de búsqueda; con una dirección, solo tiene que
  producir una cadena. De regalo, el resultado se puede recargar y compartir, y
  el botón de atrás vuelve a la búsqueda. Y el requisito de degradación elegante
  queda cumplido por orden de construcción: teclear el código es el camino que
  existe primero, así que la cámara será un atajo hacia él y no una vía paralela
  que haya que mantener aparte.
- **Alternativa descartada**: (a) un diálogo con el código en estado de memoria,
  que es lo que primero apetece: no tiene URL, no se recarga ni se comparte, y
  ata la cámara al estado interno de otra pantalla; (b) reutilizar la ruta de
  búsqueda detectando que el texto son solo dígitos, que mezcla dos consultas
  distintas en una y deja sin explicar por qué "12345678" no busca por nombre;
  (c) juntar `notFound` y `unreadable` en un solo mensaje, que tira la
  distinción que `services/off` viene haciendo desde el paso 2b y que existe
  precisamente porque la interfaz responde distinto a cada una.
- **Consecuencias**: la fase 3 añade la cámara al lado del campo tecleado y
  llama a `navigate` con lo que detecte. No debería tocar nada de lo escrito
  aquí; si acaba teniendo que tocarlo, esta decisión estaba mal y hay que
  registrar por qué. El dígito de control no se comprueba y el motivo está en
  `contracts/barcode.ts`: el rango cubre esquemas que no lo calculan igual, y
  Open Food Facts contiene códigos internos de tienda que no cumplen ninguno.

## D-033 `normalizeForSearch` se muda a `contracts/` y el test de contraste desaparece
- **Fecha**: 2026-09-14
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: D-031 creó `contracts/` con el código de barras dentro y dejó
  `normalizeForSearch` duplicada a propósito, para que si la vista previa de
  Vercel fallaba con la importación relativa que sale de `api/`, fallara por una
  sola cosa. La vista previa construyó y el pull request se fusionó, así que el
  patrón está verificado y la duplicación ya no compra nada.
- **Decisión**: la función vive en `contracts/text.ts`. `api/_lib/text.ts` se
  borra y las funciones serverless la importan con ruta relativa y extensión
  `.js`; el navegador la importa con el alias `@contracts/text` en los cuatro
  sitios que la usaban, sin reexportarla desde `src/shared/lib/text.ts`. El test
  que comparaba las dos implementaciones se borra, y sus casos se mudan a
  `contracts/text.test.ts` junto a la función. En su lugar queda un test corto
  que comprueba que `normalizeQuery` sigue siendo la del contrato y no una
  variante local.
- **Por qué**: pasa la prueba de admisión que D-031 escribió para esta carpeta.
  Si las dos copias se separasen, el navegador construiría la clave de su caché
  de consultas con una normalización y la función serverless construiría la URL
  saliente, que es la clave de la caché de la red de distribución, con otra. Las
  dos cachés están pensadas para acertar a la vez ante "Plátano" y "platano"
  (D-013), y ese acuerdo es justo lo que `contracts/` protege. De regalo,
  desaparece el único punto donde el proyecto de la API miraba dentro de `src/`,
  que era el `import` del test de contraste.
- **Alternativa descartada**: (a) mantener las dos copias con su test, que es lo
  que D-031 ya decidió sustituir en cuanto el patrón estuviera verificado, y que
  paga con un test permanente lo que aquí cuesta un archivo; (b) reexportar la
  función desde `src/shared/lib/text.ts` para no tocar los cuatro importadores,
  que deja dos nombres para la misma cosa y esconde que es un contrato
  compartido justo a quien lee el código del navegador.
- **Consecuencias**: `MIN_SEARCH_LENGTH` y `MIN_QUERY_LENGTH` se quedan cada uno
  en su lado, y esto es deliberado aunque hoy los dos valgan tres. Se parecen a
  un contrato y no lo son: el del navegador decide cuándo merece la pena salir a
  la red y puede subir sin romper nada, porque pedir menos de lo permitido
  siempre le vale al servidor; el del servidor es el límite que de verdad se
  aplica. Son dos reglas con el mismo número, no una regla en dos sitios.
  `contracts/` queda con dos habitantes y la prueba de admisión de D-031 sigue
  siendo la única puerta de entrada.

- **Contexto**: para registrar una comida hace falta llevar un alimento desde la
  pantalla de resultados hasta un formulario. Lo primero que apetece es un botón
  que abra un diálogo con el alimento en memoria, o un botón que escriba en
  Dexie y luego navegue.
- **Decisión**: registrar es la pantalla `/dia/:date/registrar/:foodId`, y lo
  único que viaja es el identificador. Para que ese identificador exista
  siempre, la búsqueda guarda en el catálogo local todo lo que trae, que es lo
  que D-013 ya decía y hasta ahora no se había implementado. El repositorio gana
  `adopt`, que devuelve el alimento que hay que usar: si ese código de barras ya
  estaba, devuelve el guardado y **no lo pisa**. Las tarjetas de resultado
  reciben su acción por un hueco (`action`), así que la misma tarjeta sirve en
  la búsqueda y en la pantalla de un código de barras.
- **Por qué**: son tres problemas resueltos por el mismo sitio. El primero es el
  de D-032: quien produce un alimento no debe saber qué pasa después, y con una
  dirección la pantalla se recarga y se comparte. El segundo es la dirección de
  las dependencias de D-027: si la acción fuera un botón que escribe y navega,
  la funcionalidad de búsqueda tendría que importar código de la del diario;
  siendo un enlace, solo produce una URL y nadie importa a nadie. El tercero es
  que `adopt` no sobrescriba: la normalización genera un identificador nuevo en
  cada llamada, así que sin esto el mismo yogur buscado dos veces serían dos
  filas, y además la copia guardada puede llevar cifras completadas a mano que
  la recién traída nunca lleva.
- **Alternativa descartada**: (a) un diálogo con el alimento en memoria, que no
  tiene dirección, se pierde al recargar y ata la pantalla de destino al estado
  de la de origen; (b) botón que adopta al pulsar, que obliga al cruce entre
  funcionalidades descrito arriba; (c) pasar el alimento por el estado del
  router, que no sobrevive a recargar y deja la pantalla sin nada que enseñar;
  (d) que `adopt` sobrescriba siempre, más simple y que tira sin avisar el
  trabajo de quien completó un producto a mano.
- **Consecuencias**: cada búsqueda escribe sus resultados en IndexedDB. Es lo
  que D-013 pedía y lo que habilitará buscar primero en local, pero si esa
  escritura falla no puede tumbar una búsqueda que ha ido bien: se devuelve la
  página sin adoptar y el enlace de añadir acaba en la rama "ese alimento no
  está en tu catálogo", que la pantalla de destino ya explica. Y la vista previa
  del formulario es literalmente el registro que se va a guardar, construido con
  la misma función; por eso `build` llega como propiedad, de modo que editar un
  registro pueda pasar otra sin tocar el formulario.

## D-035 La marca de un total incompleto es "sobre N de M registros", y la estimación es una insignia
- **Fecha**: 2026-09-14
- **Fase**: 1
- **Estado**: pendiente de revisión
- **Contexto**: D-026 fijó que una cifra con `unknown` mayor que cero nunca se
  enseña sola, y dejó escrito a propósito que la forma concreta de la marca se
  decidía aparte. Hacía falta elegirla para poder pintar la primera cifra.
- **Decisión**: existe `shared/ui/NutrientValue`, el único componente que enseña
  la cifra de un nutriente. Lleva dos marcas distintas: `unknown` se escribe como
  "sobre N de M registros" junto al número, y `estimated` como una insignia con
  el texto "estimación", para las cifras que rellenó a mano la persona usuaria
  (D-002). Un `unknown` de cero no se enseña.
- **Por qué**: de las tres formas que D-026 mencionaba, esta es la que se
  entiende sin aprender nada y no depende de que nadie pase el ratón por encima
  ni despliegue un detalle, que era justo lo que esa decisión descartaba. Que
  las dos marcas vivan en el mismo componente es lo que hace cumplible la regla:
  una pantalla nueva no puede olvidarse de ponerlas porque no son cosa suya.
  Enseñar "sobre 5 de 5" cuando no falta nada sería ruido, y el ruido enseña a
  ignorar la marca justo cuando sí importa.
- **Alternativa descartada**: (a) un signo junto a la cifra, tipo asterisco, que
  ocupa menos y obliga a buscar la leyenda; (b) el recuento solo en un detalle
  desplegable, que D-026 ya descartó porque engaña a quien no despliega; (c) dos
  componentes distintos, uno para el recuento y otro para la estimación, que
  reparte en dos sitios una regla que hay que cumplir siempre.
- **Nota**: queda marcada como pendiente de revisión porque es una decisión de
  presentación tomada sobre la marcha para no bloquear el paso 5. Cierra el
  pendiente que D-026 dejó abierto, pero el texto y la forma son revisables sin
  tocar nada más que este componente.

## D-036 TanStack Query también para lo local, con `networkMode: 'always'`, y sin React Hook Form todavía
- **Fecha**: 2026-09-14
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: la pantalla de registro lee un alimento de IndexedDB y escribe un
  registro. Hacía falta decidir con qué se hace eso, porque CLAUDE.md reserva
  TanStack Query para "datos del servidor" y el stack menciona React Hook Form
  para formularios.
- **Decisión**: las lecturas y escrituras de Dexie usan TanStack Query, con
  claves que empiezan por `db` para distinguirlas de las de `off`, y **siempre**
  con `networkMode: 'always'`. Los formularios de la fase 1 se hacen con
  `useState`; React Hook Form no se instala todavía.
- **Por qué**: lo que hace falta para una lectura local es lo mismo que para una
  remota: estados de carga y error, una caché compartida entre pantallas y una
  forma de decir "esto ha cambiado" tras escribir. Añadir `dexie-react-hooks`
  sería una dependencia más y dos modelos mentales en la misma aplicación, y
  hacerlo con `useEffect` significa escribir a mano el cargando, el error y la
  invalidación en cada pantalla. Lo de `networkMode` no es un detalle de
  configuración: por defecto TanStack Query no intenta siquiera una consulta
  cuando el navegador dice que no hay red, cosa correcta para Open Food Facts
  (D-029) y absurda para IndexedDB. Sin esa línea, el diario se quedaría en
  blanco en el metro con los datos dentro del propio dispositivo, que es
  exactamente lo contrario de la decisión 5 del proyecto.
- **Alternativa descartada**: (a) `dexie-react-hooks`, que da reactividad viva
  sobre las consultas y es realmente cómodo, pero es una dependencia nueva para
  un problema que la que ya está resuelve; (b) `useEffect` con `useState`, sin
  dependencias y con los estados a mano en cada pantalla; (c) instalar React
  Hook Form ahora, que para un formulario de tres campos añade una biblioteca
  que habría que defender sin que resuelva nada que duela hoy.
- **Consecuencias**: toda consulta o mutación contra Dexie tiene que llevar
  `networkMode: 'always'`. Es fácil de olvidar y no falla en desarrollo, donde
  siempre hay red; si aparece una tercera, conviene un ayudante que lo ponga por
  defecto. React Hook Form se reconsidera en la fase 2, con el editor de
  objetivos, que sí tiene bastantes campos y validación cruzada.

## D-037 La pantalla del día agrupa por momento, y los totales son una proyección
- **Fecha**: 2026-09-14
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: el paso 6 tenía que enseñar lo registrado y los totales. Quedaba
  decidir cómo se ordena, dónde se calcula y quién enseña las cifras.
- **Decisión**: los registros se agrupan por momento del día y, dentro de cada
  uno, en el orden en que se escribieron, que es el que devuelve el repositorio.
  Los totales se calculan al pintar con `dayTotals` y no se guardan en ninguna
  tabla. Toda cifra de un nutriente pasa por `NutrientValue`, con su recuento de
  `unknown` cuando lo hay (D-026, D-035). La pantalla del día se queda en
  `app/routes` como marco, y lo que va dentro vive en `features/diary`.
- **Por qué**: agrupar por momento se parece a cómo se come, y quien mira el
  diario busca "qué cené" antes que "qué registré a las ocho y cuarto". Los
  totales no se guardan porque son una proyección de los registros: una fila
  guardada sería una segunda verdad que habría que mantener sincronizada, y un
  error de escalado quedaría congelado, que es lo mismo que D-003 razonó para el
  registro. Y separar el marco de lo que va dentro es lo que hace que la pantalla
  del día no crezca cada vez que el diario aprenda a enseñar algo nuevo.
- **Alternativa descartada**: (a) una lista plana por hora de registro, más
  simple y que obliga a leerla entera para saber qué se comió en cada momento;
  (b) guardar un resumen del día en su propia tabla, que acelera una consulta que
  ya es instantánea a cambio de duplicar la verdad; (c) que cada pantalla
  formatee sus cifras por su cuenta, que es exactamente lo que D-026 prohíbe
  porque la marca del recuento se acabaría olvidando en alguna.
- **Consecuencias**: `dayTotals` recibe una lista de ejercicio vacía, porque el
  ejercicio llega en la fase 5. Se pasa igualmente para no tocar la llamada
  cuando exista. En la fase 2, el panel de micronutrientes se añade a esta misma
  pantalla usando el mismo componente de cifra.

## D-038 Borrar un registro se confirma en dos pasos, y la lápida no se ofrece deshacer
- **Fecha**: 2026-09-14
- **Fase**: 1
- **Estado**: sustituida por D-042
- **Contexto**: D-006 ya decidió que borrar escribe una lápida y nunca elimina la
  fila. Lo que no estaba decidido es qué ve quien pulsa "borrar".
- **Decisión**: el botón pregunta antes, en la propia fila y sin diálogo del
  navegador: "Borrar" se convierte en "Sí, borrar" y "No". No se ofrece deshacer
  después, ni una papelera desde la que recuperar.
- **Por qué**: la fila sigue existiendo en la base de datos, pero desde la
  interfaz no hay forma de recuperarla, así que para quien usa la aplicación el
  borrado es definitivo y preguntar es lo mínimo. Se hace en la fila, y no con
  `window.confirm`, porque el diálogo del navegador bloquea la página entera, no
  se puede escribir en español sin que el navegador meta sus propios botones y
  queda fuera del estilo de la aplicación.
- **Alternativa descartada**: (a) borrar sin preguntar, que con un toque mal dado
  en el móvil pierde un registro; (b) `window.confirm`, descrito arriba; (c) un
  "deshacer" temporal tipo aviso flotante, que es lo mejor de las tres para quien
  lo usa y necesita un componente de avisos, un temporizador y decidir qué pasa si
  te vas de la pantalla antes de que expire. Es la mejor candidata a sustituir a
  esta decisión, y por eso queda anotada.
- **Nota**: pendiente de revisión. Es una decisión de interfaz tomada sobre la
  marcha para no bloquear el paso 6.

## D-039 El sembrado de ejemplo usa identificadores fijos y entra en el paso 6
- **Fecha**: 2026-09-14
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: D-016 adelantó el sembrado de datos de ejemplo al paso 2 o 3 de
  la fase 1, para que las previsualizaciones no se vieran vacías. En la práctica
  no se hizo entonces, y llega ahora con la pantalla del día, que es donde el
  ejemplo se puede ver de verdad.
- **Decisión**: los datos de ejemplo se construyen con las mismas funciones del
  dominio y se escriben con los mismos repositorios que usa la aplicación, con
  **identificadores fijos** conocidos. Se cargan en el día que se está mirando,
  solo al pulsar el botón, y se retiran escribiendo lápidas sobre esos
  identificadores (D-006). Los alimentos de ejemplo tienen origen `custom`.
- **Por qué**: los identificadores fijos son lo que permite retirar el ejemplo
  sin inventar una marca de "esto es de mentira" dentro del dominio, que
  contaminaría todas las entidades para siempre por una necesidad de
  demostración. Usar los repositorios de verdad hace que el sembrado sea, de
  paso, una prueba de humo de la capa de datos: si siembra, la escritura
  funciona. Y el origen es `custom` porque inventar un código de barras haría
  pasar un dato falso por un dato de la fuente, y además chocaría con el catálogo
  real en cuanto alguien buscara ese producto.
- **Alternativa descartada**: (a) escribir directamente en las tablas de Dexie,
  más corto y que no demuestra nada porque se salta justo el código que se quiere
  enseñar; (b) una bandera `isSample` en las entidades, que mete una necesidad de
  demostración dentro del modelo de dominio y habría que arrastrar hasta la
  sincronización de la fase 4; (c) sembrar automáticamente al abrir la aplicación
  con la base vacía, que mezcla datos inventados con los de la persona usuaria
  sin que los haya pedido; (d) sembrar siempre en el día de hoy, que haría que
  pulsar el botón mirando el martes no cambiara nada en pantalla.
- **Consecuencias**: esta entrada ajusta **el calendario** de D-016, que situaba
  el sembrado en el paso 2 o 3; lo demás de D-016 sigue vigente y no se reescribe,
  según la regla de este archivo de no tocar las entradas anteriores. El precio de
  haberlo dejado para el final es el que D-016 anticipaba: las previsualizaciones
  de los pasos 4, 4b y 5 se enseñaron vacías. Y sembrar dos veces no duplica nada,
  porque los identificadores son fijos: el segundo sembrado reescribe el primero
  y devuelve a la vida lo que estuviera retirado.

## D-040 El límite de la fuente deja de disfrazarse de fallo pasajero
- **Fecha**: 2026-09-14
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: usando la aplicación una sola persona contra el despliegue de
  `main`, los registros de Vercel enseñaron en cuarenta segundos **siete 502,
  cinco 429 y solo tres 200**. El 429 es nuestro cubo de fichas, que rechaza
  antes de salir a la red y por tanto no le cuesta nada a la fuente. El 502 es
  `upstream_error`, o sea que la petición sí salió y Open Food Facts la rechazó.
  Eso son **diez peticiones salientes en cuarenta segundos, quince por minuto**,
  contra un límite documentado de diez por minuto. Y la dirección IP es la de
  Vercel, compartida, con aviso expreso en su documentación de que pueden denegar
  el acceso por IP.
- **Decisión**: el límite de ritmo de la fuente deja de traducirse a `502
  upstream_error` y pasa a ser **`429 upstream_rate_limited`**, un código propio
  que no está en la lista de lo reintentable y que conserva el `retry-after` de
  la fuente cuando lo manda, o un minuto entero cuando no lo manda. Además los
  reintentos bajan de dos a uno. `rate_limited` (nuestro cubo) y
  `upstream_rate_limited` (el suyo) son dos códigos distintos aunque los dos
  viajen con un 429.
- **Por qué**: la traducción anterior creaba un bucle de realimentación medible.
  `handlers.ts` convertía **cualquier** respuesta que no fuera 200 en un 502
  `upstream_error`, y `upstream_error` estaba en `RETRYABLE_CODES`, así que el
  navegador respondía a un "para" de la fuente con dos peticiones más contra la
  fuente. Reproducido con la cadena entera —navegador, función serverless y una
  fuente devolviendo 429—: **una sola búsqueda producía tres peticiones
  salientes**. Con el arreglo produce una. La regla que queda es que la única
  respuesta que nunca hay que repetir no puede llegar indistinguible de la que sí
  conviene repetir.
- **Alternativa descartada**: (a) quitar `upstream_error` de la lista de
  reintentables, que también corta el bucle pero de paso deja de reintentar un
  500 pasajero de verdad, que es justo el caso para el que los reintentos
  existen; (b) traducir el límite de la fuente a nuestro `rate_limited`, más
  corto y que mezcla dos cosas que hay que poder contar por separado en los
  registros: si no se distinguen, no hay forma de saber si un arreglo funcionó;
  (c) bajar los reintentos a cero, que castiga la red mala de quien va en el
  metro por un problema que no es suyo.
- **Consecuencias**: `ErrorCode` y `OffErrorCode` ganan un miembro, y como son el
  vocabulario compartido entre las dos puntas (D-013), añadirlo obliga a tocar
  las dos y a que el mensaje de la interfaz diga quién impone el límite. Este
  arreglo **no** resuelve el problema de fondo, que es que se sale a la red por
  cada prefijo tecleado: en la misma reproducción, teclear "leche entera" con
  pausas de 450 ms pasó de once peticiones a nueve. Las nueve las quita D-041.

## D-041 Buscar mientras se teclea se hace en local; a la fuente se sale con intención
- **Fecha**: 2026-09-14
- **Fase**: 1
- **Estado**: aceptada


- **Estado**: propuesta
- **Contexto**: el diagnóstico de D-040 destapó una causa anterior. Midiendo el
  par `useDebouncedValue` + `useFoodSearch` con el cliente y el `QueryClient`
  reales, teclear "leche entera" produce **una** petición si se teclea a menos de
  400 ms por tecla y **nueve** si se teclea a más. El precipicio está exactamente
  en el valor de `SEARCH_DEBOUNCE_MS`. El debounce funciona y cancela bien; lo
  que pasa es que cuando las pausas superan su umbral no hay nada que cancelar,
  porque cada petición termina antes de que empiece la siguiente. Y cada prefijo
  (`lec`, `lech`, `leche`…) es una entrada de caché distinta en los tres sitios a
  la vez: TanStack Query, la red de distribución de Vercel y Open Food Facts. Una
  sesión realista —teclear, mirar los resultados, refinar— gastó seis peticiones
  en trece segundos, que es el cubo entero.
- **Decisión**: mientras se teclea se busca **solo en el catálogo local** de
  Dexie, sin debounce, porque leer IndexedDB no cuesta red. A Open Food Facts se
  sale únicamente con una acción explícita: Intro o un botón. Además el cliente
  manda a la red el texto **normalizado**, no el crudo.
- **Por qué**: la documentación de Open Food Facts avisa explícitamente de que no
  se use su búsqueda para buscar mientras se teclea, y ese aviso ya estaba
  recogido en el contexto de D-013. La pantalla del paso 4 hizo exactamente eso,
  con el debounce como paliativo. Así que esto no es ajustar un parámetro: es que
  el diseño de la pantalla no era compatible con las condiciones de la fuente que
  nosotros mismos habíamos anotado. Buscar en local no es además un premio de
  consolación: es instantáneo, funciona sin conexión y es la mitad de D-013 que
  nunca se implementó —`foodRepository.searchByName` existe y está probado desde
  el paso 1, y no lo llamaba nadie más que sus propios tests—. Lo de normalizar la
  URL arregla una afirmación falsa: `contracts/text.ts` dice que las dos cachés
  aciertan a la vez ante "Plátano" y "platano", y medido daba **tres** entradas de
  caché distintas para el mismo término, porque la normalización se aplicaba solo
  a la clave de TanStack Query y no a la URL saliente.
- **Alternativa descartada**: (a) subir el debounce a 800 o 1000 ms, dos líneas,
  pero en el móvil se teclea más despacio que cualquier umbral razonable, así que
  estrecha el agujero sin cerrarlo y sigue incumpliendo el aviso de la fuente;
  (b) agrandar el cubo de fichas, que es apagar la alarma en vez del fuego y
  además reparte el daño sobre una IP compartida; (c) salir a la red también tras
  una pausa larga, que vuelve a meter peticiones que nadie pidió.
- **Consecuencias**: la primera vez que se abre la aplicación el catálogo está
  vacío, así que teclear no enseña nada hasta pulsar el botón; hay que decirlo en
  el estado vacío, y los datos de ejemplo de D-039 ayudan. Los números del cubo
  (`capacity: 6`, `refillPerMinute: 6`) se revisan **después** de medir el tráfico
  con esto puesto, no antes, para no ajustar a ojo. Y cuando llegue USDA en la
  fase 2, añadir una segunda fuente deja de multiplicar el problema: teclear no
  genera tráfico, y elegir fuente pasa a ser una decisión de quien busca.
- **Al implementarlo**: `useDebouncedValue` se queda sin ningún uso y se borra,
  en lugar de guardarlo por si acaso, que es lo que CLAUDE.md pide evitar; el
  historial de git lo conserva. La pantalla gana un test de componente, el único
  de la suite, y se justifica solo: lo que comprueba es que teclear produce cero
  peticiones, y esa garantía no vive en ninguna función pura que se pudiera
  probar aparte. Aparecieron de paso dos cosas que no se buscaban: que había dos
  botones llamados Buscar en la misma pantalla, indistinguibles para un lector
  de pantalla, y que la consulta confirmada puede vivir en la URL en lugar de en
  un `useState`, lo que elimina el `useEffect` que sincronizaba las dos.

## D-042 Borrar se confirma antes y se puede deshacer después, mientras no te vayas del día
- **Fecha**: 2026-09-14
- **Fase**: 1
- **Estado**: aceptada
- **Contexto**: D-038 decidió confirmar en dos pasos y **no** ofrecer deshacer, y
  se dejó a sí misma en estado `pendiente de revisión` porque era una decisión de
  interfaz tomada sobre la marcha para no bloquear el paso 6. Además nombró por
  su nombre a su sustituta: *«un "deshacer" temporal tipo aviso flotante, que es
  lo mejor de las tres para quien lo usa (…) Es la mejor candidata a sustituir a
  esta decisión, y por eso queda anotada»*. Esta entrada la revisa.
- **Decisión**: se mantiene la confirmación en dos pasos **y** se añade deshacer.
  No son redundantes: la confirmación protege del toque mal dado en el móvil, y
  el deshacer del arrepentimiento inmediato, que al registrar comidas es
  corriente. Al borrar, la fila no desaparece: se convierte en un hueco apagado y
  tachado, en su sitio, con un botón de "Deshacer". Como el borrado es por lápida
  (D-006), deshacer es **quitar el campo** `deletedAt`, no escribir nada nuevo.
  El deshacer dura mientras no te vayas de la pantalla del día.
- **Por qué**: la premisa de D-038 era que, como desde la interfaz no había forma
  de recuperar nada, el borrado era definitivo y preguntar era lo mínimo. Eso
  seguía siendo verdad solo porque no habíamos escrito la vuelta, no porque el
  modelo lo impidiera: la fila nunca se fue de la base de datos. Escribir la
  vuelta cuesta una función de dominio y un método de repositorio.
  Lo que hace barata la opción que D-038 descartó por cara es **dónde vive el
  hueco**: en la lista, en el sitio del registro borrado, y no en un aviso
  flotante. Así no hace falta ni componente de avisos, ni temporizador, ni
  decidir qué pasa si te vas antes de que expire —te vas y se acabó el deshacer,
  que es una regla que se explica sola—. Las tres objeciones de D-038 eran
  objeciones al formato flotante, no al deshacer.
- **Alternativa descartada**: (a) solo confirmación, que es D-038 y deja el
  arrepentimiento sin salida; (b) aviso flotante con temporizador, el patrón que
  todo el mundo conoce, pero con las tres piezas que D-038 enumeró y con la
  pregunta sin respuesta de qué pasa al cambiar de pantalla; (c) una papelera con
  lo borrado y un botón de recuperar, que resuelve más de lo que hace falta y
  abre la pregunta de cuándo se purga; (d) quitar la confirmación ahora que hay
  deshacer, que confunde dos problemas distintos: un toque accidental en una
  lista no debería llegar a producir un hueco.
- **Consecuencias**: el estado de "esto se acaba de borrar" **no puede vivir en
  la fila**, porque al borrar el registro sale de la consulta y React desmonta
  esa fila con su estado dentro; lo guarda la pantalla del día, que es quien
  sobrevive. Los totales bajan en el momento del borrado y no esperan al
  deshacer: para quien mira, lo borrado ya no cuenta, y que el total baje es
  justamente lo que explica el hueco. `asRestored` es el reverso de `asDeleted` y
  quita la clave en lugar de ponerla a `undefined`, que con
  `exactOptionalPropertyTypes` ni siquiera compila: es D-001 aplicado por el
  compilador a la propia lápida. Queda sin resolver a propósito el deshacer de un
  borrado hecho en **otra** pantalla o en otra visita; si hiciera falta, eso es
  una papelera y es otra decisión.

## D-043 La zona horaria se lee del perfil, no del navegador
- **Fecha**: 2026-09-14
- **Fase**: 2
- **Estado**: aceptada
- **Contexto**: `time-zone.ts` preguntaba al navegador con
  `Intl.DateTimeFormat().resolvedOptions().timeZone` y lo anotaba desde el paso 4
  de la fase 1: *"el dominio ya tiene `UserProfile.timeZone`, pero todavía no hay
  ninguna pantalla que lo escriba (…) en la fase 2 esta función pasará a leer de
  ahí"*. Con la fase 2 arrancando, `Profile` existe pero nadie lo crea ni lo
  edita, así que no había ningún perfil del que leer.
- **Decisión**: se crea `createProfile`, que fabrica el perfil inicial con los
  valores del navegador como propuesta de partida (D-006 del proyecto: nadie se
  registra para usar la aplicación, así que el perfil se crea solo, sin
  formulario, al primer arranque). `ProfileProvider` lo lee una vez con
  `useQuery` y no pinta el árbol hasta tenerlo; `useTimeZone()` es desde ahora el
  único sitio permitido para preguntar la zona horaria, y `time-zone.ts` queda
  reducido a lo que de verdad es: la opinión del navegador, usada solo para
  proponer un valor inicial y para la pantalla de ajustes.
- **Por qué**: la pieza que el comentario original no mencionaba es que preguntar
  al navegador es **síncrono** y leer un perfil de IndexedDB es **asíncrono**, así
  que el cambio no podía ser la línea que prometía. La salida es un componente que
  espera antes de pintar nada: el coste es un parpadeo de milisegundos al abrir
  —es disco local, no red—, y a cambio toda la aplicación por debajo sigue
  pudiendo preguntar la zona horaria de forma síncrona, sin repartir un
  "todavía no lo sé" por cada pantalla que la necesite.
  Guardarlo en el perfil y no solo en el navegador es lo que resuelve el caso que
  de verdad importa: si tu perfil dice Europe/Madrid y abres la aplicación desde
  Nueva York, tu diario tiene que seguir partiendo los días como en Madrid. Un
  viaje no debe reescribir a qué día pertenece la cena de ayer.
- **Alternativa descartada**: (a) `useQuery` con el valor del navegador como dato
  inicial, que no espera nada pero falla justo en el caso que importa: pintaría
  primero el día según el navegador y saltaría al del perfil después, y
  `TodayRedirect` ya te habría mandado al día equivocado antes del salto; (b)
  seguir preguntando al navegador y guardar la zona en el perfil solo como dato
  informativo sin que nada la lea, que es no hacer el cambio y dejar la promesa
  del paso 4 sin cumplir; (c) pedir la zona horaria en un formulario de
  bienvenida antes de poder usar la aplicación, que es una cuenta con otro
  nombre y choca con la decisión 6 del proyecto.
- **Consecuencias**: `ProfileProvider` tiene que envolver el árbol de rutas y no
  al revés, porque `TodayRedirect` y `DayPage` leen `useTimeZone()` antes de
  decidir nada. Aparece la primera pantalla de ajustes (`/ajustes`), con solo la
  zona horaria por ahora: el resto de preferencias de `DisplayPreferences` y los
  datos corporales llegan cuando tengan una razón para pedirse. La zona horaria
  se puede teclear a mano cuando `Intl.supportedValuesOf` no está disponible,
  que es la decisión 7 del proyecto aplicada aquí: la misma regla que exige poder
  teclear un código de barras cuando no hay cámara.

## D-044 Valores de referencia de micronutrientes: una tabla oficial citada, por sexo, sin edad todavía
- **Fecha**: 2026-09-14
- **Fase**: 2
- **Estado**: aceptada
- **Contexto**: CLAUDE.md exige que los valores de referencia diarios salgan de
  fuentes oficiales (EFSA o NIH ODS), con la fuente citada en el propio archivo
  de configuración, y nada inventado ni copiado de un blog. Ni EFSA ni NIH ODS
  dan un número único por nutriente: dan una tabla por sexo y, dentro de cada
  sexo, por tramo de edad. El hierro de una mujer adulta no es el de un hombre
  (18 mg frente a 8 mg, y es el caso contrario de casi todos los demás).
- **Decisión**: `reference-intakes.ts` cita una única fila de una única tabla
  oficial: **"Adults, 19–30 y"** de la tabla resumen de Dietary Reference
  Intakes (DRI) de la National Academies de EE. UU. (Apéndice J de *Dietary
  Reference Intakes for Sodium and Potassium*, 2019), que reúne los resultados
  de todos los informes DRI anteriores y es la que el NIH Office of Dietary
  Supplements cita como fuente. Cada entrada lleva `female` y `male`; sin
  tramo de edad todavía. `referenceIntakeFor(id, sex)` devuelve el que
  corresponda, y cuando `sex` es `unspecified`, el **mayor** de los dos.
- **Por qué**: la tabla se verificó consultando la fuente primaria en el
  momento de escribir esta decisión (2026-09-14), no de memoria ni de una copia
  de segunda mano, precisamente por lo que pide CLAUDE.md sobre no inventar ni
  copiar de un blog. La fila de "19–30 y" se descarta frente a la de "31–50 y"
  por pura arbitrariedad de elegir una sola: para 21 de los 22 nutrientes dan
  exactamente lo mismo, y solo el magnesio distingue las dos (310/400 mg frente
  a 320/420 mg), diferencia sin efecto práctico. Tomar el mayor de los dos
  sexos cuando no se declara es la lectura prudente del requisito de salud del
  proyecto: un objetivo de referencia inflado dice "te falta esto" cuando no es
  cierto, que es un error inofensivo; uno deflactado puede decir "vas bien"
  cuando no lo estás, que es el error que hay que evitar.
- **Alternativa descartada**: (a) un solo juego de valores de adulto,
  eligiendo uno de los dos sexos, que es justo el "medio inventado" que
  CLAUDE.md pide evitar; (b) por sexo y por tramo de edad, la opción más fiel a
  la fuente, descartada porque obligaría a pedir la fecha de nacimiento antes
  de que sirva para nada más, y hoy no hay ninguna otra pantalla que la
  necesite; (c) EFSA en lugar de NIH ODS, que también habría sido válido según
  CLAUDE.md, pero NIH ODS da una tabla única, completa y consistente para los
  22 micronutrientes del catálogo, mientras que construir la misma cobertura
  con las fichas de EFSA habría significado mezclar veintidós documentos
  distintos con formatos distintos.
- **Consecuencias**: el día que se pida la fecha de nacimiento (por ejemplo,
  para sugerir objetivos con Mifflin-St Jeor), esta decisión se revisa para
  añadir el tramo de edad y se registra aparte. La comprobación de tipos exige
  que el catálogo cubra exactamente los 22 micronutrientes de
  `MICRONUTRIENTS`, con el mismo patrón que ya usa `macros.ts`.

## D-045 Los límites superiores entran ahora; "ND" se representa como ausencia, nunca como cero o como techo inventado
- **Fecha**: 2026-09-14
- **Fase**: 2
- **Estado**: aceptada
- **Contexto**: la misma tabla oficial que da los valores de referencia da
  también el Tolerable Upper Intake Level (UL) de cada nutriente: la cifra por
  encima de la cual conviene avisar. Siete de los veintidós micronutrientes
  (vitamina K, tiamina, riboflavina, B12, potasio, y con matices manganeso y
  magnesio) no tienen uno: la fuente dice "ND", no determinable, porque no hay
  base científica suficiente para fijarlo, no porque nadie lo haya buscado.
- **Decisión**: `ReferenceIntake.upperLimit` es opcional, y `upperLimitFor`
  devuelve `undefined` exactamente en esos siete casos. El panel de
  micronutrientes de un paso posterior no podrá avisar de "te has pasado" en
  ninguno de los siete, y esa limitación es correcta: es la propia ciencia la
  que no tiene un umbral que ofrecer, y fingir uno sería peor que no decir
  nada. El sodio es un caso aparte dentro de la propia decisión: no tiene un UL
  clásico, pero el informe de 2019 introdujo la Chronic Disease Risk Reduction
  Intake (CDRR), pensada para reducir el riesgo de enfermedad crónica y no la
  toxicidad aguda; se usa como si fuera el `upperLimit` porque cumple la misma
  función de cara a quien usa la aplicación (2 300 mg/día, "reduce si lo
  superas"), documentando en el propio catálogo que su origen científico es
  distinto del resto.
- **Por qué**: D-001 ya fijó la regla general —la ausencia de una clave
  significa "no se sabe", nunca se rellena con un valor que sustituya
  silenciosamente al dato que falta— y esto es esa misma regla aplicada a un
  límite en vez de a una medida. La alternativa de poner un cero, o de copiar
  el límite de un nutriente parecido, contaminaría el panel con avisos falsos:
  un "0 mg de margen" para la tiamina se leería como "ya te has pasado", que es
  exactamente lo que la fuente no dice.
- **Alternativa descartada**: (a) esconder de la interfaz los nutrientes sin
  UL, que es la variante de "esconder lo incompleto" que D-026 ya rechazó por
  otro motivo parecido; (b) fijar un límite propio "razonable" a ojo para los
  siete, que es inventar un dato con la apariencia de estar citado; (c) tratar
  el CDRR del sodio como un UL más sin decir que es un tipo de cifra distinto,
  que habría sido más simple pero menos honesto sobre lo que esa cifra
  significa de verdad.
- **Consecuencias**: el componente que pinte una barra de progreso por
  micronutriente tiene que saber dibujar "sin límite conocido" como un estado
  legítimo, no como un hueco vacío por accidente.

## D-046 El suelo de calorías depende del sexo, y se documenta que su fuente es más débil que la del resto de referencias
- **Fecha**: 2026-09-14
- **Fase**: 2
- **Estado**: aceptada
- **Contexto**: `MIN_ENERGY_GOAL` valía 1200 kcal desde la fase 1, marcado
  expresamente como "límite conservador provisional" a la espera de esta fase.
  Al ir a revisarlo con su fuente citada, como pedía ese comentario, resultó
  que **no existe** una tabla oficial de "mínimo de calorías" del mismo tipo
  que la de los micronutrientes: las Dietary Reference Intakes calculan el
  requerimiento energético (EER) con una fórmula que depende de edad, peso,
  talla y actividad, no con un número único por grupo del que se pueda tomar
  un suelo.
- **Decisión**: el suelo pasa a depender del sexo —1200 kcal para mujer o sin
  especificar, 1500 kcal para hombre—, que es la convención clínica y dietética
  más citada por encima del umbral de las dietas de muy pocas calorías (VLCD,
  por debajo de 800 kcal/día, que la literatura del NIH National Task Force on
  the Prevention and Treatment of Obesity liga a supervisión médica por riesgo
  de desequilibrios electrolíticos). Y se documenta con toda claridad, en el
  propio código, que esta cifra **no tiene el mismo respaldo** que los valores
  de referencia de D-044: es un margen de práctica clínica sobre un umbral de
  seguridad, no una fila de una tabla RDA/AI.
- **Por qué**: la alternativa de callar la diferencia y presentar 1200/1500
  como si vinieran de la misma clase de fuente que el resto de valores de
  referencia habría sido precisamente lo que CLAUDE.md prohíbe con más fuerza:
  hacer pasar una cifra por algo que no es. Es preferible una cifra bien
  documentada sobre su origen real que una cifra con una cita que exagera su
  certeza.
  Sobre el sexo: el suelo, a diferencia de un valor de referencia, es un límite
  que **impide** guardar un objetivo, así que la prudencia va al revés que en
  D-044. Ahí, sin sexo declarado, se toma el mayor de los dos porque sugerir de
  más es inofensivo. Aquí, sin sexo declarado, se toma el **menor** de los dos
  (1200, no 1500): subirlo bloquearía a cualquier mujer que no haya declarado
  su sexo con un límite pensado para hombres, y esa dirección del error sí es
  perjudicial.
- **Alternativa descartada**: (a) dejar 1200 kcal para todos sin distinguir
  sexo, más simple y ya vigente, pero es exactamente la cifra "medio inventada"
  que este paso tenía que corregir con una fuente citada; (b) calcular el suelo
  con la fórmula EER completa a partir de los datos corporales, que sería lo
  más fiel pero exige que existan `body.heightCm`, `body.weightKg` y
  `body.activityLevel`, datos que hoy no se piden y que convertirían un límite
  de seguridad en algo que depende de haber rellenado un formulario opcional.
- **Consecuencias**: `isEnergyGoalAllowed` gana un segundo parámetro opcional,
  `sex`, con `'unspecified'` por defecto, así que ningún código existente que
  la llamara sin ese argumento se rompe (hoy no la llama nadie fuera de sus
  propios tests). Si en el futuro se calcula el EER completo con los datos
  corporales, esta decisión se revisa y se sustituye.

## D-047 USDA FoodData Central se consulta a través de una función serverless propia, con la clave solo en el servidor
- **Fecha**: 2026-09-14
- **Fase**: 2
- **Estado**: aceptada
- **Contexto**: D-013 puso Open Food Facts detrás de una función serverless
  propia y ya avisó de que la misma capa haría falta para USDA: *"es la misma
  capa que la fase 2 necesitará para esconder la clave de USDA, así que
  montarla ahora no es trabajo adelantado, es no montarla dos veces"*. Con la
  fase 2 en marcha, tocaba escribirla. La diferencia con OFF es que aquí sí hay
  un secreto de verdad: la clave de `api.data.gov` que da acceso a FDC, con un
  cupo (1000 peticiones por hora y por IP) que se agotaría para todo el mundo
  si se filtrara, y no una simple cabecera de cortesía como el `User-Agent` de
  OFF.
- **Decisión**: dos funciones serverless nuevas, `/api/usda/search` y
  `/api/usda/food/[fdcId]`, calcadas del patrón de `api/off/`: adaptadores de
  tres líneas, con toda la lógica en `api/_lib/usda.ts` (construcción de URL,
  validación, llamada con tiempo máximo) y `api/_lib/usda-handlers.ts`
  (los dos manejadores, con sus dependencias por parámetro). Reutilizan el
  vocabulario de `http.ts` (`ErrorCode`, cabeceras de caché) y el patrón de
  `rate-limit.ts`, con un cubo propio (`usdaBucket`, 15/min, ~900/hora, por
  debajo del límite documentado). La clave se lee de `process.env.USDA_API_KEY`
  dentro de la función, nunca llega al navegador, y si falta se devuelve un
  `500` controlado sin mencionar el nombre de la variable en la respuesta.
  `.env.example` documenta el nombre de la variable, sin ningún valor.
- **Por qué**: es la razón de D-013 (nunca hablar con una fuente externa desde
  el navegador) más el motivo nuevo que esa decisión ya anticipaba. Que las dos
  fuentes compartan `http.ts` y el patrón de `rate-limit.ts` no es
  casualidad: el trato con el navegador es el mismo trato sea cual sea la
  fuente de detrás, y duplicar ese vocabulario para USDA habría significado
  mantener dos copias de la misma regla (D-040 aplicada dos veces por
  separado). Que vivan en un archivo `usda-handlers.ts` distinto de
  `handlers.ts`, y no mezcladas, es al revés: son dos fuentes externas con su
  propio formato de campos por debajo, y cambian por motivos distintos.
- **Alternativa descartada**: (a) guardar la clave en una variable pública de
  Vite (`VITE_USDA_API_KEY`) y llamar a FDC desde el navegador, que es
  exactamente lo que D-013 prohíbe y aquí sería peor: una cabecera de
  identificación filtrada es molesta, una clave de API filtrada es un cupo
  ajeno agotado por cualquiera que abra las herramientas de desarrollo; (b)
  un único archivo de manejadores para OFF y USDA, más corto de escribir hoy y
  más caro de leer en cuanto una de las dos fuentes cambie su formato de
  error y haya que averiguar si afecta a la otra.
- **Consecuencias**: un fallo real se encontró escribiendo los tests y no a
  ojo: `new URL(ruta, base)` trata una ruta que empieza por "/" como absoluta,
  y sustituye toda la ruta de la base en lugar de añadirse a ella. Con
  `FDC_BASE` sin barra final, `buildFoodUrl` perdía el "/fdc/v1" de la URL
  real y apuntaba a un dominio que no existe. Se detectó porque el test
  comprobaba la ruta completa (`url.pathname`) y no solo el dominio, que es la
  comprobación que sí habría pasado con el error dentro. Corregido con la
  barra final en la base y rutas relativas sin barra inicial.

  Un segundo hallazgo, este comprobado contra la API real y no en su
  documentación: el formato por defecto de `/food/{fdcId}` da un
  `foodNutrients[]` cuya forma depende del tipo de dato de la fuente, y para
  los alimentos de marca ("Branded", la mayoría de una búsqueda real) **no
  lleva en ningún sitio el número que identifica cada nutriente**, solo un
  identificador de fila interno y la cantidad. `buildFoodUrl` pide ahora
  `format=abridged`, que da siempre la misma forma plana
  (`{ number, name, amount, unitName }`) sea cual sea el tipo de dato. Sin
  este parámetro, el cliente de la fase 2 que traduce el número de nutriente
  de FDC a las claves de `Micronutrients` se habría quedado ciego justo en el
  caso más común, y no en un caso raro.

---

## D-048 El cliente de USDA nace en dos etapas: identidad y macros al buscar, micronutrientes al completar
- **Fecha**: 2026-09-14
- **Fase**: 2
- **Estado**: aceptada
- **Contexto**: al escribir `services/usda/` (D-047 puso el servidor; faltaba
  el cliente) se comprobó contra la API real que `/foods/search` y
  `/food/{fdcId}?format=abridged` no traen el mismo dato. Una búsqueda real de
  un alimento de marca trae 10-14 nutrientes básicos; la ficha completa trae
  el panel entero. Guardar directamente lo que da la búsqueda como si fuera
  el perfil definitivo habría congelado en el catálogo, y más tarde en el
  historial (D-003), un alimento con aspecto de dato completo y la mayoría de
  sus micronutrientes ausentes sin que nadie lo hubiera decidido.
- **Decisión**: dos funciones de normalización, no una. `normalizeSearchFood`
  convierte un resultado de búsqueda en un `Food`/`FoodDraft` con identidad y
  macros, y con `micros: {}` a propósito. `normalizeFoodDetail` convierte la
  ficha en el mismo tipo, con el panel de veintiún micronutrientes completo
  (el yodo queda siempre ausente: ver más abajo). La tarjeta de un resultado
  de USDA en la interfaz debe decir que los micronutrientes se completan al
  añadir, y registrar un alimento de USDA en el diario debe pasar antes por
  `fetchUsdaFoodProfile` (que llama a la ficha y normaliza con
  `normalizeFoodDetail`), nunca tomar la instantánea de D-003 directamente
  del resultado de búsqueda.

  De paso, dos piezas que ya no eran solo de Open Food Facts se movieron a
  `services/shared/`: el vocabulario de error (`API_ERROR_CODES`,
  `apiErrorSchema`, antes en `off/schemas.ts`) y el contexto de normalización
  (`NormalizationContext`, antes en `off/normalize.ts`). Las dos fuentes
  comparten literalmente el mismo contrato de error (`api/_lib/http.ts` define
  un único `ErrorCode` para las dos, D-047) y el mismo concepto de
  dependencias impuras inyectadas (reloj, generador de identificadores). Cada
  cliente sigue declarando su propia unión de error (`OffErrorCode`,
  `UsdaErrorCode`) y su propia comprobación de sincronía en tiempo de
  compilación, porque el manejo de errores de una fuente no debe depender del
  de la otra, pero la lista de códigos posibles y el contexto de
  normalización sí son, de verdad, la misma cosa.
- **Por qué**: es la misma regla que ya cerró D-001 y D-002 aplicada a una
  fuente nueva. "Ausente" en `Micronutrients` significa "desconocido", y un
  resultado de búsqueda de USDA sin panel de micronutrientes es honestamente
  eso: desconocido todavía, no cero. El problema no es la representación, que
  ya es correcta por construcción; es la trampa de dejar que ese desconocido
  se congele para siempre en el momento de registrar la comida, cuando el
  dato completo estaba a una petición de distancia.
- **Alternativa descartada**: (a) pedir la ficha completa por cada fila de un
  resultado de búsqueda, en cuanto aparece en pantalla. Da micronutrientes en
  la lista, pero multiplica las peticiones a FDC por el número de resultados
  visibles, el mismo error de fondo que D-041 corrigió para Open Food Facts,
  aplicado a una fuente distinta; (b) tratar el resultado de búsqueda como
  suficiente y no completar nunca, que habría sido más simple pero traiciona
  D-003 con datos incompletos que aparentan estar completos.
- **Consecuencias**: queda pendiente de mi revisión en qué paso concreto entra
  el cableado de esto en la pantalla de búsqueda (el aviso "se completa al
  añadir" en la tarjeta, y la llamada a `fetchUsdaFoodProfile` antes de
  navegar a registrar). Este PR entrega solo la capa de servicio
  (`services/usda/schemas.ts`, `nutrients.ts`, `normalize.ts`, `client.ts`,
  `index.ts`), probada de forma aislada, sin tocar `SearchPage` ni
  `SearchResults`: es la elección conservadora mientras no se decida si ese
  cableado es un paso propio o entra en el del panel de micronutrientes.

  El yodo (`iodine`) no tiene número de nutriente FDC mapeado. FDC lo
  alimenta desde una base de colaboración NIH/FDA/USDA aparte del panel
  habitual, la inmensa mayoría de alimentos no lo declaran, y no hay un
  número único y fiable para él en lo que trae una búsqueda o una ficha
  normales. Queda siempre ausente para un alimento de fuente USDA (D-001):
  inventarlo sería presentar una estimación con aspecto de dato real. `salt`
  (la macro opcional de OFF) tampoco se deriva del sodio de FDC por el mismo
  motivo: convertir sodio en sal exige un factor (~2,5) que nadie ha medido
  para ese alimento concreto.

---

## D-049 USDA entra en la pantalla de búsqueda: cierra D-048
- **Fecha**: 2026-09-14
- **Fase**: 2
- **Estado**: aceptada
- **Contexto**: D-048 dejó pendiente, a propósito y por escrito, en qué paso
  entraría el cableado de USDA en la pantalla de búsqueda. Con el cliente
  completo y sin usarse desde ninguna pantalla, la fase 2 no cumplía su
  propio motivo de existir: buscar "espinacas" o "manzana" seguía sin
  encontrar nada, porque Open Food Facts cubre bien lo envasado y trae poco
  de lo fresco, que es justo lo que USDA FoodData Central tiene en
  abundancia (su base SR Legacy es sobre todo alimentos crudos y básicos).
- **Decisión**: la misma búsqueda confirmada sale a la vez a las dos fuentes,
  en dos secciones separadas de `SearchPage` ("En Open Food Facts" / "En USDA
  FoodData Central"), cada una con su propio hook (`useUsdaFoodSearch`,
  calcado de `useFoodSearch`), sus propios estados (`UsdaSearchStates.tsx`) y
  sus propios mensajes de error (`usda-error-messages.ts`). "En tu catálogo"
  no se duplica: ya era agnóstica de fuente y ahora enseña alimentos de las
  dos indistintamente.

  Cada tarjeta de un resultado de USDA lleva un aviso ("los micronutrientes
  se completan al añadir esta comida al diario"), coherente con D-029: un
  resultado incompleto explica qué le falta en el propio resultado en vez de
  parecer un fallo. Y "añadir al diario" para uno de USDA
  (`AddUsdaFoodLink`) no es el enlace inmediato de OFF: primero llama a
  `fetchUsdaFoodProfile`, guarda el perfil completo en el alimento ya
  adoptado (`mergeUsdaDetailIntoCatalogFood`, que conserva la identidad del
  catálogo y toma el perfil nutricional de la ficha) y solo entonces navega a
  registrar. Si el alimento ya se completó antes (una visita anterior, o
  desde "en tu catálogo"), no vuelve a pedir la ficha: `Object.keys(...).length
  > 0` en sus micronutrientes ya dice que no hace falta.

  Tres arreglos de fondo, encontrados al construir esto y no al buscarlos:
  1. `foodRepository.adopt()` no deduplicaba por `fdcId` como sí hacía por
     código de barras: cada búsqueda de un mismo alimento de USDA habría
     creado una fila nueva del catálogo. Arreglado con el mismo trato que
     el código de barras, y un índice nuevo (`[isDeleted+source.fdcId]`,
     versión 2 del esquema de Dexie, D-015).
  2. La política de reintentos del `QueryClient` (`shouldRetryOffQuery`,
     D-040) era sin saberlo la política de TODA la aplicación, porque
     ninguna consulta local lanza un `OffApiError` y por eso siempre daba
     `false` para ellas, por casualidad. Con USDA de por medio, un
     `UsdaApiError` tampoco es un `OffApiError`, así que sus fallos de red se
     habrían quedado sin ningún reintento, también por casualidad y no por
     decisión. Ahora `shouldRetryQuery` despacha a la lista de cada fuente.
  3. `dbKeys.food` (la clave de caché de un alimento por identificador) vivía
     en `features/diary/queries.ts`, pero desde que completar un alimento de
     USDA necesita invalidarla también desde `features/food-search/`, y
     D-027 prohíbe que una funcionalidad importe de la otra, se mudó a
     `foodKeys` en `data/repositories/foods.ts`, que las dos ya importaban.
- **Por qué**: mostrar las dos fuentes a la vez, en vez de una detrás de otra
  o tras un interruptor, es lo que de verdad resuelve el problema que
  motivó todo esto: encontrar alimentos frescos sin tener que saber de
  antemano en qué base de datos están. El aviso en la tarjeta y el
  completar-antes-de-navegar son la aplicación directa de D-048: la
  instantánea de D-003 nunca puede salir de un resultado de búsqueda a
  medias.
- **Alternativa descartada**: (a) pedir la ficha completa de cada resultado
  de USDA en cuanto aparece en pantalla, en vez de al añadir, que es la
  opción que D-048 ya descartó por multiplicar las peticiones exactamente
  por el número de resultados visibles (el error de fondo de D-041, aplicado
  a otra fuente); (b) un selector para elegir "buscar en OFF" o "buscar en
  USDA" antes de escribir, que traslada a quien busca una decisión que la
  aplicación puede tomar por su cuenta sin coste real, dado que las dos
  búsquedas ya salían gratis en paralelo.
- **Consecuencias**: esto no añade ninguna forma de editar
  `DailyGoals.micros` desde la interfaz, así que `targetSource` del panel de
  micronutrientes (D-050, en otra rama todavía sin fusionar) sigue valiendo
  `'reference'` siempre en la práctica. Lo que sí cambia es que ahora los
  alimentos de USDA registrados en el diario aportan de verdad micronutrientes
  al total del día, que es lo que ese panel necesitaba para tener algo que
  enseñar más allá de lo que ya trajera Open Food Facts.
