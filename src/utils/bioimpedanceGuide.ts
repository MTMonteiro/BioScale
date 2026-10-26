import { BioimpedanceMetrics, Sex, UserProfile } from '../types/health';

export type ClinicalStatusLevel = 'optimal' | 'normal' | 'attention' | 'alert';

export interface BioMetricEvaluation {
  key: string;
  label: string;
  shortLabel: string;
  value: number;
  formattedValue: string;
  unit: string;
  category: 'composition' | 'hydration_bone' | 'metabolism';
  status: ClinicalStatusLevel;
  statusLabel: string;
  idealRangeText: string;
  /** Position from 0 to 100 on the horizontal clinical range bar */
  barPositionPercent: number;
  /** Ideal zone start/end percent on the bar (defaults to 28..72) */
  idealZoneStartPercent: number;
  idealZoneEndPercent: number;
  whatItMeans: string;
  howToImprove: string;
}

function clampPercent(val: number): number {
  return Math.max(4, Math.min(96, Math.round(val)));
}

function computeBarPercent(value: number, minScale: number, maxScale: number): number {
  if (maxScale <= minScale) return 50;
  const ratio = ((value - minScale) / (maxScale - minScale)) * 100;
  return clampPercent(ratio);
}

/**
 * Avalia todas as 11 métricas de bioimpedância da balança Wellmix BLE
 * com faixas clínicas personalizadas por sexo e idade, posição em barra
 * horizontal e explicações clínicas sob demanda (Tap-to-Expand).
 */
