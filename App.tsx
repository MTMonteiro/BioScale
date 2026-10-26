import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
} from 'react-native';
import {
  Bluetooth,
  Activity,
  Sparkles,
  Settings,
  Flame,
  Dumbbell,
  HeartPulse,
  Footprints,
  Moon,
  RefreshCw,
  Scale,
  Ruler,
  Trash2,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react-native';
import {
  BioimpedanceMetrics,
  BodyMeasurementsEntry,
  BodyPartKey,
  DayPeriod,
  DayPeriodFilter,
  LabExamEntry,
  SamsungHealthSummary,
  StructuredCoachPlan,
  UserProfile,
} from './src/types/health';
import {
  calculateBioimpedance,
  DAY_PERIOD_INFO,
  filterMeasurementsByPeriod,
  getBmiCategory,
  resolveMeasurementPeriod,
} from './src/utils/bioimpedance';
import { BODY_PARTS_GUIDE } from './src/utils/bodyMeasurements';
import { requestBlePermissions, startScaleBleScan } from './src/services/bleScanner';
import { syncWithSamsungHealth } from './src/services/samsungHealthService';
import {
  loadMeasurements,
  addMeasurement,
  deleteMeasurement,
  updateMeasurementPeriod,
  loadProfile,
  saveProfile,
  loadBodyMeasurementsHistory,
  saveBodyMeasurementsEntry,
  loadLabExamsHistory,
  saveLabExamEntry,
  deleteLabExamEntry,
  DEFAULT_PROFILE,
} from './src/services/storageAndCloud';
import {
  computeBioHealthScore,
  generateAiHealthCoachAnalysis,
} from './src/services/aiCoachService';
import { TrendChart } from './src/components/TrendChart';
import { EvolutionAndCompareView } from './src/components/EvolutionAndCompareView';
import { AiCoachHubView } from './src/components/AiCoachHubView';
import { HealthAndExamsView } from './src/components/HealthAndExamsView';
import { ScaleScannerModal } from './src/components/ScaleScannerModal';
import { SettingsModal } from './src/components/SettingsModal';
import { obsidianTheme } from './src/theme/obsidianTheme';

type MainTab = 'home' | 'body' | 'health' | 'coach';

export default function App() {
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [scannerModalVisible, setScannerModalVisible] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);

  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [history, setHistory] = useState<BioimpedanceMetrics[]>([]);
  const [samsungHealth, setSamsungHealth] = useState<SamsungHealthSummary>({
    stepsToday: 8420,
    caloriesBurnedToday: 2180,
    sleepHoursLastNight: 7.4,
    lastSyncedAt: 'Agora',
    isConnected: true,
  });

  // Estados das Medidas Corporais + Avatar Paramétrico
  const [bodyHistory, setBodyHistory] = useState<BodyMeasurementsEntry[]>([]);
  const [selectedPart, setSelectedPart] = useState<BodyPartKey>('waistCm');
  const [draftBody, setDraftBody] = useState<{
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
  }>({
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
  });
  const [bodySaveFeedback, setBodySaveFeedback] = useState<string>('');

  // Estados do Scanner Bluetooth / Balança Wellmix
  const [isScanning, setIsScanning] = useState(false);
  const [liveWeight, setLiveWeight] = useState<number | null>(null);
  const [liveImpedance, setLiveImpedance] = useState<number | null>(null);
  const [bleStatusMsg, setBleStatusMsg] = useState<string>(
    'Pronto para conectar à balança Wellmix BLE'
  );
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<DayPeriodFilter>('all');
  const [scannerPeriodChoice, setScannerPeriodChoice] = useState<'auto' | DayPeriod>(
    'auto'
  );
  const [webConfirmDeleteId, setWebConfirmDeleteId] = useState<string | null>(null);

  // Estados do AI Coach & Exames Laboratoriais
  const [labExams, setLabExams] = useState<LabExamEntry[]>([]);
  const [coachPlan, setCoachPlan] = useState<StructuredCoachPlan | null>(null);
  const [streamingPreview, setStreamingPreview] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [syncingHealth, setSyncingHealth] = useState<boolean>(false);

  useEffect(() => {
    (async () => {
      const loadedProf = await loadProfile();
      setProfile(loadedProf);
      const loadedHist = await loadMeasurements(loadedProf);
      setHistory(loadedHist);
      const loadedBody = await loadBodyMeasurementsHistory(loadedProf);
      setBodyHistory(loadedBody);
      if (loadedBody.length > 0) {
        const lastB = loadedBody[loadedBody.length - 1];
        setDraftBody({
          neckCm: lastB.neckCm,
          shouldersCm: lastB.shouldersCm,
          chestCm: lastB.chestCm,
          bicepsCm: lastB.bicepsCm,
          forearmCm: lastB.forearmCm,
          waistCm: lastB.waistCm,
          abdomenCm: lastB.abdomenCm,
          hipsCm: lastB.hipsCm,
          thighCm: lastB.thighCm,
          calfCm: lastB.calfCm,
        });
      }
      const loadedExams = await loadLabExamsHistory();
      setLabExams(loadedExams);
      const healthData = await syncWithSamsungHealth();
      setSamsungHealth(healthData);

      const initialPlan = await generateAiHealthCoachAnalysis(
        loadedHist,
        healthData,
        { ...loadedProf, aiProvider: 'local' },
        loadedBody,
        loadedExams
      );
      setCoachPlan(initialPlan);
    })();
  }, []);

  const latest = history.length > 0 ? history[history.length - 1] : null;
  const previous = history.length > 1 ? history[history.length - 2] : undefined;

  const handleDeleteMeasurement = async (id: string) => {
    const updated = await deleteMeasurement(id, profile);
    setHistory(updated);
  };

  const handleUpdateMeasurementPeriod = async (
    id: string,
    nextPeriod: DayPeriod
  ) => {
    const updated = await updateMeasurementPeriod(id, nextPeriod, profile);
    setHistory(updated);
  };

  const handlePromptDeleteMeasurement = (item: BioimpedanceMetrics) => {
    const pInfo = DAY_PERIOD_INFO[resolveMeasurementPeriod(item)];
    const d = new Date(item.timestamp);
    const dateStr = `${String(d.getDate()).padStart(2, '0')}/${String(
      d.getMonth() + 1
    ).padStart(2, '0')}`;

    if (Platform.OS === 'web') {
      if (webConfirmDeleteId === item.id) {
        handleDeleteMeasurement(item.id);
        setWebConfirmDeleteId(null);
      } else {
        setWebConfirmDeleteId(item.id);
      }
      return;
    }

    Alert.alert(
      'Excluir Registro',
      `Deseja remover a pesagem de ${item.weightKg} kg (${dateStr} • ${pInfo.icon} ${pInfo.label})?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () => handleDeleteMeasurement(item.id),
        },
      ]
    );
  };

  const handleSyncSamsungHealth = async (measurementToWrite?: BioimpedanceMetrics) => {
    setSyncingHealth(true);
    const res = await syncWithSamsungHealth(measurementToWrite || latest || undefined);
    setSamsungHealth(res);
    setSyncingHealth(false);
  };

  const handleToggleBleScan = async () => {
    if (isScanning) {
      setIsScanning(false);
      setBleStatusMsg('Leitura Bluetooth pausada.');
      return;
    }

    const granted = await requestBlePermissions();
    if (!granted) {
      setBleStatusMsg('Permissão de Bluetooth negada no Android.');
      return;
    }

    setIsScanning(true);
    setBleStatusMsg('Suba descalço na balança... Escutando pacotes BLE (0xCA)...');

    const stopScan = startScaleBleScan({
      onReading: async (reading) => {
        setLiveWeight(reading.weightKg);
        setLiveImpedance(reading.impedanceOhm);
        setBleStatusMsg(
          `Capturado: ${reading.weightKg} kg | ${reading.impedanceOhm} Ω (${reading.protocolVersion})`
        );

        if (reading.isStabilized) {
          stopScan();
          setIsScanning(false);
          const chosenPeriod =
            scannerPeriodChoice === 'auto' ? undefined : scannerPeriodChoice;
          const metrics = calculateBioimpedance(
            reading.weightKg,
            reading.impedanceOhm,
            profile,
            chosenPeriod
          );
          const updated = await addMeasurement(metrics, profile);
          setHistory(updated);
          await handleSyncSamsungHealth(metrics);
        }
      },
      onRawPacket: (name, _mac, hex) => {
        setRawLogs((prev) => [`[${name}] ${hex}`, ...prev.slice(0, 7)]);
      },
      onError: (err) => {
        setIsScanning(false);
        setBleStatusMsg(err);
      },
    });

    setTimeout(() => {
      stopScan();
      setIsScanning(false);
    }, 25000);
  };

  const handleSimulateWellmixWeighIn = async () => {
    setIsScanning(true);
    setBleStatusMsg('Lendo anúncio BLE da balança Wellmix (0xCA)...');

    const baseWeight = latest ? latest.weightKg : 76.5;
    const simulatedWeight =
      Math.round((baseWeight + (Math.random() * 0.6 - 0.35)) * 100) / 100;
    const simulatedImpedance = Math.round(485 + (Math.random() * 24 - 12));

    const wRaw = Math.round(simulatedWeight * 100);
    const hexW = wRaw.toString(16).padStart(4, '0').toUpperCase();
    const hexI = simulatedImpedance.toString(16).padStart(4, '0').toUpperCase();
    const fakePacket = `CA 10 0E 01 ${hexW.slice(0, 2)} ${hexW.slice(2, 4)} ${hexI.slice(
      0,
      2
    )} ${hexI.slice(2, 4)} C4`;

    setRawLogs((prev) => [`[Wellmix-OKOK] ${fakePacket}`, ...prev.slice(0, 7)]);
    setLiveWeight(simulatedWeight);
    setLiveImpedance(simulatedImpedance);

    setTimeout(async () => {
      const chosenPeriod =
        scannerPeriodChoice === 'auto' ? undefined : scannerPeriodChoice;
      const metrics = calculateBioimpedance(
        simulatedWeight,
        simulatedImpedance,
        profile,
        chosenPeriod
      );
      const updated = await addMeasurement(metrics, profile);
      setHistory(updated);
      await handleSyncSamsungHealth(metrics);
      setIsScanning(false);
      const pInfo = DAY_PERIOD_INFO[resolveMeasurementPeriod(metrics)];
      setBleStatusMsg(
        `Pesagem (${pInfo.icon} ${pInfo.label}) registrada: ${metrics.weightKg} kg (${metrics.bodyFatPercent}% BF).`
      );
    }, 750);
  };

  const handleAddManualWeight = async (weightKg: number, impedanceOhms: number) => {
    const chosenPeriod =
      scannerPeriodChoice === 'auto' ? undefined : scannerPeriodChoice;
    const metrics = calculateBioimpedance(
      weightKg,
      impedanceOhms,
      profile,
      chosenPeriod
    );
    const updated = await addMeasurement(metrics, profile);
    setHistory(updated);
    setLiveWeight(weightKg);
    setLiveImpedance(impedanceOhms);
    const pInfo = DAY_PERIOD_INFO[resolveMeasurementPeriod(metrics)];
    setBleStatusMsg(
      `Registro manual (${pInfo.icon} ${pInfo.label}) salvo: ${metrics.weightKg} kg.`
    );
    await handleSyncSamsungHealth(metrics);
  };

  const handleChangeDraftMeasure = (part: BodyPartKey, delta: number) => {
    const guide = BODY_PARTS_GUIDE[part];
    const current = draftBody[part];
    const clamped =
      Math.round(Math.max(guide.minCm, Math.min(guide.maxCm, current + delta)) * 10) /
      10;
    setDraftBody((prev) => ({
      ...prev,
      [part]: clamped,
    }));
  };

  const handleSetDraftMeasureDirect = (part: BodyPartKey, value: string) => {
    const parsed = parseFloat(value.replace(',', '.'));
    if (isNaN(parsed)) return;
    const guide = BODY_PARTS_GUIDE[part];
    const clamped =
      Math.round(Math.max(guide.minCm, Math.min(guide.maxCm, parsed)) * 10) / 10;
    setDraftBody((prev) => ({
      ...prev,
      [part]: clamped,
    }));
  };

  const handleSaveBodyTapeEntry = async () => {
    const updated = await saveBodyMeasurementsEntry(draftBody, profile);
    setBodyHistory(updated);
    setBodySaveFeedback('Medidas corporais salvas no histórico.');
    setTimeout(() => setBodySaveFeedback(''), 3000);
  };

  const handleGenerateAiAnalysis = async () => {
    setLoadingAi(true);
    setStreamingPreview('');
    const res = await generateAiHealthCoachAnalysis(
      history,
      samsungHealth,
      profile,
      bodyHistory,
      labExams,
      (partial) => setStreamingPreview(partial)
    );
    setCoachPlan(res);
    setStreamingPreview('');
    setLoadingAi(false);
  };

  const handleUpdateAndSaveProfile = async (nextProf: UserProfile) => {
    setProfile(nextProf);
    await saveProfile(nextProf);
  };

  const handleSaveNewLabExam = async (
    examInput: Omit<LabExamEntry, 'id' | 'timestamp' | 'homaIr'> | LabExamEntry
  ) => {
    const updatedExams = await saveLabExamEntry(examInput, profile);
    setLabExams(updatedExams);
    const refreshedPlan = await generateAiHealthCoachAnalysis(
      history,
      samsungHealth,
      profile,
      bodyHistory,
      updatedExams
    );
    setCoachPlan(refreshedPlan);
  };

  const handleRemoveLabExam = async (id: string) => {
    const updatedExams = await deleteLabExamEntry(id, profile);
    setLabExams(updatedExams);
  };

  const renderHomeTab = () => {
    const filteredHistory = filterMeasurementsByPeriod(history, periodFilter);
    const activeLatest =
      filteredHistory.length > 0
        ? filteredHistory[filteredHistory.length - 1]
        : latest;

    if (!activeLatest) {
      return (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          <View style={styles.emptyCard}>
            <Scale size={32} color={obsidianTheme.accent} />
            <Text style={styles.emptyTitle}>Nenhuma pesagem registrada</Text>
            <Text style={styles.emptySubtitle}>
              Conecte sua balança Wellmix via Bluetooth ou simule uma leitura para iniciar seu acompanhamento biométrico.
            </Text>
            <TouchableOpacity
              style={styles.weighNowPrimaryBtn}
              onPress={() => setScannerModalVisible(true)}
            >
              <Bluetooth size={17} color="#090A0F" />
              <Text style={styles.weighNowPrimaryText}>Pesar Agora</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    const activePeriod = resolveMeasurementPeriod(activeLatest);
    const activePeriodInfo = DAY_PERIOD_INFO[activePeriod];

    const sameShiftHistory = filterMeasurementsByPeriod(history, activePeriod);
    const idxInSameShift = sameShiftHistory.findIndex((i) => i.id === activeLatest.id);
    const prevSameShift =
      idxInSameShift > 0 ? sameShiftHistory[idxInSameShift - 1] : null;
    const prevInFilter =
      filteredHistory.length > 1
        ? filteredHistory[filteredHistory.length - 2]
        : null;
    const comparisonBase =
      periodFilter === 'all' ? prevSameShift || prevInFilter : prevInFilter;

    const weightDiff = comparisonBase
      ? Math.round((activeLatest.weightKg - comparisonBase.weightKg) * 10) / 10
      : 0;
    const distToTarget =
      Math.round((activeLatest.weightKg - profile.targetWeightKg) * 10) / 10;
    const bmiCat = getBmiCategory(activeLatest.bmi);
    const bioScore = computeBioHealthScore(
      activeLatest,
      samsungHealth,
      profile,
      bodyHistory.length > 0 ? bodyHistory[bodyHistory.length - 1] : null,
      labExams.length > 0 ? labExams[labExams.length - 1] : null
    );

    const dLatest = new Date(activeLatest.timestamp);
    const formattedDate = `${String(dLatest.getDate()).padStart(2, '0')}/${String(
      dLatest.getMonth() + 1
    ).padStart(2, '0')} às ${String(dLatest.getHours()).padStart(2, '0')}:${String(
      dLatest.getMinutes()
    ).padStart(2, '0')}`;

    return (
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO CARD: PESO ATUAL + BOTÃO PESAR AGORA */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View>
              <Text style={styles.heroEyebrow}>PESO ATUAL • {formattedDate}</Text>
              <View style={styles.shiftBadge}>
                <Text style={styles.shiftBadgeText}>
                  {activePeriodInfo.icon} Turno {activePeriodInfo.label}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.weighNowPrimaryBtn}
              onPress={() => setScannerModalVisible(true)}
              activeOpacity={0.85}
            >
              <Bluetooth size={15} color="#090A0F" />
              <Text style={styles.weighNowPrimaryText}>Pesar Agora</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.heroWeightRow}>
            <Text style={styles.heroWeightValue}>
              {activeLatest.weightKg.toFixed(1)}
            </Text>
            <Text style={styles.heroWeightUnit}>kg</Text>

            <View
              style={[
                styles.deltaPill,
                {
                  backgroundColor:
                    weightDiff <= 0
                      ? obsidianTheme.statusOptimalBg
                      : obsidianTheme.statusAttentionBg,
                },
              ]}
            >
              <Text
                style={[
                  styles.deltaPillText,
                  {
                    color:
                      weightDiff <= 0
                        ? obsidianTheme.statusOptimal
                        : obsidianTheme.statusAttention,
                  },
                ]}
              >
                {weightDiff > 0 ? `+${weightDiff}` : weightDiff} kg vs anterior
              </Text>
            </View>
          </View>

          <View style={styles.heroFooterRow}>
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>META</Text>
              <Text style={styles.heroMetaValue}>
                {profile.targetWeightKg.toFixed(1)} kg (
                {distToTarget > 0 ? `faltam ${distToTarget} kg` : 'atingida'})
              </Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroMetaItem}>
              <Text style={styles.heroMetaLabel}>IMC</Text>
              <Text style={[styles.heroMetaValue, { color: bmiCat.color }]}>
                {activeLatest.bmi} • {bmiCat.label}
              </Text>
            </View>
          </View>
        </View>

        {/* 4 KPI ESSENCIAIS (2x2 BENTO GRID) */}
        <View style={styles.kpiGrid}>
          <TouchableOpacity
            style={styles.kpiCard}
            activeOpacity={0.8}
            onPress={() => setActiveTab('health')}
          >
            <View style={styles.kpiHeader}>
              <Flame size={15} color={obsidianTheme.accent} />
              <Text style={styles.kpiLabel}>GORDURA (BF%)</Text>
            </View>
            <Text style={styles.kpiValue}>{activeLatest.bodyFatPercent}%</Text>
            <Text style={styles.kpiSub}>
              {activeLatest.bodyFatPercent <= (profile.sex === 'male' ? 20 : 28)
                ? 'Faixa clínica ideal'
                : 'Acima da faixa ideal'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCard}
            activeOpacity={0.8}
            onPress={() => setActiveTab('health')}
          >
            <View style={styles.kpiHeader}>
              <Dumbbell size={15} color={obsidianTheme.accent} />
              <Text style={styles.kpiLabel}>MASSA MUSCULAR</Text>
            </View>
            <Text style={styles.kpiValue}>{activeLatest.muscleMassKg} kg</Text>
            <Text style={styles.kpiSub}>
              {Math.round((activeLatest.muscleMassKg / activeLatest.weightKg) * 100)}% do
              peso corporal
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCard}
            activeOpacity={0.8}
            onPress={() => setActiveTab('health')}
          >
            <View style={styles.kpiHeader}>
              <Activity size={15} color={obsidianTheme.accent} />
              <Text style={styles.kpiLabel}>GORDURA VISCERAL</Text>
            </View>
            <Text style={styles.kpiValue}>Nível {activeLatest.visceralFat}</Text>
            <Text style={styles.kpiSub}>
              {activeLatest.visceralFat <= 9 ? 'Baixo risco (< 10)' : 'Atenção (> 9)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.kpiCard}
            activeOpacity={0.8}
            onPress={() => setActiveTab('coach')}
          >
            <View style={styles.kpiHeader}>
              <ShieldCheck size={15} color={obsidianTheme.accent} />
              <Text style={styles.kpiLabel}>BIO SCORE IA</Text>
            </View>
            <Text style={[styles.kpiValue, { color: obsidianTheme.accent }]}>
              {bioScore}/100
            </Text>
            <Text style={styles.kpiSub}>Ver plano do Coach →</Text>
          </TouchableOpacity>
        </View>

        {/* BARRA SAMSUNG HEALTH (PASSOS, SONO, KCAL) */}
        <View style={styles.healthStripCard}>
          <View style={styles.healthStripTop}>
            <View style={styles.rowCenter}>
              <HeartPulse size={15} color={obsidianTheme.accent} />
              <Text style={styles.healthStripTitle}>SAMSUNG HEALTH</Text>
            </View>
            <TouchableOpacity
              style={styles.syncMiniBtn}
              onPress={() => handleSyncSamsungHealth()}
              disabled={syncingHealth}
            >
              {syncingHealth ? (
                <ActivityIndicator size="small" color={obsidianTheme.accent} />
              ) : (
                <>
                  <RefreshCw size={12} color={obsidianTheme.textSecondary} />
                  <Text style={styles.syncMiniText}>Sincronizar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.healthMetricsRow}>
            <View style={styles.healthMetricItem}>
              <Footprints size={14} color={obsidianTheme.textSecondary} />
              <Text style={styles.healthMetricVal}>
                {samsungHealth.stepsToday.toLocaleString()}
              </Text>
              <Text style={styles.healthMetricLbl}>passos</Text>
            </View>
            <View style={styles.healthDivider} />
            <View style={styles.healthMetricItem}>
              <Moon size={14} color={obsidianTheme.accent} />
              <Text style={styles.healthMetricVal}>
                {samsungHealth.sleepHoursLastNight}h
              </Text>
              <Text style={styles.healthMetricLbl}>sono</Text>
            </View>
            <View style={styles.healthDivider} />
            <View style={styles.healthMetricItem}>
              <Flame size={14} color={obsidianTheme.textSecondary} />
              <Text style={styles.healthMetricVal}>
                {samsungHealth.caloriesBurnedToday}
              </Text>
              <Text style={styles.healthMetricLbl}>kcal ativas</Text>
            </View>
          </View>
        </View>

        {/* SELETOR DE TURNO + GRÁFICO DE TENDÊNCIA */}
        <View style={styles.periodFilterBar}>
          {(
            [
              { key: 'all', label: 'Todos' },
              { key: 'morning', label: '🌅 Manhã' },
              { key: 'afternoon', label: '☀️ Tarde' },
              { key: 'night', label: '🌙 Noite' },
            ] as { key: DayPeriodFilter; label: string }[]
          ).map((f) => {
            const active = periodFilter === f.key;
            return (
              <TouchableOpacity
                key={f.key}
                onPress={() => setPeriodFilter(f.key)}
                style={[
                  styles.periodChip,
                  active && styles.periodChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.periodChipText,
                    active && styles.periodChipTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TrendChart
          data={filteredHistory.length > 0 ? filteredHistory : history}
          title="CURVA DE EVOLUÇÃO BIOMÉTRICA"
          color={obsidianTheme.accent}
        />

        {/* ÚLTIMAS PESAGENS RÁPIDAS */}
        <View style={styles.recentCard}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>REGISTROS RECENTES</Text>
            <TouchableOpacity
              style={styles.rowCenter}
              onPress={() => setActiveTab('body')}
            >
              <Text style={styles.seeAllText}>Gerenciar todos</Text>
              <ChevronRight size={14} color={obsidianTheme.accent} />
            </TouchableOpacity>
          </View>

          {(filteredHistory.length > 0 ? filteredHistory : history)
            .slice()
            .reverse()
            .slice(0, 5)
            .map((item) => {
              const d = new Date(item.timestamp);
              const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(
                d.getMonth() + 1
              ).padStart(2, '0')} • ${String(d.getHours()).padStart(2, '0')}:${String(
                d.getMinutes()
              ).padStart(2, '0')}`;
              const pKey = resolveMeasurementPeriod(item);
              const pInfo = DAY_PERIOD_INFO[pKey];
              const nextP: DayPeriod =
                pKey === 'morning'
                  ? 'afternoon'
                  : pKey === 'afternoon'
                  ? 'night'
                  : 'morning';

              return (
                <View key={item.id} style={styles.recentRow}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowCenter}>
                      <Text style={styles.recentWeight}>
                        {item.weightKg.toFixed(1)} kg
                      </Text>
                      <TouchableOpacity
                        style={styles.shiftMiniPill}
                        onPress={() =>
                          handleUpdateMeasurementPeriod(item.id, nextP)
                        }
                      >
                        <Text style={styles.shiftMiniText}>
                          {pInfo.icon} {pInfo.shortLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.recentMeta}>
                      {dateLabel} • {item.bodyFatPercent}% BF • {item.muscleMassKg} kg
                      músculo
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.deleteIconBtn}
                    onPress={() => handlePromptDeleteMeasurement(item)}
                  >
                    <Trash2 size={15} color={obsidianTheme.textMuted} />
                  </TouchableOpacity>
                </View>
              );
            })}
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />

      {/* CABEÇALHO SÓBRIO & MINIMALISTA */}
      <View style={styles.topHeader}>
        <View style={styles.brandRow}>
          <View style={styles.brandDot} />
          <Text style={styles.brandTitle}>BioScale</Text>
          <View style={styles.engineBadge}>
            <Text style={styles.engineBadgeText}>
              {profile.aiProvider === 'gemma_local'
                ? 'Gemma Local'
                : profile.aiProvider === 'openrouter'
                ? 'OpenRouter'
                : profile.aiProvider === 'deepseek'
                ? 'DeepSeek'
                : profile.aiProvider === 'gemini'
                ? 'Gemini'
                : 'Bio Engine'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerScaleQuickBtn}
            onPress={() => setScannerModalVisible(true)}
          >
            <Scale size={15} color={obsidianTheme.accent} />
            <Text style={styles.headerScaleQuickText}>Pesar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.settingsIconBtn}
            onPress={() => setSettingsModalVisible(true)}
          >
            <Settings size={19} color={obsidianTheme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* CONTEÚDO DA ABA ATIVA */}
      <View style={styles.contentContainer}>
        {activeTab === 'home' && renderHomeTab()}

        {activeTab === 'body' && (
          <EvolutionAndCompareView
            scaleHistory={history}
            bodyHistory={bodyHistory}
            profile={profile}
            selectedPeriodFilter={periodFilter}
            onChangePeriodFilter={setPeriodFilter}
            onDeleteMeasurement={handleDeleteMeasurement}
            onUpdateMeasurementPeriod={handleUpdateMeasurementPeriod}
            draftBody={draftBody}
            selectedPart={selectedPart}
            onSelectPart={setSelectedPart}
            onChangeDraftMeasure={handleChangeDraftMeasure}
            onSetDraftMeasureDirect={handleSetDraftMeasureDirect}
            onSaveBodyMeasurements={handleSaveBodyTapeEntry}
            bodySaveFeedback={bodySaveFeedback}
          />
        )}

        {activeTab === 'health' && latest && (
          <HealthAndExamsView
            latestMetrics={latest}
            previousMetrics={previous}
            profile={profile}
            samsungHealth={samsungHealth}
            labExams={labExams}
            onSaveLabExam={handleSaveNewLabExam}
            onDeleteLabExam={handleRemoveLabExam}
            onSyncSamsungHealth={() => handleSyncSamsungHealth()}
            syncingHealth={syncingHealth}
          />
        )}

        {activeTab === 'coach' && (
          <AiCoachHubView
            history={history}
            bodyHistory={bodyHistory}
            labExams={labExams}
            samsungHealth={samsungHealth}
            profile={profile}
            coachPlan={coachPlan}
            loadingAi={loadingAi}
            streamingPreview={streamingPreview}
            onGenerateAnalysis={handleGenerateAiAnalysis}
            onUpdateProfile={handleUpdateAndSaveProfile}
            onSaveLabExam={handleSaveNewLabExam}
            onDeleteLabExam={handleRemoveLabExam}
            onOpenSettings={() => setSettingsModalVisible(true)}
          />
        )}
      </View>

      {/* BARRA INFERIOR DE 4 ABAS (DARK OBSIDIAN MINIMALISTA) */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('home')}
        >
          <Scale
            size={20}
            color={
              activeTab === 'home'
                ? obsidianTheme.accent
                : obsidianTheme.textMuted
            }
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'home' && styles.navLabelActive,
            ]}
          >
            Início
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('body')}
        >
          <Ruler
            size={20}
            color={
              activeTab === 'body'
                ? obsidianTheme.accent
                : obsidianTheme.textMuted
            }
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'body' && styles.navLabelActive,
            ]}
          >
            Corpo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('health')}
        >
          <Activity
            size={20}
            color={
              activeTab === 'health'
                ? obsidianTheme.accent
                : obsidianTheme.textMuted
            }
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'health' && styles.navLabelActive,
            ]}
          >
            Saúde & Exames
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('coach')}
        >
          <Sparkles
            size={20}
            color={
              activeTab === 'coach'
                ? obsidianTheme.accent
                : obsidianTheme.textMuted
            }
          />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'coach' && styles.navLabelActive,
            ]}
          >
            Coach IA
          </Text>
        </TouchableOpacity>
      </View>

      {/* MODAL DE PESAGEM BLUETOOTH ("PESAR AGORA") */}
      <ScaleScannerModal
        visible={scannerModalVisible}
        onClose={() => setScannerModalVisible(false)}
        isScanning={isScanning}
        liveWeight={liveWeight}
        liveImpedance={liveImpedance}
        bleStatusMsg={bleStatusMsg}
        rawLogs={rawLogs}
        scannerPeriodChoice={scannerPeriodChoice}
        onChangePeriodChoice={setScannerPeriodChoice}
        onToggleBleScan={handleToggleBleScan}
        onSimulateScaleReading={handleSimulateWellmixWeighIn}
        onAddManualWeight={handleAddManualWeight}
      />

      {/* MODAL DE CONFIGURAÇÕES & DOWNLOAD DE MODELO LOCAL GEMMA */}
      <SettingsModal
        visible={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        profile={profile}
        onUpdateProfile={handleUpdateAndSaveProfile}
        onSyncSamsungHealth={() => handleSyncSamsungHealth()}
        syncingHealth={syncingHealth}
        samsungHealth={samsungHealth}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: obsidianTheme.bg,
    paddingTop:
      Platform.OS === 'android'
        ? Math.max(StatusBar.currentHeight || 0, 32) + 6
        : 0,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: obsidianTheme.border,
    backgroundColor: obsidianTheme.bg,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: obsidianTheme.accent,
  },
  brandTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  engineBadge: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginLeft: 4,
  },
  engineBadgeText: {
    color: obsidianTheme.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerScaleQuickBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: obsidianTheme.accentSoft,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 999,
  },
  headerScaleQuickText: {
    color: obsidianTheme.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  settingsIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: obsidianTheme.surface,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingTop: 14,
    paddingBottom: 28,
  },
  emptyCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 24,
    alignItems: 'center',
    marginTop: 20,
    gap: 10,
  },
  emptyTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  emptySubtitle: {
    color: obsidianTheme.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 8,
  },
  heroCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 18,
    marginBottom: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroEyebrow: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  shiftBadge: {
    marginTop: 4,
    alignSelf: 'flex-start',
    backgroundColor: obsidianTheme.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  shiftBadgeText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  weighNowPrimaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: obsidianTheme.accent,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  weighNowPrimaryText: {
    color: '#090A0F',
    fontSize: 13,
    fontWeight: '800',
  },
  heroWeightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 14,
    marginBottom: 14,
    gap: 6,
  },
  heroWeightValue: {
    color: obsidianTheme.textPrimary,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  heroWeightUnit: {
    color: obsidianTheme.textSecondary,
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
  deltaPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  deltaPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  heroFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
  },
  heroMetaItem: {
    flex: 1,
  },
  heroDivider: {
    width: 1,
    height: 24,
    backgroundColor: obsidianTheme.border,
    marginHorizontal: 12,
  },
  heroMetaLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  heroMetaValue: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 12,
  },
  kpiCard: {
    width: '48.3%',
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 14,
  },
  kpiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  kpiLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  kpiValue: {
    color: obsidianTheme.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  kpiSub: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  healthStripCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 14,
    marginBottom: 12,
  },
  healthStripTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  healthStripTitle: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginLeft: 6,
  },
  syncMiniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: obsidianTheme.surfaceElevated,
  },
  syncMiniText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  healthMetricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  healthMetricItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
  },
  healthMetricVal: {
    color: obsidianTheme.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  healthMetricLbl: {
    color: obsidianTheme.textMuted,
    fontSize: 11,
  },
  healthDivider: {
    width: 1,
    height: 18,
    backgroundColor: obsidianTheme.border,
  },
  periodFilterBar: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 10,
  },
  periodChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: obsidianTheme.surface,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    alignItems: 'center',
  },
  periodChipActive: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accentBorder,
  },
  periodChipText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  periodChipTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '700',
  },
  recentCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 16,
    marginTop: 4,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  recentTitle: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  seeAllText: {
    color: obsidianTheme.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
  },
  recentWeight: {
    color: obsidianTheme.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginRight: 8,
  },
  shiftMiniPill: {
    backgroundColor: obsidianTheme.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  shiftMiniText: {
    color: obsidianTheme.textSecondary,
    fontSize: 10,
    fontWeight: '600',
  },
  recentMeta: {
    color: obsidianTheme.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  deleteIconBtn: {
    padding: 8,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: obsidianTheme.surface,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  navLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  navLabelActive: {
    color: obsidianTheme.accent,
    fontWeight: '700',
  },
});
