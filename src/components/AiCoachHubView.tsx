import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import {
  Sparkles,
  Settings,
  Dumbbell,
  Apple,
  Moon,
  FlaskConical,
  MessageSquare,
  Send,
} from 'lucide-react-native';
import {
  BioimpedanceMetrics,
  BodyMeasurementsEntry,
  CoachChatMessage,
  CoachPersona,
  LabExamEntry,
  SamsungHealthSummary,
  StructuredCoachPlan,
  TrainingGoal,
  UserProfile,
} from '../types/health';
import { evaluateFullLabExam } from '../utils/labExams';
import {
  checkModelDownloaded,
  getModelSpecById,
} from '../services/localModelService';
import {
  askCoachInteractiveQuestion,
  computeBioHealthScore,
} from '../services/aiCoachService';
import { CoachAvatarSvg } from './CoachAvatarSvg';
import { MarkdownRenderer } from './MarkdownRenderer';
import { obsidianTheme } from '../theme/obsidianTheme';

export interface AiCoachHubViewProps {
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
  onSaveLabExam?: (
    exam: Omit<LabExamEntry, 'id' | 'timestamp' | 'homaIr'>
  ) => Promise<void>;
  onDeleteLabExam?: (id: string) => Promise<void>;
  onOpenSettings?: () => void;
}

type CoachSubTab = 'overview' | 'training' | 'nutrition' | 'chat';

const TRAINING_GOALS: Array<{ key: TrainingGoal; label: string }> = [
  { key: 'recomposition', label: 'Recomposição' },
  { key: 'fat_loss', label: 'Cutting' },
  { key: 'hypertrophy', label: 'Hipertrofia' },
  { key: 'longevity', label: 'Longevidade' },
];

const QUICK_QUESTIONS = [
  'O que comer no pré e pós-treino para meus dados?',
  'Qual treino focar para melhorar meu Avatar (V-Taper)?',
  'Como ajustar minha dieta pelos resultados dos meus exames?',
  'Como reduzir gordura visceral e melhorar meu sono?',
];

