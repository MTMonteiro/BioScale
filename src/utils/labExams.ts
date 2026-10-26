import { LabExamEntry, Sex } from '../types/health';

export type BiomarkerFieldKey =
  | 'fastingGlucoseMgDl'
  | 'hba1cPercent'
  | 'fastingInsulinUiuMl'
  | 'homaIr'
  | 'totalCholesterolMgDl'
  | 'hdlMgDl'
  | 'ldlMgDl'
  | 'triglyceridesMgDl'
  | 'tshUiuMl'
  | 'freeT4NgDl'
  | 'totalTestosteroneNgDl'
  | 'morningCortisolUgDl'
  | 'vitaminDNgMl'
  | 'vitaminB12PgMl'
  | 'ferritinNgMl'
  | 'hsCrpMgL'
  | 'creatinineMgDl'
  | 'astU_L'
  | 'altU_L';

export type BiomarkerCategory =
  | 'glycemic'
  | 'lipid'
  | 'hormonal'
  | 'vitamins_organs';

export interface BiomarkerGuide {
  key: BiomarkerFieldKey;
  label: string;
  shortLabel: string;
  unit: string;
  category: BiomarkerCategory;
  minIdealMale: number;
  maxIdealMale: number;
  minIdealFemale: number;
  maxIdealFemale: number;
  placeholder: string;
  lowImpactTip: string;
  highImpactTip: string;
}

export const BIOMARKER_CATEGORIES: Array<{
  key: BiomarkerCategory;
  label: string;
  color: string;
}> = [
  { key: 'glycemic', label: 'Glicemia & Insulina', color: '#F59E0B' },
  { key: 'lipid', label: 'Colesterol & Lipídios', color: '#EF4444' },
  { key: 'hormonal', label: 'Hormônios & Tireoide', color: '#A855F7' },
  { key: 'vitamins_organs', label: 'Vitaminas, Rim & Fígado', color: '#10B981' },
];

