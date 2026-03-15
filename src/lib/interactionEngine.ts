export interface InteractionResult {
  severity: 'high' | 'moderate' | 'low' | 'none';
  message: string;
  meds: [string, string];
}

const KNOWN_INTERACTIONS: {
  pair: [string, string];
  severity: 'high' | 'moderate' | 'low';
  message: string;
}[] = [
  {
    pair: ['Aspirin', 'Warfarin'],
    severity: 'high',
    message: 'Aspirin and Warfarin together significantly increase bleeding risk. Consult your doctor immediately.',
  },
  {
    pair: ['Ibuprofen', 'Aspirin'],
    severity: 'moderate',
    message: 'Ibuprofen may reduce the cardioprotective effects of Aspirin.',
  },
  {
    pair: ['Lisinopril', 'Potassium'],
    severity: 'moderate',
    message: 'Lisinopril can raise potassium levels. Avoid potassium supplements without medical advice.',
  },
  {
    pair: ['Metformin', 'Alcohol'],
    severity: 'moderate',
    message: 'Combining Metformin with alcohol increases the risk of lactic acidosis.',
  },
];

export function checkInteractions(medications: string[]): InteractionResult[] {
  const results: InteractionResult[] = [];
  const medNames = medications.map((m) => m.toLowerCase());

  for (const interaction of KNOWN_INTERACTIONS) {
    const [a, b] = interaction.pair;
    if (
      medNames.includes(a.toLowerCase()) &&
      medNames.includes(b.toLowerCase())
    ) {
      results.push({
        severity: interaction.severity,
        message: interaction.message,
        meds: interaction.pair,
      });
    }
  }

  return results;
}

export function hasHighRiskInteraction(medications: string[]): InteractionResult | null {
  const interactions = checkInteractions(medications);
  return interactions.find((i) => i.severity === 'high') ?? null;
}
