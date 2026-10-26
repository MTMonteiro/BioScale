import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import {
  Sparkles,
  Settings,
  Download,
  Trash2,
  CheckCircle2,
  Dumbbell,
  Apple,
  Moon,
  FlaskConical,
  MessageSquare,
  Send,
  Cpu,
  AlertTriangle,
  Plus,
  XCircle,
} from 'lucide-react-native';
import {
  BioimpedanceMetrics,
  BodyMeasurementsEntry,
  CoachChatMessage,
  CoachPersona,
  LabExamEntry,
  LocalGemmaModelSpec,
  SamsungHealthSummary,
  StructuredCoachPlan,
  TrainingGoal,
  UserProfile,
} from '../types/health';
import {
  BIOMARKER_CATEGORIES,
  BiomarkerCategory,
  BiomarkerFieldKey,
  calculateHomaIr,
  evaluateFullLabExam,
  LAB_BIOMARKERS_GUIDE,
} from '../utils/labExams';
import {
  cancelActiveModelDownload,
  deleteDownloadedGemmaModel,
  DownloadedModelStatus,
  downloadLocalGemmaModel,
  getAllModelsDownloadStatus,
  getModelSpecById,
  isLocalGemmaLoadedInRam,
  LOCAL_GEMMA_MODELS,
} from '../services/localModelService';
import {
  askCoachInteractiveQuestion,
  computeBioHealthScore,
} from '../services/aiCoachService';
import { CoachAvatarSvg } from './CoachAvatarSvg';

interface Props {
  history: BioimpedanceMetrics[];
  bodyHistory: BodyMeasurementsEntry[];
  labExams: LabExamEntry[];
  samsungHealth: SamsungHealthSummary;
  profile: UserProfile;
  coachPlan: StructuredCoachPlan | null;
  loadingAi: boolean;
  streamingPreview: string;
  onGenerateAnalysis: () => void;
  onUpdateProfile: (next: UserProfile) => void;
  onSaveLabExam: (
    exam: Omit<LabExamEntry, 'id' | 'timestamp' | 'homaIr'>
  ) => Promise<void>;
  onDeleteLabExam: (id: string) => Promise<void>;
  onOpenSettings: () => void;
}

type CoachSubTab =
  | 'overview'
  | 'training'
  | 'nutrition'
  | 'habits'
  | 'exams'
  | 'chat'
  | 'local_models';

const TRAINING_GOALS: Array<{ key: TrainingGoal; label: string }> = [
  { key: 'recomposition', label: '⚡ Recomposição' },
  { key: 'fat_loss', label: '🔥 Secar Gordura' },
  { key: 'hypertrophy', label: '💪 Hipertrofia' },
  { key: 'longevity', label: '🧬 Saúde & Exames' },
];

const QUICK_QUESTIONS = [
  'O que comer no pré e pós-treino para meus dados?',
  'Qual treino focar para melhorar meu Avatar (V-Taper)?',
  'Como ajustar minha dieta pelos resultados dos meus exames?',
  'Como reduzir gordura visceral e melhorar meu sono?',
];