export const LAB_BIOMARKERS_GUIDE: BiomarkerGuide[] = [
  {
    key: 'fastingGlucoseMgDl',
    label: 'Glicemia de Jejum',
    shortLabel: 'Glicose',
    unit: 'mg/dL',
    category: 'glycemic',
    minIdealMale: 70,
    maxIdealMale: 99,
    minIdealFemale: 70,
    maxIdealFemale: 99,
    placeholder: '88',
    lowImpactTip: 'Glicemia baixa pode gerar fadiga no treino; garanta carboidratos complexos pré-treino.',
    highImpactTip: 'Glicemia >= 100 mg/dL pede redução de açúcares simples, mais fibras (aveia, psyllium) e cardio pós-refeição.',
  },
  {
    key: 'hba1cPercent',
    label: 'Hemoglobina Glicada (HbA1c)',
    shortLabel: 'HbA1c',
    unit: '%',
    category: 'glycemic',
    minIdealMale: 4.0,
    maxIdealMale: 5.6,
    minIdealFemale: 4.0,
    maxIdealFemale: 5.6,
    placeholder: '5.2',
    lowImpactTip: 'Dentro da faixa basal.',
    highImpactTip: 'HbA1c >= 5.7% indica tendência à resistência insulínica; priorize musculação intensa + caminhadas diárias.',
  },
  {
    key: 'fastingInsulinUiuMl',
    label: 'Insulina Basal',
    shortLabel: 'Insulina',
    unit: 'µUI/mL',
    category: 'glycemic',
    minIdealMale: 2.0,
    maxIdealMale: 10.0,
    minIdealFemale: 2.0,
    maxIdealFemale: 10.0,
    placeholder: '6.5',
    lowImpactTip: 'Boa sensibilidade insulínica.',
    highImpactTip: 'Insulina basal elevada dificulta a lipólise abdominal; evite beliscar entre refeições e priorize proteínas.',
  },
  {
    key: 'homaIr',
    label: 'Índice HOMA-IR (Calculado)',
    shortLabel: 'HOMA-IR',
    unit: '',
    category: 'glycemic',
    minIdealMale: 0.4,
    maxIdealMale: 2.1,
    minIdealFemale: 0.4,
    maxIdealFemale: 2.1,
    placeholder: '1.4',
    lowImpactTip: 'Excelente sensibilidade à insulina.',
    highImpactTip: 'HOMA-IR > 2.1 sugere resistência insulínica associada à gordura visceral; foque em perder cintura e ganhar massa muscular nas pernas.',
  },
  {
    key: 'totalCholesterolMgDl',
    label: 'Colesterol Total',
    shortLabel: 'Col. Total',
    unit: 'mg/dL',
    category: 'lipid',
    minIdealMale: 110,
    maxIdealMale: 190,
    minIdealFemale: 110,
    maxIdealFemale: 190,
    placeholder: '175',
    lowImpactTip: 'Colesterol muito baixo pode impactar síntese de hormônios esteroides.',
    highImpactTip: 'Colesterol total > 190 mg/dL: substitua gorduras saturadas por azeite extravirgem, abacate, castanhas e ômega-3.',
  },
  {
    key: 'hdlMgDl',
    label: 'Colesterol HDL (Bom)',
    shortLabel: 'HDL',
    unit: 'mg/dL',
    category: 'lipid',
    minIdealMale: 45,
    maxIdealMale: 100,
    minIdealFemale: 50,
    maxIdealFemale: 100,
    placeholder: '54',
    lowImpactTip: 'HDL baixo: aumente exercícios aeróbicos (Zona 2) e consumo de gorduras mono/poli-insaturadas (peixes, azeite, chia).',
    highImpactTip: 'Ótimo fator cardioprotetor.',
  },
  {
    key: 'ldlMgDl',
    label: 'Colesterol LDL',
    shortLabel: 'LDL',
    unit: 'mg/dL',
    category: 'lipid',
    minIdealMale: 40,
    maxIdealMale: 100,
    minIdealFemale: 40,
    maxIdealFemale: 100,
    placeholder: '92',
    lowImpactTip: 'LDL controlado.',
    highImpactTip: 'LDL > 100 mg/dL: inclua 30g de aveia/fibras solúveis por dia, reduza frituras/embutidos e intensifique o controle do BF%.',
  },
  {
    key: 'triglyceridesMgDl',
    label: 'Triglicerídeos',
    shortLabel: 'Triglicer.',
    unit: 'mg/dL',
    category: 'lipid',
    minIdealMale: 35,
    maxIdealMale: 149,
    minIdealFemale: 35,
    maxIdealFemale: 149,
    placeholder: '95',
    lowImpactTip: 'Triglicerídeos bem controlados.',
    highImpactTip: 'Triglicerídeos >= 150 mg/dL respondem rápido ao corte de farinhas refinadas, refrigerantes/álcool e suplementação de Ômega-3 EPA/DHA.',
  },
  {
    key: 'tshUiuMl',
    label: 'TSH (Tireoide)',
    shortLabel: 'TSH',
    unit: 'µUI/mL',
    category: 'hormonal',
    minIdealMale: 0.45,
    maxIdealMale: 4.0,
    minIdealFemale: 0.45,
    maxIdealFemale: 4.0,
    placeholder: '1.8',
    lowImpactTip: 'TSH < 0.45 pode indicar hipertireoidismo; acompanhe com endocrinologista.',
    highImpactTip: 'TSH > 4.0 pode reduzir a Taxa Metabólica Basal e causar retenção hídrica; verifique selênio, iodo e função tireoidiana.',
  },
  {
    key: 'freeT4NgDl',
    label: 'T4 Livre',
    shortLabel: 'T4 Livre',
    unit: 'ng/dL',
    category: 'hormonal',
    minIdealMale: 0.8,
    maxIdealMale: 1.8,
    minIdealFemale: 0.8,
    maxIdealFemale: 1.8,
    placeholder: '1.2',
    lowImpactTip: 'T4 Livre baixo pode desacelerar a queima de gordura; evite déficits calóricos extremos.',
    highImpactTip: 'Acima da faixa de referência.',
  },
  {
    key: 'totalTestosteroneNgDl',
    label: 'Testosterona Total',
    shortLabel: 'Testost.',
    unit: 'ng/dL',
    category: 'hormonal',
    minIdealMale: 350,
    maxIdealMale: 950,
    minIdealFemale: 15,
    maxIdealFemale: 70,
    placeholder: '580',
    lowImpactTip: 'Testosterona baixa prejudica hipertrofia de ombros/peito e recuperação; priorize 7.5h+ de sono, zinco, magnésio, vitamina D e treinos de perna pesados.',
    highImpactTip: 'Nível elevado.',
  },
  {
    key: 'morningCortisolUgDl',
    label: 'Cortisol Matinal',
    shortLabel: 'Cortisol',
    unit: 'µg/dL',
    category: 'hormonal',
    minIdealMale: 6.0,
    maxIdealMale: 18.0,
    minIdealFemale: 6.0,
    maxIdealFemale: 18.0,
    placeholder: '12.5',
    lowImpactTip: 'Cortisol matinal muito baixo pode causar indisposição ao acordar.',
    highImpactTip: 'Cortisol > 18 µg/dL favorece acúmulo de gordura abdominal/visceral e catabolismo muscular; melhore o sono, hidratação e faça deload no treino se houver overtraining.',
  },
  {
    key: 'vitaminDNgMl',
    label: 'Vitamina D (25-OH)',
    shortLabel: 'Vit. D',
    unit: 'ng/mL',
    category: 'vitamins_organs',
    minIdealMale: 30,
    maxIdealMale: 70,
    minIdealFemale: 30,
    maxIdealFemale: 70,
    placeholder: '38',
    lowImpactTip: 'Vitamina D < 30 ng/mL reduz força muscular, densidade óssea e imunidade; exponha-se ao sol 15 min/dia e avalie suplementação de Vitamina D3.',
    highImpactTip: 'Nível elevado.',
  },
  {
    key: 'vitaminB12PgMl',
    label: 'Vitamina B12',
    shortLabel: 'Vit. B12',
    unit: 'pg/mL',
    category: 'vitamins_organs',
    minIdealMale: 350,
    maxIdealMale: 900,
    minIdealFemale: 350,
    maxIdealFemale: 900,
    placeholder: '510',
    lowImpactTip: 'Vitamina B12 < 350 pg/mL reduz energia celular e disposição; reforce ovos, carnes magras, peixes ou metilcobalamina.',
    highImpactTip: 'Reserva elevada.',
  },
  {
    key: 'ferritinNgMl',
    label: 'Ferritina (Estoque de Ferro)',
    shortLabel: 'Ferritina',
    unit: 'ng/mL',
    category: 'vitamins_organs',
    minIdealMale: 40,
    maxIdealMale: 300,
    minIdealFemale: 30,
    maxIdealFemale: 200,
    placeholder: '110',
    lowImpactTip: 'Ferritina baixa reduz o transporte de oxigênio (VO2) e causa cansaço precoce no treino; combine fontes de ferro com Vitamina C.',
    highImpactTip: 'Ferritina elevada pode ser marcador inflamatório ou sobrecarga de ferro.',
  },
  {
    key: 'hsCrpMgL',
    label: 'PCR Ultrassensível (Inflamação)',
    shortLabel: 'PCR-us',
    unit: 'mg/L',
    category: 'vitamins_organs',
    minIdealMale: 0.0,
    maxIdealMale: 1.5,
    minIdealFemale: 0.0,
    maxIdealFemale: 1.5,
    placeholder: '0.8',
    lowImpactTip: 'Baixa inflamação sistêmica.',
    highImpactTip: 'PCR > 1.5 mg/L indica inflamação sistêmica ou recuperação muscular incompleta; invista em sono, cúrcuma, frutas vermelhas e ômega-3.',
  },
  {
    key: 'creatinineMgDl',
    label: 'Creatinina Sérico',
    shortLabel: 'Creatinina',
    unit: 'mg/dL',
    category: 'vitamins_organs',
    minIdealMale: 0.6,
    maxIdealMale: 1.3,
    minIdealFemale: 0.5,
    maxIdealFemale: 1.1,
    placeholder: '1.05',
    lowImpactTip: 'Normal.',
    highImpactTip: 'Creatinina levemente alta é comum em quem tem boa massa muscular ou usa creatina, mas exige hidratação mínima de 45 ml/kg de água por dia!',
  },
  {
    key: 'astU_L',
    label: 'TGO / AST (Fígado)',
    shortLabel: 'TGO/AST',
    unit: 'U/L',
    category: 'vitamins_organs',
    minIdealMale: 5,
    maxIdealMale: 40,
    minIdealFemale: 5,
    maxIdealFemale: 35,
    placeholder: '24',
    lowImpactTip: 'Normal.',
    highImpactTip: 'TGO elevado pode ocorrer após treino intenso de musculação (dano muscular) ou sobrecarga hepática.',
  },
  {
    key: 'altU_L',
    label: 'TGP / ALT (Fígado)',
    shortLabel: 'TGP/ALT',
    unit: 'U/L',
    category: 'vitamins_organs',
    minIdealMale: 5,
    maxIdealMale: 41,
    minIdealFemale: 5,
    maxIdealFemale: 33,
    placeholder: '26',
    lowImpactTip: 'Normal.',
    highImpactTip: 'TGP elevado frequentemente se associa a gordura hepática (esteatose); reduza frutose industrializada, álcool e gordura visceral.',
  },
];

