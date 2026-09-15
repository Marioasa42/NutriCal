/**
 * Detener un `MediaStream` de la cámara.
 *
 * Aparte y no en línea dentro de `BarcodeScanner.tsx` porque es el único
 * trozo de la liberación de la cámara que de verdad se puede probar sin un
 * navegador real: `BarcodeScanner` lo llama desde la única función de
 * limpieza de su `useEffect`, y esa misma función es la que corre al cerrar
 * el visor, al desmontarse el componente y al cambiar de ruta -las tres son
 * la misma llamada de React, no tres caminos que puedan desincronizarse-.
 * Dejar un `track` sin detener mantiene la cámara encendida (y gastando
 * batería) aunque quien la usó crea que ya la cerró.
 */
export function stopMediaStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}
