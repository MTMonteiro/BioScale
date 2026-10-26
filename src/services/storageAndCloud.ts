import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import {
  BioimpedanceMetrics,
  BodyMeasurementsEntry,
  DayPeriod,
  LabExamEntry,
  UserProfile,
} from '../types/health';
import { calculateBioimpedance, getDayPeriodFromIso } from '../utils/bioimpedance';
import { calculateAnthropometricIndices } from '../utils/bodyMeasurements';
import { calculateHomaIr } from '../utils/labExams';

const STORAGE_KEYS = {
  MEASUREMENTS: '@bioscale:measurements_v1',
  PROFILE: '@bioscale:profile_v1',
  BODY_TAPE: '@bioscale:body_tape_v2',
  LAB_EXAMS: '@bioscale:lab_exams_v1',
};

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Matheus',
  heightCm: 175,
  age: 28,
  sex: 'male',
  targetWeightKg: 74.0,
  trainingGoal: 'recomposition',
  weeklyWorkoutsTarget: 4,
  coachPersona: 'atlas',
  aiProvider: 'gemma_local',
  selectedLocalModelId: 'gemma-3-1b-q4',
  customLocalModelUrl: '',
  openRouterApiKey: '',
  openRouterModel: 'deepseek/deepseek-chat',
  deepseekApiKey: '',
  deepseekModel: 'deepseek-chat',
  geminiApiKey: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
};

export async function loadProfile(): Promise<UserProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE);
    if (raw) {
      return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_PROFILE;
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
}

export function generateSeedHistory(profile: UserProfile): BioimpedanceMetrics[] {
  const now = new Date();
  const samples: Array<{
    daysAgo: number;
    hour: number;
    minute: number;
    period: DayPeriod;
    weight: number;
    imp: number;
  }> = [
    { daysAgo: 180, hour: 7, minute: 30, period: 'morning', weight: 84.6, imp: 558 },
    { daysAgo: 120, hour: 7, minute: 35, period: 'morning', weight: 82.9, imp: 546 },
    { daysAgo: 90, hour: 7, minute: 40, period: 'morning', weight: 81.7, imp: 538 },
    { daysAgo: 60, hour: 7, minute: 25, period: 'morning', weight: 80.8, imp: 531 },
    { daysAgo: 30, hour: 7, minute: 30, period: 'morning', weight: 79.8, imp: 525 },
    { daysAgo: 21, hour: 7, minute: 45, period: 'morning', weight: 79.1, imp: 518 },
    { daysAgo: 18, hour: 21, minute: 10, period: 'night', weight: 79.7, imp: 514 },
    { daysAgo: 14, hour: 7, minute: 35, period: 'morning', weight: 78.4, imp: 512 },
    { daysAgo: 11, hour: 15, minute: 20, period: 'afternoon', weight: 78.3, imp: 506 },
    { daysAgo: 7, hour: 7, minute: 40, period: 'morning', weight: 77.5, imp: 501 },
    { daysAgo: 5, hour: 15, minute: 10, period: 'afternoon', weight: 77.7, imp: 496 },
    { daysAgo: 3, hour: 21, minute: 30, period: 'night', weight: 77.8, imp: 493 },
    { daysAgo: 2, hour: 7, minute: 30, period: 'morning', weight: 76.9, imp: 492 },
    { daysAgo: 0, hour: 7, minute: 50, period: 'morning', weight: 76.5, imp: 488 },
  ];

  return samples.map((s, idx) => {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - s.daysAgo);
    dt.setHours(s.hour, s.minute, 0, 0);
    const m = calculateBioimpedance(s.weight, s.imp, profile, s.period);
    return {
      ...m,
      id: `seed-${idx}`,
      timestamp: dt.toISOString(),
      period: s.period,
      syncedSamsungHealth: true,
    };
  });
}

export async function loadMeasurements(profile: UserProfile): Promise<BioimpedanceMetrics[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.MEASUREMENTS);
    if (raw !== null) {
      const parsed: BioimpedanceMetrics[] = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map((m) => ({
          ...m,
          period: m.period || getDayPeriodFromIso(m.timestamp),
        }));
      }
    }
  } catch {}
  const seeded = generateSeedHistory(profile);
  await AsyncStorage.setItem(STORAGE_KEYS.MEASUREMENTS, JSON.stringify(seeded));
  return seeded;
}

