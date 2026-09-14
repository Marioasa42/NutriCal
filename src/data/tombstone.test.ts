import { describe, expect, it } from 'vitest';

import { asDeleted, asRestored, asTouched } from '@/data/tombstone';
import { toStored, ALIVE, DELETED } from '@/data/stored';
import { instant } from '@/domain/time/local-date';
import { makeMealEntry } from '@/test/factories';

/**
 * La lápida y su reverso.
 *
 * Lo que se prueba aquí no es que se asigne un campo: es que "viva" tenga UNA
 * sola representación. D-001 dice que la ausencia de una clave es el estado, y
 * no un valor especial; si deshacer dejara `deletedAt: undefined` en lugar de
 * quitar la clave, habría dos maneras de decir lo mismo y el campo derivado
 * `isDeleted` podría contradecir al dominio.
 */

const T1 = instant('2026-09-14T10:00:00.000Z');
const T2 = instant('2026-09-14T11:00:00.000Z');

describe('asRestored', () => {
  it('quita la clave, no la pone a undefined', () => {
    const buried = asDeleted(makeMealEntry(), T1);
    const alive = asRestored(buried, T2);

    expect('deletedAt' in alive).toBe(false);
    expect(alive.deletedAt).toBeUndefined();
  });

  it('mueve updatedAt, porque resucitar es un cambio como cualquier otro', () => {
    // Lo necesita la sincronización de la fase 4: si deshacer no compitiera en
    // el mismo orden temporal que el borrado, otro dispositivo podría volver a
    // aplicar la lápida encima.
    const buried = asDeleted(makeMealEntry(), T1);
    expect(asRestored(buried, T2).updatedAt).toBe(T2);
  });

  it('el campo derivado del almacenamiento vuelve a decir "viva"', () => {
    const entry = makeMealEntry();
    expect(toStored(asDeleted(entry, T1)).isDeleted).toBe(DELETED);
    expect(toStored(asRestored(asDeleted(entry, T1), T2)).isDeleted).toBe(ALIVE);
  });

  it('resucitar algo que ya estaba vivo solo le toca la marca de tiempo', () => {
    const entry = makeMealEntry();
    const touched = asRestored(entry, T2);

    expect('deletedAt' in touched).toBe(false);
    expect(touched.updatedAt).toBe(T2);
    expect(touched.id).toBe(entry.id);
  });

  it('es exactamente lo contrario de asDeleted, salvo las marcas de tiempo', () => {
    const entry = asTouched(makeMealEntry(), T1);
    expect(asRestored(asDeleted(entry, T2), T1)).toEqual(entry);
  });
});
