import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
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
  Droplets,
  Flame,
  Dumbbell,
  HeartPulse,
  Footprints,
  Moon,
  RefreshCw,
  CheckCircle2,
  Cpu,
  Scale,
  Cloud,
  Ruler,
  Info,
  Plus,
  Minus,
  Layers,
  Trash2,
  Clock,
} from 'lucide-react-native';
import {
  AiProvider,
  BioimpedanceMetrics,
  BodyMeasurementsEntry,
  BodyPartKey,
  DayPeriod,
  DayPeriodFilter,
  SamsungHealthSummary,
  UserProfile,
} from './src/types/health';
import {
  calculateBioimpedance,
  DAY_PERIOD_INFO,
  filterMeasurementsByPeriod,
  getBmiCategory,
  getDayPeriodFromIso,
  resolveMeasurementPeriod,
} from './src/utils/bioimpedance';
import {
  BODY_PARTS_GUIDE,
  BODY_PART_ORDER,
  calculateAnthropometricIndices,
} from './src/utils/bodyMeasurements';
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
  DEFAULT_PROFILE,
  SUPABASE_SQL_SCHEMA,
} from './src/services/storageAndCloud';
import {
  generateAiHealthCoachAnalysis,
  OPENROUTER_SUGGESTED_MODELS,
  DEEPSEEK_SUGGESTED_MODELS,
} from './src/services/aiCoachService';
import { TrendChart } from './src/components/TrendChart';
import { BodyAvatarSvg } from './src/components/BodyAvatarSvg';
import { EvolutionAndCompareView } from './src/components/EvolutionAndCompareView';

