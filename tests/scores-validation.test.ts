import { describe, it, expect } from 'vitest';
import { validateScoreValues } from '@/lib/services/scores';

const maxById = { c1: 25, c2: 25 };

describe('validateScoreValues', () => {
  it('accepts a valid set', () => {
    expect(validateScoreValues([{ criterionId: 'c1', value: 20 }, { criterionId: 'c2', value: 0 }], maxById)).toBeNull();
  });
  it('rejects a negative value', () => {
    expect(validateScoreValues([{ criterionId: 'c1', value: -1 }], maxById)).not.toBeNull();
  });
  it('rejects a value greater than the criterion max', () => {
    expect(validateScoreValues([{ criterionId: 'c1', value: 26 }], maxById)).not.toBeNull();
  });
  it('rejects NaN/blank values', () => {
    expect(validateScoreValues([{ criterionId: 'c1', value: NaN }], maxById)).not.toBeNull();
    // @ts-expect-error simulating blank/empty string coming from a loose client payload
    expect(validateScoreValues([{ criterionId: 'c1', value: '' }], maxById)).not.toBeNull();
  });
  it('rejects an unknown criterionId', () => {
    expect(validateScoreValues([{ criterionId: 'unknown', value: 5 }], maxById)).not.toBeNull();
  });
});
