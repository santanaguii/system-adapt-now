import { describe, expect, it } from 'vitest';
import { getPriorityValue } from './useActivities.utils';

describe('getPriorityValue', () => {
  it('normalizes accented and unaccented priority labels', () => {
    expect(getPriorityValue('Alta')).toBe(3);
    expect(getPriorityValue('Média')).toBe(2);
    expect(getPriorityValue('Media')).toBe(2);
    expect(getPriorityValue('Baixa')).toBe(1);
  });

  it('returns zero for invalid values', () => {
    expect(getPriorityValue(null)).toBe(0);
    expect(getPriorityValue('sem-prioridade')).toBe(0);
  });
});
