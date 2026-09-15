import { describe, expect, it } from 'vitest';

import { exportFileName } from '@/features/profile/export-file';
import { anInstant } from '@/test/factories';

describe('exportFileName', () => {
  it('usa la fecha del instante exportado, en formato de archivo', () => {
    expect(exportFileName(anInstant('2026-09-15T09:00:00.000Z'))).toBe('nutrical-2026-09-15.json');
  });
});