export async function addMeasurement(
  measurement: BioimpedanceMetrics,
  profile: UserProfile
): Promise<BioimpedanceMetrics[]> {
  const current = await loadMeasurements(profile);
  const resolvedPeriod = measurement.period || getDayPeriodFromIso(measurement.timestamp);
  const normalizedMeasurement: BioimpedanceMetrics = {
    ...measurement,
    period: resolvedPeriod,
  };

  if (profile.supabaseUrl && profile.supabaseAnonKey) {
    try {
      const supabase = createClient(profile.supabaseUrl, profile.supabaseAnonKey);
      const { error } = await supabase.from('measurements').insert([
        {
          id: normalizedMeasurement.id,
          created_at: normalizedMeasurement.timestamp,
          weight_kg: normalizedMeasurement.weightKg,
          impedance_ohm: normalizedMeasurement.impedanceOhm,
          bmi: normalizedMeasurement.bmi,
          body_fat_percent: normalizedMeasurement.bodyFatPercent,
          muscle_mass_kg: normalizedMeasurement.muscleMassKg,
          water_percent: normalizedMeasurement.waterPercent,
          visceral_fat: normalizedMeasurement.visceralFat,
          bmr_kcal: normalizedMeasurement.bmrKcal,
          metabolic_age: normalizedMeasurement.metabolicAge,
        },
      ]);
      if (!error) {
        normalizedMeasurement.syncedSupabase = true;
      }
    } catch (e) {
      console.warn('Erro ao sincronizar com Supabase:', e);
    }
  }

  const updated = [...current, normalizedMeasurement];
  await AsyncStorage.setItem(STORAGE_KEYS.MEASUREMENTS, JSON.stringify(updated));
  return updated;
}

export async function deleteMeasurement(
  id: string,
  profile: UserProfile
): Promise<BioimpedanceMetrics[]> {
  const current = await loadMeasurements(profile);
  const updated = current.filter((item) => item.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.MEASUREMENTS, JSON.stringify(updated));

  if (profile.supabaseUrl && profile.supabaseAnonKey) {
    try {
      const supabase = createClient(profile.supabaseUrl, profile.supabaseAnonKey);
      await supabase.from('measurements').delete().eq('id', id);
    } catch (e) {
      console.warn('Erro ao remover pesagem do Supabase:', e);
    }
  }

  return updated;
}

export async function updateMeasurementPeriod(
  id: string,
  period: DayPeriod,
  profile: UserProfile
): Promise<BioimpedanceMetrics[]> {
  const current = await loadMeasurements(profile);
  const updated = current.map((item) =>
    item.id === id ? { ...item, period } : item
  );
  await AsyncStorage.setItem(STORAGE_KEYS.MEASUREMENTS, JSON.stringify(updated));
  return updated;
}

export function generateSeedBodyMeasurements(profile: UserProfile): BodyMeasurementsEntry[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const entriesRaw = [
    {
      daysAgo: 180,
      raw: {
        neckCm: 42.0,
        shouldersCm: 113.0,
        chestCm: 97.5,
        bicepsCm: 33.2,
        forearmCm: 27.2,
        waistCm: 94.0,
        abdomenCm: 97.0,
        hipsCm: 104.5,
        thighCm: 54.0,
        calfCm: 36.8,
      },
    },
    {
      daysAgo: 90,
      raw: {
        neckCm: 41.2,
        shouldersCm: 114.0,
        chestCm: 98.5,
        bicepsCm: 33.8,
        forearmCm: 27.6,
        waistCm: 91.0,
        abdomenCm: 94.0,
        hipsCm: 103.0,
        thighCm: 55.0,
        calfCm: 37.1,
      },
    },
    {
      daysAgo: 60,
      raw: {
        neckCm: 40.8,
        shouldersCm: 114.5,
        chestCm: 99.0,
        bicepsCm: 34.2,
        forearmCm: 27.8,
        waistCm: 89.8,
        abdomenCm: 92.8,
        hipsCm: 102.2,
        thighCm: 55.5,
        calfCm: 37.3,
      },
    },
    {
      daysAgo: 30,
      raw: {
        neckCm: 40.5,
        shouldersCm: 115.0,
        chestCm: 99.5,
        bicepsCm: 34.5,
        forearmCm: 28.0,
        waistCm: 88.5,
        abdomenCm: 91.5,
        hipsCm: 101.5,
        thighCm: 56.0,
        calfCm: 37.5,
      },
    },
    {
      daysAgo: 14,
      raw: {
        neckCm: 39.5,
        shouldersCm: 117.0,
        chestCm: 101.0,
        bicepsCm: 35.5,
        forearmCm: 28.5,
        waistCm: 85.0,
        abdomenCm: 87.5,
        hipsCm: 99.5,
        thighCm: 57.5,
        calfCm: 38.0,
      },
    },
    {
      daysAgo: 5,
      raw: {
        neckCm: 39.2,
        shouldersCm: 118.0,
        chestCm: 102.0,
        bicepsCm: 36.2,
        forearmCm: 28.8,
        waistCm: 83.2,
        abdomenCm: 85.2,
        hipsCm: 98.5,
        thighCm: 58.2,
        calfCm: 38.3,
      },
    },
    {
      daysAgo: 0,
      raw: {
        neckCm: 39.0,
        shouldersCm: 118.5,
        chestCm: 102.5,
        bicepsCm: 36.5,
        forearmCm: 29.0,
        waistCm: 82.0,
        abdomenCm: 84.0,
        hipsCm: 98.0,
        thighCm: 58.5,
        calfCm: 38.5,
      },
    },
  ];

  return entriesRaw.map((item, i) => {
    const idx = calculateAnthropometricIndices(item.raw, profile);
    return {
      id: `tape-seed-${i + 1}`,
      timestamp: new Date(now - item.daysAgo * dayMs).toISOString(),
      ...item.raw,
      waistToHipRatio: idx.waistToHipRatio,
      navyBodyFatEstimate: idx.navyBodyFatEstimate,
    };
  });
}

