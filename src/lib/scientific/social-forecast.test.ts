import { describe, expect, it } from 'vitest';
import { calculateSocialForecast } from './social-forecast';

describe('calculateSocialForecast', () => {
  it('returns sorted states with probabilities in 0..1', () => {
    const out = calculateSocialForecast({
      avgAnxiety: 5,
      emotions: { anger: 0.4, fear: 0.3, calmness: 0.1 },
      dominantArchetypes: ['conflict', 'war'],
      dominantNarrative: 'conflict',
      coherence: 0.6,
      entryCount: 10,
      uniqueUsers: 25,
    });
    expect(out.length).toBeGreaterThan(0);
    expect(out[0].probability).toBeLessThanOrEqual(1);
    expect(out[0].probability).toBeGreaterThanOrEqual(0);
    for (let i = 1; i < out.length; i++) {
      expect(out[i - 1].probability).toBeGreaterThanOrEqual(out[i].probability);
    }
  });
});
