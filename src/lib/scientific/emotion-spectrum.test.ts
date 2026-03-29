import { describe, expect, it } from 'vitest';
import {
  averageEmotionMaps,
  centroidEmotionCoherence,
  flattenEmotionalSpectrum,
} from './emotion-spectrum';

describe('flattenEmotionalSpectrum', () => {
  it('maps emotion tags from array to scores', () => {
    const out = flattenEmotionalSpectrum({
      emotions: ['fear', 'anger'],
      anxiety_score: 5,
    });
    expect(out.fear).toBeGreaterThan(0);
    expect(out.anger).toBeGreaterThan(0);
    expect(out.anxiety).toBeGreaterThanOrEqual(0.5);
    expect(out.anxiety).toBeLessThanOrEqual(1);
  });

  it('returns empty for null', () => {
    expect(flattenEmotionalSpectrum(null)).toEqual({});
  });
});

describe('averageEmotionMaps', () => {
  it('averages two maps', () => {
    const a = averageEmotionMaps(
      [
        { fear: 0.4, anger: 0.2 },
        { fear: 0.2, anger: 0.4 },
      ],
      2
    );
    expect(a.fear).toBeCloseTo(0.3, 2);
    expect(a.anger).toBeCloseTo(0.3, 2);
  });
});

describe('centroidEmotionCoherence', () => {
  it('returns mid value for short series', () => {
    expect(centroidEmotionCoherence([{ a: 1 }])).toBe(0.5);
  });

  it('is higher when maps align', () => {
    const c1 = centroidEmotionCoherence([
      { fear: 0.5, anger: 0.5 },
      { fear: 0.5, anger: 0.5 },
    ]);
    const c2 = centroidEmotionCoherence([
      { fear: 1, anger: 0 },
      { fear: 0, anger: 1 },
    ]);
    expect(c1).toBeGreaterThan(c2);
  });
});
