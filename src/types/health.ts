export type Sex = 'male' | 'female';

export type AiProvider = 'openrouter' | 'deepseek' | 'gemini' | 'local';

export interface UserProfile {
  name: string;
  heightCm: number;
  age: number;
  sex: Sex;
  targetWeightKg: number;
  aiProvider: AiProvider;
  openRouterApiKey?: string;
  openRouterModel?: string;
  deepseekApiKey?: string;
  deepseekModel?: string;
  geminiApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface RawScaleReading {
  weightKg: number;
  impedanceOhm: number;
  isStabilized: boolean;
  hasImpedance: boolean;
  protocolVersion: string;
  rawHex: string;
  deviceName?: string;
  deviceId?: string;
}

export interface BioimpedanceMetrics {
  id: string;
  timestamp: string;
  weightKg: number;
  impedanceOhm: number;
  bmi: number;
  bodyFatPercent: number;
  fatMassKg: number;
  leanBodyMassKg: number;
  muscleMassKg: number;
  musclePercent: number;
  waterPercent: number;
  boneMassKg: number;
  visceralFat: number;
  bmrKcal: number;
  metabolicAge: number;
  proteinPercent: number;
  syncedSamsungHealth?: boolean;
  syncedSupabase?: boolean;
}

export type BodyPartKey =
  | 'neckCm'
  | 'shouldersCm'
  | 'chestCm'
  | 'bicepsCm'
  | 'forearmCm'
  | 'waistCm'
  | 'abdomenCm'
  | 'hipsCm'
  | 'thighCm'
  | 'calfCm';

export interface BodyMeasurementsEntry {
  id: string;
  timestamp: string;
  neckCm: number;
  shouldersCm: number;
  chestCm: number;
  bicepsCm: number;
  forearmCm: number;
  waistCm: number;
  abdomenCm: number;
  hipsCm: number;
  thighCm: number;
  calfCm: number;
  waistToHipRatio: number;
  navyBodyFatEstimate: number;
  syncedSupabase?: boolean;
}

export interface SamsungHealthSummary {
  stepsToday: number;
  caloriesBurnedToday: number;
  sleepHoursLastNight: number;
  lastSyncedAt?: string;
  isConnected: boolean;
}