export const AiCoachHubView: React.FC<AiCoachHubViewProps> = ({
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
  onOpenSettings,
}) => {
  const [subTab, setSubTab] = useState<CoachSubTab>('overview');
  const [isSelectedLocalDownloaded, setIsSelectedLocalDownloaded] =
    useState<boolean>(false);

  // Estados do Chat Interativo com o Coach
  const [chatQuestion, setChatQuestion] = useState<string>('');
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<CoachChatMessage[]>([
    {
      id: 'welcome-coach',
      role: 'assistant',
      text: 'Olá! Eu sou o seu Coach Biomédico IA. Cruzo os dados da sua balança Wellmix, seu Avatar corporal, Samsung Health e Exames de Sangue para prescrever seu treino, dieta e rotina. Atualize o plano acima ou tire suas dúvidas aqui!',
      timestamp: 'Agora',
      providerBadge: 'BioScale Coach',
    },
  ]);

  const selectedLocalSpec = getModelSpecById(
    profile.selectedLocalModelId,
    profile.customLocalModelUrl
  );

  useEffect(() => {
    let active = true;
    checkModelDownloaded(selectedLocalSpec).then((st) => {
      if (active) {
        setIsSelectedLocalDownloaded(st.isDownloaded);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedLocalSpec.id, selectedLocalSpec.downloadUrl]);

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
          isSelectedLocalDownloaded ? '(On-Device)' : '(Configurar em ⚙️)'
        }`
      : coachPlan?.providerUsed || profile.aiProvider.toUpperCase();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* 1. AVATAR DO COACH + SCORE BIOMÉTRICO + PERSONA */}
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
          'Balança BIA + Avatar + Samsung Health + Exames Clínicos'
        }
      />

      {/* 2. BARRA COMPACTA DE OBJETIVO, FREQUÊNCIA E MOTOR IA */}
      <View style={styles.controlCard}>
        <View style={styles.rowBetween}>
          <Text style={styles.smallSectionLabel}>DIRETRIZ DO PROTOCOLO</Text>
          {onOpenSettings && (
            <TouchableOpacity
              style={styles.engineSettingsBtn}
              onPress={onOpenSettings}
            >
              <Settings size={13} color={obsidianTheme.accent} />
              <Text style={styles.engineSettingsBtnText}>⚙️ Motor IA</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Seletor Compacto de Objetivo */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.goalScroll}
        >
          {TRAINING_GOALS.map((g) => {
            const active = (profile.trainingGoal || 'recomposition') === g.key;
            return (
              <TouchableOpacity
                key={g.key}
                onPress={() =>
                  onUpdateProfile({ ...profile, trainingGoal: g.key })
                }
                style={[styles.goalChip, active && styles.goalChipActive]}
              >
                <Text
                  style={[
                    styles.goalChipText,
                    active && styles.goalChipTextActive,
                  ]}
                >
                  {g.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Frequência Semanal */}
        <View style={styles.freqBarRow}>
          <Text style={styles.freqLabel}>Frequência semanal:</Text>
          <View style={styles.freqPillsRow}>
            {[3, 4, 5, 6].map((n) => {
              const isSel = (profile.weeklyWorkoutsTarget || 4) === n;
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() =>
                    onUpdateProfile({ ...profile, weeklyWorkoutsTarget: n })
                  }
                  style={[styles.freqPill, isSel && styles.freqPillActive]}
                >
                  <Text
                    style={[
                      styles.freqPillText,
                      isSel && styles.freqPillTextActive,
                    ]}
                  >
                    {n}x/sem
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Botão Principal Emerald */}
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={onGenerateAnalysis}
          disabled={loadingAi}
        >
          {loadingAi ? (
            <>
              <ActivityIndicator size="small" color={obsidianTheme.bg} />
              <Text style={styles.generateBtnText}>
                Processando Balança, Avatar, Sono e Exames...
              </Text>
            </>
          ) : (
            <>
              <Sparkles size={16} color={obsidianTheme.bg} />
              <Text style={styles.generateBtnText}>
                Atualizar Plano com IA
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Live Token Streaming Preview (Gemma Local On-Device) */}
        {loadingAi && streamingPreview !== '' && (
          <View style={styles.streamPreviewBox}>
            <Text style={styles.streamPreviewTitle}>
              ⚡ Inferência On-Device em Tempo Real:
            </Text>
            <MarkdownRenderer content={streamingPreview} compact />
          </View>
        )}
      </View>

      {/* 3. CONTROLE SEGMENTADO DE 4 ABAS LIMPAS */}
      <View style={styles.segmentedControl}>
        {(
          [
            { key: 'overview', label: 'Plano Geral' },
            { key: 'training', label: 'Treino' },
            { key: 'nutrition', label: 'Dieta & Hábitos' },
            { key: 'chat', label: 'Chat IA' },
          ] as Array<{ key: CoachSubTab; label: string }>
        ).map((tab) => {
          const active = subTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setSubTab(tab.key)}
              style={[styles.segmentTab, active && styles.segmentTabActive]}
            >
              <Text
                style={[
                  styles.segmentTabText,
                  active && styles.segmentTabTextActive,
                ]}
                numberOfLines={1}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 4. CONTEÚDO DA ABA SELECIONADA */}
      {subTab === 'overview' && (
        <View>
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <Sparkles size={16} color={obsidianTheme.accent} />
              <Text style={styles.sectionCardTitle}>
                Diagnóstico Executivo Integrado
              </Text>
            </View>
            <MarkdownRenderer
              content={
                coachPlan
                  ? coachPlan.overviewAnalysis
                  : 'Toque em **Atualizar Plano com IA** acima para cruzar sua bioimpedância Wellmix, simetria do Avatar, Samsung Health e exames laboratoriais.'
              }
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <FlaskConical size={16} color={obsidianTheme.statusNormal} />
              <Text style={styles.sectionCardTitle}>
                Destaques Clínicos & Exames Laboratoriais
              </Text>
            </View>
            <MarkdownRenderer
              content={
                coachPlan
                  ? coachPlan.examsAnalysis
                  : latestExamEval
                  ? `Último check-up (**${latestExam?.label}**): **${latestExamEval.optimalCount} marcadores** em faixa ótima e **${latestExamEval.alerts.length} ponto(s)** de atenção. Gere o plano para ver os ajustes clínicos.`
                  : 'Consulte ou cadastre novos biomarcadores na aba **Saúde & Exames** para calibrar sua conduta clínica.'
              }
            />
          </View>
        </View>
      )}

      {subTab === 'training' && (
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <Dumbbell size={16} color={obsidianTheme.accent} />
            <Text style={styles.sectionCardTitle}>
              Periodização de Treino, Simetria & Cardio
            </Text>
          </View>
          <MarkdownRenderer
            content={
              coachPlan
                ? coachPlan.trainingPlan
                : 'Toque em **Atualizar Plano com IA** para gerar sua prescrição semanal focada nos pontos de simetria do seu Avatar e protocolo de queima visceral.'
            }
          />
        </View>
      )}

      {subTab === 'nutrition' && (
        <View>
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <Apple size={16} color={obsidianTheme.accent} />
              <Text style={styles.sectionCardTitle}>
                Prescrição Nutricional, Macros & Suplementação
              </Text>
            </View>
            <MarkdownRenderer
              content={
                coachPlan
                  ? coachPlan.nutritionPlan
                  : 'Toque em **Atualizar Plano com IA** para calcular suas calorias exatas, gramas de proteínas, carboidratos, gorduras e ajustes pelos exames.'
              }
            />
          </View>

          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <Moon size={16} color={obsidianTheme.statusNormal} />
              <Text style={styles.sectionCardTitle}>
                Protocolo Circadiano, Sono & Recuperação
              </Text>
            </View>
            <MarkdownRenderer
              content={
                coachPlan
                  ? coachPlan.habitsAndRecoveryPlan
                  : 'Toque em **Atualizar Plano com IA** para receber sua rotina circadiana, meta de passos e manejo de cortisol.'
              }
            />
          </View>
        </View>
      )}

      {subTab === 'chat' && (
        <View style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <MessageSquare size={16} color={obsidianTheme.accent} />
            <Text style={styles.sectionCardTitle}>
              Chat Interativo com o Coach Biomédico
            </Text>
          </View>
          <Text style={styles.sectionCardSubtitle}>
            Pergunte sobre substituições de refeições, ajustes de treino ou interpretação de marcadores.
          </Text>

          {/* Pílulas de Perguntas Rápidas */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.quickPromptsScroll}
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

          {/* Histórico de Mensagens */}
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
                      ⚡ {msg.providerBadge}
                    </Text>
                  )}
                  {isUser ? (
                    <Text
                      style={[
                        styles.chatBubbleText,
                        { color: obsidianTheme.bg, fontWeight: '700' },
                      ]}
                    >
                      {msg.text}
                    </Text>
                  ) : (
                    <MarkdownRenderer content={msg.text} compact />
                  )}
                </View>
              );
            })}
            {chatLoading && (
              <View style={[styles.chatBubble, styles.chatBubbleCoach]}>
                <ActivityIndicator size="small" color={obsidianTheme.accent} />
                <Text style={styles.chatProviderBadge}>
                  Elaborando resposta clínica...
                </Text>
              </View>
            )}
          </View>

          {/* Input de Pergunta */}
          <View style={styles.chatInputRow}>
            <TextInput
              style={styles.chatInput}
              placeholder="Pergunte sobre treino, dieta ou exames..."
              placeholderTextColor={obsidianTheme.textMuted}
              value={chatQuestion}
              onChangeText={setChatQuestion}
            />
            <TouchableOpacity
              style={styles.chatSendBtn}
              onPress={() => handleAskCoach()}
              disabled={chatLoading}
            >
              <Send size={16} color={obsidianTheme.bg} />
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
    paddingVertical: 8,
  },
  controlCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    padding: 14,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginBottom: 12,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smallSectionLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  engineSettingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: obsidianTheme.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  engineSettingsBtnText: {
    color: obsidianTheme.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  goalScroll: {
    marginVertical: 10,
  },
  goalChip: {
    backgroundColor: obsidianTheme.bg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginRight: 8,
  },
  goalChipActive: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accentBorder,
  },
  goalChipText: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  goalChipTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '700',
  },
  freqBarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  freqLabel: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  freqPillsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  freqPill: {
    backgroundColor: obsidianTheme.bg,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  freqPillActive: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accentBorder,
  },
  freqPillText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  freqPillTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '700',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: obsidianTheme.accent,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: obsidianTheme.radiusMd,
    gap: 8,
  },
  generateBtnText: {
    color: obsidianTheme.bg,
    fontWeight: '800',
    fontSize: 13.5,
  },
  streamPreviewBox: {
    marginTop: 10,
    backgroundColor: obsidianTheme.bg,
    padding: 11,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
  },
  streamPreviewTitle: {
    color: obsidianTheme.accent,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  streamPreviewText: {
    color: obsidianTheme.textPrimary,
    fontSize: 12,
    lineHeight: 18,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: obsidianTheme.surface,
    padding: 4,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginBottom: 12,
    gap: 4,
  },
  segmentTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    paddingHorizontal: 4,
    borderRadius: obsidianTheme.radiusSm,
  },
  segmentTabActive: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
  },
  segmentTabText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  segmentTabTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '700',
  },
  sectionCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    padding: 16,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionCardTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  sectionCardSubtitle: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  planBodyText: {
    color: obsidianTheme.textPrimary,
    fontSize: 13.5,
    lineHeight: 21,
  },
  quickPromptsScroll: {
    marginBottom: 12,
  },
  quickQuestionChip: {
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: obsidianTheme.radiusSm,
    marginRight: 8,
  },
  quickQuestionText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11.5,
    fontWeight: '600',
  },
  chatHistoryBox: {
    gap: 8,
    marginBottom: 12,
  },
  chatBubble: {
    padding: 12,
    borderRadius: obsidianTheme.radiusMd,
    maxWidth: '92%',
  },
  chatBubbleUser: {
    backgroundColor: obsidianTheme.accent,
    alignSelf: 'flex-end',
  },
  chatBubbleCoach: {
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    alignSelf: 'flex-start',
  },
  chatProviderBadge: {
    color: obsidianTheme.accent,
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  chatBubbleText: {
    color: obsidianTheme.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    borderRadius: obsidianTheme.radiusSm,
    color: obsidianTheme.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  chatSendBtn: {
    width: 42,
    height: 42,
    borderRadius: obsidianTheme.radiusSm,
    backgroundColor: obsidianTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
