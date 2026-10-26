import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Activity,
  AlertTriangle,
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardPaste,
  Droplets,
  FileText,
  Flame,
  Footprints,
  FlaskConical,
  Image as ImageIcon,
  Info,
  Moon,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import { obsidianTheme } from '../theme/obsidianTheme';
import {
  importLabExamFromPdf,
  importLabExamFromPhoto,
  parseBiomarkersFromLabText,
} from '../services/labExamImportService';
import {
  BioimpedanceMetrics,
  LabExamEntry,
  SamsungHealthSummary,
  UserProfile,
} from '../types/health';
import {
  BioMetricEvaluation,
  ClinicalStatusLevel,
  evaluateAllBioimpedanceMetrics,
} from '../utils/bioimpedanceGuide';
import {
  BIOMARKER_CATEGORIES,
  BiomarkerCategory,
  BiomarkerFieldKey,
  BiomarkerGuide,
  calculateHomaIr,
  evaluateBiomarker,
  evaluateFullLabExam,
  LAB_BIOMARKERS_GUIDE,
} from '../utils/labExams';

export interface HealthAndExamsViewProps {
  latestMetrics: BioimpedanceMetrics;
  previousMetrics?: BioimpedanceMetrics;
  profile: UserProfile;
  samsungHealth: SamsungHealthSummary;
  labExams: LabExamEntry[];
  onSaveLabExam: (entry: LabExamEntry) => Promise<void>;
  onDeleteLabExam: (id: string) => Promise<void>;
  onSyncSamsungHealth: () => Promise<void>;
  syncingHealth: boolean;
}

type ActiveSubTab = 'bioimpedance' | 'exams';

const BIO_SECTIONS: Array<{
  key: BioMetricEvaluation['category'];
  title: string;
  subtitle: string;
}> = [
  {
    key: 'composition',
    title: 'COMPOSIÇÃO CORPORAL',
    subtitle: 'Adiposidade, massa contrátil e risco metabólico visceral',
  },
  {
    key: 'hydration_bone',
    title: 'HIDRATAÇÃO & ESTRUTURA ÓSSEA',
    subtitle: 'Água intra/extracelular, reserva proteica e densidade mineral',
  },
  {
    key: 'metabolism',
    title: 'METABOLISMO & BIOFÍSICA',
    subtitle: 'Gasto energético basal, longevidade biológica e condutividade 50 kHz',
  },
];

const BIOMARKER_CLINICAL_MEANING: Record<BiomarkerFieldKey, string> = {
  fastingGlucoseMgDl:
    'Mede a concentração de glicose circulante no sangue após jejum de 8–12 horas, refletindo o controle glicêmico basal.',
  hba1cPercent:
    'Reflete a média da glicemia nos últimos 90 a 120 dias através da glicação da hemoglobina nos glóbulos vermelhos.',
  fastingInsulinUiuMl:
    'Quantifica o hormônio insulina em jejum. Níveis baixos indicam alta sensibilidade celular; níveis altos sinalizam resistência insulínica precoce.',
  homaIr:
    'Índice matemático (Glicose × Insulina / 405) padrão-ouro para detectar resistência à insulina e risco de acúmulo visceral.',
  totalCholesterolMgDl:
    'Soma das frações de colesterol (HDL, LDL e VLDL), precursor essencial de membranas celulares e hormônios esteroides.',
  hdlMgDl:
    'Lipoproteína de alta densidade responsável pelo transporte reverso do colesterol das artérias de volta ao fígado.',
  ldlMgDl:
    'Lipoproteína de baixa densidade. Quando oxidada e em excesso, associa-se à formação de placas ateroscleróticas.',
  triglyceridesMgDl:
    'Reserva circulante de ácidos graxos e glicerol, fortemente sensível ao excesso de carboidratos refinados, frutose e álcool.',
  tshUiuMl:
    'Hormônio estimulante da tireoide produzido pela hipófise; regula diretamente a velocidade da Taxa Metabólica Basal.',
  freeT4NgDl:
    'Fração biologicamente livre da tiroxina produzida pela tireoide, convertida perifericamente no hormônio ativo T3.',
  totalTestosteroneNgDl:
    'Principal hormônio anabólico e androgênico, determinante para síntese proteica muscular, densidade óssea e vigor.',
  morningCortisolUgDl:
    'Hormônio glicocorticoide do despertar e resposta ao estresse; o excesso crônico induz catabolismo magro e gordura visceral.',
  vitaminDNgMl:
    'Pró-hormônio esteroide essencial para transcrição gênica, imunidade inata, absorção de cálcio e força de contração muscular.',
  vitaminB12PgMl:
    'Cofator indispensável para formação de hemácias, mielinização neurológica e ciclo energético mitocondrial.',
  ferritinNgMl:
    'Principal proteína intracelular de armazenamento de ferro, vital para o transporte de oxigênio pela hemoglobina e mioglobina.',
  hsCrpMgL:
    'Proteína C-Reativa de alta sensibilidade, marcador sistêmico de inflamação vascular ou estresse fisiológico pós-treino.',
  creatinineMgDl:
    'Subproduto da degradação da fosfocreatina muscular filtrado pelos rins; proporcional ao volume de massa muscular.',
  astU_L:
    'Enzima transaminase presente no fígado e no músculo esquelético; eleva-se em lesão hepatocelular ou microlesões de treino intenso.',
  altU_L:
    'Enzima predominantemente hepática; marcador sensível de sobrecarga metabólica ou esteatose no fígado.',
};

function getStatusColor(status: ClinicalStatusLevel): string {
  switch (status) {
    case 'optimal':
      return obsidianTheme.statusOptimal;
    case 'normal':
      return obsidianTheme.statusNormal;
    case 'attention':
      return obsidianTheme.statusAttention;
    case 'alert':
      return obsidianTheme.statusAlert;
  }
}

function getStatusBgColor(status: ClinicalStatusLevel): string {
  switch (status) {
    case 'optimal':
      return obsidianTheme.statusOptimalBg;
    case 'normal':
      return obsidianTheme.statusNormalBg;
    case 'attention':
      return obsidianTheme.statusAttentionBg;
    case 'alert':
      return obsidianTheme.statusAlertBg;
  }
}

function computeBiomarkerBarGeometry(
  value: number | undefined,
  minIdeal: number,
  maxIdeal: number
): {
  barPositionPercent: number;
  idealZoneStartPercent: number;
  idealZoneEndPercent: number;
} {
  const span = Math.max(0.1, maxIdeal - minIdeal);
  const scaleMin = Math.max(0, minIdeal - span * 0.45);
  const scaleMax = maxIdeal + span * 0.55;
  const totalScale = Math.max(0.1, scaleMax - scaleMin);

  const idealStart = Math.max(8, Math.min(45, Math.round(((minIdeal - scaleMin) / totalScale) * 100)));
  const idealEnd = Math.max(
    idealStart + 18,
    Math.min(90, Math.round(((maxIdeal - scaleMin) / totalScale) * 100))
  );

  if (typeof value !== 'number' || isNaN(value) || value <= 0) {
    return {
      barPositionPercent: 50,
      idealZoneStartPercent: idealStart,
      idealZoneEndPercent: idealEnd,
    };
  }

  const rawPos = ((value - scaleMin) / totalScale) * 100;
  const clampedPos = Math.max(4, Math.min(96, Math.round(rawPos)));

  return {
    barPositionPercent: clampedPos,
    idealZoneStartPercent: idealStart,
    idealZoneEndPercent: idealEnd,
  };
}