export function evaluateAllBioimpedanceMetrics(
  metrics: BioimpedanceMetrics,
  profile: UserProfile
): BioMetricEvaluation[] {
  const sex: Sex = profile.sex || 'male';
  const weight = metrics.weightKg || 70;
  const results: BioMetricEvaluation[] = [];

  // 1. Gordura Corporal (%)
  const bfIdealMin = sex === 'male' ? 10 : 18;
  const bfIdealMax = sex === 'male' ? 20 : 28;
  const bfAttentionMax = sex === 'male' ? 25 : 33;
  const bf = metrics.bodyFatPercent;
  let bfStatus: ClinicalStatusLevel = 'optimal';
  let bfLabel = 'Ideal';
  if (bf < bfIdealMin) {
    bfStatus = 'attention';
    bfLabel = 'Abaixo do Ideal';
  } else if (bf <= bfIdealMax) {
    bfStatus = 'optimal';
    bfLabel = 'Ideal';
  } else if (bf <= bfAttentionMax) {
    bfStatus = 'attention';
    bfLabel = 'Acima do Ideal';
  } else {
    bfStatus = 'alert';
    bfLabel = 'Elevado';
  }
  results.push({
    key: 'bodyFatPercentage',
    label: 'Gordura Corporal (BF%)',
    shortLabel: 'Gordura',
    value: bf,
    formattedValue: `${bf.toFixed(1)}%`,
    unit: '%',
    category: 'composition',
    status: bfStatus,
    statusLabel: bfLabel,
    idealRangeText: `${bfIdealMin}% – ${bfIdealMax}%`,
    barPositionPercent: computeBarPercent(bf, bfIdealMin - 6, bfAttentionMax + 8),
    idealZoneStartPercent: 22,
    idealZoneEndPercent: 64,
    whatItMeans:
      'Representa a proporção de tecido adiposo (essencial + reserva) em relação ao peso corporal total.',
    howToImprove:
      'Para reduzir preservando massa magra: mantenha déficit calórico moderado (300–500 kcal), aporte proteico de 1.8–2.2 g/kg e treino resistido aliado a cardio Zona 2.',
  });

  // 2. Massa Muscular (kg e %)
  const musclePct = weight > 0 ? (metrics.muscleMassKg / weight) * 100 : 0;
  const muscIdealMinPct = sex === 'male' ? 40 : 32;
  const muscIdealMaxPct = sex === 'male' ? 56 : 46;
  const muscIdealMinKg = Number(((weight * muscIdealMinPct) / 100).toFixed(1));
  const muscIdealMaxKg = Number(((weight * muscIdealMaxPct) / 100).toFixed(1));
  let muscStatus: ClinicalStatusLevel = 'optimal';
  let muscLabel = 'Forte / Ideal';
  if (musclePct < muscIdealMinPct - 4) {
    muscStatus = 'alert';
    muscLabel = 'Baixa';
  } else if (musclePct < muscIdealMinPct) {
    muscStatus = 'attention';
    muscLabel = 'Limítrofe';
  }
  results.push({
    key: 'muscleMassKg',
    label: 'Massa Muscular Esquelética',
    shortLabel: 'Músculo',
    value: metrics.muscleMassKg,
    formattedValue: `${metrics.muscleMassKg.toFixed(1)} kg (${musclePct.toFixed(1)}%)`,
    unit: 'kg',
    category: 'composition',
    status: muscStatus,
    statusLabel: muscLabel,
    idealRangeText: `${muscIdealMinKg} – ${muscIdealMaxKg} kg (${muscIdealMinPct}–${muscIdealMaxPct}%)`,
    barPositionPercent: computeBarPercent(musclePct, muscIdealMinPct - 10, muscIdealMaxPct + 6),
    idealZoneStartPercent: 32,
    idealZoneEndPercent: 85,
    whatItMeans:
      'Volume total de músculo ativo responsável pela força motora, sensibilidade à insulina e gasto calórico em repouso.',
    howToImprove:
      'Priorize sobrecarga progressiva na musculação (3 a 5x/semana), ingestão fracionada de proteínas e 7.5h+ de sono reparador.',
  });

  // 3. Gordura Visceral (Nível 1 a 20)
  const vf = metrics.visceralFat;
  let vfStatus: ClinicalStatusLevel = 'optimal';
  let vfLabel = 'Saudável';
  if (vf > 12) {
    vfStatus = 'alert';
    vfLabel = 'Risco Elevado';
  } else if (vf > 9) {
    vfStatus = 'attention';
    vfLabel = 'Atenção';
  }
  results.push({
    key: 'visceralFat',
    label: 'Gordura Visceral (Intra-abdominal)',
    shortLabel: 'G. Visceral',
    value: vf,
    formattedValue: `Nível ${vf}`,
    unit: 'nível',
    category: 'composition',
    status: vfStatus,
    statusLabel: vfLabel,
    idealRangeText: 'Nível 1 – 9',
    barPositionPercent: computeBarPercent(vf, 1, 18),
    idealZoneStartPercent: 5,
    idealZoneEndPercent: 52,
    whatItMeans:
      'Gordura armazenada ao redor dos órgãos vitais (fígado e intestino), diretamente associada à resistência insulínica e inflamação.',
    howToImprove:
      'Responde rapidamente ao corte de açúcares líquidos/álcool, caminhadas pós-refeição, HIIT/Zona 2 e manejo do cortisol (sono).',
  });

  // 4. IMC (Índice de Massa Corporal)
  const bmi = metrics.bmi;
  let bmiStatus: ClinicalStatusLevel = 'optimal';
  let bmiLabel = 'Normal';
  if (bmi < 18.5) {
    bmiStatus = 'attention';
    bmiLabel = 'Abaixo do Peso';
  } else if (bmi <= 24.9) {
    bmiStatus = 'optimal';
    bmiLabel = 'Normal';
  } else if (bmi <= 29.9) {
    bmiStatus = 'attention';
    bmiLabel = 'Sobrepeso';
  } else {
    bmiStatus = 'alert';
    bmiLabel = 'Obesidade';
  }
  results.push({
    key: 'bmi',
    label: 'Índice de Massa Corporal (IMC)',
    shortLabel: 'IMC',
    value: bmi,
    formattedValue: `${bmi.toFixed(1)} kg/m²`,
    unit: 'kg/m²',
    category: 'composition',
    status: bmiStatus,
    statusLabel: bmiLabel,
    idealRangeText: '18.5 – 24.9 kg/m²',
    barPositionPercent: computeBarPercent(bmi, 15, 35),
    idealZoneStartPercent: 18,
    idealZoneEndPercent: 50,
    whatItMeans:
      'Relação matemática entre peso e altura ao quadrado. Deve sempre ser interpretado em conjunto com o BF% e a Massa Muscular.',
    howToImprove:
      'Indivíduos musculosos podem ter IMC > 25 com gordura baixa. Foque em manter BF% ideal e relação cintura-quadril controlada.',
  });

  // 5. Massa Livre de Gordura (LBM / FFM)
  const lbmKg = Number((weight * (1 - bf / 100)).toFixed(1));
  const lbmPct = Number((100 - bf).toFixed(1));
  const lbmIdealMinPct = 100 - bfIdealMax;
  results.push({
    key: 'leanBodyMass',
    label: 'Massa Livre de Gordura (MLG)',
    shortLabel: 'Massa Magra',
    value: lbmKg,
    formattedValue: `${lbmKg.toFixed(1)} kg (${lbmPct}%)`,
    unit: 'kg',
    category: 'composition',
    status: lbmPct >= lbmIdealMinPct ? 'optimal' : 'attention',
    statusLabel: lbmPct >= lbmIdealMinPct ? 'Preservada' : 'Atenção',
    idealRangeText: `≥ ${lbmIdealMinPct}% do peso`,
    barPositionPercent: computeBarPercent(lbmPct, 65, 92),
    idealZoneStartPercent: 35,
    idealZoneEndPercent: 90,
    whatItMeans:
      'Soma de todos os tecidos não-adiposos do corpo: músculos, ossos, órgãos e água intra/extracelular.',
    howToImprove:
      'Durante fases de emagrecimento, monitore a MLG para garantir que a perda de peso venha da gordura e não do catabolismo muscular.',
  });

  // 6. Água Corporal Total (%)
  const water = metrics.waterPercent;
  const waterIdealMin = sex === 'male' ? 55 : 48;
  const waterIdealMax = sex === 'male' ? 65 : 58;
  let waterStatus: ClinicalStatusLevel = 'optimal';
  let waterLabel = 'Bem Hidratado';
  if (water < waterIdealMin - 3) {
    waterStatus = 'alert';
    waterLabel = 'Desidratado';
  } else if (water < waterIdealMin) {
    waterStatus = 'attention';
    waterLabel = 'Sub-hidratado';
  }
  results.push({
    key: 'waterPercent',
    label: 'Água Corporal Total (ACT)',
    shortLabel: 'Água',
    value: water,
    formattedValue: `${water.toFixed(1)}%`,
    unit: '%',
    category: 'hydration_bone',
    status: waterStatus,
    statusLabel: waterLabel,
    idealRangeText: `${waterIdealMin}% – ${waterIdealMax}%`,
    barPositionPercent: computeBarPercent(water, waterIdealMin - 8, waterIdealMax + 6),
    idealZoneStartPercent: 28,
    idealZoneEndPercent: 78,
    whatItMeans:
      'Percentual de água nos compartimentos intracelular (músculos) e extracelular. Afeta diretamente a impedância elétrica da balança.',
    howToImprove: `Ingira no mínimo 35–40 ml de água por kg de peso ao dia (${Math.round(weight * 0.038 * 10) / 10} L/dia para você) e mantenha equilíbrio de eletrólitos.`,
  });

  // 7. Proteína Corporal (%)
  const prot = metrics.proteinPercent;
  const protIdealMin = sex === 'male' ? 16 : 14;
  const protIdealMax = 20;
  let protStatus: ClinicalStatusLevel = 'optimal';
  let protLabel = 'Adequada';
  if (prot < protIdealMin - 1.5) {
    protStatus = 'alert';
    protLabel = 'Baixa';
  } else if (prot < protIdealMin) {
    protStatus = 'attention';
    protLabel = 'Limítrofe';
  }
  results.push({
    key: 'proteinPercent',
    label: 'Proteína Corporal',
    shortLabel: 'Proteína',
    value: prot,
    formattedValue: `${prot.toFixed(1)}%`,
    unit: '%',
    category: 'hydration_bone',
    status: protStatus,
    statusLabel: protLabel,
    idealRangeText: `${protIdealMin}% – ${protIdealMax}%`,
    barPositionPercent: computeBarPercent(prot, 11, 22),
    idealZoneStartPercent: 36,
    idealZoneEndPercent: 84,
    whatItMeans:
      'Reflete o conteúdo de proteínas estruturais nas fibras musculares, pele, enzimas e tecidos conectivos.',
    howToImprove:
      'Consuma de 1.6 a 2.2 g de proteína por kg de peso corporal diariamente, distribuídos em 3 a 5 refeições.',
  });

  // 8. Massa Óssea (kg)
  const bone = metrics.boneMassKg;
  const boneIdealMin = sex === 'male' ? 2.8 : 2.2;
  const boneIdealMax = sex === 'male' ? 3.8 : 3.1;
  let boneStatus: ClinicalStatusLevel = 'optimal';
  let boneLabel = 'Normal';
  if (bone < boneIdealMin) {
    boneStatus = 'attention';
    boneLabel = 'Abaixo da Média';
  }
  results.push({
    key: 'boneMassKg',
    label: 'Massa Mineral Óssea Estimada',
    shortLabel: 'Massa Óssea',
    value: bone,
    formattedValue: `${bone.toFixed(2)} kg`,
    unit: 'kg',
    category: 'hydration_bone',
    status: boneStatus,
    statusLabel: boneLabel,
    idealRangeText: `${boneIdealMin.toFixed(1)} – ${boneIdealMax.toFixed(1)} kg`,
    barPositionPercent: computeBarPercent(bone, boneIdealMin - 0.8, boneIdealMax + 0.6),
    idealZoneStartPercent: 28,
    idealZoneEndPercent: 80,
    whatItMeans:
      'Estimativa do peso mineral da estrutura esquelética (cálcio, fósforo e matriz óssea).',
    howToImprove:
      'Treinamento de força (tração mecânica nos ossos), níveis ideais de Vitamina D (35–60 ng/mL) e aporte adequado de cálcio e magnésio.',
  });

  // 9. Taxa Metabólica Basal (TMB)
  const bmr = metrics.bmrKcal;
  const expectedBmrMin = Math.round(weight * 21);
  const expectedBmrMax = Math.round(weight * 26);
  results.push({
    key: 'bmrKcal',
    label: 'Taxa Metabólica Basal (TMB)',
    shortLabel: 'TMB',
    value: bmr,
    formattedValue: `${bmr} kcal/dia`,
    unit: 'kcal',
    category: 'metabolism',
    status: bmr >= expectedBmrMin ? 'optimal' : 'normal',
    statusLabel: bmr >= expectedBmrMin ? 'Ativo' : 'Padrão',
    idealRangeText: `${expectedBmrMin} – ${expectedBmrMax} kcal/dia`,
    barPositionPercent: computeBarPercent(bmr, expectedBmrMin - 300, expectedBmrMax + 300),
    idealZoneStartPercent: 25,
    idealZoneEndPercent: 80,
    whatItMeans:
      'Energia mínima que seu corpo consome em 24h de repouso absoluto para manter funções vitais (coração, cérebro, respiração).',
    howToImprove:
      'Aumentar a Massa Muscular Esquelética eleva diretamente sua TMB. Nunca faça dietas abaixo da sua TMB por períodos prolongados.',
  });

  // 10. Idade Metabólica
  const metAge = metrics.metabolicAge;
  const chronAge = profile.age || 30;
  let metStatus: ClinicalStatusLevel = 'optimal';
  let metLabel = 'Jovem';
  if (metAge > chronAge + 4) {
    metStatus = 'alert';
    metLabel = `+${metAge - chronAge} anos vs real`;
  } else if (metAge > chronAge) {
    metStatus = 'attention';
    metLabel = `+${metAge - chronAge} anos vs real`;
  } else {
    metLabel = `${metAge <= chronAge ? `${chronAge - metAge} anos mais jovem` : 'Igual à real'}`;
  }
  results.push({
    key: 'metabolicAge',
    label: 'Idade Metabólica Biométrica',
    shortLabel: 'Idade Metab.',
    value: metAge,
    formattedValue: `${metAge} anos`,
    unit: 'anos',
    category: 'metabolism',
    status: metStatus,
    statusLabel: metLabel,
    idealRangeText: `≤ ${chronAge} anos (sua idade)`,
    barPositionPercent: computeBarPercent(metAge, chronAge - 12, chronAge + 12),
    idealZoneStartPercent: 8,
    idealZoneEndPercent: 52,
    whatItMeans:
      'Compara sua eficiência metabólica e proporção músculo/gordura com a média populacional da sua faixa etária.',
    howToImprove:
      'Reduzir gordura visceral e ganhar massa magra diminui progressivamente a idade metabólica.',
  });

  // 11. Impedância Bioelétrica (Ohms)
  const imp = metrics.impedanceOhm || 500;
  results.push({
    key: 'impedanceOhm',
    label: 'Impedância Bioelétrica (50 kHz)',
    shortLabel: 'Impedância',
    value: imp,
    formattedValue: `${imp} Ω`,
    unit: 'Ω',
    category: 'metabolism',
    status: imp >= 350 && imp <= 680 ? 'normal' : 'attention',
    statusLabel: 'Sinal BIA Estável',
    idealRangeText: '380 – 620 Ω',
    barPositionPercent: computeBarPercent(imp, 300, 750),
    idealZoneStartPercent: 20,
    idealZoneEndPercent: 72,
    whatItMeans:
      'Resistência elétrica medida pelos eletrodos da balança entre os pés. Músculos e água conduzem corrente (menor Ω); gordura oferece resistência (maior Ω).',
    howToImprove:
      'Para máxima precisão: pese-se sempre no mesmo turno (preferencialmente pela manhã em jejum) e com os pés limpos e secos.',
  });

  return results;
}
