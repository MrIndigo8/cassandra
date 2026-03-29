export interface SocialForecast {
  state: string;
  probability: number;
  confidence: number;
  drivers: string[];
  trend: 'rising' | 'falling' | 'stable';
}

export interface PsycheInputs {
  avgAnxiety: number;
  emotions: Record<string, number>;
  dominantArchetypes: string[];
  dominantNarrative: string;
  coherence: number;
  entryCount: number;
  uniqueUsers: number;
}

const ARCH_ALIASES: Record<string, string[]> = {
  Shadow: ['shadow', 'conflict', 'war', 'terror', 'attack', 'political_crisis'],
  Explorer: ['explorer', 'discovery', 'earthquake', 'hurricane', 'flood'],
  Magician: ['magician', 'magic', 'transform', 'epidemic'],
  Creator: ['creator', 'creation', 'build'],
  Hero: ['hero', 'social', 'rescue', 'personal'],
  Destroyer: ['destroyer', 'disaster', 'explosion', 'fire', 'collapse', 'volcanic'],
  Outlaw: ['outlaw', 'protest', 'riot', 'terror_attack'],
  Ruler: ['ruler', 'government', 'political'],
  Mother: ['mother', 'care', 'nurture'],
  Child: ['child', 'innocent'],
  Everyman: ['everyman', 'ordinary', 'personal', 'unknown'],
};

function hasArchetype(archetypes: string[], name: string): boolean {
  const needles = ARCH_ALIASES[name] || [name.toLowerCase()];
  return archetypes.some((a) => {
    const al = a.toLowerCase();
    return needles.some((n) => al.includes(n));
  });
}