export async function loadBodyMeasurementsHistory(
  profile: UserProfile
): Promise<BodyMeasurementsEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.BODY_TAPE);
    if (raw) {
      const parsed: BioimpedanceMetrics[] | BodyMeasurementsEntry[] = JSON.parse(raw);
      if (parsed.length > 0) return parsed as BodyMeasurementsEntry[];
    }
  } catch {}
  const seeded = generateSeedBodyMeasurements(profile);
  await AsyncStorage.setItem(STORAGE_KEYS.BODY_TAPE, JSON.stringify(seeded));
  return seeded;
}

export async function saveBodyMeasurementsEntry(
  rawValues: Omit<
    BodyMeasurementsEntry,
    'id' | 'timestamp' | 'waistToHipRatio' | 'navyBodyFatEstimate'
  >,
  profile: UserProfile
): Promise<BodyMeasurementsEntry[]> {
  const current = await loadBodyMeasurementsHistory(profile);
  const indices = calculateAnthropometricIndices(rawValues, profile);

  const newEntry: BodyMeasurementsEntry = {
    id: `tape-${Date.now()}`,
    timestamp: new Date().toISOString(),
    ...rawValues,
    waistToHipRatio: indices.waistToHipRatio,
    navyBodyFatEstimate: indices.navyBodyFatEstimate,
  };

  if (profile.supabaseUrl && profile.supabaseAnonKey) {
    try {
      const supabase = createClient(profile.supabaseUrl, profile.supabaseAnonKey);
      const { error } = await supabase.from('body_measurements').insert([
        {
          id: newEntry.id,
          created_at: newEntry.timestamp,
          neck_cm: newEntry.neckCm,
          shoulders_cm: newEntry.shouldersCm,
          chest_cm: newEntry.chestCm,
          biceps_cm: newEntry.bicepsCm,
          forearm_cm: newEntry.forearmCm,
          waist_cm: newEntry.waistCm,
          abdomen_cm: newEntry.abdomenCm,
          hips_cm: newEntry.hipsCm,
          thigh_cm: newEntry.thighCm,
          calf_cm: newEntry.calfCm,
          waist_hip_ratio: newEntry.waistToHipRatio,
          navy_bf_percent: newEntry.navyBodyFatEstimate,
        },
      ]);
      if (!error) {
        newEntry.syncedSupabase = true;
      }
    } catch (e) {
      console.warn('Erro ao salvar medidas corporais no Supabase:', e);
    }
  }

  const updated = [...current, newEntry];
  await AsyncStorage.setItem(STORAGE_KEYS.BODY_TAPE, JSON.stringify(updated));
  return updated;
}

