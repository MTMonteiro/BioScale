import React, { useEffect, useState } from 'react';
import {
  Modal,
  SafeAreaView,
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
  X,
  Cpu,
  User,
  Database,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  KeyRound,
  Activity,
  Cloud,
} from 'lucide-react-native';
import {
  AiProvider,
  LocalGemmaModelSpec,
  SamsungHealthSummary,
  Sex,
  TrainingGoal,
  UserProfile,
} from '../types/health';
import {
  cancelActiveModelDownload,
  deleteDownloadedGemmaModel,
  DownloadedModelStatus,
  downloadLocalGemmaModel,
  getAllModelsDownloadStatus,
  getModelSpecById,
  isLocalGemmaLoadedInRam,
  LOCAL_GEMMA_MODELS,
  releaseLocalGemmaModel,
} from '../services/localModelService';
import {
  DEEPSEEK_SUGGESTED_MODELS,
  OPENROUTER_SUGGESTED_MODELS,
} from '../services/aiCoachService';
import { SUPABASE_SQL_SCHEMA } from '../services/storageAndCloud';
import { obsidianTheme } from '../theme/obsidianTheme';

export interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  profile: UserProfile;
  onUpdateProfile: (nextProfile: UserProfile) => Promise<void> | void;
  onSyncSamsungHealth: () => Promise<void>;
  syncingHealth: boolean;
  samsungHealth: SamsungHealthSummary;
}

type SettingsTabKey = 'ai_engine' | 'biometric_profile' | 'integrations';

const AI_PROVIDERS_LIST: Array<{
  key: AiProvider;
  title: string;
  subtitle: string;
}> = [
  {
    key: 'gemma_local',
    title: 'Gemma Local (On-Device)',
    subtitle: 'Privado • Roda offline via llama.rn GGUF no celular',
  },
  {
    key: 'openrouter',
    title: 'OpenRouter Cloud',
    subtitle: 'Gemma 3 27B, DeepSeek R1/V3, Claude, GPT-4o',
  },
  {
    key: 'deepseek',
    title: 'DeepSeek API',
    subtitle: 'DeepSeek V3 / Reasoner R1 direto na nuvem',
  },
  {
    key: 'gemini',
    title: 'Google Gemini',
    subtitle: 'Gemini 2.5 Flash via Google AI Studio',
  },
  {
    key: 'local',
    title: 'Motor Clínico Offline',
    subtitle: 'Cálculo bio-heurístico instantâneo sem download',
  },
];