type ActiveTab = 'dashboard' | 'scanner' | 'avatar' | 'compare' | 'ai' | 'settings';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
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
    'Pronto para escanear sua balança Wellmix (OKOK BLE)'
  );
  const [rawLogs, setRawLogs] = useState<string[]>([]);
  const [periodFilter, setPeriodFilter] = useState<DayPeriodFilter>('all');
  const [scannerPeriodChoice, setScannerPeriodChoice] = useState<'auto' | DayPeriod>(
    'auto'
  );
  const [webConfirmDeleteId, setWebConfirmDeleteId] = useState<string | null>(null);

  // Estados do AI Coach
  const [aiReport, setAiReport] = useState<string>('');
  const [aiProviderBadge, setAiProviderBadge] = useState<string>('');
  const [loadingAi, setLoadingAi] = useState<boolean>(false);
  const [syncingHealth, setSyncingHealth] = useState<boolean>(false);
  const [settingsSavedMsg, setSettingsSavedMsg] = useState<string>('');

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
      const healthData = await syncWithSamsungHealth();
      setSamsungHealth(healthData);
    })();
  }, []);

  const latest = history.length > 0 ? history[history.length - 1] : null;
  const previous = history.length > 1 ? history[history.length - 2] : null;

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
      'Excluir Registro de Peso',
      `Deseja excluir a pesagem de ${item.weightKg} kg (${dateStr} • ${pInfo.icon} ${pInfo.label}) para não atrapalhar suas estatísticas?`,
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

  const handleStartRealBleScan = async () => {
    const granted = await requestBlePermissions();
    if (!granted) {
      setBleStatusMsg('Permissão de Bluetooth negada no Android.');
      return;
    }

    setIsScanning(true);
    setBleStatusMsg('Suba descalço na balança Wellmix... Escutando pacotes BLE (0xCA)...');

    const stopScan = startScaleBleScan({
      onReading: async (reading) => {
        setLiveWeight(reading.weightKg);
        setLiveImpedance(reading.impedanceOhm);
        setBleStatusMsg(
          `Capturado! ${reading.weightKg} kg | ${reading.impedanceOhm} Ω (${reading.protocolVersion})`
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
      onRawPacket: (name, mac, hex) => {
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
    setBleStatusMsg('Recebendo anúncio BLE da balança Wellmix (Protocolo Chipsea 0xCA 0x10)...');

    const baseWeight = latest ? latest.weightKg : 76.5;
    const simulatedWeight = Math.round((baseWeight + (Math.random() * 0.6 - 0.35)) * 100) / 100;
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
        `Pesagem (${pInfo.icon} ${pInfo.label}) salva! ${metrics.weightKg} kg (${metrics.bodyFatPercent}% gordura) sincronizado com Samsung Health.`
      );
    }, 900);
  };

  const handleUpdateBodyPartValue = (part: BodyPartKey, newVal: number) => {
    const guide = BODY_PARTS_GUIDE[part];
    const clamped = Math.round(Math.max(guide.minCm, Math.min(guide.maxCm, newVal)) * 10) / 10;
    setDraftBody((prev) => ({
      ...prev,
      [part]: clamped,
    }));
  };

  const handleSaveBodyTapeEntry = async () => {
    const updated = await saveBodyMeasurementsEntry(draftBody, profile);
    setBodyHistory(updated);
    setBodySaveFeedback('Medidas corporais e proporções do Avatar salvas no histórico!');
    setTimeout(() => setBodySaveFeedback(''), 3200);
  };

  const handleGenerateAiAnalysis = async () => {
    setLoadingAi(true);
    const res = await generateAiHealthCoachAnalysis(
      history,
      samsungHealth,
      profile,
      bodyHistory
    );
    setAiReport(res.text);
    setAiProviderBadge(res.providerUsed);
    setLoadingAi(false);
  };

  const handleSaveProfileSettings = async () => {
    await saveProfile(profile);
    setSettingsSavedMsg('Configurações salvas com sucesso!');
    setTimeout(() => setSettingsSavedMsg(''), 3000);
  };

  const renderDashboard = () => {
    const filteredHistory = filterMeasurementsByPeriod(history, periodFilter);
    const activeLatest =
      filteredHistory.length > 0
        ? filteredHistory[filteredHistory.length - 1]
        : latest;

    if (!activeLatest) {
      return (
        <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <Text style={styles.heroSubtitle}>SEM REGISTROS DE PESO</Text>
            <Text style={[styles.aiDesc, { marginBottom: 14 }]}>
              Nenhuma pesagem cadastrada. Vá até a aba Balança para pesar ou simular!
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => setActiveTab('scanner')}
            >
              <Bluetooth size={18} color="#0F172A" />
              <Text style={styles.primaryBtnText}>Ir para a Balança</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      );
    }

    const activePeriod = resolveMeasurementPeriod(activeLatest);
    const activePeriodInfo = DAY_PERIOD_INFO[activePeriod];

    // Compara sempre com a pesagem anterior do mesmo filtro (ou do mesmo turno se estiver em 'all')
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
    const bmiCat = getBmiCategory(activeLatest.bmi);

    // Estatísticas limpas do filtro selecionado
    const statsSource = filteredHistory.length > 0 ? filteredHistory : history;
    const weightsList = statsSource.map((i) => i.weightKg);
    const avgWeight =
      Math.round(
        (weightsList.reduce((a, b) => a + b, 0) / weightsList.length) * 10
      ) / 10;
    const minWeight = Math.min(...weightsList);
    const maxWeight = Math.max(...weightsList);

    const periodFilterOptions: Array<{
      key: DayPeriodFilter;
      label: string;
      icon: string;
      color: string;
    }> = [
      { key: 'all', label: 'Todos', icon: '🕒', color: '#38BDF8' },
      { key: 'morning', label: 'Manhã', icon: '☀️', color: '#F59E0B' },
      { key: 'afternoon', label: 'Tarde', icon: '🌤️', color: '#38BDF8' },
      { key: 'night', label: 'Noite', icon: '🌙', color: '#A855F7' },
    ];

    return (
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        {/* Seletor Rápido de Turno (Manhã, Tarde, Noite) */}
        <View style={styles.dashboardPeriodBar}>
          {periodFilterOptions.map((opt) => {
            const isSel = periodFilter === opt.key;
            const count =
              opt.key === 'all'
                ? history.length
                : filterMeasurementsByPeriod(history, opt.key).length;
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => setPeriodFilter(opt.key)}
                style={[
                  styles.dashboardPeriodChip,
                  isSel && {
                    backgroundColor: opt.color + '25',
                    borderColor: opt.color,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dashboardPeriodChipText,
                    isSel && { color: opt.color, fontWeight: '800' },
                  ]}
                >
                  {opt.icon} {opt.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {filteredHistory.length === 0 && periodFilter !== 'all' && (
          <View style={styles.emptyShiftBanner}>
            <Text style={styles.emptyShiftBannerText}>
              Nenhuma pesagem no turno de {DAY_PERIOD_INFO[periodFilter].label}. Exibindo a última pesagem geral abaixo.
            </Text>
          </View>
        )}

        {/* Card Principal de Peso e Bioimpedância */}
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.rowCenter}>
                <Text style={styles.heroSubtitle}>
                  {periodFilter === 'all'
                    ? 'ÚLTIMA PESAGEM WELLMIX'
                    : `ÚLTIMA PESAGEM • ${DAY_PERIOD_INFO[periodFilter].label.toUpperCase()}`}
                </Text>
                <View
                  style={[
                    styles.shiftInlineBadge,
                    {
                      borderColor: activePeriodInfo.color,
                      backgroundColor: activePeriodInfo.color + '20',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.shiftInlineBadgeText,
                      { color: activePeriodInfo.color },
                    ]}
                  >
                    {activePeriodInfo.icon} {activePeriodInfo.label}
                  </Text>
                </View>
              </View>

              <View style={styles.weightRow}>
                <Text style={styles.heroWeight}>
                  {activeLatest.weightKg.toFixed(1)}
                </Text>
                <Text style={styles.heroUnit}>kg</Text>
                {comparisonBase && (
                  <View
                    style={[
                      styles.deltaBadge,
                      { backgroundColor: weightDiff <= 0 ? '#064E3B' : '#7F1D1D' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.deltaText,
                        { color: weightDiff <= 0 ? '#34D399' : '#FCA5A5' },
                      ]}
                    >
                      {weightDiff > 0 ? `+${weightDiff}` : weightDiff} kg (vs{' '}
                      {activePeriodInfo.label})
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.heroActionsCol}>
              <TouchableOpacity
                style={styles.weighNowBtn}
                onPress={() => setActiveTab('scanner')}
              >
                <Bluetooth size={18} color="#0F172A" />
                <Text style={styles.weighNowBtnText}>Pesar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.deleteHeroBtn}
                onPress={() => handlePromptDeleteMeasurement(activeLatest)}
              >
                <Trash2 size={13} color="#FCA5A5" />
                <Text style={styles.deleteHeroBtnText}>
                  {webConfirmDeleteId === activeLatest.id
                    ? 'Confirmar?'
                    : 'Excluir errado'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.heroPillsRow}>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>IMC</Text>
              <Text style={[styles.heroPillVal, { color: bmiCat.color }]}>
                {activeLatest.bmi} ({bmiCat.label})
              </Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Média ({periodFilter === 'all' ? 'Geral' : DAY_PERIOD_INFO[periodFilter].label})</Text>
              <Text style={styles.heroPillVal}>{avgWeight} kg</Text>
            </View>
            <View style={styles.heroPill}>
              <Text style={styles.heroPillLabel}>Mín / Máx</Text>
              <Text style={styles.heroPillVal}>
                {minWeight} / {maxWeight} kg
              </Text>
            </View>
          </View>
        </View>

        {/* Ponte Samsung Health (Health Connect) */}
        <View style={styles.samsungCard}>
          <View style={styles.samsungHeader}>
            <View style={styles.rowCenter}>
              <HeartPulse size={20} color="#10B981" />
              <Text style={styles.samsungTitle}>Samsung Health Connect</Text>
            </View>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={() => handleSyncSamsungHealth()}
            >
              {syncingHealth ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <>
                  <RefreshCw size={14} color="#38BDF8" />
                  <Text style={styles.syncBtnText}>Sincronizar</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.samsungStatsRow}>
            <View style={styles.samsungStatBox}>
              <Footprints size={18} color="#38BDF8" />
              <Text style={styles.samsungStatVal}>
                {samsungHealth.stepsToday.toLocaleString('pt-BR')}
              </Text>
              <Text style={styles.samsungStatLabel}>Passos hoje</Text>
            </View>

            <View style={styles.samsungStatBox}>
              <Flame size={18} color="#F97316" />
              <Text style={styles.samsungStatVal}>{samsungHealth.caloriesBurnedToday}</Text>
              <Text style={styles.samsungStatLabel}>kcal gastas</Text>
            </View>

            <View style={styles.samsungStatBox}>
              <Moon size={18} color="#A855F7" />
              <Text style={styles.samsungStatVal}>{samsungHealth.sleepHoursLastNight}h</Text>
              <Text style={styles.samsungStatLabel}>Sono ontem</Text>
            </View>
          </View>

          <View style={styles.syncFooterRow}>
            <CheckCircle2 size={13} color="#10B981" />
            <Text style={styles.syncFooterText}>
              Peso e % de gordura enviados para o Samsung Health ({samsungHealth.lastSyncedAt})
            </Text>
          </View>
        </View>

        {/* Gráfico Interativo Filtrado pelo Turno */}
        <TrendChart data={statsSource} />

        {/* Grade Completa de Bioimpedância */}
        <Text style={styles.sectionHeader}>Composição Corporal Completa (BIA)</Text>
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <View style={styles.metricTop}>
              <Flame size={18} color="#F43F5E" />
              <Text style={styles.metricName}>Gordura Corporal</Text>
            </View>
            <Text style={styles.metricNumber}>{activeLatest.bodyFatPercent}%</Text>
            <Text style={styles.metricSub}>{activeLatest.fatMassKg} kg de massa gorda</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricTop}>
              <Dumbbell size={18} color="#10B981" />
              <Text style={styles.metricName}>Massa Muscular</Text>
            </View>
            <Text style={styles.metricNumber}>{activeLatest.muscleMassKg} kg</Text>
            <Text style={styles.metricSub}>{activeLatest.musclePercent}% do peso total</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricTop}>
              <Droplets size={18} color="#38BDF8" />
              <Text style={styles.metricName}>Água Corporal</Text>
            </View>
            <Text style={styles.metricNumber}>{activeLatest.waterPercent}%</Text>
            <Text style={styles.metricSub}>Massa magra: {activeLatest.leanBodyMassKg} kg</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricTop}>
              <Activity size={18} color="#F59E0B" />
              <Text style={styles.metricName}>Gordura Visceral</Text>
            </View>
            <Text style={styles.metricNumber}>Nível {activeLatest.visceralFat}</Text>
            <Text style={styles.metricSub}>
              {activeLatest.visceralFat <= 9 ? 'Saudável (< 10)' : 'Atenção (>= 10)'}
            </Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricTop}>
              <Cpu size={18} color="#A855F7" />
              <Text style={styles.metricName}>Metabolismo Basal</Text>
            </View>
            <Text style={styles.metricNumber}>{activeLatest.bmrKcal} kcal</Text>
            <Text style={styles.metricSub}>Idade metabólica: {activeLatest.metabolicAge} anos</Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricTop}>
              <Scale size={18} color="#EC4899" />
              <Text style={styles.metricName}>Proteína & Ossos</Text>
            </View>
            <Text style={styles.metricNumber}>{activeLatest.proteinPercent}%</Text>
            <Text style={styles.metricSub}>Massa óssea: {activeLatest.boneMassKg} kg</Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  const renderAvatarAndMeasures = () => {
    const activeGuide = BODY_PARTS_GUIDE[selectedPart];
    const currentVal = draftBody[selectedPart];
    const indices = calculateAnthropometricIndices(draftBody, profile);
    const firstEntry = bodyHistory.length > 0 ? bodyHistory[0] : null;
    const partDiff = firstEntry
      ? Math.round((currentVal - firstEntry[selectedPart]) * 10) / 10
      : 0;

    return (
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={styles.avatarHeaderCard}>
          <View style={styles.measureEditorHeader}>
            <Text style={styles.avatarTitle}>Avatar Biométrico & Fita Métrica</Text>
            <TouchableOpacity
              style={styles.syncButton}
              onPress={() => setActiveTab('compare')}
            >
              <Layers size={14} color="#38BDF8" />
              <Text style={styles.syncBtnText}>Comparar Períodos</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.avatarSubtitle}>
            Toque nos pontos do Avatar ou nos botões abaixo. A silhueta do Avatar se molda em tempo real seguindo todas as suas medidas!
          </Text>

          {/* Avatar SVG Paramétrico */}
          <BodyAvatarSvg
            measurements={draftBody}
            selectedPart={selectedPart}
            onSelectPart={(p) => setSelectedPart(p)}
          />

          {/* Índices Antropométricos Calculados pelo Avatar */}
          <View style={styles.indicesRow}>
            <View style={styles.indexPill}>
              <Text style={styles.indexPillLabel}>Shape V-Taper</Text>
              <Text style={styles.indexPillVal}>{indices.vTaperRatio}</Text>
            </View>
            <View style={styles.indexPill}>
              <Text style={styles.indexPillLabel}>Cintura/Quadril</Text>
              <Text style={styles.indexPillVal}>{indices.waistToHipRatio}</Text>
            </View>
            <View style={styles.indexPill}>
              <Text style={styles.indexPillLabel}>BF (Fita US Navy)</Text>
              <Text style={[styles.indexPillVal, { color: '#38BDF8' }]}>
                {indices.navyBodyFatEstimate}%
              </Text>
            </View>
          </View>
        </View>

        {/* Seletor Rápido das 10 Regiões do Corpo */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.partSelectorScroll}
        >
          {BODY_PART_ORDER.map((partKey) => {
            const g = BODY_PARTS_GUIDE[partKey];
            const isSel = partKey === selectedPart;
            return (
              <TouchableOpacity
                key={partKey}
                onPress={() => setSelectedPart(partKey)}
                style={[
                  styles.partChip,
                  isSel && { backgroundColor: g.color + '25', borderColor: g.color },
                ]}
              >
                <Text
                  style={[
                    styles.partChipTitle,
                    isSel && { color: g.color, fontWeight: '800' },
                  ]}
                >
                  {g.shortLabel}
                </Text>
                <Text style={styles.partChipValue}>{draftBody[partKey]} cm</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Controle de Medida + Guia Passo a Passo de Como Medir */}
        <View style={[styles.measureEditorCard, { borderColor: activeGuide.color }]}>
          <View style={styles.measureEditorHeader}>
            <View>
              <Text style={[styles.measurePartTitle, { color: activeGuide.color }]}>
                {activeGuide.label}
              </Text>
              {firstEntry && (
                <Text style={styles.measureDiffText}>
                  Evolução desde o início: {partDiff > 0 ? `+${partDiff}` : partDiff} cm
                </Text>
              )}
            </View>

            <View style={styles.stepperRow}>
              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleUpdateBodyPartValue(selectedPart, currentVal - 0.5)}
              >
                <Minus size={18} color="#F8FAFC" />
              </TouchableOpacity>

              <TextInput
                style={styles.measureValueInput}
                keyboardType="numeric"
                value={String(currentVal)}
                onChangeText={(txt) => {
                  const num = parseFloat(txt.replace(',', '.'));
                  if (!isNaN(num)) {
                    setDraftBody((prev) => ({ ...prev, [selectedPart]: num }));
                  }
                }}
              />
              <Text style={styles.cmUnitText}>cm</Text>

              <TouchableOpacity
                style={styles.stepperBtn}
                onPress={() => handleUpdateBodyPartValue(selectedPart, currentVal + 0.5)}
              >
                <Plus size={18} color="#F8FAFC" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Barra deslizante visual de proporção */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: activeGuide.color,
                  width: `${Math.min(
                    100,
                    Math.max(
                      5,
                      ((currentVal - activeGuide.minCm) /
                        (activeGuide.maxCm - activeGuide.minCm)) *
                        100
                    )
                  )}%`,
                },
              ]}
            />
          </View>

          {/* Instruções de Como Tirar a Medida com a Fita */}
          <View style={styles.instructionsBox}>
            <View style={styles.rowCenter}>
              <Info size={16} color={activeGuide.color} />
              <Text style={styles.instructionsTitle}>{activeGuide.howToMeasureTitle}</Text>
            </View>
            {activeGuide.howToMeasureSteps.map((step, i) => (
              <Text key={i} style={styles.instructionStep}>
                {i + 1}. {step}
              </Text>
            ))}
            <Text style={styles.proTipText}>💡 Dica: {activeGuide.proTip}</Text>
          </View>

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveBodyTapeEntry}>
            <Ruler size={18} color="#0F172A" />
            <Text style={styles.primaryBtnText}>Salvar Todas as Medidas de Hoje</Text>
          </TouchableOpacity>

          {bodySaveFeedback !== '' && (
            <Text style={styles.savedBanner}>{bodySaveFeedback}</Text>
          )}
        </View>

        {/* Tabela Resumo de Todas as 10 Medidas */}
        <View style={styles.allMeasuresTableCard}>
          <Text style={styles.sectionHeader}>Resumo Completo das 10 Medidas</Text>
          {BODY_PART_ORDER.map((partKey) => {
            const g = BODY_PARTS_GUIDE[partKey];
            const val = draftBody[partKey];
            const initVal = firstEntry ? firstEntry[partKey] : val;
            const delta = Math.round((val - initVal) * 10) / 10;
            return (
              <TouchableOpacity
                key={partKey}
                style={styles.tableRow}
                onPress={() => setSelectedPart(partKey)}
              >
                <View style={styles.rowCenter}>
                  <View style={[styles.colorDot, { backgroundColor: g.color }]} />
                  <Text style={styles.tablePartName}>{g.label}</Text>
                </View>
                <View style={styles.rowCenter}>
                  {delta !== 0 && (
                    <Text
                      style={[
                        styles.tableDelta,
                        { color: delta < 0 ? '#38BDF8' : '#10B981' },
                      ]}
                    >
                      {delta > 0 ? `+${delta}` : delta} cm
                    </Text>
                  )}
                  <Text style={styles.tablePartVal}>{val} cm</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    );
  };

  const renderScanner = () => {
    const autoDetectedPeriod = getDayPeriodFromIso(new Date().toISOString());
    const autoInfo = DAY_PERIOD_INFO[autoDetectedPeriod];

    return (
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={styles.scannerCard}>
          <View style={styles.scannerCircle}>
            <Bluetooth size={42} color={isScanning ? '#38BDF8' : '#94A3B8'} />
            <Text style={styles.scannerWeightText}>
              {liveWeight ? `${liveWeight.toFixed(2)} kg` : '--.- kg'}
            </Text>
            <Text style={styles.scannerImpText}>
              {liveImpedance ? `Impedância: ${liveImpedance} Ω` : 'Suba descalço na Wellmix'}
            </Text>
          </View>

          {/* Seletor de Turno para Classificar a Pesagem */}
          <View style={styles.scannerPeriodBox}>
            <View style={[styles.rowCenter, { marginBottom: 8 }]}>
              <Clock size={14} color="#38BDF8" />
              <Text style={styles.scannerPeriodTitle}>
                Turno desta Pesagem (para comparação justa):
              </Text>
            </View>
            <View style={styles.dashboardPeriodBar}>
              <TouchableOpacity
                onPress={() => setScannerPeriodChoice('auto')}
                style={[
                  styles.dashboardPeriodChip,
                  scannerPeriodChoice === 'auto' && {
                    backgroundColor: '#38BDF825',
                    borderColor: '#38BDF8',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dashboardPeriodChipText,
                    scannerPeriodChoice === 'auto' && {
                      color: '#38BDF8',
                      fontWeight: '800',
                    },
                  ]}
                >
                  🕒 Auto ({autoInfo.icon} {autoInfo.label})
                </Text>
              </TouchableOpacity>

              {(['morning', 'afternoon', 'night'] as DayPeriod[]).map((pKey) => {
                const pInfo = DAY_PERIOD_INFO[pKey];
                const isSel = scannerPeriodChoice === pKey;
                return (
                  <TouchableOpacity
                    key={pKey}
                    onPress={() => setScannerPeriodChoice(pKey)}
                    style={[
                      styles.dashboardPeriodChip,
                      isSel && {
                        backgroundColor: pInfo.color + '25',
                        borderColor: pInfo.color,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dashboardPeriodChipText,
                        isSel && { color: pInfo.color, fontWeight: '800' },
                      ]}
                    >
                      {pInfo.icon} {pInfo.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <Text style={styles.scannerStatus}>{bleStatusMsg}</Text>

          <TouchableOpacity
            style={[styles.primaryBtn, isScanning && { opacity: 0.7 }]}
            onPress={handleStartRealBleScan}
            disabled={isScanning}
          >
            <Bluetooth size={18} color="#0F172A" />
            <Text style={styles.primaryBtnText}>
              {isScanning ? 'Escutando Bluetooth BLE...' : 'Conectar Balança Wellmix (BLE)'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={handleSimulateWellmixWeighIn}
            disabled={isScanning}
          >
            <Sparkles size={18} color="#38BDF8" />
            <Text style={styles.secondaryBtnText}>
              Simular Pesagem da Balança Wellmix Agora
            </Text>
          </TouchableOpacity>
        </View>

        {/* Últimas Pesagens com Exclusão Rápida caso algum registro saia errado */}
        <View style={styles.logBox}>
          <Text style={styles.logTitle}>
            Últimas Pesagens Registradas (Exclua caso alguma leitura seja inválida)
          </Text>
          {history.length === 0 ? (
            <Text style={styles.logEmpty}>Nenhum registro salvo.</Text>
          ) : (
            [...history]
              .reverse()
              .slice(0, 5)
              .map((item) => {
                const pInfo = DAY_PERIOD_INFO[resolveMeasurementPeriod(item)];
                const dt = new Date(item.timestamp);
                const dateLabel = `${String(dt.getDate()).padStart(2, '0')}/${String(
                  dt.getMonth() + 1
                ).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(
                  dt.getMinutes()
                ).padStart(2, '0')}`;
                return (
                  <View key={item.id} style={styles.recentWeighRow}>
                    <View>
                      <Text style={styles.recentWeighMain}>
                        {item.weightKg} kg • {item.bodyFatPercent}% BF
                      </Text>
                      <Text style={styles.recentWeighSub}>
                        {dateLabel} • {pInfo.icon} {pInfo.label}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.deleteHeroBtn}
                      onPress={() => handlePromptDeleteMeasurement(item)}
                    >
                      <Trash2 size={14} color="#FCA5A5" />
                      <Text style={styles.deleteHeroBtnText}>
                        {webConfirmDeleteId === item.id ? 'Confirmar?' : 'Excluir'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
          )}
        </View>

        <View style={styles.logBox}>
          <Text style={styles.logTitle}>Inspetor de Pacotes BLE (Protocolo OKOK / Chipsea)</Text>
          {rawLogs.length === 0 ? (
            <Text style={styles.logEmpty}>
              Nenhum pacote capturado ainda. Clique em Pesar ou Simular acima para ver a decodificação Hexadecimal da balança.
            </Text>
          ) : (
            rawLogs.map((log, i) => (
              <Text key={i} style={styles.logLine}>
                {log}
              </Text>
            ))
          )}
        </View>
      </ScrollView>
    );
  };

  const renderAiCoach = () => (
    <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
      <View style={styles.aiHeaderCard}>
        <View style={styles.measureEditorHeader}>
          <View style={styles.rowCenter}>
            <Sparkles size={22} color="#38BDF8" />
            <Text style={styles.aiTitle}>Treinador IA Multi-Modelo</Text>
          </View>
          <TouchableOpacity
            style={styles.syncButton}
            onPress={() => setActiveTab('settings')}
          >
            <Settings size={13} color="#38BDF8" />
            <Text style={styles.syncBtnText}>
              {profile.aiProvider.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.aiDesc}>
          Suporta **OpenRouter** (`deepseek/deepseek-chat`, `deepseek-r1`, Claude, GPT-4o), **DeepSeek API Direta** ou **Google Gemini**. Cruza sua balança Wellmix com o Avatar e Samsung Health!
        </Text>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={handleGenerateAiAnalysis}
          disabled={loadingAi}
        >
          {loadingAi ? (
            <ActivityIndicator size="small" color="#0F172A" />
          ) : (
            <>
              <Sparkles size={18} color="#0F172A" />
              <Text style={styles.primaryBtnText}>Gerar Diagnóstico Inteligente</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {aiReport ? (
        <View style={styles.aiResultCard}>
          {aiProviderBadge !== '' && (
            <View style={styles.providerUsedBadge}>
              <Text style={styles.providerUsedText}>Modelo: {aiProviderBadge}</Text>
            </View>
          )}
          <Text style={styles.aiResultText}>{aiReport}</Text>
        </View>
      ) : (
        <View style={styles.aiResultCard}>
          <Text style={styles.logEmpty}>
            Toque em "Gerar Diagnóstico Inteligente" para analisar sua evolução de gordura, simetria corporal do Avatar e sono do Samsung Health.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const renderSettings = () => {
    const providers: Array<{ key: AiProvider; label: string }> = [
      { key: 'openrouter', label: 'OpenRouter' },
      { key: 'deepseek', label: 'DeepSeek' },
      { key: 'gemini', label: 'Gemini' },
      { key: 'local', label: 'Local Offline' },
    ];

    return (
      <ScrollView style={styles.scrollArea} showsVerticalScrollIndicator={false}>
        <View style={styles.settingsCard}>
          <Text style={styles.sectionHeader}>Provedor de Inteligência Artificial</Text>
          <View style={styles.providerTabsRow}>
            {providers.map((p) => {
              const active = profile.aiProvider === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => setProfile({ ...profile, aiProvider: p.key })}
                  style={[
                    styles.providerTabBtn,
                    active && { backgroundColor: '#38BDF825', borderColor: '#38BDF8' },
                  ]}
                >
                  <Text
                    style={[
                      styles.providerTabText,
                      active && { color: '#38BDF8', fontWeight: '800' },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {profile.aiProvider === 'openrouter' && (
            <View style={styles.providerConfigBox}>
              <Text style={styles.inputLabel}>OpenRouter API Key (openrouter.ai)</Text>
              <TextInput
                style={styles.input}
                placeholder="sk-or-v1-..."
                placeholderTextColor="#475569"
                secureTextEntry
                value={profile.openRouterApiKey}
                onChangeText={(v) => setProfile({ ...profile, openRouterApiKey: v })}
              />

              <Text style={styles.inputLabel}>Modelo no OpenRouter</Text>
              <TextInput
                style={styles.input}
                placeholder="deepseek/deepseek-chat"
                placeholderTextColor="#475569"
                value={profile.openRouterModel}
                onChangeText={(v) => setProfile({ ...profile, openRouterModel: v })}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
              >
                {OPENROUTER_SUGGESTED_MODELS.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setProfile({ ...profile, openRouterModel: m.id })}
                    style={[
                      styles.modelPresetChip,
                      profile.openRouterModel === m.id && { borderColor: '#38BDF8' },
                    ]}
                  >
                    <Text style={styles.modelPresetText}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {profile.aiProvider === 'deepseek' && (
            <View style={styles.providerConfigBox}>
              <Text style={styles.inputLabel}>DeepSeek API Key (platform.deepseek.com)</Text>
              <TextInput
                style={styles.input}
                placeholder="sk-..."
                placeholderTextColor="#475569"
                secureTextEntry
                value={profile.deepseekApiKey}
                onChangeText={(v) => setProfile({ ...profile, deepseekApiKey: v })}
              />

              <Text style={styles.inputLabel}>Modelo DeepSeek</Text>
              <TextInput
                style={styles.input}
                placeholder="deepseek-chat"
                placeholderTextColor="#475569"
                value={profile.deepseekModel}
                onChangeText={(v) => setProfile({ ...profile, deepseekModel: v })}
              />

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginTop: 8 }}
              >
                {DEEPSEEK_SUGGESTED_MODELS.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setProfile({ ...profile, deepseekModel: m.id })}
                    style={[
                      styles.modelPresetChip,
                      profile.deepseekModel === m.id && { borderColor: '#38BDF8' },
                    ]}
                  >
                    <Text style={styles.modelPresetText}>{m.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {profile.aiProvider === 'gemini' && (
            <View style={styles.providerConfigBox}>
              <Text style={styles.inputLabel}>Chave API Google Gemini</Text>
              <TextInput
                style={styles.input}
                placeholder="AIzaSy..."
                placeholderTextColor="#475569"
                secureTextEntry
                value={profile.geminiApiKey}
                onChangeText={(v) => setProfile({ ...profile, geminiApiKey: v })}
              />
            </View>
          )}

          <Text style={[styles.sectionHeader, { marginTop: 18 }]}>
            Seu Perfil Antropométrico (Para Fórmulas BIA)
          </Text>

          <Text style={styles.inputLabel}>Altura (cm)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(profile.heightCm)}
            onChangeText={(v) => setProfile({ ...profile, heightCm: Number(v) || 170 })}
          />

          <Text style={styles.inputLabel}>Idade</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(profile.age)}
            onChangeText={(v) => setProfile({ ...profile, age: Number(v) || 25 })}
          />

          <Text style={styles.inputLabel}>Meta de Peso (kg)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={String(profile.targetWeightKg)}
            onChangeText={(v) => setProfile({ ...profile, targetWeightKg: Number(v) || 70 })}
          />

          <View style={styles.rowCenter}>
            <Cloud size={18} color="#38BDF8" />
            <Text style={[styles.sectionHeader, { marginBottom: 0, marginTop: 14 }]}>
              Nuvem Supabase (Opcional)
            </Text>
          </View>

          <Text style={styles.inputLabel}>Supabase Project URL</Text>
          <TextInput
            style={styles.input}
            placeholder="https://xyz.supabase.co"
            placeholderTextColor="#475569"
            value={profile.supabaseUrl}
            onChangeText={(v) => setProfile({ ...profile, supabaseUrl: v })}
          />

          <Text style={styles.inputLabel}>Supabase Anon Key</Text>
          <TextInput
            style={styles.input}
            placeholder="eyJhbGciOiJIUzI1NiIsInR5..."
            placeholderTextColor="#475569"
            value={profile.supabaseAnonKey}
            onChangeText={(v) => setProfile({ ...profile, supabaseAnonKey: v })}
          />

          <TouchableOpacity style={styles.primaryBtn} onPress={handleSaveProfileSettings}>
            <Text style={styles.primaryBtnText}>Salvar Configurações</Text>
          </TouchableOpacity>

          {settingsSavedMsg !== '' && (
            <Text style={styles.savedBanner}>{settingsSavedMsg}</Text>
          )}

          <View style={styles.sqlBox}>
            <Text style={styles.logTitle}>Tabelas SQL para seu Supabase:</Text>
            <Text style={styles.logLine}>{SUPABASE_SQL_SCHEMA}</Text>
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.appName}>BioScale AI</Text>
          <Text style={styles.appTagline}>
            Wellmix BLE • Avatar 360 • DeepSeek / OpenRouter
          </Text>
        </View>
        <View style={styles.statusDotRow}>
          <View style={styles.greenDot} />
          <Text style={styles.statusDotText}>OKOK Ready</Text>
        </View>
      </View>

      <View style={styles.contentContainer}>
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'avatar' && renderAvatarAndMeasures()}
        {activeTab === 'compare' && (
          <EvolutionAndCompareView
            scaleHistory={history}
            bodyHistory={bodyHistory}
            profile={profile}
            selectedPeriodFilter={periodFilter}
            onChangePeriodFilter={setPeriodFilter}
            onDeleteMeasurement={handleDeleteMeasurement}
            onUpdateMeasurementPeriod={handleUpdateMeasurementPeriod}
          />
        )}
        {activeTab === 'scanner' && renderScanner()}
        {activeTab === 'ai' && renderAiCoach()}
        {activeTab === 'settings' && renderSettings()}
      </View>

      {/* Barra de Navegação Inferior */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('dashboard')}
        >
          <Activity size={19} color={activeTab === 'dashboard' ? '#38BDF8' : '#64748B'} />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'dashboard' && { color: '#38BDF8', fontWeight: '700' },
            ]}
          >
            Painel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('avatar')}
        >
          <Ruler size={19} color={activeTab === 'avatar' ? '#38BDF8' : '#64748B'} />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'avatar' && { color: '#38BDF8', fontWeight: '700' },
            ]}
          >
            Avatar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('compare')}
        >
          <Layers size={19} color={activeTab === 'compare' ? '#38BDF8' : '#64748B'} />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'compare' && { color: '#38BDF8', fontWeight: '700' },
            ]}
          >
            Evolução
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('scanner')}
        >
          <Bluetooth size={19} color={activeTab === 'scanner' ? '#38BDF8' : '#64748B'} />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'scanner' && { color: '#38BDF8', fontWeight: '700' },
            ]}
          >
            Balança
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('ai')}>
          <Sparkles size={19} color={activeTab === 'ai' ? '#38BDF8' : '#64748B'} />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'ai' && { color: '#38BDF8', fontWeight: '700' },
            ]}
          >
            IA Coach
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navItem}
          onPress={() => setActiveTab('settings')}
        >
          <Settings size={19} color={activeTab === 'settings' ? '#38BDF8' : '#64748B'} />
          <Text
            style={[
              styles.navLabel,
              activeTab === 'settings' && { color: '#38BDF8', fontWeight: '700' },
            ]}
          >
            Ajustes
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  appName: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  appTagline: {
    color: '#64748B',
    fontSize: 12,
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#1E293B',
    gap: 6,
  },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
  statusDotText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollArea: {
    flex: 1,
    paddingVertical: 12,
  },
  heroCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroSubtitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 4,
    gap: 6,
  },
  heroWeight: {
    color: '#F8FAFC',
    fontSize: 42,
    fontWeight: '800',
  },
  heroUnit: {
    color: '#94A3B8',
    fontSize: 18,
    fontWeight: '600',
  },
  deltaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 6,
  },
  deltaText: {
    fontSize: 12,
    fontWeight: '700',
  },
  weighNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38BDF8',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    gap: 6,
  },
  weighNowBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
  },
  heroPillsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  heroPill: {
    flex: 1,
  },
  heroPillLabel: {
    color: '#64748B',
    fontSize: 11,
  },
  heroPillVal: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  samsungCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#065F46',
    marginBottom: 4,
  },
  samsungHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  samsungTitle: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  syncBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '600',
  },
  samsungStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  samsungStatBox: {
    flex: 1,
    backgroundColor: '#111827',
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  samsungStatVal: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 6,
  },
  samsungStatLabel: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  syncFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  syncFooterText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  sectionHeader: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 10,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    paddingBottom: 28,
  },
  metricCard: {
    width: '48%',
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  metricTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricName: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  metricNumber: {
    color: '#F8FAFC',
    fontSize: 22,
    fontWeight: '800',
    marginTop: 8,
  },
  metricSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  avatarHeaderCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  avatarTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  avatarSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 17,
  },
  indicesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 8,
  },
  indexPill: {
    flex: 1,
    backgroundColor: '#0F172A',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  indexPillLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  indexPillVal: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 2,
  },
  partSelectorScroll: {
    marginBottom: 12,
  },
  partChip: {
    backgroundColor: '#111827',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  partChipTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  partChipValue: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  measureEditorCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 14,
  },
  measureEditorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  measurePartTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  measureDiffText: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stepperBtn: {
    backgroundColor: '#1E293B',
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  measureValueInput: {
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    minWidth: 62,
    textAlign: 'center',
  },
  cmUnitText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#0F172A',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 14,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  instructionsBox: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 8,
  },
  instructionsTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  instructionStep: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  proTipText: {
    color: '#38BDF8',
    fontSize: 11,
    marginTop: 8,
    lineHeight: 16,
    fontWeight: '600',
  },
  allMeasuresTableCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 28,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  tablePartName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '600',
  },
  tableDelta: {
    fontSize: 12,
    fontWeight: '700',
    marginRight: 8,
  },
  tablePartVal: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  scannerCard: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 22,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  scannerCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    borderWidth: 3,
    borderColor: '#38BDF8',
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scannerWeightText: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  scannerImpText: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
  },
  scannerStatus: {
    color: '#CBD5E1',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 16,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  primaryBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 14,
  },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 13,
    paddingHorizontal: 18,
    borderRadius: 14,
    width: '100%',
    gap: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#38BDF8',
  },
  secondaryBtnText: {
    color: '#38BDF8',
    fontWeight: '700',
    fontSize: 13,
  },
  logBox: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 24,
  },
  logTitle: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  logEmpty: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
  },
  logLine: {
    color: '#38BDF8',
    fontFamily: 'monospace',
    fontSize: 11,
    marginBottom: 4,
  },
  aiHeaderCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  aiTitle: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
  },
  aiDesc: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 10,
    lineHeight: 19,
  },
  aiResultCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 24,
  },
  providerUsedBadge: {
    backgroundColor: '#1E293B',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  providerUsedText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  aiResultText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 22,
  },
  settingsCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 28,
  },
  providerTabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  providerTabBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  providerTabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  providerConfigBox: {
    backgroundColor: '#0B1120',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  modelPresetChip: {
    backgroundColor: '#111827',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  modelPresetText: {
    color: '#CBD5E1',
    fontSize: 11,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  savedBanner: {
    color: '#10B981',
    textAlign: 'center',
    marginTop: 10,
    fontWeight: '700',
  },
  sqlBox: {
    marginTop: 16,
    backgroundColor: '#0A0E1A',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    paddingVertical: 10,
    justifyContent: 'space-around',
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    color: '#64748B',
    fontSize: 10,
  },
  dashboardPeriodBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  dashboardPeriodChip: {
    backgroundColor: '#111827',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  dashboardPeriodChipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  emptyShiftBanner: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
  },
  emptyShiftBannerText: {
    color: '#CBD5E1',
    fontSize: 12,
    textAlign: 'center',
  },
  shiftInlineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  shiftInlineBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  heroActionsCol: {
    alignItems: 'flex-end',
    gap: 8,
  },
  deleteHeroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#7F1D1D55',
    borderWidth: 1,
    borderColor: '#EF444470',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  deleteHeroBtnText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  scannerPeriodBox: {
    width: '100%',
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  scannerPeriodTitle: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
  },
  recentWeighRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  recentWeighMain: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
  },
  recentWeighSub: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 2,
  },
});