export function generateSeedLabExams(): LabExamEntry[] {
  const daysAgo7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const glucose = 91;
  const insulin = 7.8;
  return [
    {
      id: 'exam-seed-1',
      timestamp: daysAgo7,
      label: 'Check-up Metabólico & Hormonal',
      fastingGlucoseMgDl: glucose,
      hba1cPercent: 5.3,
      fastingInsulinUiuMl: insulin,
      homaIr: calculateHomaIr(glucose, insulin),
      totalCholesterolMgDl: 184,
      hdlMgDl: 48,
      ldlMgDl: 108,
      triglyceridesMgDl: 138,
      tshUiuMl: 2.1,
      freeT4NgDl: 1.25,
      totalTestosteroneNgDl: 540,
      morningCortisolUgDl: 14.2,
      vitaminDNgMl: 26.5,
      vitaminB12PgMl: 430,
      ferritinNgMl: 115,
      hsCrpMgL: 1.1,
      creatinineMgDl: 1.04,
      astU_L: 25,
      altU_L: 28,
      customNotes:
        'Objetivo: recomposição corporal, baixar LDL para < 100 mg/dL e corrigir Vitamina D.',
    },
  ];
}

export async function loadLabExamsHistory(): Promise<LabExamEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.LAB_EXAMS);
    if (raw !== null) {
      const parsed: LabExamEntry[] = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  const seeded = generateSeedLabExams();
  await AsyncStorage.setItem(STORAGE_KEYS.LAB_EXAMS, JSON.stringify(seeded));
  return seeded;
}

export async function saveLabExamEntry(
  rawExam: Omit<LabExamEntry, 'id' | 'timestamp' | 'homaIr'>,
  profile: UserProfile
): Promise<LabExamEntry[]> {
  const current = await loadLabExamsHistory();
  const homaIr = calculateHomaIr(
    rawExam.fastingGlucoseMgDl,
    rawExam.fastingInsulinUiuMl
  );

  const newExam: LabExamEntry = {
    ...rawExam,
    id: `exam-${Date.now()}`,
    timestamp: new Date().toISOString(),
    homaIr,
  };

  if (profile.supabaseUrl && profile.supabaseAnonKey) {
    try {
      const supabase = createClient(profile.supabaseUrl, profile.supabaseAnonKey);
      const { error } = await supabase.from('lab_exams').insert([
        {
          id: newExam.id,
          created_at: newExam.timestamp,
          label: newExam.label,
          payload: newExam,
        },
      ]);
      if (!error) {
        newExam.syncedSupabase = true;
      }
    } catch (e) {
      console.warn('Erro ao salvar exame no Supabase:', e);
    }
  }

  const updated = [...current, newExam];
  await AsyncStorage.setItem(STORAGE_KEYS.LAB_EXAMS, JSON.stringify(updated));
  return updated;
}

export async function deleteLabExamEntry(
  id: string,
  profile: UserProfile
): Promise<LabExamEntry[]> {
  const current = await loadLabExamsHistory();
  const updated = current.filter((e) => e.id !== id);
  await AsyncStorage.setItem(STORAGE_KEYS.LAB_EXAMS, JSON.stringify(updated));

  if (profile.supabaseUrl && profile.supabaseAnonKey) {
    try {
      const supabase = createClient(profile.supabaseUrl, profile.supabaseAnonKey);
      await supabase.from('lab_exams').delete().eq('id', id);
    } catch {}
  }

  return updated;
}

export const SUPABASE_SQL_SCHEMA = `-- Execute este SQL no SQL Editor do seu projeto Supabase:
create table if not exists public.measurements (
  id text primary key,
  created_at timestamptz not null default now(),
  weight_kg numeric(5,2) not null,
  impedance_ohm integer not null,
  bmi numeric(4,1),
  body_fat_percent numeric(4,1),
  muscle_mass_kg numeric(5,2),
  water_percent numeric(4,1),
  visceral_fat integer,
  bmr_kcal integer,
  metabolic_age integer
);

create table if not exists public.body_measurements (
  id text primary key,
  created_at timestamptz not null default now(),
  neck_cm numeric(5,1),
  shoulders_cm numeric(5,1),
  chest_cm numeric(5,1),
  biceps_cm numeric(5,1),
  forearm_cm numeric(5,1),
  waist_cm numeric(5,1),
  abdomen_cm numeric(5,1),
  hips_cm numeric(5,1),
  thigh_cm numeric(5,1),
  calf_cm numeric(5,1),
  waist_hip_ratio numeric(4,2),
  navy_bf_percent numeric(4,1)
);

create table if not exists public.lab_exams (
  id text primary key,
  created_at timestamptz not null default now(),
  label text,
  payload jsonb not null
);
`;
