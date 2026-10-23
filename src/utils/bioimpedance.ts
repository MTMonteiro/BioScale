import { BioimpedanceMetrics, DayPeriod, DayPeriodFilter, UserProfile } from '../types/health';

export const DAY_PERIOD_INFO: Record<
  DayPeriod,
  { label: string; shortLabel: string; icon: string; color: string; hoursHint: string }
> = {
  morning: {
    label: 'Manhã',
    shortLabel: 'Manhã',
    icon: '☀️',
    color: '#F59E0B',
    hoursHint: '04h–11h59',
  },
  afternoon: {
    label: 'Tarde',
    shortLabel: 'Tarde',
    icon: '🌤️',
    color: '#38BDF8',
    hoursHint: '12h–17h59',
  },
  night: {
    label: 'Noite',
    shortLabel: 'Noite',
    icon: '🌙',
    color: '#A855F7',
    hoursHint: '18h–03h59',
  },
};

export function getDayPeriodFromIso(iso: string): DayPeriod {
  const hour = new Date(iso).getHours();
  if (hour >= 4 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'night';
}

export function resolveMeasurementPeriod(item: BioimpedanceMetrics): DayPeriod {
  return item.period || getDayPeriodFromIso(item.timestamp);
}

export function filterMeasurementsByPeriod(
  list: BioimpedanceMetrics[],
  filter: DayPeriodFilter
): BioimpedanceMetrics[] {
  if (filter === 'all') return list;
  return list.filter((item) => resolveMeasurementPeriod(item) === filter);
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function round1(val: number): number {
  return Math.round(val * 10) / 10;
}

/**
 * Calcula todas as métricas de bioimpedância a partir do Peso (kg), Impedância (Ohms)
 * e Perfil do Usuário (Altura, Idade, Sexo).
 * Baseado nas equações antropométricas + BIA utilizadas pelas balanças Chipsea / OKOK / openScale.
 */
export function calculateBioimpedance(
  weightKg: number,
  impedanceOhm: number,
  profile: UserProfile,
  customPeriod?: DayPeriod
): BioimpedanceMetrics {
  const heightM = profile.heightCm / 100;
  const bmi = round1(weightKg / (heightM * heightM));
  const isMale = profile.sex === 'male';
  const effectiveImpedance = impedanceOhm > 50 ? impedanceOhm : 480; // fallback caso a pessoa pese de meia

  // Massa Magra (Lean Body Mass - LBM) usando equação de BIA (Altura² / Impedância)
  let lbm: number;
  if (isMale) {
    lbm =
      0.485 * ((profile.heightCm * profile.heightCm) / effectiveImpedance) +
      0.338 * weightKg +
      5.32;
    // Ajuste por idade
    lbm -= (profile.age - 25) * 0.06;
  } else {
    lbm =
      0.475 * ((profile.heightCm * profile.heightCm) / effectiveImpedance) +
      0.295 * weightKg +
      5.49;
    lbm -= (profile.age - 25) * 0.05;
  }

  // Garantir limites fisiológicos realistas para LBM (50% a 95% do peso total)
  lbm = clamp(lbm, weightKg * 0.5, weightKg * 0.95);

  const fatMassKg = round1(Math.max(1.5, weightKg - lbm));
  const bodyFatPercent = round1(clamp((fatMassKg / weightKg) * 100, 4.0, 60.0));
  const leanBodyMassKg = round1(weightKg - fatMassKg);

  // Massa óssea estimada (~4.2% a 4.5% da massa magra)
  const boneMassKg = round1(
    clamp(isMale ? leanBodyMassKg * 0.046 : leanBodyMassKg * 0.043, 1.5, 4.5)
  );

  // Massa muscular esquelética / total (Massa magra menos massa óssea)
  const muscleMassKg = round1(Math.max(10, leanBodyMassKg - boneMassKg));
  const musclePercent = round1((muscleMassKg / weightKg) * 100);

  // Água Corporal Total (TBW % - músculos são ~73% água)
  const rawWaterPercent = ((100 - bodyFatPercent) * (isMale ? 0.735 : 0.715));
  const waterPercent = round1(clamp(rawWaterPercent, 35.0, 75.0));

  // Proteína Corporal (%)
  const proteinPercent = round1(
    clamp(100 - bodyFatPercent - waterPercent - (boneMassKg / weightKg) * 100, 10.0, 26.0)
  );

  // Gordura Visceral (Índice de 1 a 30)
  let visceralFatRaw = isMale
    ? 0.35 * bmi + 0.12 * profile.age + (bodyFatPercent - 18) * 0.25 - 4.2
    : 0.28 * bmi + 0.1 * profile.age + (bodyFatPercent - 24) * 0.22 - 3.8;
  const visceralFat = Math.round(clamp(visceralFatRaw, 1, 30));

  // Taxa Metabólica Basal (Mifflin-St Jeor combinada com Katch-McArdle pela Massa Magra)
  const bmrMifflin =
    10 * weightKg +
    6.25 * profile.heightCm -
    5 * profile.age +
    (isMale ? 5 : -161);
  const bmrKatch = 370 + 21.6 * leanBodyMassKg;
  const bmrKcal = Math.round((bmrMifflin + bmrKatch) / 2);

  // Idade Metabólica
  const idealBodyFat = isMale ? 15 : 23;
  const fatDiff = bodyFatPercent - idealBodyFat;
  const metabolicAge = Math.round(
    clamp(profile.age + fatDiff * 0.75, Math.max(15, profile.age - 12), profile.age + 20)
  );

  const nowIso = new Date().toISOString();

  return {
    id: `${Date.now()}`,
    timestamp: nowIso,
    weightKg: round1(weightKg),
    impedanceOhm: Math.round(impedanceOhm),
    bmi,
    bodyFatPercent,
    fatMassKg,
    leanBodyMassKg,
    muscleMassKg,
    musclePercent,
    waterPercent,
    boneMassKg,
    visceralFat,
    bmrKcal,
    metabolicAge,
    proteinPercent,
    period: customPeriod || getDayPeriodFromIso(nowIso),
  };
}

export function getBmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: 'Abaixo do peso', color: '#38BDF8' };
  if (bmi < 25) return { label: 'Normal', color: '#10B981' };
  if (bmi < 30) return { label: 'Sobrepeso', color: '#F59E0B' };
  return { label: 'Obesidade', color: '#EF4444' };
}
