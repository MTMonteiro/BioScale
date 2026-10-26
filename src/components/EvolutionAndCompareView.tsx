import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
  Check,
  Clock,
  Info,
  Layers,
  Minus,
  Plus,
  Ruler,
  Scale,
  ShieldCheck,
  Sparkles,
  Table2,
  Trash2,
  X,
} from 'lucide-react-native';
import {
  BioimpedanceMetrics,
  BodyMeasurementsEntry,
  BodyPartKey,
  DayPeriod,
  DayPeriodFilter,
  UserProfile,
} from '../types/health';
import {
  DAY_PERIOD_INFO,
  filterMeasurementsByPeriod,
  resolveMeasurementPeriod,
} from '../utils/bioimpedance';
import {
  BODY_PARTS_GUIDE,
  BODY_PART_ORDER,
  calculateAnthropometricIndices,
} from '../utils/bodyMeasurements';
import { BodyAvatarSvg } from './BodyAvatarSvg';
import { obsidianTheme } from '../theme/obsidianTheme';

export interface EvolutionAndCompareViewProps {
  scaleHistory: BioimpedanceMetrics[];
  bodyHistory: BodyMeasurementsEntry[];
  profile: UserProfile;
  selectedPeriodFilter?: DayPeriodFilter;
  onChangePeriodFilter?: (filter: DayPeriodFilter) => void;
  onDeleteMeasurement?: (id: string) => void;
  onUpdateMeasurementPeriod?: (id: string, period: DayPeriod) => void;
  // Props for View 1 ("Avatar & Fita Métrica"):
  draftBody?: {
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
  };
  selectedPart?: BodyPartKey;
  onSelectPart?: (part: BodyPartKey) => void;
  onChangeDraftMeasure?: (part: BodyPartKey, delta: number) => void;
  onSetDraftMeasureDirect?: (part: BodyPartKey, value: string) => void;
  onSaveBodyMeasurements?: () => void;
  bodySaveFeedback?: string;
}

type BodySubView = 'avatar' | 'compare' | 'records';

type ComparePresetDays = 7 | 30 | 60 | 90 | 180 | 'custom';

const COMPARE_PRESETS: Array<{
  key: ComparePresetDays;
  label: string;
  shortLabel: string;
}> = [
  { key: 7, label: 'Últimos 7 dias', shortLabel: '7 dias' },
  { key: 30, label: 'Últimos 30 dias', shortLabel: '30 dias' },
  { key: 60, label: 'Últimos 60 dias', shortLabel: '60 dias' },
  { key: 90, label: 'Últimos 90 dias', shortLabel: '90 dias' },
  { key: 180, label: 'Últimos 180 dias', shortLabel: '180 dias' },
  { key: 'custom', label: 'Personalizado', shortLabel: 'Manual' },
];

const PERIOD_FILTERS: Array<{
  key: DayPeriodFilter;
  label: string;
  icon: string;
}> = [
  { key: 'all', label: 'Todos', icon: '🕒' },
  { key: 'morning', label: 'Manhã', icon: '🌅' },
  { key: 'afternoon', label: 'Tarde', icon: '☀️' },
  { key: 'night', label: 'Noite', icon: '🌙' },
];

const SHIFT_DISPLAY: Record<
  DayPeriod,
  { label: string; icon: string; color: string }
> = {
  morning: { label: 'Manhã', icon: '🌅', color: '#F59E0B' },
  afternoon: { label: 'Tarde', icon: '☀️', color: '#38BDF8' },
  night: { label: 'Noite', icon: '🌙', color: '#A855F7' },
};

const NEXT_PERIOD_ORDER: Record<DayPeriod, DayPeriod> = {
  morning: 'afternoon',
  afternoon: 'night',
  night: 'morning',
};

const ANATOMICAL_DETAILS: Record<
  BodyPartKey,
  { anatomicalReference: string; howToMeasure: string; whyItMatters: string }