function formatExamDate(isoOrDate: string): string {
  if (!isoOrDate) return 'Sem data';
  const parsed = new Date(isoOrDate);
  if (isNaN(parsed.getTime())) {
    return isoOrDate;
  }
  return parsed.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function normalizeBioMetricsForEvaluator(metrics: BioimpedanceMetrics): BioimpedanceMetrics {
  const compatRecord: Record<string, unknown> = {
    ...metrics,
    bodyFatPercentage: metrics.bodyFatPercent ?? 0,
    waterPercentage: metrics.waterPercent ?? 0,
    proteinPercentage: metrics.proteinPercent ?? 0,
    impedanceOhms: metrics.impedanceOhm ?? 500,
  };
  return compatRecord as unknown as BioimpedanceMetrics;
}

export const HealthAndExamsView: React.FC<HealthAndExamsViewProps> = ({
  latestMetrics,
  previousMetrics,
  profile,
  samsungHealth,
  labExams,
  onSaveLabExam,
  onDeleteLabExam,
  onSyncSamsungHealth,
  syncingHealth,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<ActiveSubTab>('bioimpedance');
  const [expandedMetricKey, setExpandedMetricKey] = useState<string | null>('bodyFatPercentage');

  // Lab Exams states
  const [selectedExamId, setSelectedExamId] = useState<string | null>(
    labExams.length > 0 ? labExams[0].id : null
  );
  const [showExamForm, setShowExamForm] = useState<boolean>(false);
  const [activeFormCategory, setActiveFormCategory] = useState<BiomarkerCategory>('glycemic');
  const [showOnlyFilledBiomarkers, setShowOnlyFilledBiomarkers] = useState<boolean>(false);
  const [expandedBiomarkerKey, setExpandedBiomarkerKey] = useState<BiomarkerFieldKey | null>(null);
  const [savingExam, setSavingExam] = useState<boolean>(false);

  // Registration Form inputs
  const [examLabelInput, setExamLabelInput] = useState<string>('Check-up Metabólico & Hormonal');
  const [examDateInput, setExamDateInput] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [examNotesInput, setExamNotesInput] = useState<string>('');
  const [biomarkerInputs, setBiomarkerInputs] = useState<
    Partial<Record<BiomarkerFieldKey, string>>
  >({});

  // Photo / PDF / Text Import states
  const [importingFile, setImportingFile] = useState<boolean>(false);
  const [importStatusMsg, setImportStatusMsg] = useState<string>('');
  const [attachmentUri, setAttachmentUri] = useState<string | undefined>(undefined);
  const [attachmentType, setAttachmentType] = useState<'photo' | 'pdf' | undefined>(
    undefined
  );
  const [attachmentName, setAttachmentName] = useState<string | undefined>(undefined);
  const [showPasteTextBox, setShowPasteTextBox] = useState<boolean>(false);
  const [pastedLabText, setPastedLabText] = useState<string>('');

  // Evaluate 11 Bioimpedance Metrics
  const evaluatedBioMetrics = useMemo(() => {
    const normalized = normalizeBioMetricsForEvaluator(latestMetrics);
    return evaluateAllBioimpedanceMetrics(normalized, profile);
  }, [latestMetrics, profile]);

  const previousBioEvaluationsMap = useMemo(() => {
    if (!previousMetrics) return null;
    const normalizedPrev = normalizeBioMetricsForEvaluator(previousMetrics);
    const list = evaluateAllBioimpedanceMetrics(normalizedPrev, profile);
    const map: Record<string, number> = {};
    for (const item of list) {
      map[item.key] = item.value;
    }
    return map;
  }, [previousMetrics, profile]);

  const bioSummaryStats = useMemo(() => {
    const idealCount = evaluatedBioMetrics.filter(
      (m) => m.status === 'optimal' || m.status === 'normal'
    ).length;
    const attentionCount = evaluatedBioMetrics.filter(
      (m) => m.status === 'attention' || m.status === 'alert'
    ).length;
    return {
      idealCount,
      attentionCount,
      total: evaluatedBioMetrics.length,
    };
  }, [evaluatedBioMetrics]);

  // Selected Lab Exam resolution
  const activeExam: LabExamEntry | undefined = useMemo(() => {
    if (labExams.length === 0) return undefined;
    if (selectedExamId) {
      const found = labExams.find((e) => e.id === selectedExamId);
      if (found) return found;
    }
    return labExams[0];
  }, [labExams, selectedExamId]);

  const activeExamReport = useMemo(() => {
    if (!activeExam) return null;
    return evaluateFullLabExam(activeExam, profile.sex || 'male');
  }, [activeExam, profile.sex]);

  // Live HOMA-IR preview in Registration Form
  const liveHomaIrPreview = useMemo(() => {
    const gStr = biomarkerInputs.fastingGlucoseMgDl?.replace(',', '.');
    const iStr = biomarkerInputs.fastingInsulinUiuMl?.replace(',', '.');
    const gVal = gStr ? parseFloat(gStr) : undefined;
    const iVal = iStr ? parseFloat(iStr) : undefined;
    return calculateHomaIr(gVal, iVal);
  }, [biomarkerInputs.fastingGlucoseMgDl, biomarkerInputs.fastingInsulinUiuMl]);

  const handleOpenForm = (prefillFromActive = false) => {
    setImportStatusMsg('');
    setShowPasteTextBox(false);
    setPastedLabText('');
    if (prefillFromActive && activeExam) {
      setExamLabelInput(activeExam.label || 'Check-up Laboratorial');
      setExamDateInput(activeExam.timestamp.split('T')[0] || new Date().toISOString().split('T')[0]);
      setExamNotesInput(activeExam.customNotes || '');
      setAttachmentUri(activeExam.attachmentUri);
      setAttachmentType(activeExam.attachmentType);
      setAttachmentName(activeExam.attachmentName);
      const nextInputs: Partial<Record<BiomarkerFieldKey, string>> = {};
      for (const guide of LAB_BIOMARKERS_GUIDE) {
        const val = activeExam[guide.key];
        if (typeof val === 'number' && !isNaN(val)) {
          nextInputs[guide.key] = String(val);
        }
      }
      setBiomarkerInputs(nextInputs);
    } else {
      setExamLabelInput('Check-up Metabólico & Hormonal');
      setExamDateInput(new Date().toISOString().split('T')[0]);
      setExamNotesInput('');
      setAttachmentUri(undefined);
      setAttachmentType(undefined);
      setAttachmentName(undefined);
      setBiomarkerInputs({});
    }
    setShowExamForm(true);
  };

  const handleImportFromPhoto = async (source: 'camera' | 'gallery') => {
    setImportingFile(true);
    setImportStatusMsg('Processando imagem do laudo...');
    try {
      const res = await importLabExamFromPhoto(source, profile);
      if (!res.cancelled) {
        setShowExamForm(true);
        setAttachmentUri(res.attachmentUri);
        setAttachmentType(res.attachmentType);
        setAttachmentName(res.attachmentName);
        if (res.suggestedLabel) {
          setExamLabelInput(res.suggestedLabel);
        }
        setBiomarkerInputs((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(res.extractedValues)) {
            if (typeof v === 'number' && !isNaN(v)) {
              next[k as BiomarkerFieldKey] = String(v);
            }
          }
          return next;
        });
        setImportStatusMsg(res.statusMessage);
      } else if (res.statusMessage && res.statusMessage !== 'Seleção cancelada.') {
        setImportStatusMsg(res.statusMessage);
      } else {
        setImportStatusMsg('');
      }
    } finally {
      setImportingFile(false);
    }
  };

  const handleImportFromPdf = async () => {
    setImportingFile(true);
    setImportStatusMsg('Lendo arquivo PDF e extraindo biomarcadores...');
    try {
      const res = await importLabExamFromPdf(profile);
      if (!res.cancelled) {
        setShowExamForm(true);
        setAttachmentUri(res.attachmentUri);
        setAttachmentType(res.attachmentType);
        setAttachmentName(res.attachmentName);
        if (res.suggestedLabel) {
          setExamLabelInput(res.suggestedLabel);
        }
        setBiomarkerInputs((prev) => {
          const next = { ...prev };
          for (const [k, v] of Object.entries(res.extractedValues)) {
            if (typeof v === 'number' && !isNaN(v)) {
              next[k as BiomarkerFieldKey] = String(v);
            }
          }
          return next;
        });
        setImportStatusMsg(res.statusMessage);
      } else {
        setImportStatusMsg('');
      }
    } finally {
      setImportingFile(false);
    }
  };

  const handleExtractFromPastedText = () => {
    const extracted = parseBiomarkersFromLabText(pastedLabText);
    setBiomarkerInputs((prev) => {
      const next = { ...prev };
      for (const [k, v] of Object.entries(extracted)) {
        if (typeof v === 'number' && !isNaN(v)) {
          next[k as BiomarkerFieldKey] = String(v);
        }
      }
      return next;
    });
    const count = Object.keys(extracted).length;
    setImportStatusMsg(
      count > 0
        ? `✅ Extraímos ${count} biomarcador(es) do texto colado! Revise abaixo e salve.`
        : 'Nenhum biomarcador padrão identificado no texto colado. Verifique o formato ou preencha os campos abaixo.'
    );
    if (count > 0) {
      setShowPasteTextBox(false);
    }
  };

  const handleUpdateBiomarkerInput = (key: BiomarkerFieldKey, text: string) => {
    setBiomarkerInputs((prev) => ({
      ...prev,
      [key]: text,
    }));
  };

  const handleSaveExamSubmit = async () => {
    setSavingExam(true);
    try {
      const numericFields: Partial<Record<BiomarkerFieldKey, number>> = {};
      for (const guide of LAB_BIOMARKERS_GUIDE) {
        const raw = biomarkerInputs[guide.key];
        if (raw && raw.trim().length > 0) {
          const parsed = parseFloat(raw.replace(',', '.'));
          if (!isNaN(parsed) && parsed > 0) {
            numericFields[guide.key] = parsed;
          }
        }
      }

      if (
        !numericFields.homaIr &&
        numericFields.fastingGlucoseMgDl &&
        numericFields.fastingInsulinUiuMl
      ) {
        const computed = calculateHomaIr(
          numericFields.fastingGlucoseMgDl,
          numericFields.fastingInsulinUiuMl
        );
        if (computed) {
          numericFields.homaIr = computed;
        }
      }

      const newEntry: LabExamEntry = {
        id: `exam_${Date.now()}`,
        timestamp: examDateInput.trim()
          ? new Date(examDateInput.trim()).toISOString()
          : new Date().toISOString(),
        label: examLabelInput.trim() || 'Exame de Sangue',
        ...numericFields,
        customNotes: examNotesInput.trim() || undefined,
        attachmentUri,
        attachmentType,
        attachmentName,
      };

      await onSaveLabExam(newEntry);
      setSelectedExamId(newEntry.id);
      setShowExamForm(false);
      setImportStatusMsg('');
    } finally {
      setSavingExam(false);
    }
  };

  const handleDeleteCurrentExam = async () => {
    if (!activeExam) return;
    await onDeleteLabExam(activeExam.id);
    const remaining = labExams.filter((e) => e.id !== activeExam.id);
    setSelectedExamId(remaining.length > 0 ? remaining[0].id : null);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Segmented Control */}
      <View style={styles.segmentedWrapper}>
        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.segmentButton,
            activeSubTab === 'bioimpedance' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveSubTab('bioimpedance')}
        >
          <Activity
            size={15}
            color={
              activeSubTab === 'bioimpedance'
                ? obsidianTheme.accent
                : obsidianTheme.textSecondary
            }
          />
          <Text
            style={[
              styles.segmentButtonText,
              activeSubTab === 'bioimpedance' && styles.segmentButtonTextActive,
            ]}
          >
            Bioimpedância (11)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.85}
          style={[
            styles.segmentButton,
            activeSubTab === 'exams' && styles.segmentButtonActive,
          ]}
          onPress={() => setActiveSubTab('exams')}
        >
          <FlaskConical
            size={15}
            color={
              activeSubTab === 'exams'
                ? obsidianTheme.accent
                : obsidianTheme.textSecondary
            }
          />
          <Text
            style={[
              styles.segmentButtonText,
              activeSubTab === 'exams' && styles.segmentButtonTextActive,
            ]}
          >
            Exames de Sangue
          </Text>
          {labExams.length > 0 && (
            <View style={styles.segmentCountBadge}>
              <Text style={styles.segmentCountText}>{labExams.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* =================================================================== */}
      {/* VIEW 1: BIOIMPEDÂNCIA (11)                                          */}
      {/* =================================================================== */}
      {activeSubTab === 'bioimpedance' && (
        <View style={styles.viewSection}>
          {/* Executive Summary Banner + Samsung Health Recovery Bar */}
          <View style={styles.executiveBanner}>
            <View style={styles.executiveHeaderRow}>
              <View style={styles.executiveTitleCol}>
                <Text style={styles.executiveOverline}>DIAGNÓSTICO BIOMÉTRICO 50 KHZ</Text>
                <Text style={styles.executiveTitle}>Panorama Corporal Completo</Text>
              </View>
              <View style={styles.weightPill}>
                <Text style={styles.weightPillValue}>
                  {latestMetrics.weightKg.toFixed(1)} kg
                </Text>
              </View>
            </View>

            <View style={styles.kpiSummaryRow}>
              <View style={[styles.kpiBox, styles.kpiBoxOptimal]}>
                <CheckCircle2 size={16} color={obsidianTheme.statusOptimal} />
                <View>
                  <Text style={styles.kpiNumberOptimal}>
                    {bioSummaryStats.idealCount}/{bioSummaryStats.total}
                  </Text>
                  <Text style={styles.kpiCaption}>Zona Ideal / Normal</Text>
                </View>
              </View>

              <View
                style={[
                  styles.kpiBox,
                  bioSummaryStats.attentionCount > 0
                    ? styles.kpiBoxAttention
                    : styles.kpiBoxNeutral,
                ]}
              >
                <AlertTriangle
                  size={16}
                  color={
                    bioSummaryStats.attentionCount > 0
                      ? obsidianTheme.statusAttention
                      : obsidianTheme.textMuted
                  }
                />
                <View>
                  <Text
                    style={[
                      styles.kpiNumberAttention,
                      bioSummaryStats.attentionCount === 0 && {
                        color: obsidianTheme.textSecondary,
                      },
                    ]}
                  >
                    {bioSummaryStats.attentionCount}
                  </Text>
                  <Text style={styles.kpiCaption}>Atenção / Alerta</Text>
                </View>
              </View>
            </View>

            {/* Compact Samsung Health Recovery Bar */}
            <View style={styles.recoveryBar}>
              <View style={styles.recoveryMetricsRow}>
                <View style={styles.recoveryMetricItem}>
                  <Footprints size={13} color={obsidianTheme.accent} />
                  <Text style={styles.recoveryMetricValue}>
                    {samsungHealth.stepsToday.toLocaleString('pt-BR')}
                  </Text>
                  <Text style={styles.recoveryMetricLabel}>passos</Text>
                </View>

                <View style={styles.recoveryDivider} />

                <View style={styles.recoveryMetricItem}>
                  <Moon size={13} color={obsidianTheme.statusNormal} />
                  <Text style={styles.recoveryMetricValue}>
                    {samsungHealth.sleepHoursLastNight.toFixed(1)}h
                  </Text>
                  <Text style={styles.recoveryMetricLabel}>sono</Text>
                </View>

                <View style={styles.recoveryDivider} />

                <View style={styles.recoveryMetricItem}>
                  <Flame size={13} color={obsidianTheme.statusAttention} />
                  <Text style={styles.recoveryMetricValue}>
                    {samsungHealth.caloriesBurnedToday}
                  </Text>
                  <Text style={styles.recoveryMetricLabel}>kcal</Text>
                </View>
              </View>

              <TouchableOpacity
                activeOpacity={0.8}
                style={styles.syncMiniButton}
                onPress={onSyncSamsungHealth}
                disabled={syncingHealth}
              >
                {syncingHealth ? (
                  <ActivityIndicator size="small" color={obsidianTheme.accent} />
                ) : (
                  <>
                    <RefreshCw size={12} color={obsidianTheme.accent} />
                    <Text style={styles.syncMiniButtonText}>Sync</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* 3 Clean Clinical Sections for the 11 Metrics */}
          {BIO_SECTIONS.map((section) => {
            const sectionMetrics = evaluatedBioMetrics.filter(
              (m) => m.category === section.key
            );

            return (
              <View key={section.key} style={styles.clinicalSectionBlock}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionHeaderTitle}>{section.title}</Text>
                  <Text style={styles.sectionHeaderSubtitle}>{section.subtitle}</Text>
                </View>

                <View style={styles.cardsStack}>
                  {sectionMetrics.map((item) => {
                    const isExpanded = expandedMetricKey === item.key;
                    const statusColor = getStatusColor(item.status);
                    const statusBg = getStatusBgColor(item.status);
                    const prevVal = previousBioEvaluationsMap?.[item.key];
                    const delta =
                      typeof prevVal === 'number'
                        ? Number((item.value - prevVal).toFixed(1))
                        : null;

                    return (
                      <TouchableOpacity
                        key={item.key}
                        activeOpacity={0.88}
                        style={[
                          styles.metricCard,
                          isExpanded && styles.metricCardExpanded,
                        ]}
                        onPress={() =>
                          setExpandedMetricKey(isExpanded ? null : item.key)
                        }
                      >
                        {/* Top Row: Label + Value + Status Badge */}
                        <View style={styles.metricTopRow}>
                          <View style={styles.metricTitleArea}>
                            <Text style={styles.metricLabel}>{item.label}</Text>
                            <View style={styles.metricValueRow}>
                              <Text style={styles.metricFormattedValue}>
                                {item.formattedValue}
                              </Text>
                              {delta !== null && delta !== 0 && (
                                <Text
                                  style={[
                                    styles.metricDeltaText,
                                    {
                                      color:
                                        delta > 0
                                          ? obsidianTheme.textSecondary
                                          : obsidianTheme.accent,
                                    },
                                  ]}
                                >
                                  {delta > 0 ? `+${delta}` : `${delta}`}
                                </Text>
                              )}
                            </View>
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: statusBg,
                                borderColor: `${statusColor}45`,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDot,
                                { backgroundColor: statusColor },
                              ]}
                            />
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: statusColor },
                              ]}
                            >
                              {item.statusLabel}
                            </Text>
                          </View>
                        </View>

                        {/* Minimalist Horizontal Clinical Range Bar */}
                        <View style={styles.rangeBarContainer}>
                          <View style={styles.rangeTrack}>
                            <View
                              style={[
                                styles.rangeIdealZone,
                                {
                                  left: `${item.idealZoneStartPercent}%`,
                                  width: `${Math.max(
                                    8,
                                    item.idealZoneEndPercent -
                                      item.idealZoneStartPercent
                                  )}%`,
                                },
                              ]}
                            />
                            <View
                              style={[
                                styles.rangeMarker,
                                {
                                  left: `${item.barPositionPercent}%`,
                                  backgroundColor: statusColor,
                                  shadowColor: statusColor,
                                },
                              ]}
                            />
                          </View>

                          <View style={styles.rangeFooterRow}>
                            <Text style={styles.rangeIdealCaption}>
                              Faixa de referência ideal:{' '}
                              <Text style={styles.rangeIdealCaptionStrong}>
                                {item.idealRangeText}
                              </Text>
                            </Text>

                            <View style={styles.expandHintWrap}>
                              <Text style={styles.expandHintText}>
                                {isExpanded ? 'Ocultar' : 'Toque para detalhes'}
                              </Text>
                              {isExpanded ? (
                                <ChevronUp
                                  size={13}
                                  color={obsidianTheme.textSecondary}
                                />
                              ) : (
                                <ChevronDown
                                  size={13}
                                  color={obsidianTheme.textMuted}
                                />
                              )}
                            </View>
                          </View>
                        </View>

                        {/* Tap-to-Expand Clinical Detail Drawer */}
                        {isExpanded && (
                          <View style={styles.detailDrawer}>
                            <View style={styles.detailBlock}>
                              <View style={styles.detailTitleRow}>
                                <Info size={13} color={obsidianTheme.statusNormal} />
                                <Text style={styles.detailBlockTitle}>
                                  O que significa
                                </Text>
                              </View>
                              <Text style={styles.detailBlockBody}>
                                {item.whatItMeans}
                              </Text>
                            </View>

                            <View style={styles.detailDivider} />

                            <View style={styles.detailBlock}>
                              <View style={styles.detailTitleRow}>
                                <Sparkles size={13} color={obsidianTheme.accent} />
                                <Text
                                  style={[
                                    styles.detailBlockTitle,
                                    { color: obsidianTheme.accent },
                                  ]}
                                >
                                  Como otimizar
                                </Text>
                              </View>
                              <Text style={styles.detailBlockBody}>
                                {item.howToImprove}
                              </Text>
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: EXAMES DE SANGUE                                            */}
      {/* =================================================================== */}
      {activeSubTab === 'exams' && (
        <View style={styles.viewSection}>
          {/* Header Card: Summary of Latest Lab Exam + "+ Registrar Exame" */}
          <View style={styles.examHeaderCard}>
            <View style={styles.examHeaderTopRow}>
              <View style={styles.examTitleCol}>
                <Text style={styles.executiveOverline}>PAINEL LABORATORIAL INTEGRADO</Text>
                <Text style={styles.executiveTitle}>
                  {activeExam ? activeExam.label : 'Biomarcadores Sanguíneos'}
                </Text>
                <Text style={styles.examDateSubtext}>
                  {activeExam
                    ? `Coleta registrada em ${formatExamDate(activeExam.timestamp)}`
                    : 'Cruze seus exames de sangue com a bioimpedância'}
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.85}
                style={[
                  styles.registerExamBtn,
                  showExamForm && styles.registerExamBtnCancel,
                ]}
                onPress={() => {
                  if (showExamForm) {
                    setShowExamForm(false);
                  } else {
                    handleOpenForm(false);
                  }
                }}
              >
                {showExamForm ? (
                  <>
                    <X size={15} color={obsidianTheme.textPrimary} />
                    <Text style={styles.registerExamBtnCancelText}>Fechar</Text>
                  </>
                ) : (
                  <>
                    <Plus size={15} color="#052E16" />
                    <Text style={styles.registerExamBtnText}>+ Registrar Exame</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Sleek Action Bar: Importar Laudo por Foto ou PDF */}
            <View style={styles.importActionBox}>
              <Text style={styles.importActionOverline}>
                IMPORTAR LAUDO POR FOTO OU PDF
              </Text>
              <View style={styles.importButtonsRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.importActionButton}
                  onPress={() => handleImportFromPhoto('camera')}
                  disabled={importingFile}
                >
                  <Camera size={14} color={obsidianTheme.accent} />
                  <Text style={styles.importActionButtonText}>📷 Câmera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.importActionButton}
                  onPress={() => handleImportFromPhoto('gallery')}
                  disabled={importingFile}
                >
                  <ImageIcon size={14} color={obsidianTheme.statusNormal} />
                  <Text style={styles.importActionButtonText}>🖼️ Galeria</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.importActionButton}
                  onPress={handleImportFromPdf}
                  disabled={importingFile}
                >
                  <FileText size={14} color={obsidianTheme.statusAttention} />
                  <Text style={styles.importActionButtonText}>📄 Arquivo PDF</Text>
                </TouchableOpacity>
              </View>

              {importingFile && (
                <View style={styles.importLoadingBanner}>
                  <ActivityIndicator size="small" color={obsidianTheme.accent} />
                  <Text style={styles.importLoadingText}>
                    {importStatusMsg || 'Processando arquivo...'}
                  </Text>
                </View>
              )}
            </View>

            {/* Active Exam Attachment Badge / Preview */}
            {(activeExam?.attachmentName || activeExam?.attachmentUri) && (
              <View style={styles.activeAttachmentBanner}>
                {activeExam.attachmentType === 'photo' && activeExam.attachmentUri ? (
                  <Image
                    source={{ uri: activeExam.attachmentUri }}
                    style={styles.activeAttachmentThumb}
                    resizeMode="cover"
                  />
                ) : (
                  <FileText size={16} color={obsidianTheme.accent} />
                )}
                <View style={styles.activeAttachmentInfo}>
                  <Text style={styles.activeAttachmentTitle} numberOfLines={1}>
                    {activeExam.attachmentType === 'photo' ? '📷' : '📄'} Anexo:{' '}
                    {activeExam.attachmentName || 'Laudo anexado'}
                  </Text>
                  <Text style={styles.activeAttachmentSub}>
                    {activeExam.attachmentType === 'photo'
                      ? 'Imagem do exame vinculada a este registro'
                      : 'Documento PDF vinculado a este registro'}
                  </Text>
                </View>
              </View>
            )}

            {/* Summary KPIs + HOMA-IR Badge if activeExam exists */}
            {activeExam && activeExamReport && (
              <View style={styles.examSummaryPillsRow}>
                <View style={styles.examStatBadgeOptimal}>
                  <ShieldCheck size={14} color={obsidianTheme.statusOptimal} />
                  <Text style={styles.examStatBadgeTextOptimal}>
                    {activeExamReport.optimalCount} em faixa ideal
                  </Text>
                </View>

                <View
                  style={[
                    styles.examStatBadgeAlert,
                    activeExamReport.alerts.length === 0 && {
                      backgroundColor: obsidianTheme.surfaceElevated,
                      borderColor: obsidianTheme.border,
                    },
                  ]}
                >
                  <AlertTriangle
                    size={14}
                    color={
                      activeExamReport.alerts.length > 0
                        ? obsidianTheme.statusAttention
                        : obsidianTheme.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.examStatBadgeTextAlert,
                      activeExamReport.alerts.length === 0 && {
                        color: obsidianTheme.textSecondary,
                      },
                    ]}
                  >
                    {activeExamReport.alerts.length} em atenção/alterados
                  </Text>
                </View>

                {(activeExam.homaIr ||
                  calculateHomaIr(
                    activeExam.fastingGlucoseMgDl,
                    activeExam.fastingInsulinUiuMl
                  )) && (
                  <View style={styles.homaBadge}>
                    <Droplets size={13} color={obsidianTheme.statusNormal} />
                    <Text style={styles.homaBadgeText}>
                      HOMA-IR:{' '}
                      {(
                        activeExam.homaIr ??
                        calculateHomaIr(
                          activeExam.fastingGlucoseMgDl,
                          activeExam.fastingInsulinUiuMl
                        )
                      )?.toFixed(2)}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {/* Horizontal Date Chips + Discrete Trash Icon when exams exist */}
            {labExams.length > 0 && (
              <View style={styles.examHistorySelectorRow}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.examChipsScroll}
                >
                  {labExams.map((entry) => {
                    const isSelected = activeExam?.id === entry.id;
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        activeOpacity={0.85}
                        style={[
                          styles.examDateChip,
                          isSelected && styles.examDateChipActive,
                        ]}
                        onPress={() => setSelectedExamId(entry.id)}
                      >
                        <Text
                          style={[
                            styles.examDateChipText,
                            isSelected && styles.examDateChipTextActive,
                          ]}
                        >
                          {formatExamDate(entry.timestamp)} · {entry.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <View style={styles.examActionsRight}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.editCurrentExamBtn}
                    onPress={() => handleOpenForm(true)}
                  >
                    <Text style={styles.editCurrentExamBtnText}>Editar</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.deleteExamIconBtn}
                    onPress={handleDeleteCurrentExam}
                  >
                    <Trash2 size={15} color={obsidianTheme.statusAlert} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Registration Form Drawer (when toggled open) */}
          {showExamForm && (
            <View style={styles.formCard}>
              <Text style={styles.formSectionTitle}>
                Registrar / Atualizar Exame de Sangue
              </Text>
              <Text style={styles.formSectionSubtitle}>
                Preencha apenas os marcadores disponíveis no seu laudo. O Coach IA usará esses dados na prescrição.
              </Text>

              {/* Import & Paste Actions inside Registration Form */}
              <View style={styles.formImportRow}>
                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.formImportBtn}
                  onPress={() => handleImportFromPhoto('camera')}
                  disabled={importingFile}
                >
                  <Camera size={13} color={obsidianTheme.accent} />
                  <Text style={styles.formImportBtnText}>📷 Câmera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.formImportBtn}
                  onPress={() => handleImportFromPhoto('gallery')}
                  disabled={importingFile}
                >
                  <ImageIcon size={13} color={obsidianTheme.statusNormal} />
                  <Text style={styles.formImportBtnText}>🖼️ Galeria</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={styles.formImportBtn}
                  onPress={handleImportFromPdf}
                  disabled={importingFile}
                >
                  <FileText size={13} color={obsidianTheme.statusAttention} />
                  <Text style={styles.formImportBtnText}>📄 PDF</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  activeOpacity={0.85}
                  style={[
                    styles.formImportBtn,
                    showPasteTextBox && styles.formImportBtnActive,
                  ]}
                  onPress={() => setShowPasteTextBox((prev) => !prev)}
                >
                  <ClipboardPaste size={13} color={obsidianTheme.accent} />
                  <Text style={styles.formImportBtnText}>📋 Colar Texto</Text>
                </TouchableOpacity>
              </View>

              {/* Paste Lab Text Box */}
              {showPasteTextBox && (
                <View style={styles.pasteTextCard}>
                  <Text style={styles.inputLabel}>
                    Cole abaixo o texto copiado do PDF ou laudo online:
                  </Text>
                  <TextInput
                    style={[styles.textInput, styles.pasteTextInput]}
                    value={pastedLabText}
                    onChangeText={setPastedLabText}
                    placeholder="Ex: Glicose: 88 mg/dL, Insulina: 6,2 uUI/mL, Colesterol Total: 175 mg/dL, HDL: 58..."
                    placeholderTextColor={obsidianTheme.textMuted}
                    multiline
                  />
                  <TouchableOpacity
                    activeOpacity={0.85}
                    style={styles.extractPastedBtn}
                    onPress={handleExtractFromPastedText}
                  >
                    <Sparkles size={14} color="#052E16" />
                    <Text style={styles.extractPastedBtnText}>
                      Extrair Valores Automaticamente
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Import Status Banner */}
              {importStatusMsg.trim().length > 0 && (
                <View style={styles.importStatusBanner}>
                  <Sparkles size={15} color={obsidianTheme.accent} />
                  <Text style={styles.importStatusBannerText}>
                    {importStatusMsg}
                  </Text>
                </View>
              )}

              {/* Attachment Preview inside Registration Form */}
              {attachmentUri && (
                <View style={styles.attachmentPreviewCard}>
                  <View style={styles.attachmentPreviewHeader}>
                    <Text style={styles.attachmentPreviewTitle} numberOfLines={1}>
                      {attachmentType === 'photo'
                        ? `📷 Foto Anexada: ${attachmentName || 'Imagem do Exame'}`
                        : `📄 ${attachmentName || 'Laudo.pdf'}`}
                    </Text>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      style={styles.removeAttachmentBtn}
                      onPress={() => {
                        setAttachmentUri(undefined);
                        setAttachmentType(undefined);
                        setAttachmentName(undefined);
                      }}
                    >
                      <X size={13} color={obsidianTheme.statusAlert} />
                      <Text style={styles.removeAttachmentBtnText}>Remover</Text>
                    </TouchableOpacity>
                  </View>

                  {attachmentType === 'photo' && (
                    <Image
                      source={{ uri: attachmentUri }}
                      style={{ width: '100%', height: 180, borderRadius: 12 }}
                      resizeMode="contain"
                    />
                  )}
                </View>
              )}

              <View style={styles.formMetaRow}>
                <View style={styles.formMetaColWide}>
                  <Text style={styles.inputLabel}>Laboratório / Identificação</Text>
                  <TextInput
                    style={styles.textInput}
                    value={examLabelInput}
                    onChangeText={setExamLabelInput}
                    placeholder="Ex: Fleury Check-up"
                    placeholderTextColor={obsidianTheme.textMuted}
                  />
                </View>

                <View style={styles.formMetaColNarrow}>
                  <Text style={styles.inputLabel}>Data (AAAA-MM-DD)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={examDateInput}
                    onChangeText={setExamDateInput}
                    placeholder="2026-10-26"
                    placeholderTextColor={obsidianTheme.textMuted}
                  />
                </View>
              </View>

              {/* Category Pills in Registration Form */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryPillsRow}
              >
                {BIOMARKER_CATEGORIES.map((cat) => {
                  const isSelected = activeFormCategory === cat.key;
                  const shortCatLabel =
                    cat.key === 'lipid'
                      ? 'Perfil Lipídico'
                      : cat.key === 'vitamins_organs'
                      ? 'Vitaminas & Órgãos'
                      : cat.label;

                  return (
                    <TouchableOpacity
                      key={cat.key}
                      activeOpacity={0.85}
                      style={[
                        styles.categoryPill,
                        isSelected && {
                          backgroundColor: obsidianTheme.surfaceElevated,
                          borderColor: obsidianTheme.accent,
                        },
                      ]}
                      onPress={() => setActiveFormCategory(cat.key)}
                    >
                      <View
                        style={[
                          styles.categoryDot,
                          { backgroundColor: cat.color },
                        ]}
                      />
                      <Text
                        style={[
                          styles.categoryPillText,
                          isSelected && {
                            color: obsidianTheme.textPrimary,
                            fontWeight: '700',
                          },
                        ]}
                      >
                        {shortCatLabel}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Live HOMA-IR Preview Card when Glucose & Insulin are typed */}
              {liveHomaIrPreview !== undefined && (
                <View style={styles.liveHomaCard}>
                  <View style={styles.liveHomaLeft}>
                    <Sparkles size={15} color={obsidianTheme.accent} />
                    <View>
                      <Text style={styles.liveHomaTitle}>
                        HOMA-IR Calculado Automaticamente
                      </Text>
                      <Text style={styles.liveHomaSub}>
                        {liveHomaIrPreview <= 2.1
                          ? 'Sensibilidade insulínica ideal (≤ 2.1)'
                          : 'Atenção: sugere resistência insulínica (> 2.1)'}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.liveHomaValue,
                      {
                        color:
                          liveHomaIrPreview <= 2.1
                            ? obsidianTheme.statusOptimal
                            : obsidianTheme.statusAttention,
                      },
                    ]}
                  >
                    {liveHomaIrPreview.toFixed(2)}
                  </Text>
                </View>
              )}

              {/* Biomarker Inputs for Selected Category */}
              <View style={styles.formInputsGrid}>
                {LAB_BIOMARKERS_GUIDE.filter(
                  (g) => g.category === activeFormCategory
                ).map((guide) => {
                  const minIdeal =
                    profile.sex === 'female'
                      ? guide.minIdealFemale
                      : guide.minIdealMale;
                  const maxIdeal =
                    profile.sex === 'female'
                      ? guide.maxIdealFemale
                      : guide.maxIdealMale;

                  return (
                    <View key={guide.key} style={styles.biomarkerInputCell}>
                      <View style={styles.biomarkerInputHeader}>
                        <Text style={styles.biomarkerInputLabel} numberOfLines={1}>
                          {guide.shortLabel}
                        </Text>
                        <Text style={styles.biomarkerInputRef}>
                          Ref: {minIdeal}–{maxIdeal} {guide.unit}
                        </Text>
                      </View>
                      <View style={styles.biomarkerInputBox}>
                        <TextInput
                          style={styles.biomarkerTextInput}
                          keyboardType="decimal-pad"
                          value={biomarkerInputs[guide.key] ?? ''}
                          onChangeText={(txt) =>
                            handleUpdateBiomarkerInput(guide.key, txt)
                          }
                          placeholder={guide.placeholder}
                          placeholderTextColor={obsidianTheme.textMuted}
                        />
                        {guide.unit ? (
                          <Text style={styles.biomarkerUnitTag}>{guide.unit}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Custom Notes */}
              <View style={styles.notesContainer}>
                <Text style={styles.inputLabel}>
                  Observações Clínicas / Outros Marcadores (Opcional)
                </Text>
                <TextInput
                  style={[styles.textInput, styles.notesInput]}
                  value={examNotesInput}
                  onChangeText={setExamNotesInput}
                  placeholder="Ex: Vitamina C, Estradiol, DHT, Hemograma completo normal..."
                  placeholderTextColor={obsidianTheme.textMuted}
                  multiline
                />
              </View>

              <TouchableOpacity
                activeOpacity={0.88}
                style={styles.saveExamPrimaryBtn}
                onPress={handleSaveExamSubmit}
                disabled={savingExam}
              >
                {savingExam ? (
                  <ActivityIndicator size="small" color="#052E16" />
                ) : (
                  <>
                    <CheckCircle2 size={16} color="#052E16" />
                    <Text style={styles.saveExamPrimaryBtnText}>
                      Salvar Laudo Laboratorial
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Filter Bar: Toggle Filled vs All 19 Biomarkers */}
          <View style={styles.filterHeaderBar}>
            <Text style={styles.filterHeaderLabel}>
              MAPA CLÍNICO DE BIOMARCADORES
            </Text>

            <TouchableOpacity
              activeOpacity={0.85}
              style={styles.filterTogglePill}
              onPress={() =>
                setShowOnlyFilledBiomarkers((prev) => !prev)
              }
            >
              <Text style={styles.filterToggleText}>
                {showOnlyFilledBiomarkers
                  ? 'Mostrar todos os 19'
                  : 'Mostrar apenas preenchidos'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Biomarker List Grouped by Category with Horizontal Clinical Range Bar + Tap-to-Expand */}
          {BIOMARKER_CATEGORIES.map((category) => {
            const categoryGuides = LAB_BIOMARKERS_GUIDE.filter((g) => {
              if (g.category !== category.key) return false;
              if (!showOnlyFilledBiomarkers) return true;
              const rawVal =
                g.key === 'homaIr'
                  ? activeExam?.homaIr ??
                    calculateHomaIr(
                      activeExam?.fastingGlucoseMgDl,
                      activeExam?.fastingInsulinUiuMl
                    )
                  : activeExam?.[g.key];
              return typeof rawVal === 'number' && !isNaN(rawVal) && rawVal > 0;
            });

            if (categoryGuides.length === 0) {
              return null;
            }

            return (
              <View key={category.key} style={styles.clinicalSectionBlock}>
                <View style={styles.categorySectionHeader}>
                  <View
                    style={[
                      styles.categoryDot,
                      { backgroundColor: category.color },
                    ]}
                  />
                  <Text style={styles.sectionHeaderTitle}>
                    {category.label.toUpperCase()}
                  </Text>
                </View>

                <View style={styles.cardsStack}>
                  {categoryGuides.map((guide: BiomarkerGuide) => {
                    const sex = profile.sex || 'male';
                    const minIdeal =
                      sex === 'male' ? guide.minIdealMale : guide.minIdealFemale;
                    const maxIdeal =
                      sex === 'male' ? guide.maxIdealMale : guide.maxIdealFemale;

                    const rawValue =
                      guide.key === 'homaIr'
                        ? activeExam?.homaIr ??
                          calculateHomaIr(
                            activeExam?.fastingGlucoseMgDl,
                            activeExam?.fastingInsulinUiuMl
                          )
                        : activeExam?.[guide.key];

                    const hasValue =
                      typeof rawValue === 'number' &&
                      !isNaN(rawValue) &&
                      rawValue > 0;

                    const evaluation = hasValue
                      ? evaluateBiomarker(guide.key, rawValue, sex)
                      : null;

                    const geometry = computeBiomarkerBarGeometry(
                      rawValue,
                      minIdeal,
                      maxIdeal
                    );

                    const badgeColor = evaluation
                      ? evaluation.status === 'optimal'
                        ? obsidianTheme.statusOptimal
                        : evaluation.status === 'low'
                        ? obsidianTheme.statusAttention
                        : obsidianTheme.statusAlert
                      : obsidianTheme.textMuted;

                    const badgeBg = evaluation
                      ? evaluation.status === 'optimal'
                        ? obsidianTheme.statusOptimalBg
                        : evaluation.status === 'low'
                        ? obsidianTheme.statusAttentionBg
                        : obsidianTheme.statusAlertBg
                      : obsidianTheme.surfaceElevated;

                    const isExpanded = expandedBiomarkerKey === guide.key;
                    const normalMin = Number((minIdeal * 0.88).toFixed(1));
                    const normalMax = Number((maxIdeal * 1.12).toFixed(1));

                    return (
                      <TouchableOpacity
                        key={guide.key}
                        activeOpacity={0.88}
                        style={[
                          styles.metricCard,
                          isExpanded && styles.metricCardExpanded,
                          !hasValue && styles.metricCardUnfilled,
                        ]}
                        onPress={() =>
                          setExpandedBiomarkerKey(
                            isExpanded ? null : guide.key
                          )
                        }
                      >
                        <View style={styles.metricTopRow}>
                          <View style={styles.metricTitleArea}>
                            <Text style={styles.metricLabel}>{guide.label}</Text>
                            <Text
                              style={[
                                styles.metricFormattedValue,
                                !hasValue && styles.metricFormattedValueMuted,
                              ]}
                            >
                              {hasValue
                                ? `${rawValue} ${guide.unit}`.trim()
                                : 'Não registrado'}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.statusBadge,
                              {
                                backgroundColor: badgeBg,
                                borderColor: hasValue
                                  ? `${badgeColor}45`
                                  : obsidianTheme.border,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.statusDot,
                                { backgroundColor: badgeColor },
                              ]}
                            />
                            <Text
                              style={[
                                styles.statusBadgeText,
                                { color: badgeColor },
                              ]}
                            >
                              {evaluation ? evaluation.statusLabel : 'Pendente'}
                            </Text>
                          </View>
                        </View>

                        {/* Sleek Horizontal Clinical Range Bar */}
                        <View style={styles.rangeBarContainer}>
                          <View style={styles.rangeTrack}>
                            <View
                              style={[
                                styles.rangeIdealZone,
                                {
                                  left: `${geometry.idealZoneStartPercent}%`,
                                  width: `${Math.max(
                                    8,
                                    geometry.idealZoneEndPercent -
                                      geometry.idealZoneStartPercent
                                  )}%`,
                                },
                              ]}
                            />
                            {hasValue && (
                              <View
                                style={[
                                  styles.rangeMarker,
                                  {
                                    left: `${geometry.barPositionPercent}%`,
                                    backgroundColor: badgeColor,
                                    shadowColor: badgeColor,
                                  },
                                ]}
                              />
                            )}
                          </View>

                          <View style={styles.rangeFooterRow}>
                            <Text style={styles.rangeIdealCaption}>
                              Faixa de referência ideal:{' '}
                              <Text style={styles.rangeIdealCaptionStrong}>
                                {minIdeal} – {maxIdeal} {guide.unit}
                              </Text>
                            </Text>

                            <View style={styles.expandHintWrap}>
                              <Text style={styles.expandHintText}>
                                {isExpanded ? 'Ocultar' : 'Toque para detalhes'}
                              </Text>
                              {isExpanded ? (
                                <ChevronUp
                                  size={13}
                                  color={obsidianTheme.textSecondary}
                                />
                              ) : (
                                <ChevronDown
                                  size={13}
                                  color={obsidianTheme.textMuted}
                                />
                              )}
                            </View>
                          </View>
                        </View>

                        {/* Tap-to-Expand Drawer: clinicalMeaning, coachImpact, reference ranges */}
                        {isExpanded && (
                          <View style={styles.detailDrawer}>
                            <View style={styles.detailBlock}>
                              <View style={styles.detailTitleRow}>
                                <Info size={13} color={obsidianTheme.statusNormal} />
                                <Text style={styles.detailBlockTitle}>
                                  Significado Clínico
                                </Text>
                              </View>
                              <Text style={styles.detailBlockBody}>
                                {BIOMARKER_CLINICAL_MEANING[guide.key]}
                              </Text>
                            </View>

                            <View style={styles.detailDivider} />

                            <View style={styles.detailBlock}>
                              <View style={styles.detailTitleRow}>
                                <Sparkles size={13} color={obsidianTheme.accent} />
                                <Text
                                  style={[
                                    styles.detailBlockTitle,
                                    { color: obsidianTheme.accent },
                                  ]}
                                >
                                  Impacto no Treino & Conduta do Coach
                                </Text>
                              </View>
                              <Text style={styles.detailBlockBody}>
                                {evaluation
                                  ? evaluation.clinicalTip
                                  : `Se baixo: ${guide.lowImpactTip} | Se elevado: ${guide.highImpactTip}`}
                              </Text>
                            </View>

                            <View style={styles.detailDivider} />

                            <View style={styles.referenceComparisonRow}>
                              <Text style={styles.referenceComparisonText}>
                                Ideal:{' '}
                                <Text style={styles.referenceComparisonStrong}>
                                  {minIdeal} – {maxIdeal} {guide.unit}
                                </Text>
                                {'   |   '}
                                Normal Laboratorial:{' '}
                                <Text style={styles.referenceComparisonStrong}>
                                  {normalMin} – {normalMax} {guide.unit}
                                </Text>
                              </Text>
                            </View>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: obsidianTheme.bg,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 110,
    gap: 18,
  },
  segmentedWrapper: {
    flexDirection: 'row',
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 4,
    gap: 6,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: obsidianTheme.radiusSm,
    gap: 7,
  },
  segmentButtonActive: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
  },
  segmentButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: obsidianTheme.textSecondary,
  },
  segmentButtonTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '700',
  },
  segmentCountBadge: {
    backgroundColor: obsidianTheme.accentSoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
  },
  segmentCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: obsidianTheme.accent,
  },
  viewSection: {
    gap: 20,
  },
  executiveBanner: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 16,
    gap: 14,
  },
  executiveHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  executiveTitleCol: {
    flex: 1,
    gap: 2,
  },
  executiveOverline: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: obsidianTheme.accent,
    textTransform: 'uppercase',
  },
  executiveTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: obsidianTheme.textPrimary,
  },
  weightPill: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: obsidianTheme.radiusSm,
  },
  weightPillValue: {
    fontSize: 14,
    fontWeight: '800',
    color: obsidianTheme.textPrimary,
  },
  kpiSummaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  kpiBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
  },
  kpiBoxOptimal: {
    backgroundColor: obsidianTheme.statusOptimalBg,
    borderColor: 'rgba(16, 185, 129, 0.28)',
  },
  kpiBoxAttention: {
    backgroundColor: obsidianTheme.statusAttentionBg,
    borderColor: 'rgba(245, 158, 11, 0.28)',
  },
  kpiBoxNeutral: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderColor: obsidianTheme.border,
  },
  kpiNumberOptimal: {
    fontSize: 16,
    fontWeight: '800',
    color: obsidianTheme.statusOptimal,
  },
  kpiNumberAttention: {
    fontSize: 16,
    fontWeight: '800',
    color: obsidianTheme.statusAttention,
  },
  kpiCaption: {
    fontSize: 11,
    color: obsidianTheme.textSecondary,
    fontWeight: '500',
  },
  recoveryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: obsidianTheme.surfaceElevated,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    paddingVertical: 9,
    paddingHorizontal: 12,
    gap: 8,
  },
  recoveryMetricsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  recoveryMetricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  recoveryMetricValue: {
    fontSize: 12,
    fontWeight: '700',
    color: obsidianTheme.textPrimary,
  },
  recoveryMetricLabel: {
    fontSize: 11,
    color: obsidianTheme.textMuted,
  },
  recoveryDivider: {
    width: 1,
    height: 14,
    backgroundColor: obsidianTheme.borderHighlight,
  },
  syncMiniButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: obsidianTheme.accentSoft,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: obsidianTheme.radiusSm,
  },
  syncMiniButtonText: {
    fontSize: 11,
    fontWeight: '700',
    color: obsidianTheme.accent,
  },
  clinicalSectionBlock: {
    gap: 10,
  },
  sectionHeaderRow: {
    paddingHorizontal: 2,
    gap: 2,
  },
  categorySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 2,
  },
  sectionHeaderTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    color: obsidianTheme.textSecondary,
  },
  sectionHeaderSubtitle: {
    fontSize: 12,
    color: obsidianTheme.textMuted,
  },
  cardsStack: {
    gap: 10,
  },
  metricCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 14,
    gap: 12,
  },
  metricCardExpanded: {
    borderColor: obsidianTheme.borderHighlight,
    backgroundColor: '#141722',
  },
  metricCardUnfilled: {
    opacity: 0.78,
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  metricTitleArea: {
    flex: 1,
    gap: 3,
  },
  metricLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: obsidianTheme.textSecondary,
  },
  metricValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  metricFormattedValue: {
    fontSize: 18,
    fontWeight: '800',
    color: obsidianTheme.textPrimary,
  },
  metricFormattedValueMuted: {
    fontSize: 14,
    fontWeight: '600',
    color: obsidianTheme.textMuted,
  },
  metricDeltaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  rangeBarContainer: {
    gap: 7,
  },
  rangeTrack: {
    height: 6,
    backgroundColor: '#181B26',
    borderRadius: 999,
    position: 'relative',
    justifyContent: 'center',
    overflow: 'visible',
  },
  rangeIdealZone: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
    borderRadius: 999,
  },
  rangeMarker: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: -6,
    borderWidth: 2,
    borderColor: obsidianTheme.bg,
    elevation: 3,
  },
  rangeFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rangeIdealCaption: {
    fontSize: 11,
    color: obsidianTheme.textMuted,
    flex: 1,
  },
  rangeIdealCaptionStrong: {
    color: obsidianTheme.textSecondary,
    fontWeight: '600',
  },
  expandHintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  expandHintText: {
    fontSize: 11,
    color: obsidianTheme.textMuted,
    fontWeight: '500',
  },
  detailDrawer: {
    marginTop: 2,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
    gap: 10,
  },
  detailBlock: {
    gap: 4,
  },
  detailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailBlockTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: obsidianTheme.statusNormal,
  },
  detailBlockBody: {
    fontSize: 12.5,
    lineHeight: 18,
    color: obsidianTheme.textSecondary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: obsidianTheme.border,
  },
  referenceComparisonRow: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderRadius: obsidianTheme.radiusSm,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  referenceComparisonText: {
    fontSize: 11,
    color: obsidianTheme.textMuted,
  },
  referenceComparisonStrong: {
    color: obsidianTheme.textPrimary,
    fontWeight: '700',
  },
  examHeaderCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 16,
    gap: 14,
  },
  examHeaderTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  examTitleCol: {
    flex: 1,
    gap: 3,
  },
  examDateSubtext: {
    fontSize: 12,
    color: obsidianTheme.textSecondary,
  },
  registerExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: obsidianTheme.accent,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: obsidianTheme.radiusSm,
  },
  registerExamBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#052E16',
  },
  registerExamBtnCancel: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
  },
  registerExamBtnCancelText: {
    fontSize: 12,
    fontWeight: '700',
    color: obsidianTheme.textPrimary,
  },
  examSummaryPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  examStatBadgeOptimal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: obsidianTheme.statusOptimalBg,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: obsidianTheme.radiusSm,
  },
  examStatBadgeTextOptimal: {
    fontSize: 12,
    fontWeight: '700',
    color: obsidianTheme.statusOptimal,
  },
  examStatBadgeAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: obsidianTheme.statusAttentionBg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: obsidianTheme.radiusSm,
  },
  examStatBadgeTextAlert: {
    fontSize: 12,
    fontWeight: '700',
    color: obsidianTheme.statusAttention,
  },
  homaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: obsidianTheme.statusNormalBg,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: obsidianTheme.radiusSm,
  },
  homaBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: obsidianTheme.statusNormal,
  },
  examHistorySelectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
  },
  examChipsScroll: {
    gap: 8,
    paddingRight: 8,
  },
  examDateChip: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  examDateChipActive: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accentBorder,
  },
  examDateChipText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: obsidianTheme.textSecondary,
  },
  examDateChipTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '700',
  },
  examActionsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editCurrentExamBtn: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: obsidianTheme.radiusSm,
  },
  editCurrentExamBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: obsidianTheme.textSecondary,
  },
  deleteExamIconBtn: {
    backgroundColor: obsidianTheme.statusAlertBg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    padding: 7,
    borderRadius: obsidianTheme.radiusSm,
  },
  formCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    padding: 16,
    gap: 14,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: obsidianTheme.textPrimary,
  },
  formSectionSubtitle: {
    fontSize: 12,
    color: obsidianTheme.textSecondary,
    marginTop: -8,
  },
  formMetaRow: {
    flexDirection: 'row',
    gap: 10,
  },
  formMetaColWide: {
    flex: 1.4,
    gap: 5,
  },
  formMetaColNarrow: {
    flex: 1,
    gap: 5,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: obsidianTheme.textSecondary,
  },
  textInput: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    borderRadius: obsidianTheme.radiusSm,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 13,
    color: obsidianTheme.textPrimary,
  },
  categoryPillsRow: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  categoryDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: obsidianTheme.textSecondary,
  },
  liveHomaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    borderRadius: obsidianTheme.radiusMd,
    padding: 12,
    gap: 10,
  },
  liveHomaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    flex: 1,
  },
  liveHomaTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: obsidianTheme.textPrimary,
  },
  liveHomaSub: {
    fontSize: 11,
    color: obsidianTheme.textSecondary,
  },
  liveHomaValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  formInputsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  biomarkerInputCell: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    borderRadius: obsidianTheme.radiusSm,
    padding: 10,
    gap: 6,
  },
  biomarkerInputHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
  },
  biomarkerInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: obsidianTheme.textPrimary,
    flex: 1,
  },
  biomarkerInputRef: {
    fontSize: 10,
    color: obsidianTheme.textMuted,
  },
  biomarkerInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: obsidianTheme.bg,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    paddingHorizontal: 9,
  },
  biomarkerTextInput: {
    flex: 1,
    paddingVertical: 7,
    fontSize: 14,
    fontWeight: '700',
    color: obsidianTheme.textPrimary,
  },
  biomarkerUnitTag: {
    fontSize: 11,
    color: obsidianTheme.textMuted,
    fontWeight: '600',
  },
  notesContainer: {
    gap: 5,
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  saveExamPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: obsidianTheme.accent,
    paddingVertical: 12,
    borderRadius: obsidianTheme.radiusMd,
  },
  saveExamPrimaryBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#052E16',
  },
  filterHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  filterHeaderLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    color: obsidianTheme.textMuted,
  },
  filterTogglePill: {
    backgroundColor: obsidianTheme.surface,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  filterToggleText: {
    fontSize: 11,
    fontWeight: '600',
    color: obsidianTheme.accent,
  },
  importActionBox: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
    borderRadius: obsidianTheme.radiusMd,
    padding: 12,
    gap: 9,
  },
  importActionOverline: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    color: obsidianTheme.textSecondary,
    textTransform: 'uppercase',
  },
  importButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  importActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: obsidianTheme.radiusSm,
  },
  importActionButtonText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: obsidianTheme.textPrimary,
  },
  importLoadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: obsidianTheme.accentSoft,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    borderRadius: obsidianTheme.radiusSm,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  importLoadingText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: obsidianTheme.accent,
    flex: 1,
  },
  activeAttachmentBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    borderRadius: obsidianTheme.radiusSm,
    padding: 10,
  },
  activeAttachmentThumb: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: obsidianTheme.bg,
  },
  activeAttachmentInfo: {
    flex: 1,
    gap: 2,
  },
  activeAttachmentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: obsidianTheme.textPrimary,
  },
  activeAttachmentSub: {
    fontSize: 11,
    color: obsidianTheme.textSecondary,
  },
  formImportRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  formImportBtn: {
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
    paddingVertical: 8,
    paddingHorizontal: 9,
    borderRadius: obsidianTheme.radiusSm,
  },
  formImportBtnActive: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accent,
  },
  formImportBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: obsidianTheme.textPrimary,
  },
  pasteTextCard: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    borderRadius: obsidianTheme.radiusMd,
    padding: 12,
    gap: 9,
  },
  pasteTextInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: obsidianTheme.bg,
  },
  extractPastedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: obsidianTheme.accent,
    paddingVertical: 9,
    borderRadius: obsidianTheme.radiusSm,
  },
  extractPastedBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#052E16',
  },
  importStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: obsidianTheme.accentSoft,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    borderRadius: obsidianTheme.radiusSm,
    padding: 10,
  },
  importStatusBannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '600',
    color: obsidianTheme.textPrimary,
  },
  attachmentPreviewCard: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
    borderRadius: obsidianTheme.radiusMd,
    padding: 11,
    gap: 10,
  },
  attachmentPreviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  attachmentPreviewTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    color: obsidianTheme.textPrimary,
  },
  removeAttachmentBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: obsidianTheme.statusAlertBg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  removeAttachmentBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: obsidianTheme.statusAlert,
  },
});
export default HealthAndExamsView;
