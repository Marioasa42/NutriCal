import { describe, expect, it } from 'vitest';

import { localDate } from '@/domain/time/local-date';
import { formatLocalDate, formatLocalDateShort } from '@/shared/lib/format-date';

describe('formatLocalDate', () => {
  it('enseña el día que dice la fecha', () => {
    expect(formatLocalDate(localDate('2026-09-13'))).toBe('domingo, 13 de septiembre de 2026');
  });

  it('no se desplaza en zonas horarias al oeste de Greenwich', () => {
    // El test que justifica el `timeZone: 'UTC'` de la implementación. Sin él,
    // `new Date('2026-09-13')` es medianoche UTC, que en Los Ángeles son las
    // cinco de la tarde del día 12, y la pantalla enseñaría el día anterior al
    // que dice la URL. Se comprueba con un idioma cuyo formato no depende del
    // huso para que lo único que pueda fallar sea el día.
    const formatted = formatLocalDate(localDate('2026-09-13'), 'en-CA');
    expect(formatted).toContain('13');
    expect(formatted).not.toContain('12');
  });

  it('tampoco se desplaza al este', () => {
    const formatted = formatLocalDate(localDate('2026-09-13'), 'en-CA');
    expect(formatted).not.toContain('14');
  });

  it('da el primer y el último día del año sin cambiar de año', () => {
    expect(formatLocalDate(localDate('2026-01-01'))).toContain('2026');
    expect(formatLocalDate(localDate('2026-12-31'))).toContain('2026');
  });
});

describe('formatLocalDateShort', () => {
  it('omite el año y el día de la semana', () => {
    const formatted = formatLocalDateShort(localDate('2026-09-13'));
    expect(formatted).toContain('13');
    expect(formatted).not.toContain('2026');
  });
});