export const AiCoachHubView: React.FC<Props> = ({
  history,
  bodyHistory,
  labExams,
  samsungHealth,
  profile,
  coachPlan,
  loadingAi,
  streamingPreview,
  onGenerateAnalysis,
  onUpdateProfile,
  onSaveLabExam,
  onDeleteLabExam,
  onOpenSettings,
}) => {
  const [subTab, setSubTab] = useState<CoachSubTab>('overview');

  // Estados do Gerenciador de Modelos Locais Gemma (GGUF)
  const [downloadedMap, setDownloadedMap] = useState<
    Record<string, DownloadedModelStatus>
  >({});
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(
    null
  );
  const [downloadProgress, setDownloadProgress] = useState<{
    progressPercent: number;
    downloadedMb: number;
    totalMb: number;
  }>({ progressPercent: 0, downloadedMb: 0, totalMb: 0 });
  const [modelStatusMsg, setModelStatusMsg] = useState<string>('');

  // Estados do Formulário de Exames Laboratoriais
  const [examCategory, setExamCategory] =
    useState<BiomarkerCategory>('glycemic');
  const [showNewExamForm, setShowNewExamForm] = useState<boolean>(false);
  const [examLabel, setExamLabel] = useState<string>('Check-up de Sangue');
  const [examNotes, setExamNotes] = useState<string>('');
  const [examInputs, setExamInputs] = useState<Record<string, string>>({
    fastingGlucoseMgDl: '89',
    hba1cPercent: '5.2',
    fastingInsulinUiuMl: '6.8',
    totalCholesterolMgDl: '178',
    hdlMgDl: '52',
    ldlMgDl: '98',
    triglyceridesMgDl: '110',
    tshUiuMl: '1.9',
    freeT4NgDl: '1.3',
    totalTestosteroneNgDl: '590',
    morningCortisolUgDl: '13.0',
    vitaminDNgMl: '36',
    vitaminB12PgMl: '490',
    ferritinNgMl: '120',
    hsCrpMgL: '0.7',
    creatinineMgDl: '1.02',
    astU_L: '23',
    altU_L: '25',
  });
  const [examSavedMsg, setExamSavedMsg] = useState<string>('');

  // Estados do Chat Interativo com o Coach
  const [chatQuestion, setChatQuestion] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<CoachChatMessage[]>([
    {
      id: 'welcome-coach',
      role: 'assistant',
      text: 'Olá! Eu sou o seu Coach Biomédico IA. Analiso sua balança Wellmix, seu Avatar corporal, seus dados do Samsung Health e seus Exames de Sangue para montar seu treino, dieta e rotina. Gere o diagnóstico acima ou me faça qualquer pergunta!',
      timestamp: 'Agora',
      providerBadge: 'BioScale Coach',
    },
  ]);

  const refreshDownloadedModels = async () => {
    const statusMap = await getAllModelsDownloadStatus(
      profile.customLocalModelUrl
    );
    setDownloadedMap(statusMap);
  };

  useEffect(() => {
    refreshDownloadedModels();
  }, [profile.customLocalModelUrl]);

  useEffect(() => {
    if (labExams.length > 0) {
      const latestEx = labExams[labExams.length - 1];
      const nextMap: Record<string, string> = {};
      for (const g of LAB_BIOMARKERS_GUIDE) {
        const val = latestEx[g.key];
        if (typeof val === 'number' && !isNaN(val)) {
          nextMap[g.key] = String(val);
        }
      }
      setExamInputs((prev) => ({ ...prev, ...nextMap }));
      if (latestEx.customNotes) {
        setExamNotes(latestEx.customNotes);
      }
    }
  }, [labExams.length]);

  const latestScale = history.length > 0 ? history[history.length - 1] : null;
  const latestTape =
    bodyHistory.length > 0 ? bodyHistory[bodyHistory.length - 1] : null;
  const latestExam =
    labExams.length > 0 ? labExams[labExams.length - 1] : null;
  const latestExamEval = latestExam
    ? evaluateFullLabExam(latestExam, profile.sex)
    : null;

  const activeHealthScore =
    coachPlan?.healthScore ||
    computeBioHealthScore(
      latestScale,
      samsungHealth,
      profile,
      latestTape,
      latestExam
    );

  const selectedLocalSpec = getModelSpecById(
    profile.selectedLocalModelId,
    profile.customLocalModelUrl
  );
  const isSelectedLocalDownloaded = Boolean(
    downloadedMap[selectedLocalSpec.id]?.isDownloaded
  );
  const ramInfo = isLocalGemmaLoadedInRam();

  const handleStartModelDownload = async (spec: LocalGemmaModelSpec) => {
    if (downloadingModelId) return;
    setDownloadingModelId(spec.id);
    setModelStatusMsg(`Baixando ${spec.name} direto para o celular...`);
    setDownloadProgress({
      progressPercent: 1,
      downloadedMb: 0,
      totalMb: spec.sizeMb,
    });

    try {
      await downloadLocalGemmaModel(spec, (prog) => {
        setDownloadProgress(prog);
      });
      await refreshDownloadedModels();
      onUpdateProfile({
        ...profile,
        aiProvider: 'gemma_local',
        selectedLocalModelId: spec.id,
      });
      setModelStatusMsg(
        `✅ ${spec.name} baixado com sucesso e ativado como motor do Coach!`
      );
    } catch (e: any) {
      setModelStatusMsg(
        `⚠️ ${e?.message || 'Não foi possível concluir o download do modelo.'}`
      );
    } finally {
      setDownloadingModelId(null);
    }
  };

  const handleCancelDownload = async () => {
    await cancelActiveModelDownload();
    setDownloadingModelId(null);
    setModelStatusMsg('Download cancelado pelo usuário.');
  };

  const handleDeleteModel = async (spec: LocalGemmaModelSpec) => {
    const doRemove = async () => {
      await deleteDownloadedGemmaModel(spec);
      await refreshDownloadedModels();
      setModelStatusMsg(`Modelo ${spec.name} removido da memória do aparelho.`);
    };

    if (Platform.OS === 'web') {
      await doRemove();
      return;
    }

    Alert.alert(
      'Remover Modelo Local',
      `Deseja apagar o arquivo ${spec.filename} (${spec.sizeMb} MB) do armazenamento do celular?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Apagar Arquivo', style: 'destructive', onPress: doRemove },
      ]
    );
  };

  const handleSaveNewExam = async () => {
    const numOrUndef = (k: BiomarkerFieldKey): number | undefined => {
      const raw = examInputs[k];
      if (!raw || raw.trim() === '') return undefined;
      const n = parseFloat(raw.replace(',', '.'));
      return isNaN(n) || n <= 0 ? undefined : n;
    };

    await onSaveLabExam({
      label: examLabel.trim() || 'Check-up Laboratorial',
      fastingGlucoseMgDl: numOrUndef('fastingGlucoseMgDl'),
      hba1cPercent: numOrUndef('hba1cPercent'),
      fastingInsulinUiuMl: numOrUndef('fastingInsulinUiuMl'),
      totalCholesterolMgDl: numOrUndef('totalCholesterolMgDl'),
      hdlMgDl: numOrUndef('hdlMgDl'),
      ldlMgDl: numOrUndef('ldlMgDl'),
      triglyceridesMgDl: numOrUndef('triglyceridesMgDl'),
      tshUiuMl: numOrUndef('tshUiuMl'),
      freeT4NgDl: numOrUndef('freeT4NgDl'),
      totalTestosteroneNgDl: numOrUndef('totalTestosteroneNgDl'),
      morningCortisolUgDl: numOrUndef('morningCortisolUgDl'),
      vitaminDNgMl: numOrUndef('vitaminDNgMl'),
      vitaminB12PgMl: numOrUndef('vitaminB12PgMl'),
      ferritinNgMl: numOrUndef('ferritinNgMl'),
      hsCrpMgL: numOrUndef('hsCrpMgL'),
      creatinineMgDl: numOrUndef('creatinineMgDl'),
      astU_L: numOrUndef('astU_L'),
      altU_L: numOrUndef('altU_L'),
      customNotes: examNotes.trim(),
    });

    setShowNewExamForm(false);
    setExamSavedMsg(
      'Exames salvos! Toque em "Atualizar Plano Completo do Coach" para recalcular sua dieta e treino com os novos exames.'
    );
    setTimeout(() => setExamSavedMsg(''), 5000);
  };

  const handleAskCoach = async (customQ?: string) => {
    const q = (customQ || chatQuestion).trim();
    if (!q || chatLoading) return;

    const userMsg: CoachChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    if (!customQ) setChatQuestion('');
    setChatLoading(true);

    try {
      const res = await askCoachInteractiveQuestion({
        question: q,
        history,
        samsungHealth,
        profile,
        bodyMeasurements: bodyHistory,
        labExams,
      });

      const assistantMsg: CoachChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: res.answer,
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        providerBadge: res.providerBadge,
      };
      setChatMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const activeModelDisplayBadge =
    profile.aiProvider === 'gemma_local'
      ? `${selectedLocalSpec.name} ${
          isSelectedLocalDownloaded ? '(Baixado ✅)' : '(Não baixado)'
        }`
      : coachPlan?.providerUsed || profile.aiProvider.toUpperCase();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 1. AVATAR DO COACH + SCORE BIOMÉTRICO + SELETOR DE PERSONA */}
      <CoachAvatarSvg
        persona={profile.coachPersona || 'atlas'}
        onSelectPersona={(nextPersona: CoachPersona) =>
          onUpdateProfile({ ...profile, coachPersona: nextPersona })
        }
        mood={loadingAi ? 'analyzing' : 'ready'}
        healthScore={activeHealthScore}
        activeModelBadge={activeModelDisplayBadge}
        isLocalGemmaActive={
          profile.aiProvider === 'gemma_local' && isSelectedLocalDownloaded
        }
        alertsCount={latestExamEval?.alerts.length || 0}
        statusLine={
          coachPlan?.summaryHeadline ||
          'Cruza Balança Wellmix + Avatar + Samsung Health + Exames de Sangue'
        }
      />

      {/* 2. BARRA DE OBJETIVO DE TREINO/DIETA E AÇÃO PRINCIPAL */}
      <View style={styles.controlCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.smallSectionLabel}>
            FOCO DO COACH (TREINO & DIETA):
          </Text>
          <TouchableOpacity style={styles.settingsLinkBtn} onPress={onOpenSettings}>
            <Settings size={13} color="#38BDF8" />
            <Text style={styles.settingsLinkText}>
              Chaves API / Provedor ({profile.aiProvider.toUpperCase()})
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginVertical: 8 }}
        >
          {TRAINING_GOALS.map((g) => {
            const active = (profile.trainingGoal || 'recomposition') === g.key;
            return (
              <TouchableOpacity
                key={g.key}
                onPress={() =>
                  onUpdateProfile({ ...profile, trainingGoal: g.key })
                }
                style={[
                  styles.goalChip,
                  active && {
                    backgroundColor: '#38BDF825',
                    borderColor: '#38BDF8',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.goalChipText,
                    active && { color: '#38BDF8', fontWeight: '800' },
                  ]}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Frequência Semanal de Treinos */}
        <View style={[styles.rowBetween, { marginBottom: 10 }]}>
          <Text style={styles.freqLabel}>Treinos por semana:</Text>
          <View style={styles.freqPillsRow}>
            {[3, 4, 5, 6].map((n) => {
              const isSel = (profile.weeklyWorkoutsTarget || 4) === n;
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() =>
                    onUpdateProfile({ ...profile, weeklyWorkoutsTarget: n })
                  }
                  style={[
                    styles.freqPill,
                    isSel && {
                      backgroundColor: '#10B98125',
                      borderColor: '#10B981',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.freqPillText,
                      isSel && { color: '#10B981', fontWeight: '800' },
                    ]}
                  >
                    {n}x/sem
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <TouchableOpacity
          style={styles.generateBtn}
          onPress={onGenerateAnalysis}
          disabled={loadingAi}
        >
          {loadingAi ? (
            <>
              <ActivityIndicator size="small" color="#0F172A" />
              <Text style={styles.generateBtnText}>
                Analisando Balança, Avatar, Sono e Exames...
              </Text>
            </>
          ) : (
            <>
              <Sparkles size={18} color="#0F172A" />
              <Text style={styles.generateBtnText}>
                Atualizar Plano Completo do Coach (Treino, Dieta, Hábitos & Exames)
              </Text>
            </>
          )}
        </TouchableOpacity>

        {loadingAi && streamingPreview !== '' && (
          <View style={styles.streamPreviewBox}>
            <Text style={styles.streamPreviewTitle}>
              ⚡ Gerando resposta em tempo real (Gemma On-Device):
            </Text>
            <Text style={styles.streamPreviewText}>{streamingPreview}</Text>
          </View>
        )}
      </View>

      {/* 3. NAVEGAÇÃO DE SUB-ABAS DO COACH */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.subTabsScroll}
      >
        {(
          [
            {
              key: 'overview',
              label: 'Resumo',
              icon: <Sparkles size={14} color="#38BDF8" />,
              color: '#38BDF8',
            },
            {
              key: 'training',
              label: 'Treinos',
              icon: <Dumbbell size={14} color="#10B981" />,
              color: '#10B981',
            },
            {
              key: 'nutrition',
              label: 'Alimentação',
              icon: <Apple size={14} color="#F59E0B" />,
              color: '#F59E0B',
            },
            {
              key: 'habits',
              label: 'Hábitos & Sono',
              icon: <Moon size={14} color="#A855F7" />,
              color: '#A855F7',
            },
            {
              key: 'exams',
              label: `Exames (${labExams.length})`,
              icon: <FlaskConical size={14} color="#F43F5E" />,
              color: '#F43F5E',
            },
            {
              key: 'local_models',
              label: 'Baixar IA Local (Gemma)',
              icon: <Cpu size={14} color="#F59E0B" />,
              color: '#F59E0B',
            },
            {
              key: 'chat',
              label: 'Chat Coach',
              icon: <MessageSquare size={14} color="#38BDF8" />,
              color: '#38BDF8',
            },
          ] as Array<{
            key: CoachSubTab;
            label: string;
            icon: React.ReactNode;
            color: string;
          }>
        ).map((tab) => {
          const active = subTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setSubTab(tab.key)}
              style={[
                styles.subTabBtn,
                active && {
                  backgroundColor: tab.color + '25',
                  borderColor: tab.color,
                },
              ]}
            >
              {tab.icon}
              <Text
                style={[
                  styles.subTabText,
                  active && { color: tab.color, fontWeight: '800' },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* 4. CONTEÚDO DA SUB-ABA SELECIONADA */}
      {subTab === 'overview' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>
            📊 Diagnóstico Integrado (Balança + Avatar + Exames)
          </Text>
          <Text style={styles.planBodyText}>
            {coachPlan
              ? coachPlan.overviewAnalysis
              : 'Toque no botão azul acima para gerar seu plano completo cruzando bioimpedância, medidas do Avatar, Samsung Health e exames de sangue!'}
          </Text>

          {coachPlan && (
            <View style={styles.quickJumpRow}>
              <TouchableOpacity
                style={styles.quickJumpBtn}
                onPress={() => setSubTab('training')}
              >
                <Dumbbell size={14} color="#10B981" />
                <Text style={styles.quickJumpText}>Ver Treino</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickJumpBtn}
                onPress={() => setSubTab('nutrition')}
              >
                <Apple size={14} color="#F59E0B" />
                <Text style={styles.quickJumpText}>Ver Dieta</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickJumpBtn}
                onPress={() => setSubTab('exams')}
              >
                <FlaskConical size={14} color="#F43F5E" />
                <Text style={styles.quickJumpText}>Ver Exames</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickJumpBtn}
                onPress={() => setSubTab('local_models')}
              >
                <Download size={14} color="#38BDF8" />
                <Text style={styles.quickJumpText}>Gemma Local</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {subTab === 'training' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>
            🏋️ Prescrição de Treinos & Simetria Corporal
          </Text>
          <Text style={styles.planBodyText}>
            {coachPlan
              ? coachPlan.trainingPlan
              : 'Toque em "Atualizar Plano Completo do Coach" acima para gerar sua prescrição de treino!'}
          </Text>
        </View>
      )}

      {subTab === 'nutrition' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>
            🥗 Plano Alimentar, Calorias, Macros & Suplementação
          </Text>
          <Text style={styles.planBodyText}>
            {coachPlan
              ? coachPlan.nutritionPlan
              : 'Toque em "Atualizar Plano Completo do Coach" acima para calcular suas calorias e macronutrientes!'}
          </Text>
        </View>
      )}

      {subTab === 'habits' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>
            🌙 Hábitos Diários, Higiene do Sono & Rotina
          </Text>
          <Text style={styles.planBodyText}>
            {coachPlan
              ? coachPlan.habitsAndRecoveryPlan
              : 'Toque em "Atualizar Plano Completo do Coach" acima para ver seu protocolo de sono e hábitos!'}
          </Text>
        </View>
      )}

      {/* SUB-ABA: EXAMES LABORATORIAIS & BIOMARCADORES */}
      {subTab === 'exams' && (
        <View style={styles.sectionCard}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionCardTitle}>
                🧪 Resultados de Exames Clínicos
              </Text>
              <Text style={styles.sectionCardSubtitle}>
                Cadastre seus exames de sangue para que o Coach ajuste sua alimentação, suplementos e treino com precisão clínica.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.addExamBtn}
              onPress={() => setShowNewExamForm(!showNewExamForm)}
            >
              <Plus size={15} color="#0F172A" />
              <Text style={styles.addExamBtnText}>
                {showNewExamForm ? 'Fechar' : 'Novo Exame'}
              </Text>
            </TouchableOpacity>
          </View>

          {examSavedMsg !== '' && (
            <View style={styles.successBanner}>
              <Text style={styles.successBannerText}>{examSavedMsg}</Text>
            </View>
          )}

          {/* Formulário para Adicionar / Atualizar Resultados de Exames */}
          {showNewExamForm && (
            <View style={styles.examFormBox}>
              <Text style={styles.examFormHeading}>
                Registrar / Atualizar Resultados de Exames
              </Text>

              <Text style={styles.inputLabel}>Nome / Data da Bateria de Exames</Text>
              <TextInput
                style={styles.textInput}
                value={examLabel}
                onChangeText={setExamLabel}
                placeholder="Ex: Check-up Laboratorial Outubro"
                placeholderTextColor="#64748B"
              />

              {/* Abas de Categoria de Biomarcadores */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginVertical: 10 }}
              >
                {BIOMARKER_CATEGORIES.map((cat) => {
                  const isSel = examCategory === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      onPress={() => setExamCategory(cat.key)}
                      style={[
                        styles.catChip,
                        isSel && {
                          backgroundColor: cat.color + '25',
                          borderColor: cat.color,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          isSel && { color: cat.color, fontWeight: '800' },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Inputs numéricos da categoria selecionada */}
              <View style={styles.biomarkerInputsGrid}>
                {LAB_BIOMARKERS_GUIDE.filter(
                  (g) => g.category === examCategory && g.key !== 'homaIr'
                ).map((g) => {
                  const minRef =
                    profile.sex === 'male' ? g.minIdealMale : g.minIdealFemale;
                  const maxRef =
                    profile.sex === 'male' ? g.maxIdealMale : g.maxIdealFemale;
                  return (
                    <View key={g.key} style={styles.biomarkerInputCell}>
                      <Text style={styles.biomarkerInputLabel}>{g.label}</Text>
                      <Text style={styles.biomarkerRefHint}>
                        Ideal: {minRef}–{maxRef} {g.unit}
                      </Text>
                      <View style={styles.inputWithUnitRow}>
                        <TextInput
                          style={styles.biomarkerInput}
                          keyboardType="numeric"
                          placeholder={g.placeholder}
                          placeholderTextColor="#475569"
                          value={examInputs[g.key] || ''}
                          onChangeText={(txt) =>
                            setExamInputs((prev) => ({ ...prev, [g.key]: txt }))
                          }
                        />
                        <Text style={styles.unitTag}>{g.unit}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>

              {/* Cálculo automático do HOMA-IR em tempo real */}
              {examCategory === 'glycemic' && (
                <View style={styles.homaPreviewBox}>
                  <Text style={styles.homaPreviewText}>
                    🧬 Índice HOMA-IR Calculado Automaticamente:{' '}
                    <Text style={{ color: '#38BDF8', fontWeight: '800' }}>
                      {calculateHomaIr(
                        parseFloat(
                          (examInputs.fastingGlucoseMgDl || '0').replace(',', '.')
                        ),
                        parseFloat(
                          (examInputs.fastingInsulinUiuMl || '0').replace(',', '.')
                        )
                      ) ?? '--'}{' '}
                      (Ideal {'<'} 2.1)
                    </Text>
                  </Text>
                </View>
              )}

              <Text style={styles.inputLabel}>
                Outros Exames / Laudo Médico / Restrições Alimentares (Texto Livre)
              </Text>
              <TextInput
                style={[styles.textInput, { minHeight: 66, textAlignVertical: 'top' }]}
                multiline
                value={examNotes}
                onChangeText={setExamNotes}
                placeholder="Ex: Ácido úrico 5.8 mg/dL, intolerância a lactose, ergoespirometria VO2max 44 ml/kg/min..."
                placeholderTextColor="#64748B"
              />

              <TouchableOpacity
                style={styles.saveExamSubmitBtn}
                onPress={handleSaveNewExam}
              >
                <CheckCircle2 size={17} color="#0F172A" />
                <Text style={styles.saveExamSubmitText}>
                  Salvar Exames e Integrar ao Coach IA
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Painel de Biomarcadores do Último Exame */}
          {latestExam && latestExamEval ? (
            <View style={{ marginTop: 10 }}>
              <View style={styles.rowBetween}>
                <Text style={styles.examCurrentTitle}>
                  📋 {latestExam.label} (
                  {new Date(latestExam.timestamp).toLocaleDateString('pt-BR')})
                </Text>
                <TouchableOpacity
                  style={styles.deleteExamBtn}
                  onPress={() => onDeleteLabExam(latestExam.id)}
                >
                  <Trash2 size={13} color="#FCA5A5" />
                  <Text style={styles.deleteExamBtnText}>Excluir</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.evalGrid}>
                {latestExamEval.evaluations.map((ev) => (
                  <View
                    key={ev.guide.key}
                    style={[
                      styles.evalBadgeCard,
                      { borderColor: ev.color + '70' },
                    ]}
                  >
                    <View style={styles.rowBetween}>
                      <Text style={styles.evalShortLabel}>
                        {ev.guide.shortLabel}
                      </Text>
                      <Text style={[styles.evalStatusTag, { color: ev.color }]}>
                        {ev.statusLabel}
                      </Text>
                    </View>
                    <Text style={styles.evalValueText}>
                      {ev.value}{' '}
                      <Text style={styles.evalUnitText}>{ev.guide.unit}</Text>
                    </Text>
                  </View>
                ))}
              </View>

              {coachPlan && (
                <View style={styles.examCoachInterpretationBox}>
                  <Text style={styles.planBodyText}>{coachPlan.examsAnalysis}</Text>
                </View>
              )}
            </View>
          ) : (
            <Text style={styles.emptyText}>
              Nenhum exame cadastrado. Toque em "Novo Exame" acima para adicionar seus resultados!
            </Text>
          )}
        </View>
      )}

      {/* SUB-ABA: BAIXAR E RODAR MODELO LOCAL GEMMA (ON-DEVICE GGUF) */}
      {subTab === 'local_models' && (
        <View style={styles.sectionCard}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionCardTitle}>
                ⚡ Modelos Locais Google Gemma (On-Device GGUF)
              </Text>
              <Text style={styles.sectionCardSubtitle}>
                Baixe um modelo da família Google Gemma diretamente no seu celular para rodar o Coach IA localmente (via motor nativo C++ llama.rn), sem depender de chaves de API ou nuvem!
              </Text>
            </View>
          </View>

          {modelStatusMsg !== '' && (
            <View style={styles.modelStatusBanner}>
              <Text style={styles.modelStatusBannerText}>{modelStatusMsg}</Text>
            </View>
          )}

          {/* Progresso de Download em Tempo Real */}
          {downloadingModelId && (
            <View style={styles.downloadProgressBox}>
              <View style={styles.rowBetween}>
                <Text style={styles.downloadProgressTitle}>
                  Baixando Modelo GGUF ({downloadProgress.progressPercent}%)
                </Text>
                <TouchableOpacity
                  style={styles.cancelDownloadBtn}
                  onPress={handleCancelDownload}
                >
                  <XCircle size={14} color="#FCA5A5" />
                  <Text style={styles.cancelDownloadText}>Cancelar</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${downloadProgress.progressPercent}%` },
                  ]}
                />
              </View>
              <Text style={styles.downloadBytesText}>
                {downloadProgress.downloadedMb} MB de {downloadProgress.totalMb} MB
              </Text>
            </View>
          )}

          {/* Lista de Modelos Gemma Disponíveis para Download */}
          {LOCAL_GEMMA_MODELS.map((m) => {
            const st = downloadedMap[m.id];
            const isDownloaded = Boolean(st?.isDownloaded);
            const isSelected =
              profile.aiProvider === 'gemma_local' &&
              (profile.selectedLocalModelId || 'gemma-3-1b-q4') === m.id;
            const isDownloadingThis = downloadingModelId === m.id;

            return (
              <View
                key={m.id}
                style={[
                  styles.modelCard,
                  isSelected && {
                    borderColor: '#F59E0B',
                    backgroundColor: '#F59E0B10',
                  },
                ]}
              >
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowWrap}>
                      <Text style={styles.modelTitle}>{m.name}</Text>
                      {m.recommended && (
                        <View style={styles.recBadge}>
                          <Text style={styles.recBadgeText}>RECOMENDADO</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.modelMetaText}>
                      {m.family} • {m.quantization} • ~{m.sizeMb} MB • RAM mín:{' '}
                      {m.ramRequiredGb} GB
                    </Text>
                  </View>
                </View>

                <Text style={styles.modelDescText}>{m.description}</Text>

                <View style={styles.modelActionsRow}>
                  {isDownloaded ? (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.activateModelBtn,
                          isSelected && styles.activateModelBtnActive,
                        ]}
                        onPress={() =>
                          onUpdateProfile({
                            ...profile,
                            aiProvider: 'gemma_local',
                            selectedLocalModelId: m.id,
                          })
                        }
                      >
                        <CheckCircle2
                          size={15}
                          color={isSelected ? '#0F172A' : '#10B981'}
                        />
                        <Text
                          style={[
                            styles.activateModelBtnText,
                            isSelected && { color: '#0F172A' },
                          ]}
                        >
                          {isSelected
                            ? ramInfo.loaded
                              ? 'Ativo na RAM do Coach'
                              : 'Selecionado no Coach ✅'
                            : 'Usar este Modelo no Coach'}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.deleteModelBtn}
                        onPress={() => handleDeleteModel(m)}
                      >
                        <Trash2 size={14} color="#FCA5A5" />
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.downloadModelBtn,
                        Boolean(downloadingModelId) && { opacity: 0.6 },
                      ]}
                      disabled={Boolean(downloadingModelId)}
                      onPress={() => handleStartModelDownload(m)}
                    >
                      {isDownloadingThis ? (
                        <ActivityIndicator size="small" color="#0F172A" />
                      ) : (
                        <Download size={15} color="#0F172A" />
                      )}
                      <Text style={styles.downloadModelBtnText}>
                        {isDownloadingThis
                          ? `Baixando (${downloadProgress.progressPercent}%)...`
                          : `Baixar no Aparelho (${m.sizeMb} MB)`}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })}

          {/* Opção de URL GGUF Customizada (ex: outro modelo Gemma do HuggingFace) */}
          <View style={styles.customUrlCard}>
            <Text style={styles.modelTitle}>
              🔗 Baixar Outro Modelo GGUF via Link (HuggingFace)
            </Text>
            <Text style={styles.modelDescText}>
              Cole qualquer link direto `.gguf` (ex: Gemma 2B, Qwen 2.5, Phi-3, Llama 3) para baixar e rodar localmente no Coach:
            </Text>
            <TextInput
              style={styles.textInput}
              placeholder="https://huggingface.co/.../resolve/main/modelo.gguf"
              placeholderTextColor="#475569"
              value={profile.customLocalModelUrl || ''}
              onChangeText={(v) =>
                onUpdateProfile({ ...profile, customLocalModelUrl: v })
              }
            />
            {profile.customLocalModelUrl &&
              profile.customLocalModelUrl.trim().length > 12 && (
                <TouchableOpacity
                  style={[styles.downloadModelBtn, { marginTop: 8 }]}
                  disabled={Boolean(downloadingModelId)}
                  onPress={() => {
                    const customSpec = getModelSpecById(
                      'custom_gguf',
                      profile.customLocalModelUrl
                    );
                    handleStartModelDownload(customSpec);
                  }}
                >
                  <Download size={15} color="#0F172A" />
                  <Text style={styles.downloadModelBtnText}>
                    Baixar e Ativar GGUF Customizado
                  </Text>
                </TouchableOpacity>
              )}
          </View>
        </View>
      )}

      {/* SUB-ABA: CHAT INTERATIVO COM O COACH */}
      {subTab === 'chat' && (
        <View style={styles.sectionCard}>
          <Text style={styles.sectionCardTitle}>
            💬 Converse com seu Coach Biomédico
          </Text>
          <Text style={styles.sectionCardSubtitle}>
            Tire dúvidas específicas sobre substituições na dieta, divisão de exercícios ou resultados dos seus exames.
          </Text>

          {/* Sugestões rápidas de perguntas */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginVertical: 8 }}
          >
            {QUICK_QUESTIONS.map((qq, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.quickQuestionChip}
                onPress={() => handleAskCoach(qq)}
              >
                <Text style={styles.quickQuestionText}>{qq}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Histórico de Mensagens do Chat */}
          <View style={styles.chatHistoryBox}>
            {chatMessages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.chatBubble,
                    isUser ? styles.chatBubbleUser : styles.chatBubbleCoach,
                  ]}
                >
                  {!isUser && msg.providerBadge && (
                    <Text style={styles.chatProviderBadge}>
                      🤖 {msg.providerBadge}
                    </Text>
                  )}
                  <Text
                    style={[
                      styles.chatBubbleText,
                      isUser && { color: '#0F172A', fontWeight: '700' },
                    ]}
                  >
                    {msg.text}
                  </Text>
                </View>
              );
            })}
            {chatLoading && (
              <View style={[styles.chatBubble, styles.chatBubbleCoach]}>
                <ActivityIndicator size="small" color="#38BDF8" />
                <Text style={styles.chatProviderBadge}>
                  Coach elaborando resposta com seus dados...
                </Text>
              </View>
            )}
          </View>

          {/* Barra de envio de pergunta */}
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Pergunte sobre treino, dieta ou exames..."
              placeholderTextColor="#64748B"
              value={chatQuestion}
              onChangeText={setChatQuestion}
            />
            <TouchableOpacity
              style={styles.chatSendBtn}
              onPress={() => handleAskCoach()}
              disabled={chatLoading}
            >
              <Send size={17} color="#0F172A" />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 10,
  },
  controlCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  smallSectionLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  settingsLinkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E293B',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
  },
  settingsLinkText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  goalChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  goalChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  freqLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  freqPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  freqPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  freqPillText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#38BDF8',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 13,
    gap: 8,
  },
  generateBtnText: {
    color: '#0F172A',
    fontWeight: '800',
    fontSize: 13,
    textAlign: 'center',
    flexShrink: 1,
  },
  streamPreviewBox: {
    marginTop: 10,
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B60',
  },
  streamPreviewTitle: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  streamPreviewText: {
    color: '#E2E8F0',
    fontSize: 12,
    lineHeight: 18,
  },
  subTabsScroll: {
    marginBottom: 12,
  },
  subTabBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginRight: 8,
  },
  subTabText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionCard: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 26,
  },
  sectionCardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  sectionCardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  planBodyText: {
    color: '#E2E8F0',
    fontSize: 13.5,
    lineHeight: 21,
  },
  quickJumpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  quickJumpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0F172A',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickJumpText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '700',
  },
  addExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 10,
  },
  addExamBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  successBanner: {
    backgroundColor: '#064E3B',
    borderColor: '#10B981',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginVertical: 8,
  },
  successBannerText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
  },
  examFormBox: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginVertical: 10,
  },
  examFormHeading: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 6,
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  textInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    color: '#F8FAFC',
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 13,
  },
  catChip: {
    backgroundColor: '#111827',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 8,
  },
  catChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  biomarkerInputsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  biomarkerInputCell: {
    width: '48%',
    backgroundColor: '#111827',
    padding: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  biomarkerInputLabel: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  biomarkerRefHint: {
    color: '#64748B',
    fontSize: 9.5,
    marginTop: 1,
    marginBottom: 5,
  },
  inputWithUnitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  biomarkerInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    fontWeight: '800',
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  unitTag: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  homaPreviewBox: {
    backgroundColor: '#111827',
    padding: 9,
    borderRadius: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#38BDF840',
  },
  homaPreviewText: {
    color: '#CBD5E1',
    fontSize: 11.5,
  },
  saveExamSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    paddingVertical: 11,
    borderRadius: 12,
    marginTop: 12,
  },
  saveExamSubmitText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '800',
  },
  examCurrentTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '800',
  },
  deleteExamBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#7F1D1D55',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
  },
  deleteExamBtnText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  evalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 10,
  },
  evalBadgeCard: {
    width: '48%',
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  evalShortLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  evalStatusTag: {
    fontSize: 9.5,
    fontWeight: '800',
  },
  evalValueText: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 3,
  },
  evalUnitText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  examCoachInterpretationBox: {
    marginTop: 14,
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 16,
  },
  modelStatusBanner: {
    backgroundColor: '#0F172A',
    borderColor: '#38BDF8',
    borderWidth: 1,
    padding: 10,
    borderRadius: 11,
    marginBottom: 10,
  },
  modelStatusBannerText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  downloadProgressBox: {
    backgroundColor: '#0F172A',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F59E0B',
    marginBottom: 12,
  },
  downloadProgressTitle: {
    color: '#F59E0B',
    fontSize: 12,
    fontWeight: '800',
  },
  cancelDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cancelDownloadText: {
    color: '#FCA5A5',
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarBg: {
    height: 9,
    backgroundColor: '#1E293B',
    borderRadius: 5,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
  },
  downloadBytesText: {
    color: '#94A3B8',
    fontSize: 11,
    textAlign: 'right',
  },
  modelCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 10,
  },
  modelTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '800',
  },
  recBadge: {
    backgroundColor: '#F59E0B25',
    borderColor: '#F59E0B',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recBadgeText: {
    color: '#F59E0B',
    fontSize: 9,
    fontWeight: '800',
  },
  modelMetaText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  modelDescText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    marginBottom: 10,
  },
  modelActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  downloadModelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 11,
  },
  downloadModelBtnText: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '800',
  },
  activateModelBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#10B981',
    paddingVertical: 10,
    borderRadius: 11,
  },
  activateModelBtnActive: {
    backgroundColor: '#10B981',
  },
  activateModelBtnText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '800',
  },
  deleteModelBtn: {
    backgroundColor: '#7F1D1D60',
    borderWidth: 1,
    borderColor: '#EF444480',
    padding: 10,
    borderRadius: 11,
  },
  customUrlCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    marginTop: 4,
  },
  quickQuestionChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#38BDF860',
    marginRight: 8,
  },
  quickQuestionText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '600',
  },
  chatHistoryBox: {
    marginVertical: 10,
    gap: 8,
  },
  chatBubble: {
    padding: 12,
    borderRadius: 14,
    maxWidth: '94%',
  },
  chatBubbleUser: {
    backgroundColor: '#38BDF8',
    alignSelf: 'flex-end',
  },
  chatBubbleCoach: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    alignSelf: 'flex-start',
  },
  chatProviderBadge: {
    color: '#F59E0B',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
  },
  chatBubbleText: {
    color: '#E2E8F0',
    fontSize: 13,
    lineHeight: 19,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 12,
    color: '#F8FAFC',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  chatSendBtn: {
    backgroundColor: '#38BDF8',
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