> = {
  neckCm: {
    anatomicalReference:
      'Abaixo da proeminência laríngea (pomo de adão), com eixo perpendicular à coluna cervical.',
    howToMeasure:
      'Olhe para a frente com os ombros relaxados. Posicione a fita logo abaixo da laringe sem comprimir a pele.',
    whyItMatters:
      'Variável chave na equação antropométrica da Marinha dos EUA (US Navy) e marcador clínico de risco para apneia e resistência insulínica.',
  },
  shouldersCm: {
    anatomicalReference:
      'Circunferência biacromial máxima sobre a porção média dos músculos deltoides.',
    howToMeasure:
      'Em pé, postura neutra e braços relaxados ao lado do tronco. Passe a fita ao redor do ponto mais largo dos dois ombros (~5 cm abaixo da clavícula).',
    whyItMatters:
      'Define o topo da estrutura em V (Índice V-Taper). Ganhos refletem hipertrofia direta de deltoides e cintura escapular.',
  },
  chestCm: {
    anatomicalReference:
      'Linha mamilar (4º espaço intercostal) contornando o dorso abaixo do ângulo inferior das escápulas.',
    howToMeasure:
      'Passe a fita sob as axilas na linha mais cheia do tórax, paralela ao solo. Faça a leitura ao final de uma expiração normal.',
    whyItMatters:
      'Monitora a expansão muscular de peitoral maior e grande dorsal (latíssimo do dorso).',
  },
  bicepsCm: {
    anatomicalReference:
      'Ponto médio entre o acrômio da escápula e o olécrano da ulna (pico do ventre bicipital).',
    howToMeasure:
      'Eleve o braço na linha do ombro, flexione o cotovelo a 90° e contraia o bíceps. Meça no ponto de maior circunferência.',
    whyItMatters:
      'Indicador direto de massa muscular apendicular superior. Meça sempre frio e no mesmo hemicorpo.',
  },
  forearmCm: {
    anatomicalReference:
      'Terço proximal do antebraço, ~2 cm distal à prega cubital (fossa antecubital).',
    howToMeasure:
      'Estenda o cotovelo e feche o punho com firmeza. Envolva a fita na porção mais espessa dos flexores/extensores.',
    whyItMatters:
      'Correlaciona-se fortemente com a força de preensão manual (handgrip), um dos principais biomarcadores de longevidade funcional.',
  },
  waistCm: {
    anatomicalReference:
      'Menor perímetro abdominal entre a última costela flutuante (10ª costela) e a crista ilíaca.',
    howToMeasure:
      'Com o abdômen relaxado ao final da expiração normal, meça na linha mais estreita do tronco (2 a 3 dedos acima da cicatriz umbilical).',
    whyItMatters:
      'Padrão-ouro clínico para estimar tecido adiposo visceral e risco cardiometabólico (meta < 50% da estatura).',
  },
  abdomenCm: {
    anatomicalReference:
      'Plano horizontal exato sobre a cicatriz umbilical, paralelo ao solo.',
    howToMeasure:
      'Pés unidos, postura ereta e parede abdominal relaxada. Passe a fita diretamente sobre a linha do umbigo.',
    whyItMatters:
      'Região mais sensível a variações semanais de gordura subcutânea abdominal e retenção hídrica/glicogênio.',
  },
  hipsCm: {
    anatomicalReference:
      'Maior proeminência posterior da região glútea ao nível dos trocânteres maiores do fêmur.',
    howToMeasure:
      'Mantenha os pés juntos e passe a fita no ponto de maior circunferência dos glúteos, conferindo o alinhamento horizontal.',
    whyItMatters:
      'Base para o cálculo da Relação Cintura/Quadril (RCQ) da OMS e acompanhamento de hipertrofia glútea.',
  },
  thighCm: {
    anatomicalReference:
      'Ponto médio anatômico entre a prega inguinal proximal e a borda superior da patela.',
    howToMeasure:
      'Em pé com os pés afastados na largura do quadril e peso distribuído igualmente. Meça no meio exato da coxa.',
    whyItMatters:
      'Concentra o maior volume muscular esquelético do corpo, atuando como principal dreno metabólico de glicose.',
  },
  calfCm: {
    anatomicalReference:
      'Maior perímetro do tríceps sural (ventres medial e lateral do gastrocnêmio).',
    howToMeasure:
      'Pés apoiados totalmente no solo em posição neutra. Envolva a fita na porção mais larga da panturrilha.',
    whyItMatters:
      'Indicador clássico de reserva muscular periférica e retorno venoso nos membros inferiores.',
  },
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
    2,
    '0'
  )}`;
}

function findClosestScaleEntry(
  targetIso: string,
  scaleHistory: BioimpedanceMetrics[]
): BioimpedanceMetrics | null {
  if (scaleHistory.length === 0) return null;
  const targetMs = new Date(targetIso).getTime();
  let best = scaleHistory[0];
  let bestDiff = Math.abs(new Date(best.timestamp).getTime() - targetMs);
  for (const item of scaleHistory) {
    const diff = Math.abs(new Date(item.timestamp).getTime() - targetMs);
    if (diff < bestDiff) {
      best = item;
      bestDiff = diff;
    }
  }
  return best;
}

function findClosestBodyEntry(
  targetIso: string,
  bodyHistory: BodyMeasurementsEntry[]
): BodyMeasurementsEntry | null {
  if (bodyHistory.length === 0) return null;
  const targetMs = new Date(targetIso).getTime();
  let best = bodyHistory[0];
  let bestDiff = Math.abs(new Date(best.timestamp).getTime() - targetMs);
  for (const item of bodyHistory) {
    const diff = Math.abs(new Date(item.timestamp).getTime() - targetMs);
    if (diff < bestDiff) {
      best = item;
      bestDiff = diff;
    }
  }
  return best;
}

function computePeriodStats(items: BioimpedanceMetrics[]) {
  if (items.length === 0) return null;
  const weights = items.map((i) => i.weightKg);
  const sum = weights.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / weights.length) * 10) / 10;
  const first = items[0];
  const last = items[items.length - 1];
  const delta = Math.round((last.weightKg - first.weightKg) * 10) / 10;
  return { count: items.length, avg, delta };
}

function isReductionGoalPart(part: BodyPartKey): boolean {
  return (
    part === 'waistCm' ||
    part === 'abdomenCm' ||
    part === 'hipsCm' ||
    part === 'neckCm'
  );
}

export const EvolutionAndCompareView: React.FC<EvolutionAndCompareViewProps> = ({
  scaleHistory,
  bodyHistory,
  profile,
  selectedPeriodFilter,
  onChangePeriodFilter,
  onDeleteMeasurement,
  onUpdateMeasurementPeriod,
  draftBody,
  selectedPart,
  onSelectPart,
  onChangeDraftMeasure,
  onSetDraftMeasureDirect,
  onSaveBodyMeasurements,
  bodySaveFeedback,
}) => {
  const [activeSubView, setActiveSubView] = useState<BodySubView>('avatar');

  // Estados internos de fallback caso props opcionais não sejam fornecidas
  const [internalPeriodFilter, setInternalPeriodFilter] =
    useState<DayPeriodFilter>('all');
  const [internalSelectedPart, setInternalSelectedPart] =
    useState<BodyPartKey>('waistCm');
  const [internalDraftBody, setInternalDraftBody] = useState<{
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
  }>(() => {
    const last =
      bodyHistory.length > 0 ? bodyHistory[bodyHistory.length - 1] : null;
    return {
      neckCm: last?.neckCm ?? 39.0,
      shouldersCm: last?.shouldersCm ?? 118.5,
      chestCm: last?.chestCm ?? 102.5,
      bicepsCm: last?.bicepsCm ?? 36.5,
      forearmCm: last?.forearmCm ?? 29.0,
      waistCm: last?.waistCm ?? 82.0,
      abdomenCm: last?.abdomenCm ?? 84.0,
      hipsCm: last?.hipsCm ?? 98.0,
      thighCm: last?.thighCm ?? 58.5,
      calfCm: last?.calfCm ?? 38.5,
    };
  });

  const effectivePeriodFilter = selectedPeriodFilter ?? internalPeriodFilter;
  const effectiveSelectedPart = selectedPart ?? internalSelectedPart;
  const effectiveDraftBody = draftBody ?? internalDraftBody;

  // Estado local do input numérico para permitir digitação fluida com vírgula/ponto
  const [directInputText, setDirectInputText] = useState<string>(
    String(effectiveDraftBody[effectiveSelectedPart])
  );

  useEffect(() => {
    setDirectInputText(String(effectiveDraftBody[effectiveSelectedPart]));
  }, [effectiveSelectedPart, effectiveDraftBody]);

  // Gaveta colapsável "Como medir com a fita" (minimalista por padrão)
  const [showHowToMeasure, setShowHowToMeasure] = useState<boolean>(false);

  // Card de índice clínico expandido
  const [expandedIndexKey, setExpandedIndexKey] = useState<
    'navy' | 'whr' | 'vtaper' | null
  >(null);

  // Estados do Comparador Antes/Depois (Período B = Anterior, Período A = Atual)
  const [comparePreset, setComparePreset] = useState<ComparePresetDays>(30);
  const [dateBIdx, setDateBIdx] = useState<number>(0);
  const [dateAIdx, setDateAIdx] = useState<number>(
    Math.max(0, bodyHistory.length - 1)
  );
  const [scaleBIdx, setScaleBIdx] = useState<number>(0);
  const [scaleAIdx, setScaleAIdx] = useState<number>(
    Math.max(0, scaleHistory.length - 1)
  );
  const [comparePart, setComparePart] = useState<BodyPartKey>('waistCm');

  // Estados da Tabela de Registros
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [showMatrixTable, setShowMatrixTable] = useState<boolean>(true);

  const filteredScaleHistory = filterMeasurementsByPeriod(
    scaleHistory,
    effectivePeriodFilter
  );

  const applyComparePreset = (
    days: ComparePresetDays,
    scalePool: BioimpedanceMetrics[],
    tapePool: BodyMeasurementsEntry[]
  ) => {
    setComparePreset(days);
    if (days === 'custom') {
      return;
    }

    const dayMs = days * 24 * 60 * 60 * 1000;

    if (scalePool.length > 0) {
      const lastScaleIdx = scalePool.length - 1;
      const latestMs = new Date(scalePool[lastScaleIdx].timestamp).getTime();
      const targetMs = latestMs - dayMs;
      let bestIdx = 0;
      let bestDiff = Math.abs(
        new Date(scalePool[0].timestamp).getTime() - targetMs
      );
      const maxSearchIdx = Math.max(0, lastScaleIdx - 1);
      for (let i = 0; i <= maxSearchIdx; i++) {
        const diff = Math.abs(
          new Date(scalePool[i].timestamp).getTime() - targetMs
        );
        if (diff <= bestDiff) {
          bestDiff = diff;
          bestIdx = i;
        }
      }
      setScaleAIdx(lastScaleIdx);
      setScaleBIdx(bestIdx);
    }

    if (tapePool.length > 0) {
      const lastBodyIdx = tapePool.length - 1;
      const latestBodyMs = new Date(tapePool[lastBodyIdx].timestamp).getTime();
      const targetBodyMs = latestBodyMs - dayMs;
      let bestBodyIdx = 0;
      let bestBodyDiff = Math.abs(
        new Date(tapePool[0].timestamp).getTime() - targetBodyMs
      );
      const maxBodySearchIdx = Math.max(0, lastBodyIdx - 1);
      for (let i = 0; i <= maxBodySearchIdx; i++) {
        const diff = Math.abs(
          new Date(tapePool[i].timestamp).getTime() - targetBodyMs
        );
        if (diff <= bestBodyDiff) {
          bestBodyDiff = diff;
          bestBodyIdx = i;
        }
      }
      setDateAIdx(lastBodyIdx);
      setDateBIdx(bestBodyIdx);
    }
  };

  useEffect(() => {
    const pool =
      filteredScaleHistory.length > 0 ? filteredScaleHistory : scaleHistory;
    if (comparePreset !== 'custom') {
      applyComparePreset(comparePreset, pool, bodyHistory);
    } else {
      setDateBIdx(0);
      setDateAIdx(Math.max(0, bodyHistory.length - 1));
      setScaleBIdx(0);
      setScaleAIdx(Math.max(0, pool.length - 1));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bodyHistory.length, filteredScaleHistory.length, effectivePeriodFilter]);

  const handleSelectPeriodFilter = (nextFilter: DayPeriodFilter) => {
    setInternalPeriodFilter(nextFilter);
    onChangePeriodFilter?.(nextFilter);
  };

  const handleSelectBodyPart = (part: BodyPartKey) => {
    setInternalSelectedPart(part);
    onSelectPart?.(part);
  };

  const handleStepMeasure = (part: BodyPartKey, delta: number) => {
    const guide = BODY_PARTS_GUIDE[part];
    const current = effectiveDraftBody[part];
    const nextVal =
      Math.round(
        Math.max(guide.minCm, Math.min(guide.maxCm, current + delta)) * 10
      ) / 10;

    setInternalDraftBody((prev) => ({ ...prev, [part]: nextVal }));
    onChangeDraftMeasure?.(part, delta);
  };

  const handleDirectInputChange = (txt: string) => {
    setDirectInputText(txt);
    onSetDraftMeasureDirect?.(effectiveSelectedPart, txt);

    const parsed = parseFloat(txt.replace(',', '.'));
    if (!isNaN(parsed)) {
      const guide = BODY_PARTS_GUIDE[effectiveSelectedPart];
      const clamped =
        Math.round(
          Math.max(guide.minCm, Math.min(guide.maxCm, parsed)) * 10
        ) / 10;
      setInternalDraftBody((prev) => ({
        ...prev,
        [effectiveSelectedPart]: clamped,
      }));
      if (!onSetDraftMeasureDirect && onChangeDraftMeasure) {
        const delta =
          Math.round((clamped - effectiveDraftBody[effectiveSelectedPart]) * 10) /
          10;
        if (delta !== 0) {
          onChangeDraftMeasure(effectiveSelectedPart, delta);
        }
      }
    }
  };

  // ============================================================================
  // RENDER VIEW 1: AVATAR & FITA MÉTRICA
  // ============================================================================
  const renderAvatarView = () => {
    const activeGuide = BODY_PARTS_GUIDE[effectiveSelectedPart];
    const anatomicalInfo = ANATOMICAL_DETAILS[effectiveSelectedPart];
    const currentVal = effectiveDraftBody[effectiveSelectedPart];
    const idealCm =
      profile.sex === 'male'
        ? activeGuide.idealBaseMaleCm
        : activeGuide.idealBaseFemaleCm;
    const firstBodyEntry = bodyHistory.length > 0 ? bodyHistory[0] : null;
    const diffFromStart = firstBodyEntry
      ? Math.round((currentVal - firstBodyEntry[effectiveSelectedPart]) * 10) / 10
      : 0;
    const latestScale =
      scaleHistory.length > 0 ? scaleHistory[scaleHistory.length - 1] : null;

    const indices = calculateAnthropometricIndices(effectiveDraftBody, profile);

    // Avaliações clínicas dos 3 índices
    const isMale = profile.sex === 'male';
    const navyOptimalMax = isMale ? 15 : 22;
    const navyNormalMax = isMale ? 20 : 28;
    const navyStatus =
      indices.navyBodyFatEstimate <= navyOptimalMax
        ? { label: 'Atlético / Ideal', color: obsidianTheme.statusOptimal }
        : indices.navyBodyFatEstimate <= navyNormalMax
        ? { label: 'Saudável', color: obsidianTheme.statusNormal }
        : { label: 'Acima da Meta', color: obsidianTheme.statusAttention };
    const navyPercentFill = Math.min(
      100,
      Math.max(6, ((indices.navyBodyFatEstimate - 5) / 35) * 100)
    );

    const whrOptimalMax = isMale ? 0.88 : 0.8;
    const whrNormalMax = isMale ? 0.94 : 0.85;
    const whrStatus =
      indices.waistToHipRatio <= whrOptimalMax
        ? { label: 'Baixo Risco OMS', color: obsidianTheme.statusOptimal }
        : indices.waistToHipRatio <= whrNormalMax
        ? { label: 'Risco Moderado', color: obsidianTheme.statusNormal }
        : { label: 'Atenção Visceral', color: obsidianTheme.statusAttention };
    const whrPercentFill = Math.min(
      100,
      Math.max(6, ((indices.waistToHipRatio - 0.65) / 0.45) * 100)
    );

    const vTaperStatus =
      indices.vTaperRatio >= 1.42
        ? { label: 'Shape em V Forte', color: obsidianTheme.statusOptimal }
        : indices.vTaperRatio >= 1.28
        ? { label: 'Simetria Equilibrada', color: obsidianTheme.statusNormal }
        : { label: 'Em Construção', color: obsidianTheme.statusAttention };
    const vTaperPercentFill = Math.min(
      100,
      Math.max(6, ((indices.vTaperRatio - 1.05) / 0.65) * 100)
    );

    return (
      <View>
        {/* Card do Avatar Interativo */}
        <View style={styles.card}>
          <View style={styles.cardHeaderBetween}>
            <View>
              <Text style={styles.sectionEyebrow}>MODELAGEM BIOMÉTRICA</Text>
              <Text style={styles.cardTitle}>Avatar & Fita Métrica</Text>
            </View>
            <View style={styles.emeraldPillBadge}>
              <Ruler size={12} color={obsidianTheme.accent} />
              <Text style={styles.emeraldPillBadgeText}>10 Circunferências</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>
            Toque nos pontos anatômicos do Avatar ou nas pílulas abaixo para ajustar suas medidas em tempo real.
          </Text>

          <BodyAvatarSvg
            measurements={effectiveDraftBody}
            bodyFatPercentage={latestScale?.bodyFatPercent}
            selectedPart={effectiveSelectedPart}
            onSelectPart={handleSelectBodyPart}
          />

          {/* Pílulas Horizontais das 10 Regiões do Corpo */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.partsScroll}
            contentContainerStyle={styles.partsScrollContent}
          >
            {BODY_PART_ORDER.map((partKey) => {
              const guide = BODY_PARTS_GUIDE[partKey];
              const isSelected = partKey === effectiveSelectedPart;
              return (
                <TouchableOpacity
                  key={partKey}
                  onPress={() => handleSelectBodyPart(partKey)}
                  style={[
                    styles.partSelectorPill,
                    isSelected && styles.partSelectorPillActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.partSelectorLabel,
                      isSelected && styles.partSelectorLabelActive,
                    ]}
                  >
                    {guide.shortLabel}
                  </Text>
                  <Text
                    style={[
                      styles.partSelectorValue,
                      isSelected && styles.partSelectorValueActive,
                    ]}
                  >
                    {effectiveDraftBody[partKey]} cm
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Card Editor Focado da Região Selecionada */}
        <View style={[styles.card, styles.editorFocusedCard]}>
          <View style={styles.editorHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionEyebrow}>MEDIDA SELECIONADA</Text>
              <Text style={styles.editorPartTitle}>{activeGuide.label}</Text>
              <View style={styles.editorMetaRow}>
                <Text style={styles.editorMetaText}>
                  Ref. estética: ~{idealCm} cm
                </Text>
                {firstBodyEntry && (
                  <Text
                    style={[
                      styles.editorDeltaTag,
                      {
                        color:
                          diffFromStart === 0
                            ? obsidianTheme.textSecondary
                            : (isReductionGoalPart(effectiveSelectedPart) &&
                                diffFromStart < 0) ||
                              (!isReductionGoalPart(effectiveSelectedPart) &&
                                diffFromStart > 0)
                            ? obsidianTheme.accent
                            : obsidianTheme.statusNormal,
                      },
                    ]}
                  >
                    • Δ {diffFromStart > 0 ? `+${diffFromStart}` : diffFromStart} cm
                  </Text>
                )}
              </View>
            </View>

            {/* Controles -0.5 cm | Input | +0.5 cm */}
            <View style={styles.stepperCluster}>
              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => handleStepMeasure(effectiveSelectedPart, -0.5)}
                activeOpacity={0.75}
              >
                <Minus size={14} color={obsidianTheme.textPrimary} />
                <Text style={styles.stepperButtonText}>0.5</Text>
              </TouchableOpacity>

              <View style={styles.numericInputContainer}>
                <TextInput
                  style={styles.numericInput}
                  keyboardType="numeric"
                  value={directInputText}
                  onChangeText={handleDirectInputChange}
                  selectTextOnFocus
                />
                <Text style={styles.numericInputUnit}>cm</Text>
              </View>

              <TouchableOpacity
                style={styles.stepperButton}
                onPress={() => handleStepMeasure(effectiveSelectedPart, 0.5)}
                activeOpacity={0.75}
              >
                <Plus size={14} color={obsidianTheme.textPrimary} />
                <Text style={styles.stepperButtonText}>0.5</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Barra Clínica de Proporção */}
          <View style={styles.proportionBarWrap}>
            <View style={styles.proportionBarTrack}>
              <View
                style={[
                  styles.proportionBarFill,
                  {
                    width: `${Math.min(
                      100,
                      Math.max(
                        4,
                        ((currentVal - activeGuide.minCm) /
                          (activeGuide.maxCm - activeGuide.minCm)) *
                          100
                      )
                    )}%`,
                  },
                ]}
              />
            </View>
            <View style={styles.proportionScaleLabels}>
              <Text style={styles.proportionScaleText}>{activeGuide.minCm} cm</Text>
              <Text style={styles.proportionScaleCenter}>
                Atual: {currentVal} cm
              </Text>
              <Text style={styles.proportionScaleText}>{activeGuide.maxCm} cm</Text>
            </View>
          </View>

          {/* Gaveta Colapsável: "Como medir com a fita" */}
          <TouchableOpacity
            style={styles.drawerToggleBtn}
            onPress={() => setShowHowToMeasure((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View style={styles.rowCenterGap}>
              <Info size={15} color={obsidianTheme.accent} />
              <Text style={styles.drawerToggleTitle}>Como medir com a fita</Text>
            </View>
            {showHowToMeasure ? (
              <ChevronUp size={16} color={obsidianTheme.textSecondary} />
            ) : (
              <ChevronDown size={16} color={obsidianTheme.textSecondary} />
            )}
          </TouchableOpacity>

          {showHowToMeasure && (
            <View style={styles.drawerContentBox}>
              <View style={styles.drawerSection}>
                <Text style={styles.drawerSectionLabel}>REFERÊNCIA ANATÔMICA</Text>
                <Text style={styles.drawerSectionBody}>
                  {anatomicalInfo.anatomicalReference}
                </Text>
              </View>

              <View style={styles.drawerSection}>
                <Text style={styles.drawerSectionLabel}>COMO MEDIR PASSO A PASSO</Text>
                <Text style={styles.drawerSectionBody}>
                  {anatomicalInfo.howToMeasure}
                </Text>
                {activeGuide.howToMeasureSteps.map((step, i) => (
                  <Text key={i} style={styles.drawerStepItem}>
                    {i + 1}. {step}
                  </Text>
                ))}
              </View>

              <View style={[styles.drawerSection, { marginBottom: 0 }]}>
                <Text style={styles.drawerSectionLabel}>POR QUE IMPORTA</Text>
                <Text style={styles.drawerWhyText}>
                  {anatomicalInfo.whyItMatters}
                </Text>
              </View>
            </View>
          )}

          {/* Botão Primário Esmeralda */}
          <TouchableOpacity
            style={styles.saveMeasuresBtn}
            onPress={() => onSaveBodyMeasurements?.()}
            activeOpacity={0.85}
          >
            <Check size={17} color="#090A0F" strokeWidth={2.6} />
            <Text style={styles.saveMeasuresBtnText}>
              Salvar Medidas no Histórico
            </Text>
          </TouchableOpacity>

          {!!bodySaveFeedback && (
            <View style={styles.feedbackBanner}>
              <Sparkles size={14} color={obsidianTheme.accent} />
              <Text style={styles.feedbackBannerText}>{bodySaveFeedback}</Text>
            </View>
          )}
        </View>

        {/* 3 Cards de Índices Antropométricos Clínicos */}
        <View style={styles.sectionHeaderBlock}>
          <Text style={styles.sectionEyebrow}>BIOMETRIA AVANÇADA</Text>
          <Text style={styles.sectionBlockTitle}>
            Índices Antropométricos Clínicos
          </Text>
        </View>

        {/* Card 1: BF% Marinha (US Navy) */}
        <TouchableOpacity
          style={styles.clinicalIndexCard}
          onPress={() =>
            setExpandedIndexKey((prev) => (prev === 'navy' ? null : 'navy'))
          }
          activeOpacity={0.85}
        >
          <View style={styles.clinicalCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clinicalCardTitle}>BF% Marinha (US Navy)</Text>
              <Text style={styles.clinicalCardSub}>
                Estimativa por circunferências corporais
              </Text>
            </View>
            <View style={styles.clinicalRightCol}>
              <Text style={styles.clinicalMainValue}>
                {indices.navyBodyFatEstimate}%
              </Text>
              <View
                style={[
                  styles.clinicalStatusPill,
                  {
                    backgroundColor: navyStatus.color + '18',
                    borderColor: navyStatus.color + '55',
                  },
                ]}
              >
                <Text
                  style={[styles.clinicalStatusText, { color: navyStatus.color }]}
                >
                  {navyStatus.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.clinicalRangeTrack}>
            <View
              style={[
                styles.clinicalRangeFill,
                {
                  width: `${navyPercentFill}%`,
                  backgroundColor: navyStatus.color,
                },
              ]}
            />
          </View>
          <View style={styles.clinicalRangeLabels}>
            <Text style={styles.clinicalRangeTick}>Essencial (6%)</Text>
            <Text style={styles.clinicalRangeTick}>
              Ideal ({isMale ? '10-15%' : '16-22%'})
            </Text>
            <Text style={styles.clinicalRangeTick}>Elevado (&gt;25%)</Text>
          </View>

          {expandedIndexKey === 'navy' && (
            <View style={styles.clinicalExpandedBox}>
              <Text style={styles.clinicalExpandedText}>
                Desenvolvido pelo Naval Health Research Center (Hodgdon & Beckett), este método cruza Pescoço ({effectiveDraftBody.neckCm} cm), Abdômen/Cintura ({effectiveDraftBody.abdomenCm} cm) e Altura ({profile.heightCm} cm).
                {latestScale
                  ? ` Comparado à sua última bioimpedância na balança (${latestScale.bodyFatPercent}%), a diferença é de ${Math.abs(
                      Math.round(
                        (indices.navyBodyFatEstimate -
                          latestScale.bodyFatPercent) *
                          10
                      ) / 10
                    )} pontos percentuais.`
                  : ''}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Card 2: Relação Cintura/Quadril (RCQ) */}
        <TouchableOpacity
          style={styles.clinicalIndexCard}
          onPress={() =>
            setExpandedIndexKey((prev) => (prev === 'whr' ? null : 'whr'))
          }
          activeOpacity={0.85}
        >
          <View style={styles.clinicalCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clinicalCardTitle}>
                Relação Cintura/Quadril (RCQ)
              </Text>
              <Text style={styles.clinicalCardSub}>
                Distribuição de gordura visceral vs periférica
              </Text>
            </View>
            <View style={styles.clinicalRightCol}>
              <Text style={styles.clinicalMainValue}>
                {indices.waistToHipRatio.toFixed(2)}
              </Text>
              <View
                style={[
                  styles.clinicalStatusPill,
                  {
                    backgroundColor: whrStatus.color + '18',
                    borderColor: whrStatus.color + '55',
                  },
                ]}
              >
                <Text
                  style={[styles.clinicalStatusText, { color: whrStatus.color }]}
                >
                  {whrStatus.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.clinicalRangeTrack}>
            <View
              style={[
                styles.clinicalRangeFill,
                {
                  width: `${whrPercentFill}%`,
                  backgroundColor: whrStatus.color,
                },
              ]}
            />
          </View>
          <View style={styles.clinicalRangeLabels}>
            <Text style={styles.clinicalRangeTick}>Ótimo (&lt;0.85)</Text>
            <Text style={styles.clinicalRangeTick}>Limite OMS (0.90)</Text>
            <Text style={styles.clinicalRangeTick}>Alto Risco (&gt;0.95)</Text>
          </View>

          {expandedIndexKey === 'whr' && (
            <View style={styles.clinicalExpandedBox}>
              <Text style={styles.clinicalExpandedText}>
                Calculado pela razão Cintura ({effectiveDraftBody.waistCm} cm) ÷ Quadril ({effectiveDraftBody.hipsCm} cm). A Organização Mundial da Saúde (OMS) define valores abaixo de {isMale ? '0.90' : '0.85'} como protetores contra síndrome metabólica e resistência à insulina.
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Card 3: Índice V-Taper (Ombro/Cintura) */}
        <TouchableOpacity
          style={styles.clinicalIndexCard}
          onPress={() =>
            setExpandedIndexKey((prev) => (prev === 'vtaper' ? null : 'vtaper'))
          }
          activeOpacity={0.85}
        >
          <View style={styles.clinicalCardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.clinicalCardTitle}>
                Índice V-Taper (Ombro/Cintura)
              </Text>
              <Text style={styles.clinicalCardSub}>
                Proporção estrutural atlética (Meta Áurea 1.618)
              </Text>
            </View>
            <View style={styles.clinicalRightCol}>
              <Text style={styles.clinicalMainValue}>
                {indices.vTaperRatio.toFixed(2)}
              </Text>
              <View
                style={[
                  styles.clinicalStatusPill,
                  {
                    backgroundColor: vTaperStatus.color + '18',
                    borderColor: vTaperStatus.color + '55',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.clinicalStatusText,
                    { color: vTaperStatus.color },
                  ]}
                >
                  {vTaperStatus.label}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.clinicalRangeTrack}>
            <View
              style={[
                styles.clinicalRangeFill,
                {
                  width: `${vTaperPercentFill}%`,
                  backgroundColor: vTaperStatus.color,
                },
              ]}
            />
          </View>
          <View style={styles.clinicalRangeLabels}>
            <Text style={styles.clinicalRangeTick}>Base (1.15)</Text>
            <Text style={styles.clinicalRangeTick}>Atlético (1.45)</Text>
            <Text style={styles.clinicalRangeTick}>Áureo (1.618)</Text>
          </View>

          {expandedIndexKey === 'vtaper' && (
            <View style={styles.clinicalExpandedBox}>
              <Text style={styles.clinicalExpandedText}>
                Razão entre Ombros ({effectiveDraftBody.shouldersCm} cm) e Cintura ({effectiveDraftBody.waistCm} cm). Reduzir 2 cm de cintura ou ganhar 3 cm de deltoides eleva rapidamente este índice estético e funcional.
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  // ============================================================================
  // RENDER BARRA DE FILTRO DE TURNO (COMPARTILHADA POR COMPARE & RECORDS)
  // ============================================================================
  const renderShiftFilterBar = () => {
    const morningStats = computePeriodStats(
      filterMeasurementsByPeriod(scaleHistory, 'morning')
    );
    const afternoonStats = computePeriodStats(
      filterMeasurementsByPeriod(scaleHistory, 'afternoon')
    );
    const nightStats = computePeriodStats(
      filterMeasurementsByPeriod(scaleHistory, 'night')
    );

    return (
      <View style={styles.card}>
        <View style={styles.cardHeaderBetween}>
          <View style={styles.rowCenterGap}>
            <Clock size={16} color={obsidianTheme.accent} />
            <Text style={styles.cardTitleSm}>Filtro por Turno do Dia</Text>
          </View>
          <Text style={styles.subtleCountText}>
            {filteredScaleHistory.length} pesagens
          </Text>
        </View>

        <View style={styles.shiftFilterPillsRow}>
          {PERIOD_FILTERS.map((pf) => {
            const active = effectivePeriodFilter === pf.key;
            const count =
              pf.key === 'all'
                ? scaleHistory.length
                : filterMeasurementsByPeriod(scaleHistory, pf.key).length;
            return (
              <TouchableOpacity
                key={pf.key}
                onPress={() => handleSelectPeriodFilter(pf.key)}
                style={[
                  styles.shiftFilterPill,
                  active && styles.shiftFilterPillActive,
                ]}
              >
                <Text
                  style={[
                    styles.shiftFilterPillText,
                    active && styles.shiftFilterPillTextActive,
                  ]}
                >
                  {pf.icon} {pf.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Mini Resumo das Médias por Turno */}
        <View style={styles.shiftMiniStatsRow}>
          {(
            [
              { key: 'morning', stats: morningStats },
              { key: 'afternoon', stats: afternoonStats },
              { key: 'night', stats: nightStats },
            ] as Array<{
              key: DayPeriod;
              stats: ReturnType<typeof computePeriodStats>;
            }>
          ).map(({ key, stats }) => {
            const disp = SHIFT_DISPLAY[key];
            const isSel = effectivePeriodFilter === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() =>
                  handleSelectPeriodFilter(isSel ? 'all' : key)
                }
                style={[
                  styles.shiftMiniCard,
                  isSel && {
                    borderColor: obsidianTheme.accent,
                    backgroundColor: obsidianTheme.accentSoft,
                  },
                ]}
              >
                <Text style={styles.shiftMiniTitle}>
                  {disp.icon} {disp.label}
                </Text>
                {stats ? (
                  <>
                    <Text style={styles.shiftMiniValue}>{stats.avg} kg</Text>
                    <Text
                      style={[
                        styles.shiftMiniDelta,
                        {
                          color:
                            stats.delta <= 0
                              ? obsidianTheme.accent
                              : obsidianTheme.textSecondary,
                        },
                      ]}
                    >
                      {stats.delta > 0 ? `+${stats.delta}` : stats.delta} kg ({stats.count}x)
                    </Text>
                  </>
                ) : (
                  <Text style={styles.shiftMiniEmpty}>Sem dados</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  // ============================================================================
  // RENDER VIEW 2: COMPARADOR ANTES/DEPOIS
  // ============================================================================
  const renderCompareView = () => {
    const safeBodyBIdx = Math.min(dateBIdx, Math.max(0, bodyHistory.length - 1));
    const safeBodyAIdx = Math.min(dateAIdx, Math.max(0, bodyHistory.length - 1));

    const bodyB = bodyHistory[safeBodyBIdx] || null; // Anterior
    const bodyA = bodyHistory[safeBodyAIdx] || null; // Atual

    const effectiveScalePool =
      filteredScaleHistory.length > 0 ? filteredScaleHistory : scaleHistory;

    const safeScaleBIdx = Math.min(
      scaleBIdx,
      Math.max(0, effectiveScalePool.length - 1)
    );
    const safeScaleAIdx = Math.min(
      scaleAIdx,
      Math.max(0, effectiveScalePool.length - 1)
    );

    // Se o usuário escolheu datas de fita métrica, pareamos com a pesagem mais próxima ou usamos os seletores de pesagem
    const scaleB =
      effectiveScalePool[safeScaleBIdx] ||
      (bodyB ? findClosestScaleEntry(bodyB.timestamp, effectiveScalePool) : null);
    const scaleA =
      effectiveScalePool[safeScaleAIdx] ||
      (bodyA ? findClosestScaleEntry(bodyA.timestamp, effectiveScalePool) : null);

    const weightDelta =
      scaleA && scaleB
        ? Math.round((scaleA.weightKg - scaleB.weightKg) * 10) / 10
        : 0;
    const bfDelta =
      scaleA && scaleB
        ? Math.round((scaleA.bodyFatPercent - scaleB.bodyFatPercent) * 10) / 10
        : 0;
    const muscleDelta =
      scaleA && scaleB
        ? Math.round((scaleA.muscleMassKg - scaleB.muscleMassKg) * 10) / 10
        : 0;
    const visceralDelta =
      scaleA && scaleB ? scaleA.visceralFat - scaleB.visceralFat : 0;

    const scaleSpanDays =
      effectiveScalePool.length >= 2
        ? (new Date(
            effectiveScalePool[effectiveScalePool.length - 1].timestamp
          ).getTime() -
            new Date(effectiveScalePool[0].timestamp).getTime()) /
          (24 * 60 * 60 * 1000)
        : 0;
    const bodySpanDays =
      bodyHistory.length >= 2
        ? (new Date(bodyHistory[bodyHistory.length - 1].timestamp).getTime() -
            new Date(bodyHistory[0].timestamp).getTime()) /
          (24 * 60 * 60 * 1000)
        : 0;
    const historySpanDays = Math.max(scaleSpanDays, bodySpanDays);

    const refB = scaleB ?? bodyB;
    const refA = scaleA ?? bodyA;
    const actualDaysDiff =
      refA && refB
        ? Math.max(
            0,
            Math.round(
              (new Date(refA.timestamp).getTime() -
                new Date(refB.timestamp).getTime()) /
                (24 * 60 * 60 * 1000)
            )
          )
        : 0;
    const weeklyWeightRate =
      actualDaysDiff >= 3 && scaleA && scaleB
        ? Math.round(((scaleA.weightKg - scaleB.weightKg) / (actualDaysDiff / 7)) * 10) / 10
        : null;

    return (
      <View>
        {renderShiftFilterBar()}

        {/* Card de Seleção de Datas e Avatares Lado a Lado (Período B -> Período A) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderBetween}>
            <View>
              <Text style={styles.sectionEyebrow}>COMPARATIVO VISUAL</Text>
              <Text style={styles.cardTitle}>
                Período B (Anterior) → Período A (Atual)
              </Text>
            </View>
            <Layers size={18} color={obsidianTheme.accent} />
          </View>

          {/* Barra de Período de Comparação Rápida (Presets 7, 30, 60, 90, 180 dias + Manual) */}
          <View style={styles.comparePresetSection}>
            <View style={styles.comparePresetHeaderRow}>
              <Clock size={12} color={obsidianTheme.accent} />
              <Text style={styles.comparePresetEyebrow}>
                PERÍODO DE COMPARAÇÃO RÁPIDA
              </Text>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.comparePresetPillsRow}
            >
              {COMPARE_PRESETS.map((preset) => {
                const isSelected = comparePreset === preset.key;
                const hasCoverage =
                  typeof preset.key === 'number'
                    ? historySpanDays >= preset.key * 0.5
                    : true;
                return (
                  <TouchableOpacity
                    key={String(preset.key)}
                    onPress={() =>
                      applyComparePreset(
                        preset.key,
                        effectiveScalePool,
                        bodyHistory
                      )
                    }
                    style={[
                      styles.comparePresetPill,
                      isSelected && styles.comparePresetPillActive,
                    ]}
                  >
                    {typeof preset.key === 'number' && hasCoverage && (
                      <View
                        style={[
                          styles.comparePresetDot,
                          isSelected && styles.comparePresetDotActive,
                        ]}
                      />
                    )}
                    <Text
                      style={[
                        styles.comparePresetPillText,
                        isSelected && styles.comparePresetPillTextActive,
                      ]}
                    >
                      {preset.shortLabel}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {refB && refA && (
              <View style={styles.compareSummaryBanner}>
                <Text style={styles.compareSummaryBannerText}>
                  Intervalo real comparado:{' '}
                  <Text style={styles.compareSummaryBannerStrong}>
                    {actualDaysDiff} dias
                  </Text>{' '}
                  ({formatDateShort(refB.timestamp)} →{' '}
                  {formatDateShort(refA.timestamp)})
                </Text>
                {actualDaysDiff >= 3 && weeklyWeightRate !== null && (
                  <Text style={styles.compareSummaryRateText}>
                    Ritmo médio:{' '}
                    <Text
                      style={[
                        styles.compareSummaryBannerStrong,
                        {
                          color:
                            weeklyWeightRate <= 0
                              ? obsidianTheme.accent
                              : obsidianTheme.textPrimary,
                        },
                      ]}
                    >
                      {weeklyWeightRate > 0 ? '+' : ''}
                      {weeklyWeightRate} kg/semana
                    </Text>
                  </Text>
                )}
              </View>
            )}
          </View>

          {/* Seletores de Data B (Anterior) e Data A (Atual) para Fita/Avatar */}
          {bodyHistory.length > 0 && (
            <View style={styles.compareDateSelectorsWrap}>
              <View style={styles.compareDateCol}>
                <View style={styles.compareDateHeader}>
                  <Calendar size={12} color={obsidianTheme.textSecondary} />
                  <Text style={styles.compareDateLabel}>DATA B (ANTERIOR)</Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {bodyHistory.map((entry, idx) => {
                    const active = idx === safeBodyBIdx;
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        onPress={() => {
                          setComparePreset('custom');
                          setDateBIdx(idx);
                          // Sincroniza pesagem mais próxima no seletor B
                          if (effectiveScalePool.length > 0) {
                            const closest = findClosestScaleEntry(
                              entry.timestamp,
                              effectiveScalePool
                            );
                            if (closest) {
                              const sIdx = effectiveScalePool.findIndex(
                                (s) => s.id === closest.id
                              );
                              if (sIdx >= 0) setScaleBIdx(sIdx);
                            }
                          }
                        }}
                        style={[
                          styles.datePill,
                          active && styles.datePillAnteriorActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.datePillText,
                            active && styles.datePillTextAnteriorActive,
                          ]}
                        >
                          {formatDateShort(entry.timestamp)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <ArrowRight
                size={16}
                color={obsidianTheme.textMuted}
                style={{ marginTop: 18 }}
              />

              <View style={styles.compareDateCol}>
                <View style={styles.compareDateHeader}>
                  <Calendar size={12} color={obsidianTheme.accent} />
                  <Text
                    style={[
                      styles.compareDateLabel,
                      { color: obsidianTheme.accent },
                    ]}
                  >
                    DATA A (ATUAL)
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {bodyHistory.map((entry, idx) => {
                    const active = idx === safeBodyAIdx;
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        onPress={() => {
                          setComparePreset('custom');
                          setDateAIdx(idx);
                          if (effectiveScalePool.length > 0) {
                            const closest = findClosestScaleEntry(
                              entry.timestamp,
                              effectiveScalePool
                            );
                            if (closest) {
                              const sIdx = effectiveScalePool.findIndex(
                                (s) => s.id === closest.id
                              );
                              if (sIdx >= 0) setScaleAIdx(sIdx);
                            }
                          }
                        }}
                        style={[
                          styles.datePill,
                          active && styles.datePillAtualActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.datePillText,
                            active && styles.datePillTextAtualActive,
                          ]}
                        >
                          {formatDateShort(entry.timestamp)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Seletores Diretos de Pesagem B vs A (quando há múltiplas pesagens no turno) */}
          {effectiveScalePool.length > 0 && (
            <View style={[styles.compareDateSelectorsWrap, { marginTop: 4 }]}>
              <View style={styles.compareDateCol}>
                <Text style={styles.scaleSubSelectorLabel}>
                  Pesagem B (Anterior)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {effectiveScalePool.map((sEntry, idx) => {
                    const active = idx === safeScaleBIdx;
                    const pDisp =
                      SHIFT_DISPLAY[resolveMeasurementPeriod(sEntry)];
                    return (
                      <TouchableOpacity
                        key={sEntry.id}
                        onPress={() => {
                          setComparePreset('custom');
                          setScaleBIdx(idx);
                        }}
                        style={[
                          styles.datePill,
                          active && styles.datePillAnteriorActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.datePillText,
                            active && styles.datePillTextAnteriorActive,
                          ]}
                        >
                          {pDisp.icon} {formatDateShort(sEntry.timestamp)} ({sEntry.weightKg}kg)
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>

              <ArrowRight
                size={16}
                color={obsidianTheme.textMuted}
                style={{ marginTop: 14 }}
              />

              <View style={styles.compareDateCol}>
                <Text
                  style={[
                    styles.scaleSubSelectorLabel,
                    { color: obsidianTheme.accent },
                  ]}
                >
                  Pesagem A (Atual)
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {effectiveScalePool.map((sEntry, idx) => {
                    const active = idx === safeScaleAIdx;
                    const pDisp =
                      SHIFT_DISPLAY[resolveMeasurementPeriod(sEntry)];
                    return (
                      <TouchableOpacity
                        key={sEntry.id}
                        onPress={() => {
                          setComparePreset('custom');
                          setScaleAIdx(idx);
                        }}
                        style={[
                          styles.datePill,
                          active && styles.datePillAtualActive,
                        ]}
                      >
                        <Text
                          style={[
                            styles.datePillText,
                            active && styles.datePillTextAtualActive,
                          ]}
                        >
                          {pDisp.icon} {formatDateShort(sEntry.timestamp)} ({sEntry.weightKg}kg)
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Avatares Compactos Lado a Lado: Período B -> Período A */}
          {bodyB && bodyA && (
            <>
              <View style={styles.avatarsSideBySide}>
                <View style={styles.avatarCompareCol}>
                  <Text style={styles.avatarCompareTagAnterior}>
                    PERÍODO B • {formatDateShort(bodyB.timestamp)}
                  </Text>
                  <BodyAvatarSvg
                    measurements={bodyB}
                    bodyFatPercentage={scaleB?.bodyFatPercent}
                    selectedPart={comparePart}
                    compact
                    accentColor="#64748B"
                    badgeText={
                      scaleB
                        ? `${scaleB.weightKg}kg • ${scaleB.bodyFatPercent}%`
                        : `${bodyB[comparePart]} cm`
                    }
                  />
                  <Text style={styles.avatarCompareFooter}>
                    {BODY_PARTS_GUIDE[comparePart].shortLabel}:{' '}
                    <Text style={styles.avatarCompareFooterStrong}>
                      {bodyB[comparePart]} cm
                    </Text>
                  </Text>
                </View>

                <View style={styles.avatarCompareCol}>
                  <Text style={styles.avatarCompareTagAtual}>
                    PERÍODO A • {formatDateShort(bodyA.timestamp)}
                  </Text>
                  <BodyAvatarSvg
                    measurements={bodyA}
                    bodyFatPercentage={scaleA?.bodyFatPercent}
                    selectedPart={comparePart}
                    compact
                    accentColor={obsidianTheme.accent}
                    badgeText={
                      scaleA
                        ? `${scaleA.weightKg}kg • ${scaleA.bodyFatPercent}%`
                        : `${bodyA[comparePart]} cm`
                    }
                  />
                  <Text style={styles.avatarCompareFooter}>
                    {BODY_PARTS_GUIDE[comparePart].shortLabel}:{' '}
                    <Text
                      style={[
                        styles.avatarCompareFooterStrong,
                        { color: obsidianTheme.accent },
                      ]}
                    >
                      {bodyA[comparePart]} cm
                    </Text>
                  </Text>
                </View>
              </View>

              {/* Seletor rápido de região destacada nos Avatares */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 12 }}
              >
                {BODY_PART_ORDER.map((pk) => {
                  const g = BODY_PARTS_GUIDE[pk];
                  const isSel = pk === comparePart;
                  const diff = Math.round((bodyA[pk] - bodyB[pk]) * 10) / 10;
                  const isFavorable = isReductionGoalPart(pk)
                    ? diff < 0
                    : diff > 0;
                  return (
                    <TouchableOpacity
                      key={pk}
                      onPress={() => setComparePart(pk)}
                      style={[
                        styles.partSelectorPill,
                        isSel && styles.partSelectorPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.partSelectorLabel,
                          isSel && styles.partSelectorLabelActive,
                        ]}
                      >
                        {g.shortLabel}
                      </Text>
                      <Text
                        style={[
                          styles.partSelectorValue,
                          {
                            color:
                              diff === 0
                                ? obsidianTheme.textSecondary
                                : isFavorable
                                ? obsidianTheme.accent
                                : obsidianTheme.textPrimary,
                          },
                        ]}
                      >
                        {diff > 0 ? `+${diff}` : diff} cm
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>

        {/* Grade de Deltas (Δ) — Bioimpedância + 10 Circunferências */}
        <View style={styles.card}>
          <View style={styles.cardHeaderBetween}>
            <View>
              <Text style={styles.sectionEyebrow}>SÍNTESE DE VARIAÇÃO (Δ)</Text>
              <Text style={styles.cardTitle}>
                Composição Corporal & Circunferências
              </Text>
            </View>
            <Scale size={18} color={obsidianTheme.accent} />
          </View>

          {scaleA && scaleB ? (
            <View style={styles.deltaBiaGrid}>
              <View
                style={[
                  styles.deltaBiaCard,
                  weightDelta < 0 && styles.deltaCardEmeraldBorder,
                ]}
              >
                <Text style={styles.deltaCardLabel}>Peso Corporal</Text>
                <Text
                  style={[
                    styles.deltaCardMain,
                    {
                      color:
                        weightDelta <= 0
                          ? obsidianTheme.accent
                          : obsidianTheme.textPrimary,
                    },
                  ]}
                >
                  {weightDelta > 0 ? `+${weightDelta}` : weightDelta} kg
                </Text>
                <Text style={styles.deltaCardSub}>
                  {scaleB.weightKg} kg → {scaleA.weightKg} kg
                </Text>
              </View>

              <View
                style={[
                  styles.deltaBiaCard,
                  bfDelta < 0 && styles.deltaCardEmeraldBorder,
                ]}
              >
                <Text style={styles.deltaCardLabel}>Gordura (BF%)</Text>
                <Text
                  style={[
                    styles.deltaCardMain,
                    {
                      color:
                        bfDelta <= 0
                          ? obsidianTheme.accent
                          : obsidianTheme.statusAttention,
                    },
                  ]}
                >
                  {bfDelta > 0 ? `+${bfDelta}` : bfDelta}%
                </Text>
                <Text style={styles.deltaCardSub}>
                  {scaleB.bodyFatPercent}% → {scaleA.bodyFatPercent}%
                </Text>
              </View>

              <View
                style={[
                  styles.deltaBiaCard,
                  muscleDelta > 0 && styles.deltaCardEmeraldBorder,
                ]}
              >
                <Text style={styles.deltaCardLabel}>Massa Muscular</Text>
                <Text
                  style={[
                    styles.deltaCardMain,
                    {
                      color:
                        muscleDelta >= 0
                          ? obsidianTheme.accent
                          : obsidianTheme.statusAttention,
                    },
                  ]}
                >
                  {muscleDelta > 0 ? `+${muscleDelta}` : muscleDelta} kg
                </Text>
                <Text style={styles.deltaCardSub}>
                  {scaleB.muscleMassKg} kg → {scaleA.muscleMassKg} kg
                </Text>
              </View>

              <View
                style={[
                  styles.deltaBiaCard,
                  visceralDelta < 0 && styles.deltaCardEmeraldBorder,
                ]}
              >
                <Text style={styles.deltaCardLabel}>Gordura Visceral</Text>
                <Text
                  style={[
                    styles.deltaCardMain,
                    {
                      color:
                        visceralDelta <= 0
                          ? obsidianTheme.accent
                          : obsidianTheme.statusAttention,
                    },
                  ]}
                >
                  {visceralDelta > 0 ? `+${visceralDelta}` : visceralDelta} nv
                </Text>
                <Text style={styles.deltaCardSub}>
                  Nível {scaleB.visceralFat} → Nível {scaleA.visceralFat}
                </Text>
              </View>
            </View>
          ) : (
            <Text style={styles.emptyNoticeText}>
              Registre ao menos uma pesagem neste turno para visualizar os deltas de bioimpedância.
            </Text>
          )}

          {/* Deltas das 10 Circunferências Corporais */}
          {bodyB && bodyA && (
            <>
              <View style={styles.circumferenceHeaderRow}>
                <Text style={styles.sectionEyebrow}>
                  10 CIRCUNFERÊNCIAS DA FITA MÉTRICA
                </Text>
                <Text style={styles.circumferenceLegendText}>
                  Verde = evolução favorável
                </Text>
              </View>

              <View style={styles.circumferenceDeltaGrid}>
                {BODY_PART_ORDER.map((partKey) => {
                  const guide = BODY_PARTS_GUIDE[partKey];
                  const valB = bodyB[partKey];
                  const valA = bodyA[partKey];
                  const delta = Math.round((valA - valB) * 10) / 10;
                  const reductionPart = isReductionGoalPart(partKey);
                  const isEmerald =
                    (reductionPart && delta < 0) ||
                    (!reductionPart && delta > 0);

                  return (
                    <TouchableOpacity
                      key={partKey}
                      onPress={() => setComparePart(partKey)}
                      style={[
                        styles.circumferenceDeltaItem,
                        isEmerald && styles.circumferenceDeltaItemEmerald,
                        comparePart === partKey && {
                          borderColor: obsidianTheme.accent,
                        },
                      ]}
                      activeOpacity={0.8}
                    >
                      <View style={styles.circumferenceItemTop}>
                        <Text style={styles.circumferenceItemTitle}>
                          {guide.shortLabel}
                        </Text>
                        <Text
                          style={[
                            styles.circumferenceItemDelta,
                            {
                              color:
                                delta === 0
                                  ? obsidianTheme.textMuted
                                  : isEmerald
                                  ? obsidianTheme.accent
                                  : obsidianTheme.textPrimary,
                            },
                          ]}
                        >
                          {delta > 0 ? `+${delta}` : delta} cm
                        </Text>
                      </View>
                      <Text style={styles.circumferenceItemRange}>
                        {valB} cm → {valA} cm
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>
      </View>
    );
  };

  // ============================================================================
  // RENDER VIEW 3: TABELA DE REGISTROS
  // ============================================================================
  const renderRecordsView = () => {
    const reversedRecords = [...filteredScaleHistory].reverse();

    return (
      <View>
        {renderShiftFilterBar()}

        {/* Lista de Gerenciamento de Pesagens (Turno + Exclusão Inline) */}
        <View style={styles.card}>
          <View style={styles.cardHeaderBetween}>
            <View>
              <Text style={styles.sectionEyebrow}>GERENCIAMENTO DE REGISTROS</Text>
              <Text style={styles.cardTitle}>
                Histórico de Pesagens ({reversedRecords.length})
              </Text>
            </View>
            <ShieldCheck size={18} color={obsidianTheme.accent} />
          </View>
          <Text style={styles.cardSubtitle}>
            Toque na pílula de turno (🌅 Manhã → ☀️ Tarde → 🌙 Noite) para reclassificar o horário ou no ícone de lixeira para excluir registros incorretos.
          </Text>

          {reversedRecords.length === 0 ? (
            <Text style={styles.emptyNoticeText}>
              Nenhuma pesagem encontrada para o filtro selecionado.
            </Text>
          ) : (
            <View style={styles.recordsListWrap}>
              {reversedRecords.map((item) => {
                const curPeriod = resolveMeasurementPeriod(item);
                const shiftInfo = SHIFT_DISPLAY[curPeriod];
                const isConfirming = confirmDeleteId === item.id;

                return (
                  <View key={item.id} style={styles.recordListItem}>
                    <View style={styles.recordListMainRow}>
                      {/* Data + Hora */}
                      <View style={styles.recordDateBlock}>
                        <Text style={styles.recordDateText}>
                          {formatDateShort(item.timestamp)}
                        </Text>
                        <Text style={styles.recordTimeText}>
                          {formatTimeShort(item.timestamp)}
                        </Text>
                      </View>

                      {/* Pílula de Turno (Toque para ciclar Manhã -> Tarde -> Noite) */}
                      <TouchableOpacity
                        style={[
                          styles.shiftCyclePill,
                          {
                            borderColor: shiftInfo.color + '66',
                            backgroundColor: shiftInfo.color + '15',
                          },
                        ]}
                        onPress={() =>
                          onUpdateMeasurementPeriod?.(
                            item.id,
                            NEXT_PERIOD_ORDER[curPeriod]
                          )
                        }
                        activeOpacity={0.75}
                      >
                        <Text
                          style={[
                            styles.shiftCyclePillText,
                            { color: shiftInfo.color },
                          ]}
                        >
                          {shiftInfo.icon} {shiftInfo.label}
                        </Text>
                      </TouchableOpacity>

                      {/* Métricas Chave: Peso, BF%, Músculo kg */}
                      <View style={styles.recordMetricsGroup}>
                        <View style={styles.recordMetricCol}>
                          <Text style={styles.recordMetricValPrimary}>
                            {item.weightKg.toFixed(1)} kg
                          </Text>
                          <Text style={styles.recordMetricLabel}>Peso</Text>
                        </View>
                        <View style={styles.recordMetricCol}>
                          <Text style={styles.recordMetricVal}>
                            {item.bodyFatPercent}%
                          </Text>
                          <Text style={styles.recordMetricLabel}>BF%</Text>
                        </View>
                        <View style={styles.recordMetricCol}>
                          <Text
                            style={[
                              styles.recordMetricVal,
                              { color: obsidianTheme.accent },
                            ]}
                          >
                            {item.muscleMassKg} kg
                          </Text>
                          <Text style={styles.recordMetricLabel}>Músculo</Text>
                        </View>
                      </View>

                      {/* Botão Discreto de Exclusão ou Confirmação Inline */}
                      {!isConfirming ? (
                        <TouchableOpacity
                          style={styles.discreteTrashBtn}
                          onPress={() => setConfirmDeleteId(item.id)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        >
                          <Trash2 size={15} color={obsidianTheme.textMuted} />
                        </TouchableOpacity>
                      ) : null}
                    </View>

                    {/* Barra Inline de Confirmação: Excluir? [Sim] [Não] */}
                    {isConfirming && (
                      <View style={styles.inlineConfirmRow}>
                        <Text style={styles.inlineConfirmLabel}>
                          Excluir registro de {item.weightKg} kg ({formatDateShort(item.timestamp)})?
                        </Text>
                        <View style={styles.inlineConfirmActions}>
                          <TouchableOpacity
                            style={styles.inlineConfirmYesBtn}
                            onPress={() => {
                              onDeleteMeasurement?.(item.id);
                              setConfirmDeleteId(null);
                            }}
                          >
                            <Check size={13} color="#FFF" />
                            <Text style={styles.inlineConfirmYesText}>Sim</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.inlineConfirmNoBtn}
                            onPress={() => setConfirmDeleteId(null)}
                          >
                            <X size={13} color={obsidianTheme.textSecondary} />
                            <Text style={styles.inlineConfirmNoText}>Não</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Matriz Horizontal Completa: Peso + Fita Métrica por Data */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeaderBetween}
            onPress={() => setShowMatrixTable((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View style={styles.rowCenterGap}>
              <Table2 size={18} color={obsidianTheme.accent} />
              <View>
                <Text style={styles.sectionEyebrow}>MATRIZ CONSOLIDADA</Text>
                <Text style={styles.cardTitle}>
                  Tabela Completa (Balança + Fita Métrica)
                </Text>
              </View>
            </View>
            {showMatrixTable ? (
              <ChevronUp size={18} color={obsidianTheme.textSecondary} />
            ) : (
              <ChevronDown size={18} color={obsidianTheme.textSecondary} />
            )}
          </TouchableOpacity>

          {showMatrixTable && (
            <View style={{ marginTop: 12 }}>
              {reversedRecords.length === 0 ? (
                <Text style={styles.emptyNoticeText}>
                  Sem registros para exibir na matriz.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                  <View>
                    <View style={[styles.tRow, styles.tHeaderRow]}>
                      <Text style={[styles.tCell, styles.tColDate, styles.tHeaderText]}>
                        Data
                      </Text>
                      <Text style={[styles.tCell, styles.tColPeriod, styles.tHeaderText]}>
                        Turno
                      </Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Peso</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>BF%</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Músculo</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Água</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Visceral</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>TMB</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Pescoço</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Ombros</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Peitoral</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Bíceps</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Antebr.</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Cintura</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Abdômen</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Quadril</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Coxa</Text>
                      <Text style={[styles.tCell, styles.tHeaderText]}>Pantur.</Text>
                    </View>

                    {reversedRecords.map((sItem, idx) => {
                      const bItem = findClosestBodyEntry(
                        sItem.timestamp,
                        bodyHistory
                      );
                      const curPeriod = resolveMeasurementPeriod(sItem);
                      const shiftInfo = SHIFT_DISPLAY[curPeriod];

                      return (
                        <View
                          key={sItem.id}
                          style={[
                            styles.tRow,
                            idx % 2 === 0 ? styles.tRowEven : styles.tRowOdd,
                          ]}
                        >
                          <View
                            style={[
                              styles.tCell,
                              styles.tColDate,
                              { alignItems: 'center' },
                            ]}
                          >
                            <Text style={styles.matrixDateText}>
                              {formatDateShort(sItem.timestamp)}
                            </Text>
                            <Text style={styles.matrixTimeText}>
                              {formatTimeShort(sItem.timestamp)}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.tCell,
                              styles.tColPeriod,
                              { alignItems: 'center' },
                            ]}
                          >
                            <Text
                              style={{
                                color: shiftInfo.color,
                                fontSize: 11,
                                fontWeight: '700',
                              }}
                            >
                              {shiftInfo.icon} {shiftInfo.label}
                            </Text>
                          </View>

                          <Text style={[styles.tCell, styles.matrixBoldCell]}>
                            {sItem.weightKg} kg
                          </Text>
                          <Text style={styles.tCell}>{sItem.bodyFatPercent}%</Text>
                          <Text
                            style={[
                              styles.tCell,
                              { color: obsidianTheme.accent, fontWeight: '700' },
                            ]}
                          >
                            {sItem.muscleMassKg} kg
                          </Text>
                          <Text style={styles.tCell}>{sItem.waterPercent}%</Text>
                          <Text style={styles.tCell}>Nv {sItem.visceralFat}</Text>
                          <Text style={styles.tCell}>{sItem.bmrKcal}</Text>
                          <Text style={styles.tCell}>
                            {bItem ? `${bItem.neckCm} cm` : '-'}
                          </Text>
                          <Text style={styles.tCell}>
                            {bItem ? `${bItem.shouldersCm} cm` : '-'}
                          </Text>
                          <Text style={styles.tCell}>
                            {bItem ? `${bItem.chestCm} cm` : '-'}
                          </Text>
                          <Text style={styles.tCell}>
                            {bItem ? `${bItem.bicepsCm} cm` : '-'}
                          </Text>
                          <Text style={styles.tCell}>
                            {bItem ? `${bItem.forearmCm} cm` : '-'}
                          </Text>
                          <Text style={styles.tCell}>
                            {bItem ? `${bItem.waistCm} cm` : '-'}
                          </Text>
                          <Text style={styles.tCell}>
                            {bItem ? `${bItem.abdomenCm} cm` : '-'}
                          </Text>
                          <Text style={styles.tCell}>
                            {bItem ? `${bItem.hipsCm} cm` : '-'}
                          </Text>
                          <Text style={styles.tCell}>
                            {bItem ? `${bItem.thighCm} cm` : '-'}
                          </Text>
                          <Text style={styles.tCell}>
                            {bItem ? `${bItem.calfCm} cm` : '-'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Segmented Control Superior — 3 Visões da Aba Corpo */}
      <View style={styles.segmentedBar}>
        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeSubView === 'avatar' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveSubView('avatar')}
          activeOpacity={0.85}
        >
          <Ruler
            size={14}
            color={
              activeSubView === 'avatar'
                ? '#090A0F'
                : obsidianTheme.textSecondary
            }
          />
          <Text
            style={[
              styles.segmentBtnText,
              activeSubView === 'avatar' && styles.segmentBtnTextActive,
            ]}
            numberOfLines={1}
          >
            Avatar & Fita
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeSubView === 'compare' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveSubView('compare')}
          activeOpacity={0.85}
        >
          <Layers
            size={14}
            color={
              activeSubView === 'compare'
                ? '#090A0F'
                : obsidianTheme.textSecondary
            }
          />
          <Text
            style={[
              styles.segmentBtnText,
              activeSubView === 'compare' && styles.segmentBtnTextActive,
            ]}
            numberOfLines={1}
          >
            Antes/Depois
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.segmentBtn,
            activeSubView === 'records' && styles.segmentBtnActive,
          ]}
          onPress={() => setActiveSubView('records')}
          activeOpacity={0.85}
        >
          <Table2
            size={14}
            color={
              activeSubView === 'records'
                ? '#090A0F'
                : obsidianTheme.textSecondary
            }
          />
          <Text
            style={[
              styles.segmentBtnText,
              activeSubView === 'records' && styles.segmentBtnTextActive,
            ]}
            numberOfLines={1}
          >
            Registros
          </Text>
        </TouchableOpacity>
      </View>

      {activeSubView === 'avatar' && renderAvatarView()}
      {activeSubView === 'compare' && renderCompareView()}
      {activeSubView === 'records' && renderRecordsView()}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  segmentedBar: {
    flexDirection: 'row',
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusMd,
    padding: 4,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginBottom: 14,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: obsidianTheme.radiusSm,
    gap: 5,
  },
  segmentBtnActive: {
    backgroundColor: obsidianTheme.accent,
  },
  segmentBtnText: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  segmentBtnTextActive: {
    color: '#090A0F',
    fontWeight: '800',
  },
  card: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginBottom: 14,
  },
  editorFocusedCard: {
    borderColor: obsidianTheme.accentBorder,
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowCenterGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionEyebrow: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  cardTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 16,
    fontWeight: '800',
  },
  cardTitleSm: {
    color: obsidianTheme.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  cardSubtitle: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 12,
  },
  emeraldPillBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accentBorder,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  emeraldPillBadgeText: {
    color: obsidianTheme.accent,
    fontSize: 11,
    fontWeight: '700',
  },
  partsScroll: {
    marginTop: 12,
  },
  partsScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  partSelectorPill: {
    backgroundColor: obsidianTheme.bg,
    borderRadius: obsidianTheme.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    alignItems: 'center',
    minWidth: 78,
  },
  partSelectorPillActive: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accent,
  },
  partSelectorLabel: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  partSelectorLabelActive: {
    color: obsidianTheme.accent,
    fontWeight: '800',
  },
  partSelectorValue: {
    color: obsidianTheme.textPrimary,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  partSelectorValueActive: {
    color: obsidianTheme.textPrimary,
  },
  editorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  editorPartTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 17,
    fontWeight: '800',
  },
  editorMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 3,
  },
  editorMetaText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
  },
  editorDeltaTag: {
    fontSize: 11,
    fontWeight: '700',
  },
  stepperCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
    borderRadius: obsidianTheme.radiusSm,
    paddingHorizontal: 9,
    paddingVertical: 8,
    gap: 2,
  },
  stepperButtonText: {
    color: obsidianTheme.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  numericInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.accent,
    borderRadius: obsidianTheme.radiusSm,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  numericInput: {
    color: obsidianTheme.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    minWidth: 42,
    textAlign: 'center',
    padding: 0,
  },
  numericInputUnit: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginLeft: 2,
  },
  proportionBarWrap: {
    marginTop: 14,
  },
  proportionBarTrack: {
    height: 6,
    backgroundColor: obsidianTheme.bg,
    borderRadius: 999,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  proportionBarFill: {
    height: '100%',
    backgroundColor: obsidianTheme.accent,
    borderRadius: 999,
  },
  proportionScaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  proportionScaleText: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
  },
  proportionScaleCenter: {
    color: obsidianTheme.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  drawerToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    borderRadius: obsidianTheme.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 12,
  },
  drawerToggleTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  drawerContentBox: {
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: obsidianTheme.radiusSm,
    borderBottomRightRadius: obsidianTheme.radiusSm,
    padding: 12,
    marginTop: -4,
  },
  drawerSection: {
    marginBottom: 10,
  },
  drawerSectionLabel: {
    color: obsidianTheme.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  drawerSectionBody: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  drawerStepItem: {
    color: obsidianTheme.textPrimary,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  drawerWhyText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    lineHeight: 16,
    fontStyle: 'italic',
  },
  saveMeasuresBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: obsidianTheme.accent,
    borderRadius: obsidianTheme.radiusMd,
    paddingVertical: 13,
    marginTop: 14,
    gap: 8,
  },
  saveMeasuresBtnText: {
    color: '#090A0F',
    fontSize: 14,
    fontWeight: '800',
  },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accentBorder,
    borderWidth: 1,
    borderRadius: obsidianTheme.radiusSm,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 10,
  },
  feedbackBannerText: {
    color: obsidianTheme.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeaderBlock: {
    marginTop: 4,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionBlockTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  clinicalIndexCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusMd,
    padding: 14,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginBottom: 10,
  },
  clinicalCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  clinicalCardTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  clinicalCardSub: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  clinicalRightCol: {
    alignItems: 'flex-end',
  },
  clinicalMainValue: {
    color: obsidianTheme.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  clinicalStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 3,
  },
  clinicalStatusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  clinicalRangeTrack: {
    height: 5,
    backgroundColor: obsidianTheme.bg,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 12,
  },
  clinicalRangeFill: {
    height: '100%',
    borderRadius: 999,
  },
  clinicalRangeLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  clinicalRangeTick: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
  },
  clinicalExpandedBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
  },
  clinicalExpandedText: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  subtleCountText: {
    color: obsidianTheme.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  shiftFilterPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
    marginBottom: 10,
  },
  shiftFilterPill: {
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    borderRadius: obsidianTheme.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  shiftFilterPillActive: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accent,
  },
  shiftFilterPillText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  shiftFilterPillTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '800',
  },
  shiftMiniStatsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  shiftMiniCard: {
    flex: 1,
    backgroundColor: obsidianTheme.bg,
    borderRadius: obsidianTheme.radiusSm,
    padding: 9,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    alignItems: 'center',
  },
  shiftMiniTitle: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  shiftMiniValue: {
    color: obsidianTheme.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 3,
  },
  shiftMiniDelta: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  shiftMiniEmpty: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    marginTop: 6,
  },
  comparePresetSection: {
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: obsidianTheme.bg,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 10,
  },
  comparePresetHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 8,
  },
  comparePresetEyebrow: {
    color: obsidianTheme.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  comparePresetPillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  comparePresetPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: obsidianTheme.surface,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  comparePresetPillActive: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accent,
  },
  comparePresetDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(16, 185, 129, 0.55)',
  },
  comparePresetDotActive: {
    backgroundColor: obsidianTheme.accent,
  },
  comparePresetPillText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  comparePresetPillTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '800',
  },
  compareSummaryBanner: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
  compareSummaryBannerText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  compareSummaryRateText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  compareSummaryBannerStrong: {
    color: obsidianTheme.textPrimary,
    fontWeight: '800',
  },
  compareDateSelectorsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 12,
    marginBottom: 8,
  },
  compareDateCol: {
    flex: 1,
  },
  compareDateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  compareDateLabel: {
    color: obsidianTheme.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  scaleSubSelectorLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 5,
  },
  datePill: {
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    borderRadius: obsidianTheme.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  datePillAnteriorActive: {
    backgroundColor: obsidianTheme.surfaceHighlight,
    borderColor: obsidianTheme.textSecondary,
  },
  datePillAtualActive: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accent,
  },
  datePillText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  datePillTextAnteriorActive: {
    color: obsidianTheme.textPrimary,
    fontWeight: '800',
  },
  datePillTextAtualActive: {
    color: obsidianTheme.accent,
    fontWeight: '800',
  },
  avatarsSideBySide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 8,
  },
  avatarCompareCol: {
    flex: 1,
    alignItems: 'center',
  },
  avatarCompareTagAnterior: {
    color: obsidianTheme.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  avatarCompareTagAtual: {
    color: obsidianTheme.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  avatarCompareFooter: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
  avatarCompareFooterStrong: {
    color: obsidianTheme.textPrimary,
    fontWeight: '800',
  },
  deltaBiaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 12,
  },
  deltaBiaCard: {
    width: '48.5%',
    backgroundColor: obsidianTheme.bg,
    borderRadius: obsidianTheme.radiusMd,
    padding: 12,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  deltaCardEmeraldBorder: {
    borderColor: obsidianTheme.accentBorder,
  },
  deltaCardLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  deltaCardMain: {
    color: obsidianTheme.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 3,
  },
  deltaCardSub: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  circumferenceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  circumferenceLegendText: {
    color: obsidianTheme.accent,
    fontSize: 10,
    fontWeight: '700',
  },
  circumferenceDeltaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  circumferenceDeltaItem: {
    width: '48.5%',
    backgroundColor: obsidianTheme.bg,
    borderRadius: obsidianTheme.radiusSm,
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  circumferenceDeltaItemEmerald: {
    borderColor: obsidianTheme.accentBorder,
    backgroundColor: 'rgba(16, 185, 129, 0.05)',
  },
  circumferenceItemTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  circumferenceItemTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  circumferenceItemDelta: {
    fontSize: 13,
    fontWeight: '800',
  },
  circumferenceItemRange: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  emptyNoticeText: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  recordsListWrap: {
    gap: 8,
  },
  recordListItem: {
    backgroundColor: obsidianTheme.bg,
    borderRadius: obsidianTheme.radiusMd,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  recordListMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recordDateBlock: {
    minWidth: 44,
  },
  recordDateText: {
    color: obsidianTheme.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  recordTimeText: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
  },
  shiftCyclePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  shiftCyclePillText: {
    fontSize: 10,
    fontWeight: '800',
  },
  recordMetricsGroup: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  recordMetricCol: {
    alignItems: 'center',
  },
  recordMetricValPrimary: {
    color: obsidianTheme.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  recordMetricVal: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  recordMetricLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 9,
    marginTop: 1,
  },
  discreteTrashBtn: {
    padding: 6,
    borderRadius: obsidianTheme.radiusSm,
    backgroundColor: obsidianTheme.surface,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  inlineConfirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
    gap: 8,
  },
  inlineConfirmLabel: {
    color: obsidianTheme.statusAlert,
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  inlineConfirmActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  inlineConfirmYesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: obsidianTheme.statusAlert,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: obsidianTheme.radiusSm,
  },
  inlineConfirmYesText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  inlineConfirmNoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: obsidianTheme.radiusSm,
  },
  inlineConfirmNoText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: obsidianTheme.border,
    paddingVertical: 9,
  },
  tHeaderRow: {
    backgroundColor: obsidianTheme.bg,
    borderTopLeftRadius: obsidianTheme.radiusSm,
    borderTopRightRadius: obsidianTheme.radiusSm,
  },
  tRowEven: {
    backgroundColor: obsidianTheme.surface,
  },
  tRowOdd: {
    backgroundColor: obsidianTheme.bg,
  },
  tCell: {
    width: 72,
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    textAlign: 'center',
  },
  tColDate: {
    width: 68,
  },
  tColPeriod: {
    width: 82,
  },
  tHeaderText: {
    color: obsidianTheme.textMuted,
    fontWeight: '800',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  matrixDateText: {
    color: obsidianTheme.textPrimary,
    fontWeight: '800',
    fontSize: 11,
  },
  matrixTimeText: {
    color: obsidianTheme.textMuted,
    fontSize: 9,
  },
  matrixBoldCell: {
    color: obsidianTheme.textPrimary,
    fontWeight: '800',
  },
});
