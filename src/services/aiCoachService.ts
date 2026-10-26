import {
  BioimpedanceMetrics,
  BodyMeasurementsEntry,
  LabExamEntry,
  SamsungHealthSummary,
  StructuredCoachPlan,
  UserProfile,
} from '../types/health';
import { filterMeasurementsByPeriod } from '../utils/bioimpedance';
import { evaluateFullLabExam } from '../utils/labExams';
import {
  getModelSpecById,
  runOnDeviceGemmaInference,
} from './localModelService';

export const OPENROUTER_SUGGESTED_MODELS = [
  { id: 'google/gemma-3-27b-it:free', label: 'Google Gemma 3 27B (OpenRouter)' },
  { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (OpenRouter)' },
  { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 Reasoning (OpenRouter)' },
  { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash (OpenRouter)' },
  { id: 'anthropic/claude-3.5-sonnet', label: 'Claude 3.5 Sonnet (OpenRouter)' },
  { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (OpenRouter)' },
];

export const DEEPSEEK_SUGGESTED_MODELS = [
  { id: 'deepseek-chat', label: 'DeepSeek V3 (deepseek-chat)' },
  { id: 'deepseek-reasoner', label: 'DeepSeek R1 (deepseek-reasoner)' },
];

export function computeBioHealthScore(
  latest: BioimpedanceMetrics | null,
  samsungHealth: SamsungHealthSummary,
  profile: UserProfile,
  latestTape: BodyMeasurementsEntry | null,
  latestExam: LabExamEntry | null
): number {
  if (!latest) return 75;
  let score = 82;

  // Ajuste por Gordura Visceral
  if (latest.visceralFat <= 7) score += 5;
  else if (latest.visceralFat >= 11) score -= 8;

  // Ajuste por Hidratação
  if (latest.waterPercent >= 55) score += 3;
  else if (latest.waterPercent < 50) score -= 4;

  // Ajuste por Sono e Passos (Samsung Health)
  if (samsungHealth.sleepHoursLastNight >= 7.0) score += 4;
  else if (samsungHealth.sleepHoursLastNight < 6.0) score -= 6;

  if (samsungHealth.stepsToday >= 8000) score += 4;
  else if (samsungHealth.stepsToday < 4000) score -= 4;

  // Ajuste por Simetria V-Taper (Ombros / Cintura)
  if (latestTape) {
    const vTaper = latestTape.shouldersCm / Math.max(latestTape.waistCm, 1);
    if (vTaper >= 1.42) score += 3;
    if (latestTape.waistToHipRatio > (profile.sex === 'male' ? 0.92 : 0.85)) {
      score -= 4;
    }
  }

  // Ajuste pelos Exames Laboratoriais
  if (latestExam) {
    const evalRes = evaluateFullLabExam(latestExam, profile.sex);
    score += Math.min(6, evalRes.optimalCount);
    score -= evalRes.alerts.length * 3;
  }

  return Math.max(40, Math.min(99, Math.round(score)));
}

function buildBaselineClinicalPlan(
  history: BioimpedanceMetrics[],
  samsungHealth: SamsungHealthSummary,
  profile: UserProfile,
  bodyMeasurements?: BodyMeasurementsEntry[],
  labExams?: LabExamEntry[],
  providerLabelOverride?: string
): StructuredCoachPlan {
  const latest = history[history.length - 1];
  const first = history[0];
  const morningHistory = filterMeasurementsByPeriod(history, 'morning');
  const nightHistory = filterMeasurementsByPeriod(history, 'night');

  const weightDelta = Math.round((latest.weightKg - first.weightKg) * 10) / 10;
  const fatDelta =
    Math.round((latest.bodyFatPercent - first.bodyFatPercent) * 10) / 10;
  const muscleDelta =
    Math.round((latest.muscleMassKg - first.muscleMassKg) * 10) / 10;
  const diffToTarget =
    Math.round((latest.weightKg - profile.targetWeightKg) * 10) / 10;

  const latestTape =
    bodyMeasurements && bodyMeasurements.length > 0
      ? bodyMeasurements[bodyMeasurements.length - 1]
      : null;
  const firstTape =
    bodyMeasurements && bodyMeasurements.length > 1 ? bodyMeasurements[0] : null;

  const latestExam =
    labExams && labExams.length > 0 ? labExams[labExams.length - 1] : null;
  const examEval = latestExam
    ? evaluateFullLabExam(latestExam, profile.sex)
    : null;

  const healthScore = computeBioHealthScore(
    latest,
    samsungHealth,
    profile,
    latestTape,
    latestExam
  );

  // Variação diurna (Manhã vs Noite)
  let diurnalNote = '';
  if (morningHistory.length > 0 && nightHistory.length > 0) {
    const avgM =
      morningHistory.reduce((s, i) => s + i.weightKg, 0) / morningHistory.length;
    const avgN =
      nightHistory.reduce((s, i) => s + i.weightKg, 0) / nightHistory.length;
    const diurnalDiff = Math.round((avgN - avgM) * 10) / 10;
    diurnalNote = `\n• **Flutuação Diurna (Manhã vs Noite):** Seu peso médio pela manhã é **${avgM.toFixed(
      1
    )} kg** e à noite **${avgN.toFixed(1)} kg** (diferença de **${
      diurnalDiff >= 0 ? '+' : ''
    }${diurnalDiff} kg** por hidratação/refeições). Use sempre o peso da **Manhã em jejum** como referência oficial!`;
  }

  // Cálculo nutricional preciso (TMB + Samsung Health + Objetivo + Exames)
  const activeBurn = Math.max(300, samsungHealth.caloriesBurnedToday - latest.bmrKcal);
  const tdee = Math.round(latest.bmrKcal + activeBurn * 0.65);
  const goal = profile.trainingGoal || 'recomposition';
  let targetKcal = tdee - 300;
  let goalName = 'Recomposição Corporal (Perder Gordura + Ganhar Músculo)';
  if (goal === 'fat_loss') {
    targetKcal = Math.max(1450, tdee - 480);
    goalName = 'Definição & Redução de Gordura (Cutting)';
  } else if (goal === 'hypertrophy') {
    targetKcal = tdee + 250;
    goalName = 'Hipertrofia Muscular Limpa (Lean Bulk)';
  } else if (goal === 'longevity') {
    targetKcal = tdee - 150;
    goalName = 'Saúde Metabólica & Longevidade';
  }

  const proteinG = Math.round(latest.weightKg * (goal === 'hypertrophy' ? 2.0 : 2.1));
  const fatG = Math.round(latest.weightKg * 0.85);
  const remainingKcal = Math.max(400, targetKcal - proteinG * 4 - fatG * 9);
  const carbsG = Math.round(remainingKcal / 4);
  const waterLiters = Math.round(latest.weightKg * 0.042 * 10) / 10;

  // Simetria do Avatar para direcionar o Treino
  const vTaper = latestTape
    ? Math.round((latestTape.shouldersCm / Math.max(latestTape.waistCm, 1)) * 100) /
      100
    : 1.44;
  const waistDelta =
    firstTape && latestTape
      ? Math.round((latestTape.waistCm - firstTape.waistCm) * 10) / 10
      : 0;

  const overviewAnalysis = `📊 **Diagnóstico Geral Integrado (Score ${healthScore}/100)**
• **Foco Atual:** ${goalName}.
• **Balança Wellmix (BIA):** Peso atual **${latest.weightKg} kg** (${
    diffToTarget > 0
      ? `faltam ${diffToTarget} kg para a meta de ${profile.targetWeightKg} kg`
      : `meta de ${profile.targetWeightKg} kg atingida!`
  }), Gordura Corporal **${latest.bodyFatPercent}%** (${
    latest.fatMassKg
  } kg), Massa Muscular **${latest.muscleMassKg} kg** (${
    latest.musclePercent
  }%), Água **${latest.waterPercent}%** e Gordura Visceral **nível ${
    latest.visceralFat
  }**.
• **Tendência Recente (${history.length} pesagens):** Peso **${
    weightDelta > 0 ? '+' : ''
  }${weightDelta} kg** | Gordura **${fatDelta > 0 ? '+' : ''}${fatDelta}%** | Músculo **${
    muscleDelta > 0 ? '+' : ''
  }${muscleDelta} kg**.${diurnalNote}
• **Simetria do Avatar (Fita Métrica):** ${
    latestTape
      ? `Índice V-Taper (Ombro/Cintura) em **${vTaper}** (ideal estético: 1.55–1.61), Cintura **${latestTape.waistCm} cm** (${
          waistDelta <= 0 ? `${waistDelta} cm desde o início` : `+${waistDelta} cm`
        }), Bíceps **${latestTape.bicepsCm} cm**, Coxas **${
          latestTape.thighCm
        } cm** e BF US Navy **${latestTape.navyBodyFatEstimate}%**.`
      : 'Registre suas medidas na aba Avatar para análise de simetria.'
  }`;

  // Ajustes de treino baseados nos exames, avatar e sono
  const lowSleepWarning =
    samsungHealth.sleepHoursLastNight < 6.5
      ? `⚠️ **Ajuste de Hoje pelo Sono (${samsungHealth.sleepHoursLastNight}h):** Como o sono ficou abaixo de 6.5h, reduza 1 série por exercício hoje e evite falha concêntrica extrema para controlar o cortisol.`
      : `✅ **Recuperação Pronta (${samsungHealth.sleepHoursLastNight}h de sono):** Sistema nervoso central recuperado para progressão de carga hoje!`;

  const cortisolExamWarning =
    latestExam?.morningCortisolUgDl && latestExam.morningCortisolUgDl > 18
      ? `\n• **Controle de Cortisol (${latestExam.morningCortisolUgDl} µg/dL no exame):** Limite os treinos de musculação a no máximo 55 minutos intensos e prefira cardio Zona 2 (120–135 bpm) em vez de HIIT exaustivo à noite.`
      : '';

  const trainingPlan = `🏋️ **Plano de Treino Baseado no seu Avatar & Bioimpedância (${
    profile.weeklyWorkoutsTarget || 4
  }x/semana)**
${lowSleepWarning}${cortisolExamWarning}

1. **Prioridade de Simetria (V-Taper ${vTaper} → Meta 1.55):**
   • **Deltoides Laterais & Dorsais (Alargar Ombros ${
     latestTape ? `de ${latestTape.shouldersCm} cm` : ''
   }):** Adicione 4 séries extras semanais de *Elevação Lateral no Cabo* (12–15 reps com pico de contração) e *Puxada Alta Aberta / Remada Curvada*.
   • **Peitoral Superior & Braços (${
     latestTape ? `Peito ${latestTape.chestCm} cm | Bíceps ${latestTape.bicepsCm} cm` : ''
   }):** Priorize *Supino Inclinado com Halteres* (8–10 reps) + *Rosca Inclinada 45°* e *Tríceps Testa*.
2. **Motor Metabólico de Membros Inferiores (${
    latestTape ? `Coxas ${latestTape.thighCm} cm | Panturrilha ${latestTape.calfCm} cm` : ''
  }):**
   • As pernas concentram a maior captação de glicose (GLUT-4) para melhorar seu HOMA-IR e elevar sua TMB (${
     latest.bmrKcal
   } kcal). Execute *Agachamento Livre/Hack* ou *Leg Press 45°* + *Stiff Romeno* 2x na semana.
3. **Protocolo Cardio & Queima Visceral (Nível ${latest.visceralFat}):**
   • **Pós-Treino:** 20 a 25 minutos de caminhada inclinada na esteira ou bicicleta em Zona 2 (65–70% FC máx).
   • **Meta de Passos Samsung Health:** Hoje você está com **${samsungHealth.stepsToday.toLocaleString(
     'pt-BR'
   )} passos**. Busque fechar **9.500 a 10.500 passos/dia**.`;

  // Ajustes nutricionais baseados nos exames
  const nutritionExamAdjustments: string[] = [];
  if (
    (latestExam?.fastingGlucoseMgDl && latestExam.fastingGlucoseMgDl >= 98) ||
    (latestExam?.homaIr && latestExam.homaIr > 2.0)
  ) {
    nutritionExamAdjustments.push(
      `• **Controle Glicêmico (Glicose ${latestExam?.fastingGlucoseMgDl || '-'} mg/dL | HOMA-IR ${
        latestExam?.homaIr || '-'
      }):** Inicie almoço e jantar por salada verde + 1 colher de sopa de azeite ou vinagre de maçã antes do carboidrato, concentrando 60% dos carboidratos no pré e pós-treino.`
    );
  }
  if (
    (latestExam?.ldlMgDl && latestExam.ldlMgDl > 100) ||
    (latestExam?.triglyceridesMgDl && latestExam.triglyceridesMgDl >= 145)
  ) {
    nutritionExamAdjustments.push(
      `• **Otimização Lipídica (LDL ${latestExam?.ldlMgDl || '-'} | Triglicerídeos ${
        latestExam?.triglyceridesMgDl || '-'
      } mg/dL):** Inclua 35g de aveia/psyllium no café da manhã (betaglucanas reduzem LDL em até 12%), corte açúcares líquidos e adicione 2g/dia de Ômega-3 (EPA/DHA).`
    );
  }
  if (latestExam?.vitaminDNgMl && latestExam.vitaminDNgMl < 32) {
    nutritionExamAdjustments.push(
      `• **Reposição de Vitamina D (${latestExam.vitaminDNgMl} ng/mL - Abaixo do ideal):** A Vitamina D baixa limita a síntese proteica muscular e a testosterona. Consuma ovos inteiros, peixes gordos e avalie suplementação de Vitamina D3 (2.000–4.000 UI/dia junto a refeição com gordura).`
    );
  }
  if (latestExam?.creatinineMgDl && latestExam.creatinineMgDl >= 1.1) {
    nutritionExamAdjustments.push(
      `• **Proteção Renal & Hidratação (Creatinina ${latestExam.creatinineMgDl} mg/dL):** Com alta massa muscular (${latest.muscleMassKg} kg), mantenha no mínimo **${waterLiters} litros de água/dia** para filtração glomerular ideal.`
    );
  }

  const nutritionPlan = `🥗 **Plano de Alimentação & Suplementação Baseado em Dados**
• **Taxa Metabólica Basal (Balança):** ${latest.bmrKcal} kcal | **Gasto Total Estimado:** ${tdee} kcal.
• **Meta Calórica Diária Recomendada:** **${targetKcal} kcal/dia** (${goalName}).

**Divisão de Macronutrientes Diários:**
• 🥩 **Proteínas:** **${proteinG}g/dia** (~${Math.round(
    proteinG / 4
  )}g em 4 refeições: ovos, frango, patinho, peixe, whey) — protege seus **${
    latest.muscleMassKg
  } kg** de massa muscular.
• 🍚 **Carboidratos:** **${carbsG}g/dia** (aveia, arroz, mandioca, batata-doce, frutas) — priorize em torno do treino.
• 🥑 **Gorduras Boas:** **${fatG}g/dia** (azeite extravirgem, abacate, castanhas, gema de ovo).
• 💧 **Meta de Água (Hidratação Atual ${latest.waterPercent}%):** **${waterLiters} L/dia** (cerca de ${Math.round(
    (waterLiters * 1000) / 300
  )} copos de 300ml).

${
  nutritionExamAdjustments.length > 0
    ? `**Ajustes Específicos pelos seus Exames de Sangue:**\n${nutritionExamAdjustments.join('\n')}`
    : '**Suplementação Base Evidência:** Creatina Monohidratada (5g/dia), Whey Protein (se necessário bater a meta proteica) e Ômega-3.'
}`;

  const habitsAndRecoveryPlan = `🌙 **Hábitos Diários, Sono & Consistência**
1. **Higiene do Sono (Ontem: ${samsungHealth.sleepHoursLastNight}h no Samsung Health):**
   • Meta: **7h30 a 8h00** por noite. Desligue telas brilhantes 45 min antes de dormir e mantenha o quarto escuro/fresco. Dormir bem reduz a grelina (fome por doces) e preserva massa magra.
2. **Padrão Ouro de Pesagem (Manhã, Tarde e Noite):**
   • Pese-se preferencialmente **pela manhã em jejum após urinar** e use o filtro **☀️ Manhã** na aba Evolução para acompanhar a queda real de gordura sem ruído hídrico.
3. **Pausas Ativas (NEAT) & Digestão:**
   • Faça uma caminhada leve de **10 minutos após o almoço e jantar** — reduz o pico de glicose pós-prandial em até 22% e acelera a redução da cintura (${
     latestTape ? `atualmente ${latestTape.waistCm} cm` : ''
   }).`;

  const examsAnalysis =
    examEval && latestExam
      ? `🧪 **Análise Funcional dos Exames (${latestExam.label})**
• **Marcadores na Faixa Ideal:** **${examEval.optimalCount}** de **${
          examEval.evaluations.length
        }** biomarcadores analisados.
${
  examEval.alerts.length > 0
    ? `• **Pontos de Atenção Detectados (${examEval.alerts.length}):**\n` +
      examEval.alerts
        .map(
          (a) =>
            `  - **${a.guide.label}: ${a.value} ${a.guide.unit}** (*${a.statusLabel}*): ${a.clinicalTip}`
        )
        .join('\n')
    : '• Todos os biomarcadores cadastrados estão dentro das faixas ideais de referência!'
}
${
  latestExam.customNotes
    ? `\n• **Notas do Exame / Laudo:** "${latestExam.customNotes}"`
    : ''
}`
      : '🧪 **Exames Laboratoriais:** Nenhum exame cadastrado ainda. Adicione seus exames de sangue (Glicose, Colesterol, Hormônios, Vitaminas) na seção **Exames** abaixo para personalizar ainda mais sua dieta e suplementação!';

  const rawFullText = [
    overviewAnalysis,
    trainingPlan,
    nutritionPlan,
    habitsAndRecoveryPlan,
    examsAnalysis,
  ].join('\n\n');

  return {
    generatedAt: new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    }),
    providerUsed:
      providerLabelOverride ||
      'Motor Clínico & Esportivo Bio-Heurístico Local',
    healthScore,
    summaryHeadline: `Score Bio ${healthScore}/100 • Meta ${targetKcal} kcal (${proteinG}g Prot) • ${
      examEval ? `${examEval.alerts.length} alertas em exames` : 'Sem exames'
    }`,
    overviewAnalysis,
    trainingPlan,
    nutritionPlan,
    habitsAndRecoveryPlan,
    examsAnalysis,
    rawFullText,
  };
}

function parseLlmSectionsIntoPlan(
  llmText: string,
  fallbackPlan: StructuredCoachPlan,
  providerUsed: string
): StructuredCoachPlan {
  const clean = llmText.trim();
  if (!clean) return { ...fallbackPlan, providerUsed };

  // Divide por marcadores [DIAGNOSTICO], [TREINO], [ALIMENTACAO], [HABITOS], [EXAMES] se presentes
  const extractSection = (tagStart: string, nextTags: string[]): string | null => {
    const idx = clean.indexOf(tagStart);
    if (idx === -1) return null;
    const contentStart = idx + tagStart.length;
    let endIdx = clean.length;
    for (const nt of nextTags) {
      const nIdx = clean.indexOf(nt, contentStart);
      if (nIdx !== -1 && nIdx < endIdx) {
        endIdx = nIdx;
      }
    }
    return clean.slice(contentStart, endIdx).trim();
  };

  const secOverview = extractSection('[DIAGNOSTICO]', [
    '[TREINO]',
    '[ALIMENTACAO]',
    '[HABITOS]',
    '[EXAMES]',
  ]);
  const secTraining = extractSection('[TREINO]', [
    '[ALIMENTACAO]',
    '[HABITOS]',
    '[EXAMES]',
  ]);
  const secNutrition = extractSection('[ALIMENTACAO]', ['[HABITOS]', '[EXAMES]']);
  const secHabits = extractSection('[HABITOS]', ['[EXAMES]']);
  const secExams = extractSection('[EXAMES]', []);

  if (secOverview || secTraining || secNutrition) {
    return {
      ...fallbackPlan,
      providerUsed,
      overviewAnalysis: secOverview || fallbackPlan.overviewAnalysis,
      trainingPlan: secTraining || fallbackPlan.trainingPlan,
      nutritionPlan: secNutrition || fallbackPlan.nutritionPlan,
      habitsAndRecoveryPlan: secHabits || fallbackPlan.habitsAndRecoveryPlan,
      examsAnalysis: secExams || fallbackPlan.examsAnalysis,
      rawFullText: clean,
    };
  }

  // Caso o modelo gere texto livre (ex: Gemma 1B/270M), combina a análise gerada pelo LLM com os planos estruturados
  return {
    ...fallbackPlan,
    providerUsed,
    overviewAnalysis: `🤖 **Análise Gerada por ${providerUsed}:**\n${clean}\n\n---\n${fallbackPlan.overviewAnalysis}`,
    rawFullText: `${clean}\n\n---\n${fallbackPlan.rawFullText}`,
  };
}

export async function generateAiHealthCoachAnalysis(
  history: BioimpedanceMetrics[],
  samsungHealth: SamsungHealthSummary,
  profile: UserProfile,
  bodyMeasurements?: BodyMeasurementsEntry[],
  labExams?: LabExamEntry[],
  onStreamUpdate?: (partialText: string) => void
): Promise<StructuredCoachPlan> {
  if (history.length === 0) {
    return {
      generatedAt: 'Agora',
      providerUsed: 'Sistema Local',
      healthScore: 75,
      summaryHeadline: 'Faça sua primeira pesagem na Wellmix para iniciar!',
      overviewAnalysis:
        'Faça sua primeira pesagem na balança Wellmix para receber uma análise completa da sua composição corporal!',
      trainingPlan: 'Aguardando primeira leitura de bioimpedância.',
      nutritionPlan: 'Aguardando primeira leitura de bioimpedância.',
      habitsAndRecoveryPlan: 'Aguardando primeira leitura de bioimpedância.',
      examsAnalysis: 'Adicione seus exames laboratoriais na aba Exames do Coach.',
      rawFullText:
        'Faça sua primeira pesagem na balança Wellmix para receber uma análise completa!',
    };
  }

  const baselinePlan = buildBaselineClinicalPlan(
    history,
    samsungHealth,
    profile,
    bodyMeasurements,
    labExams
  );

  const latest = history[history.length - 1];
  const first = history[0];
  const weightDelta = Math.round((latest.weightKg - first.weightKg) * 10) / 10;
  const fatDelta =
    Math.round((latest.bodyFatPercent - first.bodyFatPercent) * 10) / 10;
  const muscleDelta =
    Math.round((latest.muscleMassKg - first.muscleMassKg) * 10) / 10;

  const latestTape =
    bodyMeasurements && bodyMeasurements.length > 0
      ? bodyMeasurements[bodyMeasurements.length - 1]
      : null;

  const latestExam =
    labExams && labExams.length > 0 ? labExams[labExams.length - 1] : null;
  const examSummary = latestExam
    ? evaluateFullLabExam(latestExam, profile.sex).promptSummary
    : 'Sem exames laboratoriais cadastrados.';

  const systemPrompt =
    'Você é o Coach Biomédico, Nutricionista Esportivo e Treinador de Alta Performance do BioScale AI. Responda sempre em português de forma prática, técnica e motivadora.';

  const fullPrompt = `Analise TODOS os dados do usuário (${profile.name}, ${profile.age} anos, ${profile.heightCm}cm, sexo ${profile.sex}, meta: ${profile.targetWeightKg}kg, treinos/semana: ${profile.weeklyWorkoutsTarget || 4}):
1. BALANÇA WELLMIX (BIA): Peso ${latest.weightKg}kg (variação ${weightDelta}kg), Gordura ${latest.bodyFatPercent}% (variação ${fatDelta}%), Músculo ${latest.muscleMassKg}kg (variação ${muscleDelta}kg), Água ${latest.waterPercent}%, Gordura Visceral nv ${latest.visceralFat}, TMB ${latest.bmrKcal} kcal, Idade Metabólica ${latest.metabolicAge} anos.
2. AVATAR & FITA MÉTRICA: ${
    latestTape
      ? `Ombros ${latestTape.shouldersCm}cm, Peitoral ${latestTape.chestCm}cm, Bíceps ${latestTape.bicepsCm}cm, Cintura ${latestTape.waistCm}cm, Abdômen ${latestTape.abdomenCm}cm, Quadril ${latestTape.hipsCm}cm, Coxa ${latestTape.thighCm}cm, Panturrilha ${latestTape.calfCm}cm, RCQ ${latestTape.waistToHipRatio}, BF US Navy ${latestTape.navyBodyFatEstimate}%`
      : 'Não informado'
  }.
3. SAMSUNG HEALTH HOJE: ${samsungHealth.stepsToday} passos, ${samsungHealth.caloriesBurnedToday} kcal queimadas, ${samsungHealth.sleepHoursLastNight}h de sono.
4. EXAMES DE SANGUE: ${examSummary}

Estruture a resposta usando exatamente estas 5 tags de seção:
[DIAGNOSTICO]
Diagnóstico cruzando balança, simetria do avatar e sono.
[TREINO]
Dicas práticas de treino de musculação (focando nos pontos fracos do avatar) e cardio.
[ALIMENTACAO]
Calorias, proteínas, carboidratos, gorduras, hidratação e suplementos ajustados aos exames.
[HABITOS]
Rotina de sono, passos, controle de cortisol e horários de pesagem.
[EXAMES]
Interpretação dos resultados de exames laboratoriais e conduta nutricional.`;

  // 1. Modelo Local Gemma On-Device (llama.rn GGUF)
  if (profile.aiProvider === 'gemma_local') {
    const modelSpec = getModelSpecById(
      profile.selectedLocalModelId,
      profile.customLocalModelUrl
    );
    try {
      const compactPromptForOnDevice = `Paciente: ${profile.name}, ${profile.age}a, ${profile.heightCm}cm, Peso ${latest.weightKg}kg (meta ${profile.targetWeightKg}kg), BF ${latest.bodyFatPercent}%, Músculo ${latest.muscleMassKg}kg, Água ${latest.waterPercent}%, Visceral ${latest.visceralFat}, TMB ${latest.bmrKcal}kcal.
Medidas: ${
        latestTape
          ? `Ombro ${latestTape.shouldersCm}cm, Cintura ${latestTape.waistCm}cm, Bíceps ${latestTape.bicepsCm}cm, Coxa ${latestTape.thighCm}cm`
          : 'N/A'
      }.
Samsung Health: ${samsungHealth.stepsToday} passos, ${samsungHealth.sleepHoursLastNight}h sono.
Exames: ${examSummary}.
Dê dicas diretas de: 1) Diagnóstico Corporal, 2) Treino de Musculação e Cardio, 3) Dieta e Macros, 4) Hábitos e Exames.`;

      const localRes = await runOnDeviceGemmaInference({
        spec: modelSpec,
        systemPrompt,
        userPrompt: compactPromptForOnDevice,
        maxTokens: 650,
        onToken: onStreamUpdate,
      });

      return parseLlmSectionsIntoPlan(
        localRes.text,
        baselinePlan,
        localRes.modelUsedLabel
      );
    } catch (err: any) {
      // Se o modelo GGUF ainda não foi baixado, entrega o plano clínico completo informando como baixar
      return {
        ...baselinePlan,
        providerUsed: `Motor Clínico BioScale (Baixe o ${modelSpec.name} abaixo para ativar a inferência neural GGUF)`,
      };
    }
  }

  // 2. OpenRouter API
  if (
    profile.aiProvider === 'openrouter' &&
    profile.openRouterApiKey &&
    profile.openRouterApiKey.trim().length > 8
  ) {
    try {
      const model = profile.openRouterModel?.trim() || 'deepseek/deepseek-chat';
      const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${profile.openRouterApiKey.trim()}`,
            'HTTP-Referer': 'https://bioscale.ai',
            'X-Title': 'BioScale AI',
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: fullPrompt },
            ],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return parseLlmSectionsIntoPlan(
            text,
            baselinePlan,
            `OpenRouter (${model})`
          );
        }
      }
    } catch (e) {
      console.warn('Falha ao consultar OpenRouter, usando motor local:', e);
    }
  }

  // 3. DeepSeek API Direta
  if (
    profile.aiProvider === 'deepseek' &&
    profile.deepseekApiKey &&
    profile.deepseekApiKey.trim().length > 8
  ) {
    try {
      const model = profile.deepseekModel?.trim() || 'deepseek-chat';
      const response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${profile.deepseekApiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullPrompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return parseLlmSectionsIntoPlan(
            text,
            baselinePlan,
            `DeepSeek API (${model})`
          );
        }
      }
    } catch (e) {
      console.warn('Falha ao consultar DeepSeek API, usando motor local:', e);
    }
  }

  // 4. Google Gemini API Direta
  if (
    profile.aiProvider === 'gemini' &&
    profile.geminiApiKey &&
    profile.geminiApiKey.trim().length > 8
  ) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${profile.geminiApiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\n${fullPrompt}` }] }],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return parseLlmSectionsIntoPlan(
            text,
            baselinePlan,
            'Google Gemini 2.5 Flash'
          );
        }
      }
    } catch (e) {
      console.warn('Falha ao consultar API Gemini, usando motor local:', e);
    }
  }

  return baselinePlan;
}

