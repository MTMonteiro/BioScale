import { BodyMeasurementsEntry, BodyPartKey, UserProfile } from '../types/health';

export interface BodyPartGuide {
  key: BodyPartKey;
  label: string;
  shortLabel: string;
  minCm: number;
  maxCm: number;
  idealBaseMaleCm: number;
  idealBaseFemaleCm: number;
  color: string;
  avatarY: number; // Posição vertical (0..380) no Avatar SVG para desenhar a linha da fita métrica
  howToMeasureTitle: string;
  howToMeasureSteps: string[];
  proTip: string;
}

export const BODY_PARTS_GUIDE: Record<BodyPartKey, BodyPartGuide> = {
  neckCm: {
    key: 'neckCm',
    label: 'Pescoço',
    shortLabel: 'Pescoço',
    minCm: 28,
    maxCm: 52,
    idealBaseMaleCm: 39,
    idealBaseFemaleCm: 33,
    color: '#38BDF8',
    avatarY: 66,
    howToMeasureTitle: 'Como medir o Pescoço',
    howToMeasureSteps: [
      'Olhe para a frente com os ombros relaxados.',
      'Posicione a fita métrica logo abaixo do pomo de adão (laringe).',
      'Mantenha a fita nivelada horizontalmente, sem apertar a pele.',
    ],
    proTip: 'Usado na fórmula da Marinha dos EUA (US Navy) para estimar gordura corporal com alta precisão!',
  },
  shouldersCm: {
    key: 'shouldersCm',
    label: 'Ombros (Deltoides)',
    shortLabel: 'Ombros',
    minCm: 85,
    maxCm: 155,
    idealBaseMaleCm: 118,
    idealBaseFemaleCm: 98,
    color: '#818CF8',
    avatarY: 94,
    howToMeasureTitle: 'Como medir os Ombros',
    howToMeasureSteps: [
      'Fique em pé com postura ereta e os dois braços relaxados ao lado do corpo.',
      'Passe a fita ao redor da parte mais larga dos dois ombros (cobrindo os deltoides laterais), cerca de 5 cm abaixo da clavícula.',
    ],
    proTip: 'A proporção Ombro/Cintura (V-Taper) ideal estética fica próxima de 1.618 (Proporção Áurea).',
  },
  chestCm: {
    key: 'chestCm',
    label: 'Peitoral / Tórax',
    shortLabel: 'Peitoral',
    minCm: 70,
    maxCm: 145,
    idealBaseMaleCm: 102,
    idealBaseFemaleCm: 90,
    color: '#10B981',
    avatarY: 120,
    howToMeasureTitle: 'Como medir o Peitoral',
    howToMeasureSteps: [
      'Passe a fita métrica por baixo das axilas, contornando a linha mais cheia do peitoral (altura dos mamilos) e as escápulas nas costas.',
      'Respire normalmente e faça a leitura no final de uma expiração normal (sem estufar o peito).',
    ],
    proTip: 'Mantenha a fita paralela ao chão tanto na frente quanto nas costas.',
  },
  bicepsCm: {
    key: 'bicepsCm',
    label: 'Braço / Bíceps',
    shortLabel: 'Bíceps',
    minCm: 22,
    maxCm: 54,
    idealBaseMaleCm: 36,
    idealBaseFemaleCm: 28,
    color: '#F59E0B',
    avatarY: 136,
    howToMeasureTitle: 'Como medir o Braço (Bíceps)',
    howToMeasureSteps: [
      'Levante o braço na altura do ombro e dobre o cotovelo em 90 graus contraindo o bíceps.',
      'Envolva a fita no pico mais alto do músculo (meio caminho entre o ombro e o cotovelo).',
    ],
    proTip: 'Meça sempre o mesmo lado (ex: braço direito) e frio (antes do treino) para consistência.',
  },
  forearmCm: {
    key: 'forearmCm',
    label: 'Antebraço',
    shortLabel: 'Antebraço',
    minCm: 18,
    maxCm: 42,
    idealBaseMaleCm: 29,
    idealBaseFemaleCm: 24,
    color: '#EC4899',
    avatarY: 176,
    howToMeasureTitle: 'Como medir o Antebraço',
    howToMeasureSteps: [
      'Estenda o braço e feche o punho com força.',
      'Posicione a fita na parte mais grossa do antebraço, logo abaixo da dobra do cotovelo.',
    ],
    proTip: 'Excelente indicador de força de preensão e hipertrofia dos membros superiores.',
  },
  waistCm: {
    key: 'waistCm',
    label: 'Cintura (Linha Estreita)',
    shortLabel: 'Cintura',
    minCm: 55,
    maxCm: 140,
    idealBaseMaleCm: 82,
    idealBaseFemaleCm: 68,
    color: '#F43F5E',
    avatarY: 162,
    howToMeasureTitle: 'Como medir a Cintura',
    howToMeasureSteps: [
      'Localize a parte mais estreita do tronco (geralmente 2 a 3 dedos acima do umbigo, entre a última costela e o osso do quadril).',
      'Não encolha a barriga; mantenha o abdômen relaxado ao final de uma expiração normal.',
    ],
    proTip: 'A relação Cintura/Altura abaixo de 0.50 indica baixo risco cardiovascular e pouca gordura visceral.',
  },
  abdomenCm: {
    key: 'abdomenCm',
    label: 'Abdômen (Umbigo)',
    shortLabel: 'Abdômen',
    minCm: 60,
    maxCm: 150,
    idealBaseMaleCm: 85,
    idealBaseFemaleCm: 74,
    color: '#FB923C',
    avatarY: 182,
    howToMeasureTitle: 'Como medir o Abdômen',
    howToMeasureSteps: [
      'Posicione a fita métrica exatamente em cima da linha do umbigo, paralela ao chão.',
      'Mantenha os pés juntos e o abdômen relaxado.',
    ],
    proTip: 'Essa é a região onde a gordura subcutânea abdominal mais varia semana a semana.',
  },
  hipsCm: {
    key: 'hipsCm',
    label: 'Quadril / Glúteos',
    shortLabel: 'Quadril',
    minCm: 70,
    maxCm: 150,
    idealBaseMaleCm: 98,
    idealBaseFemaleCm: 98,
    color: '#A855F7',
    avatarY: 205,
    howToMeasureTitle: 'Como medir o Quadril',
    howToMeasureSteps: [
      'Fique em pé com os pés juntos.',
      'Passe a fita métrica na parte de maior circunferência dos glúteos/quadril, olhando de lado para garantir que a fita esteja reta.',
    ],
    proTip: 'Combinado com a cintura, calcula a Relação Cintura-Quadril (RCQ) da OMS.',
  },
  thighCm: {
    key: 'thighCm',
    label: 'Coxa (Quadríceps)',
    shortLabel: 'Coxa',
    minCm: 38,
    maxCm: 85,
    idealBaseMaleCm: 58,
    idealBaseFemaleCm: 55,
    color: '#14B8A6',
    avatarY: 254,
    howToMeasureTitle: 'Como medir a Coxa',
    howToMeasureSteps: [
      'Fique em pé com os pés afastados na largura dos ombros e o peso distribuído igualmente.',
      'Meça no ponto médio exato entre a dobra da virilha e o topo da patela (joelho).',
    ],
    proTip: 'As coxas concentram a maior massa muscular do corpo humano, influenciando diretamente sua Taxa Metabólica Basal.',
  },
  calfCm: {
    key: 'calfCm',
    label: 'Panturrilha',
    shortLabel: 'Panturrilha',
    minCm: 25,
    maxCm: 55,
    idealBaseMaleCm: 38,
    idealBaseFemaleCm: 35,
    color: '#06B6D4',
    avatarY: 320,
    howToMeasureTitle: 'Como medir a Panturrilha',
    howToMeasureSteps: [
      'Mantenha os dois pés apoiados no chão sem ficar na ponta do pé.',
      'Passe a fita na parte mais larga da batata da perna.',
    ],
    proTip: 'Uma boa simetria estética clássica aponta Panturrilha ≈ Bíceps ≈ Pescoço.',
  },
};