export function calculateHomaIr(
  glucoseMgDl?: number,
  insulinUiuMl?: number
): number | undefined {
  if (!glucoseMgDl || !insulinUiuMl || glucoseMgDl <= 0 || insulinUiuMl <= 0) {
    return undefined;
  }
  return Math.round(((glucoseMgDl * insulinUiuMl) / 405) * 100) / 100;
}

export interface BiomarkerEvaluation {
  guide: BiomarkerGuide;
  value: number;
  status: 'low' | 'optimal' | 'high';
  statusLabel: string;
  color: string;
  clinicalTip: string;
}

export function evaluateBiomarker(
  key: BiomarkerFieldKey,
  value: number,
  sex: Sex
): BiomarkerEvaluation {
  const guide = LAB_BIOMARKERS_GUIDE.find((g) => g.key === key)!;
  const minIdeal = sex === 'male' ? guide.minIdealMale : guide.minIdealFemale;
  const maxIdeal = sex === 'male' ? guide.maxIdealMale : guide.maxIdealFemale;

  if (value < minIdeal) {
    return {
      guide,
      value,
      status: 'low',
      statusLabel: 'Abaixo do Ideal',
      color: '#F59E0B',
      clinicalTip: guide.lowImpactTip,
    };
  }
  if (value > maxIdeal) {
    return {
      guide,
      value,
      status: 'high',
      statusLabel: 'Atenção / Alto',
      color: '#F43F5E',
      clinicalTip: guide.highImpactTip,
    };
  }
  return {
    guide,
    value,
    status: 'optimal',
    statusLabel: 'Ideal',
    color: '#10B981',
    clinicalTip: 'Dentro da faixa ótima para saúde metabólica e performance.',
  };
}

export function evaluateFullLabExam(
  exam: LabExamEntry,
  sex: Sex
): {
  evaluations: BiomarkerEvaluation[];
  alerts: BiomarkerEvaluation[];
  optimalCount: number;
  promptSummary: string;
} {
  const evaluations: BiomarkerEvaluation[] = [];

  for (const g of LAB_BIOMARKERS_GUIDE) {
    const rawVal = exam[g.key];
    if (typeof rawVal === 'number' && !isNaN(rawVal) && rawVal > 0) {
      evaluations.push(evaluateBiomarker(g.key, rawVal, sex));
    }
  }

  const alerts = evaluations.filter((e) => e.status !== 'optimal');
  const optimalCount = evaluations.filter((e) => e.status === 'optimal').length;

  const lines = evaluations.map(
    (e) =>
      `${e.guide.label}: ${e.value} ${e.guide.unit} [${e.statusLabel}]`
  );
  if (exam.customNotes && exam.customNotes.trim().length > 0) {
    lines.push(`Observações / Outros Exames: ${exam.customNotes.trim()}`);
  }

  return {
    evaluations,
    alerts,
    optimalCount,
    promptSummary: lines.join('; '),
  };
}