/**
 * Permite conversar / tirar dúvidas específicas com o Coach (sobre treino, refeição, exame ou hábito)
 * usando o modelo Gemma Local On-Device, API configurada ou motor clínico local.
 */
export async function askCoachInteractiveQuestion(params: {
  question: string;
  history: BioimpedanceMetrics[];
  samsungHealth: SamsungHealthSummary;
  profile: UserProfile;
  bodyMeasurements?: BodyMeasurementsEntry[];
  labExams?: LabExamEntry[];
  onStreamToken?: (partial: string) => void;
}): Promise<{ answer: string; providerBadge: string }> {
  const { question, history, samsungHealth, profile, bodyMeasurements, labExams } =
    params;
  const latest = history.length > 0 ? history[history.length - 1] : null;
  const latestTape =
    bodyMeasurements && bodyMeasurements.length > 0
      ? bodyMeasurements[bodyMeasurements.length - 1]
      : null;
  const latestExam =
    labExams && labExams.length > 0 ? labExams[labExams.length - 1] : null;
  const examSummary = latestExam
    ? evaluateFullLabExam(latestExam, profile.sex).promptSummary
    : 'Sem exames.';

  const contextStr = `Dados do Usuário (${profile.name}, ${profile.age}a, ${profile.heightCm}cm):
- Balança: Peso ${latest?.weightKg || 76.5}kg (Meta ${profile.targetWeightKg}kg), BF ${
    latest?.bodyFatPercent || 17
  }%, Músculo ${latest?.muscleMassKg || 60}kg, Água ${
    latest?.waterPercent || 58
  }%, TMB ${latest?.bmrKcal || 1750}kcal, Visceral ${latest?.visceralFat || 6}.
- Medidas Avatar: ${
    latestTape
      ? `Ombros ${latestTape.shouldersCm}cm, Cintura ${latestTape.waistCm}cm, Bíceps ${latestTape.bicepsCm}cm, Coxa ${latestTape.thighCm}cm`
      : 'N/A'
  }.
- Samsung Health: ${samsungHealth.stepsToday} passos, ${samsungHealth.sleepHoursLastNight}h sono.
- Exames: ${examSummary}`;

  const systemPrompt =
    'Você é o Coach de Saúde, Treino, Nutrição e Exames do BioScale AI. Responda à pergunta do usuário em português de forma objetiva, prática e personalizada usando os dados biométricos dele.';

  // 1. Tenta Gemma Local On-Device se selecionado e baixado
  if (profile.aiProvider === 'gemma_local') {
    const spec = getModelSpecById(
      profile.selectedLocalModelId,
      profile.customLocalModelUrl
    );
    try {
      const res = await runOnDeviceGemmaInference({
        spec,
        systemPrompt,
        userPrompt: `${contextStr}\n\nPergunta do usuário: ${question}`,
        maxTokens: 450,
        onToken: params.onStreamToken,
      });
      return {
        answer: res.text,
        providerBadge: res.modelUsedLabel,
      };
    } catch {}
  }

  // 2. Tenta OpenRouter se configurado
  if (
    profile.aiProvider === 'openrouter' &&
    profile.openRouterApiKey &&
    profile.openRouterApiKey.trim().length > 8
  ) {
    try {
      const model = profile.openRouterModel?.trim() || 'deepseek/deepseek-chat';
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${profile.openRouterApiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `${contextStr}\n\nPergunta: ${question}`,
            },
          ],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const txt = data?.choices?.[0]?.message?.content;
        if (txt) {
          return { answer: txt.trim(), providerBadge: `OpenRouter (${model})` };
        }
      }
    } catch {}
  }

  // 3. Tenta DeepSeek API Direta
  if (
    profile.aiProvider === 'deepseek' &&
    profile.deepseekApiKey &&
    profile.deepseekApiKey.trim().length > 8
  ) {
    try {
      const model = profile.deepseekModel?.trim() || 'deepseek-chat';
      const resp = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${profile.deepseekApiKey.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: `${contextStr}\n\nPergunta: ${question}`,
            },
          ],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const txt = data?.choices?.[0]?.message?.content;
        if (txt) {
          return { answer: txt.trim(), providerBadge: `DeepSeek (${model})` };
        }
      }
    } catch {}
  }

  // 4. Tenta Gemini API Direta
  if (
    profile.aiProvider === 'gemini' &&
    profile.geminiApiKey &&
    profile.geminiApiKey.trim().length > 8
  ) {
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${profile.geminiApiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${systemPrompt}\n${contextStr}\n\nPergunta: ${question}`,
                  },
                ],
              },
            ],
          }),
        }
      );
      if (resp.ok) {
        const data = await resp.json();
        const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (txt) {
          return { answer: txt.trim(), providerBadge: 'Gemini 2.5 Flash' };
        }
      }
    } catch {}
  }

  // 5. Resposta Inteligente Contextual Local baseada na pergunta e nos dados reais do usuário
  const qLower = question.toLowerCase();
  const bmr = latest?.bmrKcal || 1750;
  const weight = latest?.weightKg || 76.5;
  const muscle = latest?.muscleMassKg || 60;
  const bf = latest?.bodyFatPercent || 17;
  const protTarget = Math.round(weight * 2.0);

  if (
    qLower.includes('pré-treino') ||
    qLower.includes('pre-treino') ||
    qLower.includes('comer') ||
    qLower.includes('dieta') ||
    qLower.includes('alimento') ||
    qLower.includes('caloria')
  ) {
    return {
      providerBadge: 'Motor Clínico BioScale Local',
      answer: `🍽️ **Recomendação Nutricional para seus ${weight} kg (TMB ${bmr} kcal):**
• **Pré-Treino (60–90 min antes):** 40g de aveia ou 120g de banana/pão integral + 30g de Whey ou 3 ovos (fornece energia estável sem pico excessivo de insulina${
        latestExam?.fastingGlucoseMgDl
          ? `, considerando sua glicemia de ${latestExam.fastingGlucoseMgDl} mg/dL`
          : ''
      }).
• **Pós-Treino:** 35–40g de proteína magra (frango, patinho, peixe ou whey) + 150g de arroz, batata ou mandioca para repor glicogênio nos seus **${muscle} kg** de massa muscular.
• **Meta Diária:** Mantenha cerca de **${protTarget}g de proteína/dia** distribuídos em 4 refeições e **${(
        weight * 0.042
      ).toFixed(1)} L de água**.`,
    };
  }

  if (
    qLower.includes('treino') ||
    qLower.includes('muscul') ||
    qLower.includes('ombro') ||
    qLower.includes('peito') ||
    qLower.includes('cintura') ||
    qLower.includes('abdomen') ||
    qLower.includes('perna')
  ) {
    return {
      providerBadge: 'Motor Clínico BioScale Local',
      answer: `🏋️ **Ajuste de Treino para seu Avatar (${weight} kg | ${bf}% BF):**
• **Foco Estético (V-Taper):** ${
        latestTape
          ? `Com ombros em **${latestTape.shouldersCm} cm** e cintura em **${latestTape.waistCm} cm** (relação ${(
              latestTape.shouldersCm / Math.max(latestTape.waistCm, 1)
            ).toFixed(2)}), foque em alargar deltoides laterais e dorsais.`
          : 'Priorize exercícios compostos e deltoides laterais.'
      }
• **Divisão Sugerida (4x a 5x/semana):**
  - **Dia A:** Peitoral Superior + Deltoide Lateral + Tríceps
  - **Dia B:** Dorsais (Puxadas/Remadas) + Deltoide Posterior + Bíceps (${
    latestTape ? `atual: ${latestTape.bicepsCm} cm` : ''
  })
  - **Dia C:** Pernas Completo (Agachamento, Leg Press, Stiff, Panturrilha — ${
    latestTape ? `coxa atual: ${latestTape.thighCm} cm` : ''
  })
  - **Dia D:** Upper Body Metabólico (Ombros, Peito, Costas) + 25 min Cardio Zona 2.`,
    };
  }

  if (
    qLower.includes('exame') ||
    qLower.includes('sangue') ||
    qLower.includes('colesterol') ||
    qLower.includes('glicose') ||
    qLower.includes('vitamina') ||
    qLower.includes('testosterona') ||
    qLower.includes('triglicer')
  ) {
    const evalInfo = latestExam
      ? evaluateFullLabExam(latestExam, profile.sex)
      : null;
    return {
      providerBadge: 'Motor Clínico BioScale Local',
      answer: evalInfo
        ? `🧪 **Análise Direta dos seus Exames (${latestExam?.label}):**
${
  evalInfo.alerts.length > 0
    ? evalInfo.alerts
        .map(
          (a) =>
            `• **${a.guide.label} (${a.value} ${a.guide.unit} - ${a.statusLabel}):** ${a.clinicalTip}`
        )
        .join('\n')
    : '• Todos os seus marcadores cadastrados estão na faixa ótima!'
}
• **Ação Combinada:** Manter ${samsungHealth.stepsToday >= 8000 ? 'seu ótimo ritmo de passos' : '9.000+ passos/dia'} e reduzir a cintura para menos de ${
            profile.sex === 'male' ? '82 cm' : '72 cm'
          } otimiza simultaneamente o perfil lipídico e a sensibilidade à insulina.`
        : 'Você pode cadastrar seus exames de sangue (Glicemia, HbA1c, Colesterol, TSH, Testosterona, Vitamina D, etc.) na aba **Exames** aqui mesmo no Coach!',
    };
  }

  return {
    providerBadge: 'Motor Clínico BioScale Local',
    answer: `💡 **Análise Personalizada para ${profile.name} (${weight} kg | ${bf}% Gordura | ${muscle} kg Músculo):**
• Com base no seu sono de **${samsungHealth.sleepHoursLastNight}h** e **${samsungHealth.stepsToday.toLocaleString(
      'pt-BR'
    )} passos** hoje no Samsung Health, sua prioridade para atingir **${
      profile.targetWeightKg
    } kg** com máxima definição é manter **${protTarget}g de proteína/dia**, beber **${(
      weight * 0.042
    ).toFixed(1)}L de água** e executar seu treino com sobrecarga progressiva.
• Use as abas **Treino**, **Alimentação**, **Hábitos** e **Exames** acima para ver os protocolos detalhados!`,
  };
}
