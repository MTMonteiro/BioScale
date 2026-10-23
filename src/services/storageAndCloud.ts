import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { BioimpedanceMetrics, BodyMeasurementsEntry, UserProfile } from '../types/health';
import { calculateBioimpedance } from '../utils/bioimpedance';
import { calculateAnthropometricIndices } from '../utils/bodyMeasurements';

const STORAGE_KEYS = {
  MEASUREMENTS: '@bioscale:measurements_v1',
  PROFILE: '@bioscale:profile_v1',
  BODY_TAPE: '@bioscale:body_tape_v2',
};

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Matheus',
  heightCm: 175,
  age: 28,
  sex: 'male',
  targetWeightKg: 74.0,
  aiProvider: 'openrouter',
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
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const samples = [
    { daysAgo: 30, weight: 79.8, imp: 525 },
    { daysAgo: 21, weight: 79.1, imp: 518 },
    { daysAgo: 14, weight: 78.4, imp: 512 },
    { daysAgo: 11, weight: 78.0, imp: 508 },
    { daysAgo: 8, weight: 77.6, imp: 502 },
    { daysAgo: 5, weight: 77.3, imp: 498 },
    { daysAgo: 2, weight: 76.9, imp: 492 },
    { daysAgo: 0, weight: 76.5, imp: 488 },
  ];

  return samples.map((s, idx) => {
    const m = calculateBioimpedance(s.weight, s.imp, profile);
    return {
      ...m,
      id: `seed-${idx}`,
      timestamp: new Date(now - s.daysAgo * dayMs).toISOString(),
      syncedSamsungHealth: true,
    };
  });
}

export async function loadMeasurements(profile: UserProfile): Promise<BioimpedanceMetrics[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.MEASUREMENTS);
    if (raw) {
      const parsed: BioimpedanceMetrics[] = JSON.parse(raw);
      if (parsed.length > 0) return parsed;
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

  if (profile.supabaseUrl && profile.supabaseAnonKey) {
    try {
      const supabase = createClient(profile.supabaseUrl, profile.supabaseAnonKey);
      const { error } = await supabase.from('measurements').insert([
        {
          id: measurement.id,
          created_at: measurement.timestamp,
          weight_kg: measurement.weightKg,
          impedance_ohm: measurement.impedanceOhm,
          bmi: measurement.bmi,
          body_fat_percent: measurement.bodyFatPercent,
          muscle_mass_kg: measurement.muscleMassKg,
          water_percent: measurement.waterPercent,
          visceral_fat: measurement.visceralFat,
          bmr_kcal: measurement.bmrKcal,
          metabolic_age: measurement.metabolicAge,
        },
      ]);
      if (!error) {
        measurement.syncedSupabase = true;
      }
    } catch (e) {
      console.warn('Erro ao sincronizar com Supabase:', e);
    }
  }

  const updated = [...current, measurement];
  await AsyncStorage.setItem(STORAGE_KEYS.MEASUREMENTS, JSON.stringify(updated));
  return updated;
}

export function generateSeedBodyMeasurements(profile: UserProfile): BodyMeasurementsEntry[] {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const entriesRaw = [
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
`;