export function calculateSocialForecast(inputs: PsycheInputs): SocialForecast[] {
  const {
    avgAnxiety,
    emotions,
    dominantArchetypes,
    dominantNarrative,
    coherence,
    entryCount,
    uniqueUsers,
  } = inputs;

  const e = (key: string) => emotions[key] || 0;
  const confidence = Math.min(1, uniqueUsers / 20);

  const forecasts: SocialForecast[] = [];

  const stabilityScore =
    (1 - avgAnxiety / 10) * 0.3 +
    e('calmness') * 0.25 +
    e('satisfaction') * 0.2 +
    (dominantNarrative === 'observation' || dominantNarrative === 'creation' ? 0.15 : 0) +
    (1 - e('anger')) * 0.1;
  forecasts.push({
    state: 'STABILITY',
    probability: clamp(stabilityScore),
    confidence,
    drivers: buildDrivers({
      calmness: e('calmness'),
      anxiety_low: 1 - avgAnxiety / 10,
    }),
    trend: 'stable',
  });

  const reformScore =
    (avgAnxiety >= 3 && avgAnxiety <= 6 ? 0.2 : 0) +
    e('interest') * 0.2 +
    e('excitement') * 0.15 +
    (dominantNarrative === 'transformation' || dominantNarrative === 'quest' ? 0.25 : 0) +
    (hasArchetype(dominantArchetypes, 'Explorer') ||
    hasArchetype(dominantArchetypes, 'Magician') ||
    hasArchetype(dominantArchetypes, 'Creator')
      ? 0.2
      : 0);
  forecasts.push({
    state: 'REFORM_MOMENTUM',
    probability: clamp(reformScore),
    confidence,
    drivers: buildDrivers({
      interest: e('interest'),
      transformation: dominantNarrative === 'transformation' ? 1 : 0,
    }),
    trend: 'stable',
  });

  const tensionScore =
    (avgAnxiety / 10) * 0.25 +
    e('anger') * 0.2 +
    e('anxiety') * 0.15 +
    (hasArchetype(dominantArchetypes, 'Shadow') ? 0.15 : 0) +
    (dominantNarrative === 'conflict' || dominantNarrative === 'chase' ? 0.15 : 0) +
    (coherence > 0.5 ? 0.1 : 0);
  forecasts.push({
    state: 'SOCIAL_TENSION',
    probability: clamp(tensionScore),
    confidence,
    drivers: buildDrivers({
      anger: e('anger'),
      anxiety: avgAnxiety / 10,
      shadow: hasArchetype(dominantArchetypes, 'Shadow') ? 1 : 0,
    }),
    trend: 'stable',
  });

  const protestScore =
    (avgAnxiety >= 6 ? ((avgAnxiety - 5) / 5) * 0.2 : 0) +
    e('anger') * 0.25 +
    e('disgust') * 0.15 +
    (hasArchetype(dominantArchetypes, 'Outlaw') || hasArchetype(dominantArchetypes, 'Destroyer')
      ? 0.2
      : 0) +
    (dominantNarrative === 'conflict' ? 0.1 : 0) +
    (coherence > 0.6 ? 0.1 : 0);
  forecasts.push({
    state: 'PROTEST_RISK',
    probability: clamp(protestScore),
    confidence,
    drivers: buildDrivers({
      anger: e('anger'),
      disgust: e('disgust'),
      outlaw: hasArchetype(dominantArchetypes, 'Outlaw') ? 1 : 0,
    }),
    trend: 'stable',
  });

  const unrestScore =
    (avgAnxiety >= 8 ? ((avgAnxiety - 7) / 3) * 0.25 : 0) +
    e('horror') * 0.2 +
    e('anger') * 0.2 +
    (hasArchetype(dominantArchetypes, 'Destroyer') ? 0.15 : 0) +
    (dominantNarrative === 'destruction' ? 0.1 : 0) +
    (coherence > 0.7 ? 0.1 : 0);
  forecasts.push({
    state: 'CIVIL_UNREST',
    probability: clamp(unrestScore),
    confidence,
    drivers: buildDrivers({
      horror: e('horror'),
      anger: e('anger'),
      anxiety_extreme: avgAnxiety >= 8 ? 1 : 0,
    }),
    trend: 'stable',
  });

  const authScore =
    e('fear') * 0.25 +
    (1 - e('anger')) * 0.15 +
    e('awkwardness') * 0.1 +
    (hasArchetype(dominantArchetypes, 'Ruler') ? 0.2 : 0) +
    (dominantNarrative === 'observation' || dominantNarrative === 'chase' ? 0.15 : 0) +
    (avgAnxiety >= 5 && e('anger') < 0.2 ? 0.15 : 0);
  forecasts.push({
    state: 'AUTHORITARIAN_GRIP',
    probability: clamp(authScore),
    confidence,
    drivers: buildDrivers({
      fear: e('fear'),
      anger_suppressed: 1 - e('anger'),
      ruler: hasArchetype(dominantArchetypes, 'Ruler') ? 1 : 0,
    }),
    trend: 'stable',
  });

  const griefScore =
    e('sadness') * 0.3 +
    e('nostalgia') * 0.2 +
    (dominantNarrative === 'loss' ? 0.2 : 0) +
    (hasArchetype(dominantArchetypes, 'Mother') || hasArchetype(dominantArchetypes, 'Child')
      ? 0.15
      : 0) +
    e('empathic_pain') * 0.15;
  forecasts.push({
    state: 'COLLECTIVE_GRIEF',
    probability: clamp(griefScore),
    confidence,
    drivers: buildDrivers({
      sadness: e('sadness'),
      nostalgia: e('nostalgia'),
      loss: dominantNarrative === 'loss' ? 1 : 0,
    }),
    trend: 'stable',
  });

  const apathyScore =
    e('boredom') * 0.3 +
    (1 - e('interest')) * 0.2 +
    (1 - e('excitement')) * 0.15 +
    (dominantNarrative === 'observation' ? 0.15 : 0) +
    (hasArchetype(dominantArchetypes, 'Everyman') ? 0.1 : 0) +
    (avgAnxiety < 3 && e('calmness') < 0.3 ? 0.1 : 0);
  forecasts.push({
    state: 'APATHY',
    probability: clamp(apathyScore),
    confidence,
    drivers: buildDrivers({ boredom: e('boredom'), low_interest: 1 - e('interest') }),
    trend: 'stable',
  });

  const polarizationScore =
    (e('anger') > 0.3 && e('fear') > 0.3 ? 0.25 : 0) +
    e('disgust') * 0.15 +
    (1 - coherence) * 0.2 +
    (dominantNarrative === 'conflict' ? 0.15 : 0) +
    (dominantNarrative === 'fragmented' ? 0.15 : 0) +
    (hasArchetype(dominantArchetypes, 'Shadow') && hasArchetype(dominantArchetypes, 'Hero')
      ? 0.1
      : 0);
  forecasts.push({
    state: 'POLARIZATION',
    probability: clamp(polarizationScore),
    confidence,
    drivers: buildDrivers({
      anger_and_fear: Math.min(e('anger'), e('fear')),
      low_coherence: 1 - coherence,
    }),
    trend: 'stable',
  });

  const hopeScore =
    e('joy') * 0.2 +
    e('excitement') * 0.15 +
    e('interest') * 0.15 +
    (dominantNarrative === 'creation' || dominantNarrative === 'transformation' ? 0.2 : 0) +
    (hasArchetype(dominantArchetypes, 'Hero') ||
    hasArchetype(dominantArchetypes, 'Creator') ||
    hasArchetype(dominantArchetypes, 'Magician')
      ? 0.2
      : 0) +
    e('relief') * 0.1;
  forecasts.push({
    state: 'HOPE_RENEWAL',
    probability: clamp(hopeScore),
    confidence,
    drivers: buildDrivers({ joy: e('joy'), creation: dominantNarrative === 'creation' ? 1 : 0 }),
    trend: 'stable',
  });

  const econScore =
    e('anxiety') * 0.2 +
    e('fear') * 0.15 +
    e('craving') * 0.15 +
    (dominantNarrative === 'loss' || dominantNarrative === 'chase' ? 0.2 : 0) +
    (hasArchetype(dominantArchetypes, 'Everyman') || hasArchetype(dominantArchetypes, 'Ruler')
      ? 0.15
      : 0) +
    (avgAnxiety >= 5 ? 0.15 : 0);
  forecasts.push({
    state: 'ECONOMIC_ANXIETY',
    probability: clamp(econScore),
    confidence,
    drivers: buildDrivers({ anxiety: e('anxiety'), craving: e('craving'), fear: e('fear') }),
    trend: 'stable',
  });

  const warScore =
    e('fear') * 0.2 +
    e('horror') * 0.2 +
    (avgAnxiety >= 7 ? ((avgAnxiety - 6) / 4) * 0.15 : 0) +
    (hasArchetype(dominantArchetypes, 'Shadow') || hasArchetype(dominantArchetypes, 'Destroyer')
      ? 0.2
      : 0) +
    (dominantNarrative === 'destruction' || dominantNarrative === 'conflict' ? 0.15 : 0) +
    (coherence > 0.6 ? 0.1 : 0);
  forecasts.push({
    state: 'WAR_FOREBODING',
    probability: clamp(warScore),
    confidence,
    drivers: buildDrivers({
      fear: e('fear'),
      horror: e('horror'),
      shadow: hasArchetype(dominantArchetypes, 'Shadow') ? 1 : 0,
    }),
    trend: 'stable',
  });

  const minData = entryCount >= 3 && uniqueUsers >= 1;
  const adjusted = forecasts.map((f) => ({
    ...f,
    probability: minData ? f.probability : Math.round(f.probability * 0.5 * 100) / 100,
    confidence: minData ? f.confidence : Math.min(f.confidence, 0.3),
  }));

  return adjusted.sort((a, b) => b.probability - a.probability);
}

function clamp(v: number): number {
  return Math.round(Math.max(0, Math.min(1, v)) * 100) / 100;
}

function buildDrivers(factors: Record<string, number>): string[] {
  return Object.entries(factors)
    .filter(([, v]) => v > 0.2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
}
