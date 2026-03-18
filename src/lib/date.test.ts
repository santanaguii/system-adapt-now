import { describe, expect, it } from 'vitest';
import { normalizeDateKey } from './date';

describe('normalizeDateKey', () => {
  it('keeps date-only values unchanged', () => {
    expect(normalizeDateKey('2026-03-17')).toBe('2026-03-17');
  });

  it('converts ISO timestamps into a date key in the configured timezone', () => {
    expect(normalizeDateKey('2026-03-17T03:00:00.000Z')).toBe('2026-03-17');
  });

  it('returns null for invalid values', () => {
    expect(normalizeDateKey('')).toBeNull();
    expect(normalizeDateKey('nao-e-data')).toBeNull();
  });
});
