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
