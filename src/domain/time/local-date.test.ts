import { describe, expect, it } from 'vitest';

import {
  addDays,
  compareLocalDates,
  localDate,
  toLocalDate,
  today,
} from '@/domain/time/local-date';
import { InvariantError } from '@/shared/lib/invariant';

describe('localDate', () => {
  it('acepta fechas bien formadas', () => {
    expect(localDate('2026-09-12')).toBe('2026-09-12');
  });

  it('rechaza formatos que no son YYYY-MM-DD', () => {
    expect(() => localDate('12/09/2026')).toThrow(InvariantError);
    expect(() => localDate('2026-9-12')).toThrow(InvariantError);
    expect(() => localDate('2026-09-12T10:00:00Z')).toThrow(InvariantError);
  });

  it('rechaza fechas que no existen en el calendario', () => {
    expect(() => localDate('2026-02-31')).toThrow(InvariantError);
    expect(() => localDate('2026-13-01')).toThrow(InvariantError);
  });

  it('acepta el 29 de febrero en año bisiesto', () => {
    expect(localDate('2028-02-29')).toBe('2028-02-29');
  });
});

describe('toLocalDate', () => {
  // El caso que justifica toda la decisión: el mismo instante es un día distinto
  // según dónde estés. Una cena a las 23:30 en Madrid ya es el día siguiente en
  // hora UTC, y sigue siendo el día anterior en Nueva York.
  const lateDinnerInMadrid = new Date('2026-09-12T22:30:00Z');

  it('da el día local de cada zona para el mismo instante', () => {
    expect(toLocalDate(lateDinnerInMadrid, 'Europe/Madrid')).toBe('2026-09-13');
    expect(toLocalDate(lateDinnerInMadrid, 'UTC')).toBe('2026-09-12');
    expect(toLocalDate(lateDinnerInMadrid, 'America/New_York')).toBe('2026-09-12');
    expect(toLocalDate(lateDinnerInMadrid, 'Asia/Tokyo')).toBe('2026-09-13');
  });

  it('respeta el cambio de hora de verano', () => {
    // En 2026 el horario de verano europeo termina el 25 de octubre a las 03:00
    // locales. Una hora antes del cambio ya es día 25 en Madrid.
    const beforeSwitch = new Date('2026-10-24T23:30:00Z');
    expect(toLocalDate(beforeSwitch, 'Europe/Madrid')).toBe('2026-10-25');
  });

  it('today usa el reloj que se le pase', () => {
    expect(today('Europe/Madrid', lateDinnerInMadrid)).toBe('2026-09-13');
  });
});

describe('addDays', () => {
  it('avanza y retrocede días', () => {
    expect(addDays(localDate('2026-09-12'), 1)).toBe('2026-09-13');
    expect(addDays(localDate('2026-09-12'), -1)).toBe('2026-09-11');
    expect(addDays(localDate('2026-09-12'), 0)).toBe('2026-09-12');
  });

  it('cruza el final de mes y de año', () => {
    expect(addDays(localDate('2026-01-31'), 1)).toBe('2026-02-01');
    expect(addDays(localDate('2026-12-31'), 1)).toBe('2027-01-01');
  });

  it('cuenta bien un año bisiesto', () => {
    expect(addDays(localDate('2028-02-28'), 1)).toBe('2028-02-29');
    expect(addDays(localDate('2028-02-29'), 1)).toBe('2028-03-01');
  });

  it('no se desplaza al cruzar un cambio de hora', () => {
    // Si addDays usara aritmética de milisegundos en hora local, este salto
    // perdería o ganaría un día por la hora que quita el cambio horario.
    expect(addDays(localDate('2026-10-24'), 2)).toBe('2026-10-26');
  });

  it('rechaza desplazamientos que no son enteros', () => {
    expect(() => addDays(localDate('2026-09-12'), 1.5)).toThrow(InvariantError);
  });
});

describe('compareLocalDates', () => {
  it('ordena cronológicamente', () => {
    const dates = [localDate('2026-12-01'), localDate('2026-01-05'), localDate('2026-03-20')];
    expect([...dates].sort(compareLocalDates)).toEqual(['2026-01-05', '2026-03-20', '2026-12-01']);
  });
});