const TRAINING_GOAL_OPTIONS: Array<{
  key: TrainingGoal;
  label: string;
  desc: string;
}> = [
  {
    key: 'recomposition',
    label: 'Recomposição',
    desc: 'Reduzir gordura preservando/ganhando massa magra',
  },
  {
    key: 'fat_loss',
    label: 'Cutting (Secar)',
    desc: 'Déficit calórico focado em definição e queima visceral',
  },
  {
    key: 'hypertrophy',
    label: 'Hipertrofia',
    desc: 'Superávit controlado para ganho muscular limpo',
  },
  {
    key: 'longevity',
    label: 'Longevidade',
    desc: 'Otimização metabólica, sono e marcadores clínicos',
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  visible,
  onClose,
  profile,
  onUpdateProfile,
  onSyncSamsungHealth,
  syncingHealth,
  samsungHealth,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTabKey>('ai_engine');

  // Estado editável do Perfil
  const [draftProfile, setDraftProfile] = useState<UserProfile>(profile);
  const [heightInput, setHeightInput] = useState<string>(
    String(profile.heightCm || 175)
  );
  const [ageInput, setAgeInput] = useState<string>(String(profile.age || 28));
  const [targetWeightInput, setTargetWeightInput] = useState<string>(
    String(profile.targetWeightKg || 74)
  );

  // Estados da Central de Download de Modelos Locais Gemma GGUF
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
  const [modelStatusBanner, setModelStatusBanner] = useState<string>('');
  const [ramState, setRamState] = useState<{
    loaded: boolean;
    modelUri: string | null;
  }>({ loaded: false, modelUri: null });

  // Estado do Accordion SQL Supabase e confirmação de salvamento
  const [showSqlSchema, setShowSqlSchema] = useState<boolean>(false);
  const [savedSuccessBadge, setSavedSuccessBadge] = useState<boolean>(false);

  const refreshModelsState = async (customUrl?: string) => {
    const map = await getAllModelsDownloadStatus(
      customUrl ?? draftProfile.customLocalModelUrl
    );
    setDownloadedMap(map);
    setRamState(isLocalGemmaLoadedInRam());
  };

  useEffect(() => {
    if (visible) {
      setDraftProfile(profile);
      setHeightInput(String(profile.heightCm || 175));
      setAgeInput(String(profile.age || 28));
      setTargetWeightInput(String(profile.targetWeightKg || 74));
      refreshModelsState(profile.customLocalModelUrl);
    }
  }, [visible, profile]);

  const buildSanitizedProfile = (base: UserProfile = draftProfile): UserProfile => {
    const parsedHeight = parseFloat(heightInput.replace(',', '.'));
    const parsedAge = parseInt(ageInput, 10);
    const parsedTargetWeight = parseFloat(targetWeightInput.replace(',', '.'));

    return {
      ...base,
      name: (base.name || 'Usuário').trim(),
      heightCm:
        !isNaN(parsedHeight) && parsedHeight >= 100 && parsedHeight <= 240
          ? Math.round(parsedHeight)
          : profile.heightCm || 175,
      age:
        !isNaN(parsedAge) && parsedAge >= 10 && parsedAge <= 110
          ? parsedAge
          : profile.age || 28,
      targetWeightKg:
        !isNaN(parsedTargetWeight) &&
        parsedTargetWeight >= 35 &&
        parsedTargetWeight <= 250
          ? Math.round(parsedTargetWeight * 10) / 10
          : profile.targetWeightKg || 74,
    };
  };

  const handleSaveAllSettings = async () => {
    const next = buildSanitizedProfile();
    setDraftProfile(next);
    await onUpdateProfile(next);
    setSavedSuccessBadge(true);
    setTimeout(() => {
      setSavedSuccessBadge(false);
    }, 2800);
  };

  const handleDownloadModel = async (spec: LocalGemmaModelSpec) => {
    if (downloadingModelId) return;
    setDownloadingModelId(spec.id);
    setModelStatusBanner(`Baixando ${spec.name} direto para o armazenamento local...`);
    setDownloadProgress({
      progressPercent: 1,
      downloadedMb: 0,
      totalMb: spec.sizeMb,
    });

    try {
      await downloadLocalGemmaModel(spec, (prog) => {
        setDownloadProgress(prog);
      });
      await refreshModelsState();
      const updated = buildSanitizedProfile({
        ...draftProfile,
        aiProvider: 'gemma_local',
        selectedLocalModelId: spec.id,
      });
      setDraftProfile(updated);
      await onUpdateProfile(updated);
      setModelStatusBanner(
        `Modelo ${spec.name} baixado e ativado como motor neural on-device!`
      );
    } catch (err: any) {
      setModelStatusBanner(
        err?.message || 'Não foi possível concluir o download do arquivo GGUF.'
      );
    } finally {
      setDownloadingModelId(null);
    }
  };

  const handleCancelDownload = async () => {
    await cancelActiveModelDownload();
    setDownloadingModelId(null);
    setModelStatusBanner('Download cancelado pelo usuário.');
  };

  const handleActivateDownloadedModel = async (modelId: string) => {
    const updated = buildSanitizedProfile({
      ...draftProfile,
      aiProvider: 'gemma_local',
      selectedLocalModelId: modelId,
    });
    setDraftProfile(updated);
    await onUpdateProfile(updated);
    setModelStatusBanner('Modelo local ativado como motor principal do Coach.');
  };

  const handleDeleteModelFile = async (spec: LocalGemmaModelSpec) => {
    const executeRemove = async () => {
      await deleteDownloadedGemmaModel(spec);
      await refreshModelsState();
      setModelStatusBanner(
        `Arquivo GGUF (${spec.filename}) removido para liberar espaço.`
      );
    };

    if (Platform.OS === 'web') {
      await executeRemove();
      return;
    }

    Alert.alert(
      'Excluir Arquivo GGUF',
      `Deseja remover ${spec.filename} (~${spec.sizeMb} MB) do armazenamento interno do aparelho?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Excluir Arquivo', style: 'destructive', onPress: executeRemove },
      ]
    );
  };

  const handleReleaseRamContext = async () => {
    await releaseLocalGemmaModel();
    await refreshModelsState();
    setModelStatusBanner('Contexto llama.rn descarregado da memória RAM.');
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        {/* Top Bar Minimalista */}
        <View style={styles.topBar}>
          <View>
            <Text style={styles.topBarEyebrow}>BIOSCALE OBSIDIAN</Text>
            <Text style={styles.topBarTitle}>Configurações & Motor IA</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            accessibilityLabel="Fechar configurações"
          >
            <X size={18} color={obsidianTheme.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* Segmented Control (3 Abas Limpas) */}
        <View style={styles.segmentedWrapper}>
          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'ai_engine' && styles.segmentBtnActive,
            ]}
            onPress={() => setActiveTab('ai_engine')}
          >
            <Cpu
              size={14}
              color={
                activeTab === 'ai_engine'
                  ? obsidianTheme.accent
                  : obsidianTheme.textSecondary
              }
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === 'ai_engine' && styles.segmentBtnTextActive,
              ]}
              numberOfLines={1}
            >
              Motor IA & Gemma
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'biometric_profile' && styles.segmentBtnActive,
            ]}
            onPress={() => setActiveTab('biometric_profile')}
          >
            <User
              size={14}
              color={
                activeTab === 'biometric_profile'
                  ? obsidianTheme.accent
                  : obsidianTheme.textSecondary
              }
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === 'biometric_profile' && styles.segmentBtnTextActive,
              ]}
              numberOfLines={1}
            >
              Perfil Biométrico
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.segmentBtn,
              activeTab === 'integrations' && styles.segmentBtnActive,
            ]}
            onPress={() => setActiveTab('integrations')}
          >
            <Database
              size={14}
              color={
                activeTab === 'integrations'
                  ? obsidianTheme.accent
                  : obsidianTheme.textSecondary
              }
            />
            <Text
              style={[
                styles.segmentBtnText,
                activeTab === 'integrations' && styles.segmentBtnTextActive,
              ]}
              numberOfLines={1}
            >
              Dados & Nuvem
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollArea}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ABA 1: MOTOR IA & GEMMA LOCAL */}
          {activeTab === 'ai_engine' && (
            <View>
              <View style={styles.card}>
                <Text style={styles.cardSectionLabel}>PROVEDOR DE INTELIGÊNCIA ARTIFICIAL</Text>
                <Text style={styles.cardDescription}>
                  Escolha como o Coach Biomédico processa seus dados de balança, avatar e exames de sangue.
                </Text>

                <View style={styles.providerList}>
                  {AI_PROVIDERS_LIST.map((prov) => {
                    const selected = draftProfile.aiProvider === prov.key;
                    return (
                      <TouchableOpacity
                        key={prov.key}
                        style={[
                          styles.providerOption,
                          selected && styles.providerOptionActive,
                        ]}
                        onPress={() =>
                          setDraftProfile((prev) => ({
                            ...prev,
                            aiProvider: prov.key,
                          }))
                        }
                      >
                        <View style={styles.providerRadioOuter}>
                          {selected && <View style={styles.providerRadioInner} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.providerTitle,
                              selected && { color: obsidianTheme.accent },
                            ]}
                          >
                            {prov.title}
                          </Text>
                          <Text style={styles.providerSubtitle}>
                            {prov.subtitle}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Configuração de API Keys quando OpenRouter / DeepSeek / Gemini selecionado */}
              {draftProfile.aiProvider === 'openrouter' && (
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardSectionLabel}>OPENROUTER API</Text>
                    <KeyRound size={14} color={obsidianTheme.accent} />
                  </View>
                  <Text style={styles.inputLabel}>Chave da API OpenRouter</Text>
                  <TextInput
                    style={styles.textInput}
                    secureTextEntry
                    placeholder="sk-or-v1-..."
                    placeholderTextColor={obsidianTheme.textMuted}
                    value={draftProfile.openRouterApiKey || ''}
                    onChangeText={(txt) =>
                      setDraftProfile((prev) => ({
                        ...prev,
                        openRouterApiKey: txt,
                      }))
                    }
                  />

                  <Text style={styles.inputLabel}>Modelo OpenRouter</Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="deepseek/deepseek-chat"
                    placeholderTextColor={obsidianTheme.textMuted}
                    value={draftProfile.openRouterModel || ''}
                    onChangeText={(txt) =>
                      setDraftProfile((prev) => ({
                        ...prev,
                        openRouterModel: txt,
                      }))
                    }
                  />

                  <Text style={[styles.inputLabel, { marginTop: 10 }]}>
                    Modelos Sugeridos (Toque para selecionar):
                  </Text>
                  <View style={styles.chipsWrap}>
                    {OPENROUTER_SUGGESTED_MODELS.map((m) => {
                      const active = draftProfile.openRouterModel === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.presetChip,
                            active && styles.presetChipActive,
                          ]}
                          onPress={() =>
                            setDraftProfile((prev) => ({
                              ...prev,
                              openRouterModel: m.id,
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              active && styles.presetChipTextActive,
                            ]}
                          >
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {draftProfile.aiProvider === 'deepseek' && (
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardSectionLabel}>DEEPSEEK API DIRETA</Text>
                    <KeyRound size={14} color={obsidianTheme.accent} />
                  </View>
                  <Text style={styles.inputLabel}>Chave da API DeepSeek</Text>
                  <TextInput
                    style={styles.textInput}
                    secureTextEntry
                    placeholder="sk-..."
                    placeholderTextColor={obsidianTheme.textMuted}
                    value={draftProfile.deepseekApiKey || ''}
                    onChangeText={(txt) =>
                      setDraftProfile((prev) => ({
                        ...prev,
                        deepseekApiKey: txt,
                      }))
                    }
                  />

                  <Text style={[styles.inputLabel, { marginTop: 10 }]}>
                    Modelo DeepSeek:
                  </Text>
                  <View style={styles.chipsWrap}>
                    {DEEPSEEK_SUGGESTED_MODELS.map((m) => {
                      const active =
                        (draftProfile.deepseekModel || 'deepseek-chat') === m.id;
                      return (
                        <TouchableOpacity
                          key={m.id}
                          style={[
                            styles.presetChip,
                            active && styles.presetChipActive,
                          ]}
                          onPress={() =>
                            setDraftProfile((prev) => ({
                              ...prev,
                              deepseekModel: m.id,
                            }))
                          }
                        >
                          <Text
                            style={[
                              styles.presetChipText,
                              active && styles.presetChipTextActive,
                            ]}
                          >
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}

              {draftProfile.aiProvider === 'gemini' && (
                <View style={styles.card}>
                  <View style={styles.rowBetween}>
                    <Text style={styles.cardSectionLabel}>GOOGLE GEMINI API</Text>
                    <KeyRound size={14} color={obsidianTheme.accent} />
                  </View>
                  <Text style={styles.inputLabel}>
                    Chave da API Google AI Studio (Gemini 2.5 Flash)
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    secureTextEntry
                    placeholder="AIzaSy..."
                    placeholderTextColor={obsidianTheme.textMuted}
                    value={draftProfile.geminiApiKey || ''}
                    onChangeText={(txt) =>
                      setDraftProfile((prev) => ({
                        ...prev,
                        geminiApiKey: txt,
                      }))
                    }
                  />
                </View>
              )}

              {/* Central de Download de Modelos Locais Gemma GGUF (via llama.rn) */}
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardSectionLabel}>
                      CENTRAL DE DOWNLOAD GEMMA LOCAL (GGUF • LLAMA.RN)
                    </Text>
                    <Text style={styles.cardDescription}>
                      Baixe modelos quantizados GGUF para rodar 100% no processador do celular sem internet.
                    </Text>
                  </View>
                  {ramState.loaded && (
                    <TouchableOpacity
                      style={styles.ramReleaseBtn}
                      onPress={handleReleaseRamContext}
                    >
                      <Text style={styles.ramReleaseText}>Liberar RAM</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {modelStatusBanner !== '' && (
                  <View style={styles.statusBanner}>
                    <Text style={styles.statusBannerText}>
                      {modelStatusBanner}
                    </Text>
                  </View>
                )}

                {downloadingModelId && (
                  <View style={styles.progressBox}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.progressTitle}>
                        Baixando GGUF ({downloadProgress.progressPercent}%)
                      </Text>
                      <TouchableOpacity
                        style={styles.cancelDownloadBtn}
                        onPress={handleCancelDownload}
                      >
                        <XCircle size={13} color={obsidianTheme.statusAlert} />
                        <Text style={styles.cancelDownloadText}>Cancelar</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          { width: `${downloadProgress.progressPercent}%` },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressBytesText}>
                      {downloadProgress.downloadedMb} MB de{' '}
                      {downloadProgress.totalMb} MB
                    </Text>
                  </View>
                )}

                {LOCAL_GEMMA_MODELS.map((spec) => {
                  const status = downloadedMap[spec.id];
                  const isDownloaded = Boolean(status?.isDownloaded);
                  const isSelected =
                    draftProfile.aiProvider === 'gemma_local' &&
                    (draftProfile.selectedLocalModelId || 'gemma-3-1b-q4') ===
                      spec.id;
                  const isDownloadingThis = downloadingModelId === spec.id;

                  return (
                    <View
                      key={spec.id}
                      style={[
                        styles.modelItemCard,
                        isSelected && styles.modelItemCardActive,
                      ]}
                    >
                      <View style={styles.rowBetween}>
                        <Text style={styles.modelItemName}>{spec.name}</Text>
                        {spec.recommended && (
                          <View style={styles.recPill}>
                            <Text style={styles.recPillText}>RECOMENDADO</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.modelItemMeta}>
                        {spec.family} • {spec.quantization} • ~{spec.sizeMb} MB •
                        RAM mín: {spec.ramRequiredGb} GB
                      </Text>
                      <Text style={styles.modelItemDesc}>{spec.description}</Text>

                      <View style={styles.modelItemActions}>
                        {isDownloaded ? (
                          <>
                            <TouchableOpacity
                              style={[
                                styles.activateBtn,
                                isSelected && styles.activateBtnSelected,
                              ]}
                              onPress={() =>
                                handleActivateDownloadedModel(spec.id)
                              }
                            >
                              <CheckCircle2
                                size={14}
                                color={
                                  isSelected
                                    ? obsidianTheme.bg
                                    : obsidianTheme.accent
                                }
                              />
                              <Text
                                style={[
                                  styles.activateBtnText,
                                  isSelected && {
                                    color: obsidianTheme.bg,
                                    fontWeight: '800',
                                  },
                                ]}
                              >
                                {isSelected
                                  ? 'Modelo Ativo no Coach'
                                  : 'Ativar Modelo'}
                              </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                              style={styles.deleteFileBtn}
                              onPress={() => handleDeleteModelFile(spec)}
                            >
                              <Trash2
                                size={13}
                                color={obsidianTheme.statusAlert}
                              />
                              <Text style={styles.deleteFileBtnText}>
                                Excluir Arquivo GGUF
                              </Text>
                            </TouchableOpacity>
                          </>
                        ) : (
                          <TouchableOpacity
                            style={[
                              styles.downloadBtn,
                              Boolean(downloadingModelId) && { opacity: 0.55 },
                            ]}
                            disabled={Boolean(downloadingModelId)}
                            onPress={() => handleDownloadModel(spec)}
                          >
                            {isDownloadingThis ? (
                              <ActivityIndicator
                                size="small"
                                color={obsidianTheme.bg}
                              />
                            ) : (
                              <Download size={14} color={obsidianTheme.bg} />
                            )}
                            <Text style={styles.downloadBtnText}>
                              {isDownloadingThis
                                ? `Baixando (${downloadProgress.progressPercent}%)...`
                                : `Baixar GGUF (${spec.sizeMb} MB)`}
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                })}

                {/* URL GGUF Customizada */}
                <View style={styles.customGgufBox}>
                  <Text style={styles.inputLabel}>
                    URL Direta .GGUF Customizada (HuggingFace opcional)
                  </Text>
                  <TextInput
                    style={styles.textInput}
                    placeholder="https://huggingface.co/.../resolve/main/model.gguf"
                    placeholderTextColor={obsidianTheme.textMuted}
                    value={draftProfile.customLocalModelUrl || ''}
                    onChangeText={(txt) =>
                      setDraftProfile((prev) => ({
                        ...prev,
                        customLocalModelUrl: txt,
                      }))
                    }
                  />
                  {draftProfile.customLocalModelUrl &&
                    draftProfile.customLocalModelUrl.trim().length > 12 && (
                      <TouchableOpacity
                        style={[styles.downloadBtn, { marginTop: 8 }]}
                        disabled={Boolean(downloadingModelId)}
                        onPress={() => {
                          const customSpec = getModelSpecById(
                            'custom_gguf',
                            draftProfile.customLocalModelUrl
                          );
                          handleDownloadModel(customSpec);
                        }}
                      >
                        <Download size={14} color={obsidianTheme.bg} />
                        <Text style={styles.downloadBtnText}>
                          Baixar e Ativar GGUF Customizado
                        </Text>
                      </TouchableOpacity>
                    )}
                </View>
              </View>
            </View>
          )}

          {/* ABA 2: PERFIL BIOMÉTRICO */}
          {activeTab === 'biometric_profile' && (
            <View style={styles.card}>
              <Text style={styles.cardSectionLabel}>DADOS ANTROPOMÉTRICOS E METAS</Text>
              <Text style={styles.cardDescription}>
                Estes parâmetros calibram as equações científicas de impedância bioelétrica (BIA), TMB e cálculo de macronutrientes.
              </Text>

              <Text style={styles.inputLabel}>Nome de Exibição</Text>
              <TextInput
                style={styles.textInput}
                value={draftProfile.name}
                onChangeText={(txt) =>
                  setDraftProfile((prev) => ({ ...prev, name: txt }))
                }
                placeholder="Seu nome"
                placeholderTextColor={obsidianTheme.textMuted}
              />

              <Text style={styles.inputLabel}>Sexo Biológico (Referência BIA & Hormonal)</Text>
              <View style={styles.sexRow}>
                {(
                  [
                    { key: 'male', label: 'Masculino' },
                    { key: 'female', label: 'Feminino' },
                  ] as Array<{ key: Sex; label: string }>
                ).map((item) => {
                  const active = draftProfile.sex === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.sexBtn, active && styles.sexBtnActive]}
                      onPress={() =>
                        setDraftProfile((prev) => ({ ...prev, sex: item.key }))
                      }
                    >
                      <Text
                        style={[
                          styles.sexBtnText,
                          active && styles.sexBtnTextActive,
                        ]}
                      >
                        {item.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.numericRow}>
                <View style={styles.numericCol}>
                  <Text style={styles.inputLabel}>Altura (cm)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={heightInput}
                    onChangeText={setHeightInput}
                    placeholder="175"
                    placeholderTextColor={obsidianTheme.textMuted}
                  />
                </View>

                <View style={styles.numericCol}>
                  <Text style={styles.inputLabel}>Idade (anos)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={ageInput}
                    onChangeText={setAgeInput}
                    placeholder="28"
                    placeholderTextColor={obsidianTheme.textMuted}
                  />
                </View>

                <View style={styles.numericCol}>
                  <Text style={styles.inputLabel}>Peso Meta (kg)</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={targetWeightInput}
                    onChangeText={setTargetWeightInput}
                    placeholder="74.0"
                    placeholderTextColor={obsidianTheme.textMuted}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Objetivo Principal do Coach
              </Text>
              <View style={styles.goalGrid}>
                {TRAINING_GOAL_OPTIONS.map((g) => {
                  const active =
                    (draftProfile.trainingGoal || 'recomposition') === g.key;
                  return (
                    <TouchableOpacity
                      key={g.key}
                      style={[
                        styles.goalOptionCard,
                        active && styles.goalOptionCardActive,
                      ]}
                      onPress={() =>
                        setDraftProfile((prev) => ({
                          ...prev,
                          trainingGoal: g.key,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.goalOptionTitle,
                          active && { color: obsidianTheme.accent },
                        ]}
                      >
                        {g.label}
                      </Text>
                      <Text style={styles.goalOptionDesc}>{g.desc}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                Frequência Semanal de Treinos (Dias/Semana)
              </Text>
              <View style={styles.daysRow}>
                {[2, 3, 4, 5, 6].map((dayCount) => {
                  const active =
                    (draftProfile.weeklyWorkoutsTarget || 4) === dayCount;
                  return (
                    <TouchableOpacity
                      key={dayCount}
                      style={[
                        styles.dayPill,
                        active && styles.dayPillActive,
                      ]}
                      onPress={() =>
                        setDraftProfile((prev) => ({
                          ...prev,
                          weeklyWorkoutsTarget: dayCount,
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.dayPillText,
                          active && styles.dayPillTextActive,
                        ]}
                      >
                        {dayCount}x / sem
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}

          {/* ABA 3: DADOS & INTEGRAÇÕES */}
          {activeTab === 'integrations' && (
            <View>
              {/* Samsung Health / Health Connect Card */}
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <View style={styles.rowCenter}>
                    <Activity size={16} color={obsidianTheme.accent} />
                    <Text style={[styles.cardSectionLabel, { marginBottom: 0 }]}>
                      SAMSUNG HEALTH (HEALTH CONNECT)
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.connPill,
                      {
                        backgroundColor: samsungHealth.isConnected
                          ? obsidianTheme.statusOptimalBg
                          : obsidianTheme.statusAttentionBg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.connPillText,
                        {
                          color: samsungHealth.isConnected
                            ? obsidianTheme.statusOptimal
                            : obsidianTheme.statusAttention,
                        },
                      ]}
                    >
                      {samsungHealth.isConnected ? 'CONECTADO' : 'SIMULAÇÃO LOCAL'}
                    </Text>
                  </View>
                </View>

                <Text style={[styles.cardDescription, { marginTop: 6 }]}>
                  Sincroniza passos diários, gasto calórico ativo e horas de sono para calibrar o plano de recuperação do Coach.
                </Text>

                <View style={styles.healthMetricsRow}>
                  <View style={styles.healthMetricBox}>
                    <Text style={styles.healthMetricValue}>
                      {samsungHealth.stepsToday.toLocaleString('pt-BR')}
                    </Text>
                    <Text style={styles.healthMetricLabel}>Passos Hoje</Text>
                  </View>
                  <View style={styles.healthMetricBox}>
                    <Text style={styles.healthMetricValue}>
                      {samsungHealth.caloriesBurnedToday} kcal
                    </Text>
                    <Text style={styles.healthMetricLabel}>Calorias</Text>
                  </View>
                  <View style={styles.healthMetricBox}>
                    <Text style={styles.healthMetricValue}>
                      {samsungHealth.sleepHoursLastNight}h
                    </Text>
                    <Text style={styles.healthMetricLabel}>Sono Ontem</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.syncNowBtn}
                  onPress={onSyncSamsungHealth}
                  disabled={syncingHealth}
                >
                  {syncingHealth ? (
                    <ActivityIndicator
                      size="small"
                      color={obsidianTheme.textPrimary}
                    />
                  ) : (
                    <RefreshCw size={15} color={obsidianTheme.accent} />
                  )}
                  <Text style={styles.syncNowBtnText}>
                    {syncingHealth
                      ? 'Sincronizando Health Connect...'
                      : 'Sincronizar Agora'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Supabase Cloud Backup Card */}
              <View style={styles.card}>
                <View style={styles.rowCenter}>
                  <Cloud size={16} color={obsidianTheme.statusNormal} />
                  <Text style={[styles.cardSectionLabel, { marginBottom: 0 }]}>
                    SUPABASE CLOUD BACKUP (OPCIONAL)
                  </Text>
                </View>
                <Text style={[styles.cardDescription, { marginTop: 6 }]}>
                  Se preenchido, replica automaticamente suas pesagens da balança, medidas do Avatar e exames na sua instância privada do Supabase.
                </Text>

                <Text style={styles.inputLabel}>Supabase Project URL</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="https://xyzcompany.supabase.co"
                  placeholderTextColor={obsidianTheme.textMuted}
                  autoCapitalize="none"
                  value={draftProfile.supabaseUrl || ''}
                  onChangeText={(txt) =>
                    setDraftProfile((prev) => ({ ...prev, supabaseUrl: txt }))
                  }
                />

                <Text style={styles.inputLabel}>Supabase Anon Public Key</Text>
                <TextInput
                  style={styles.textInput}
                  secureTextEntry
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
                  placeholderTextColor={obsidianTheme.textMuted}
                  autoCapitalize="none"
                  value={draftProfile.supabaseAnonKey || ''}
                  onChangeText={(txt) =>
                    setDraftProfile((prev) => ({
                      ...prev,
                      supabaseAnonKey: txt,
                    }))
                  }
                />

                {/* Accordion Colapsável do Schema SQL */}
                <TouchableOpacity
                  style={styles.sqlAccordionHeader}
                  onPress={() => setShowSqlSchema(!showSqlSchema)}
                >
                  <Text style={styles.sqlAccordionTitle}>
                    Ver Schema SQL do Supabase
                  </Text>
                  {showSqlSchema ? (
                    <ChevronUp size={16} color={obsidianTheme.textSecondary} />
                  ) : (
                    <ChevronDown size={16} color={obsidianTheme.textSecondary} />
                  )}
                </TouchableOpacity>

                {showSqlSchema && (
                  <View style={styles.sqlCodeBox}>
                    <Text selectable style={styles.sqlCodeText}>
                      {SUPABASE_SQL_SCHEMA}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        {/* Rodapé Fixo com Botão Emerald Salvar Configurações */}
        <View style={styles.footerBar}>
          {savedSuccessBadge && (
            <View style={styles.savedBadge}>
              <CheckCircle2 size={14} color={obsidianTheme.accent} />
              <Text style={styles.savedBadgeText}>
                Configurações salvas e aplicadas ao Coach!
              </Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.saveSettingsBtn}
            onPress={handleSaveAllSettings}
          >
            <CheckCircle2 size={17} color={obsidianTheme.bg} />
            <Text style={styles.saveSettingsBtnText}>Salvar Configurações</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: obsidianTheme.bg,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: obsidianTheme.border,
    backgroundColor: obsidianTheme.bg,
  },
  topBarEyebrow: {
    color: obsidianTheme.accent,
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1,
  },
  topBarTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: obsidianTheme.surface,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedWrapper: {
    flexDirection: 'row',
    backgroundColor: obsidianTheme.surface,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 4,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    gap: 4,
  },
  segmentBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 6,
    borderRadius: obsidianTheme.radiusSm,
  },
  segmentBtnActive: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
  },
  segmentBtnText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  segmentBtnTextActive: {
    color: obsidianTheme.textPrimary,
    fontWeight: '700',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginBottom: 14,
  },
  cardSectionLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  cardDescription: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  providerList: {
    gap: 8,
  },
  providerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: obsidianTheme.bg,
    padding: 12,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  providerOptionActive: {
    borderColor: obsidianTheme.accentBorder,
    backgroundColor: obsidianTheme.accentSoft,
  },
  providerRadioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: obsidianTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerRadioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: obsidianTheme.accent,
  },
  providerTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  providerSubtitle: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  inputLabel: {
    color: obsidianTheme.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 8,
    marginBottom: 5,
  },
  textInput: {
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    borderRadius: obsidianTheme.radiusSm,
    color: obsidianTheme.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    marginTop: 4,
  },
  presetChip: {
    backgroundColor: obsidianTheme.bg,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  presetChipActive: {
    borderColor: obsidianTheme.accentBorder,
    backgroundColor: obsidianTheme.accentSoft,
  },
  presetChipText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  presetChipTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '700',
  },
  ramReleaseBtn: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  ramReleaseText: {
    color: obsidianTheme.statusAttention,
    fontSize: 10,
    fontWeight: '700',
  },
  statusBanner: {
    backgroundColor: obsidianTheme.accentSoft,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    borderRadius: obsidianTheme.radiusSm,
    padding: 10,
    marginBottom: 12,
  },
  statusBannerText: {
    color: obsidianTheme.accent,
    fontSize: 11.5,
    fontWeight: '600',
  },
  progressBox: {
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    borderRadius: obsidianTheme.radiusMd,
    padding: 12,
    marginBottom: 12,
  },
  progressTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  cancelDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: obsidianTheme.statusAlertBg,
  },
  cancelDownloadText: {
    color: obsidianTheme.statusAlert,
    fontSize: 10.5,
    fontWeight: '700',
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: obsidianTheme.surfaceElevated,
    borderRadius: 4,
    overflow: 'hidden',
    marginVertical: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: obsidianTheme.accent,
  },
  progressBytesText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
  },
  modelItemCard: {
    backgroundColor: obsidianTheme.bg,
    borderRadius: obsidianTheme.radiusMd,
    padding: 13,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginBottom: 10,
  },
  modelItemCardActive: {
    borderColor: obsidianTheme.accentBorder,
  },
  modelItemName: {
    color: obsidianTheme.textPrimary,
    fontSize: 13.5,
    fontWeight: '700',
    flex: 1,
  },
  recPill: {
    backgroundColor: obsidianTheme.accentSoft,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  recPillText: {
    color: obsidianTheme.accent,
    fontSize: 8.5,
    fontWeight: '800',
  },
  modelItemMeta: {
    color: obsidianTheme.textMuted,
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 3,
  },
  modelItemDesc: {
    color: obsidianTheme.textSecondary,
    fontSize: 11.5,
    lineHeight: 16,
    marginTop: 5,
  },
  modelItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  downloadBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: obsidianTheme.accent,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: obsidianTheme.radiusSm,
  },
  downloadBtnText: {
    color: obsidianTheme.bg,
    fontSize: 12,
    fontWeight: '800',
  },
  activateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: obsidianTheme.radiusSm,
  },
  activateBtnSelected: {
    backgroundColor: obsidianTheme.accent,
    borderColor: obsidianTheme.accent,
  },
  activateBtnText: {
    color: obsidianTheme.accent,
    fontSize: 11.5,
    fontWeight: '700',
  },
  deleteFileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: obsidianTheme.statusAlertBg,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: obsidianTheme.radiusSm,
  },
  deleteFileBtnText: {
    color: obsidianTheme.statusAlert,
    fontSize: 11,
    fontWeight: '700',
  },
  customGgufBox: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
  },
  sexRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  sexBtn: {
    flex: 1,
    backgroundColor: obsidianTheme.bg,
    paddingVertical: 11,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    alignItems: 'center',
  },
  sexBtnActive: {
    borderColor: obsidianTheme.accentBorder,
    backgroundColor: obsidianTheme.accentSoft,
  },
  sexBtnText: {
    color: obsidianTheme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  sexBtnTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '800',
  },
  numericRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  numericCol: {
    flex: 1,
  },
  goalGrid: {
    gap: 8,
    marginTop: 4,
  },
  goalOptionCard: {
    backgroundColor: obsidianTheme.bg,
    padding: 12,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  goalOptionCardActive: {
    borderColor: obsidianTheme.accentBorder,
    backgroundColor: obsidianTheme.accentSoft,
  },
  goalOptionTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  goalOptionDesc: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  dayPill: {
    flex: 1,
    backgroundColor: obsidianTheme.bg,
    paddingVertical: 10,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    alignItems: 'center',
  },
  dayPillActive: {
    borderColor: obsidianTheme.accentBorder,
    backgroundColor: obsidianTheme.accentSoft,
  },
  dayPillText: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  dayPillTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '800',
  },
  connPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  connPillText: {
    fontSize: 9,
    fontWeight: '800',
  },
  healthMetricsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  healthMetricBox: {
    flex: 1,
    backgroundColor: obsidianTheme.bg,
    padding: 10,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    alignItems: 'center',
  },
  healthMetricValue: {
    color: obsidianTheme.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  healthMetricLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    marginTop: 2,
  },
  syncNowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    paddingVertical: 11,
    borderRadius: obsidianTheme.radiusSm,
  },
  syncNowBtnText: {
    color: obsidianTheme.textPrimary,
    fontSize: 12.5,
    fontWeight: '700',
  },
  sqlAccordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: obsidianTheme.bg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginTop: 14,
  },
  sqlAccordionTitle: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  sqlCodeBox: {
    backgroundColor: obsidianTheme.bg,
    padding: 12,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginTop: 8,
  },
  sqlCodeText: {
    color: obsidianTheme.textSecondary,
    fontSize: 10.5,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 15,
  },
  footerBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
    backgroundColor: obsidianTheme.bg,
  },
  savedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 8,
  },
  savedBadgeText: {
    color: obsidianTheme.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  saveSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: obsidianTheme.accent,
    paddingVertical: 13,
    borderRadius: obsidianTheme.radiusMd,
  },
  saveSettingsBtnText: {
    color: obsidianTheme.bg,
    fontSize: 14,
    fontWeight: '800',
  },
});
