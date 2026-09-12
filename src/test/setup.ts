// IndexedDB no existe en Node. Esta importación instala una implementación en
// memoria en los globales, para poder probar Dexie de verdad en lugar de
// simularlo con un doble de prueba que nunca se comportaría igual.
import 'fake-indexeddb/auto';