export const BODY_PART_ORDER: BodyPartKey[] = [
  'neckCm',
  'shouldersCm',
  'chestCm',
  'bicepsCm',
  'forearmCm',
  'waistCm',
  'abdomenCm',
  'hipsCm',
  'thighCm',
  'calfCm',
];

/**
 * Calcula a Relação Cintura/Quadril (RCQ) e a Estimativa de Gordura Corporal pelo método US Navy
 * usando apenas fita métrica (ótimo para cruzar com a bioimpedância da balança Wellmix!).
 */
export function calculateAnthropometricIndices(
  entry: Omit<BodyMeasurementsEntry, 'id' | 'timestamp' | 'waistToHipRatio' | 'navyBodyFatEstimate'>,
  profile: UserProfile
): { waistToHipRatio: number; navyBodyFatEstimate: number; vTaperRatio: number } {
  const whr = Math.round((entry.waistCm / Math.max(entry.hipsCm, 1)) * 100) / 100;
  const vTaper = Math.round((entry.shouldersCm / Math.max(entry.waistCm, 1)) * 100) / 100;

  let navyBf = 18;
  try {
    if (profile.sex === 'male') {
      const diff = Math.max(entry.abdomenCm - entry.neckCm, 10);
      navyBf =
        495 /
          (1.0324 -
            0.19077 * Math.log10(diff) +
            0.15456 * Math.log10(profile.heightCm)) -
        450;
    } else {
      const sum = Math.max(entry.waistCm + entry.hipsCm - entry.neckCm, 20);
      navyBf =
        495 /
          (1.29579 -
            0.35004 * Math.log10(sum) +
            0.221 * Math.log10(profile.heightCm)) -
        450;
    }
  } catch {}

  const clampedNavy = Math.round(Math.max(4, Math.min(55, navyBf)) * 10) / 10;

  return {
    waistToHipRatio: whr,
    navyBodyFatEstimate: clampedNavy,
    vTaperRatio: vTaper,
  };
}
