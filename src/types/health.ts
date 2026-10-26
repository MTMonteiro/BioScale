export type Sex = 'male' | 'female';

export type AiProvider =
  | 'gemma_local'
  | 'openrouter'
  | 'deepseek'
  | 'gemini'
  | 'local';

export type DayPeriod = 'morning' | 'afternoon' | 'night';

export type DayPeriodFilter = 'all' | DayPeriod;

export type CoachPersona = 'atlas' | 'aura' | 'gemma_core';

export type TrainingGoal =
  | 'recomposition'
  | 'fat_loss'
  | 'hypertrophy'
  | 'longevity';

export interface UserProfile {
  name: string;
  heightCm: number;
  age: number;
  sex: Sex;
  targetWeightKg: number;
  trainingGoal?: TrainingGoal;
  weeklyWorkoutsTarget?: number;
  coachPersona?: CoachPersona;
  aiProvider: AiProvider;
  selectedLocalModelId?: string;
  customLocalModelUrl?: string;
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
  period?: DayPeriod;
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

export interface LabExamEntry {
  id: string;
  timestamp: string;
  label: string;
  fastingGlucoseMgDl?: number;
  hba1cPercent?: number;
  fastingInsulinUiuMl?: number;
  homaIr?: number;
  totalCholesterolMgDl?: number;
  hdlMgDl?: number;
  ldlMgDl?: number;
  triglyceridesMgDl?: number;
  tshUiuMl?: number;
  freeT4NgDl?: number;
  totalTestosteroneNgDl?: number;
  morningCortisolUgDl?: number;
  vitaminDNgMl?: number;
  vitaminB12PgMl?: number;
  ferritinNgMl?: number;
  hsCrpMgL?: number;
  creatinineMgDl?: number;
  astU_L?: number;
  altU_L?: number;
  customNotes?: string;
  attachmentUri?: string;
  attachmentType?: 'photo' | 'pdf';
  attachmentName?: string;
  syncedSupabase?: boolean;
}

export interface LocalGemmaModelSpec {
  id: string;
  name: string;
  family: string;
  sizeMb: number;
  ramRequiredGb: number;
  quantization: string;
  description: string;
  downloadUrl: string;
  filename: string;
  recommended?: boolean;
}

export interface StructuredCoachPlan {
  generatedAt: string;
  providerUsed: string;
  healthScore: number;
  summaryHeadline: string;
  overviewAnalysis: string;
  trainingPlan: string;
  nutritionPlan: string;
  habitsAndRecoveryPlan: string;
  examsAnalysis: string;
  rawFullText: string;
}

export interface CoachChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  providerBadge?: string;
}
