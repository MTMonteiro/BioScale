import {
  BioimpedanceMetrics,
  BodyMeasurementsEntry,
  SamsungHealthSummary,
  UserProfile,
} from '../types/health';

export const OPENROUTER_SUGGESTED_MODELS = [
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

export async function generateAiHealthCoachAnalysis(
  history: BioimpedanceMetrics[],
  samsungHealth: SamsungHealthSummary,
  profile: UserProfile,
  bodyMeasurements?: BodyMeasurementsEntry[]
): Promise<{ text: string; providerUsed: string }> {
  if (history.length === 0) {
    return {
      text: 'Faça sua primeira pesagem na balança Wellmix para receber uma análise completa da sua composição corporal!',
      providerUsed: 'Sistema Local',
    };
  }

  const latest = history[history.length - 1];
  const first = history[0];
  const weightDelta = Math.round((latest.weightKg - first.weightKg) * 10) / 10;
  const fatDelta = Math.round((latest.bodyFatPercent - first.bodyFatPercent) * 10) / 10;
  const muscleDelta = Math.round((latest.muscleMassKg - first.muscleMassKg) * 10) / 10;

  const latestTape =
    bodyMeasurements && bodyMeasurements.length > 0
      ? bodyMeasurements[bodyMeasurements.length - 1]
      : null;
  const firstTape =
    bodyMeasurements && bodyMeasurements.length > 1 ? bodyMeasurements[0] : null;

  const tapeInfo = latestTape
    ? `- Medidas de Fita Métrica (Avatar Atual): Pescoço ${latestTape.neckCm}cm, Ombros ${latestTape.shouldersCm}cm, Peitoral ${latestTape.chestCm}cm, Bíceps ${latestTape.bicepsCm}cm, Cintura ${latestTape.waistCm}cm, Abdômen ${latestTape.abdomenCm}cm, Quadril ${latestTape.hipsCm}cm, Coxa ${latestTape.thighCm}cm, Panturrilha ${latestTape.calfCm}cm (Relação Cintura/Quadril: ${latestTape.waistToHipRatio}, BF US Navy: ${latestTape.navyBodyFatEstimate}%).` +
      (firstTape
        ? `\n- Evolução das Medidas (Início -> Hoje): Cintura ${firstTape.waistCm}cm -> ${latestTape.waistCm}cm, Abdômen ${firstTape.abdomenCm}cm -> ${latestTape.abdomenCm}cm, Bíceps ${firstTape.bicepsCm}cm -> ${latestTape.bicepsCm}cm, Ombros ${firstTape.shouldersCm}cm -> ${latestTape.shouldersCm}cm.`
        : '')
    : '';

  const prompt = `Você é um nutricionista esportivo e fisiologista especialista em bioimpedância e antropometria.
Analise os dados atuais do usuário (${profile.name}, ${profile.age} anos, ${profile.heightCm}cm, meta: ${profile.targetWeightKg}kg):
- Última pesagem na balança Wellmix: Peso ${latest.weightKg}kg, Impedância ${latest.impedanceOhm} Ohms, Gordura Corporal ${latest.bodyFatPercent}%, Massa Muscular ${latest.muscleMassKg}kg (${latest.musclePercent}%), Água ${latest.waterPercent}%, Gordura Visceral nível ${latest.visceralFat}, Taxa Metabólica Basal ${latest.bmrKcal} kcal, Idade Metabólica ${latest.metabolicAge} anos.
- Evolução recente (${history.length} medições): Variação de peso: ${weightDelta}kg, Variação de gordura: ${fatDelta}%, Variação muscular: ${muscleDelta}kg.
${tapeInfo}
- Dados de hoje vindos do Samsung Health: ${samsungHealth.stepsToday} passos, ${samsungHealth.caloriesBurnedToday} kcal gastas, ${samsungHealth.sleepHoursLastNight}h de sono na última noite.

Responda em português de forma motivadora, direta e dividida em 4 pontos curtos:
1. Diagnóstico da Composição Corporal (relação músculo vs gordura e hidratação)
2. Análise de Simetria & Medidas Antropométricas (Ombros vs Cintura, Bíceps, Coxas e comparação Bioimpedância vs Fita Métrica US Navy)
3. Cruzamento Balança + Samsung Health (impacto do sono/passos no peso de hoje)
4. Plano Prático para as próximas 48h.`;

  // 1. OpenRouter API (Suporta DeepSeek V3/R1, Claude, GPT-4o, Gemini, Llama, etc.)
  if (
    profile.aiProvider === 'openrouter' &&
    profile.openRouterApiKey &&
    profile.openRouterApiKey.trim().length > 8
  ) {
    try {
      const model = profile.openRouterModel?.trim() || 'deepseek/deepseek-chat';
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
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
            {
              role: 'system',
              content:
                'Você é um médico do esporte e nutricionista especialista em bioimpedância e hipertrofia.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return { text, providerUsed: `OpenRouter (${model})` };
        }
      }
    } catch (e) {
      console.warn('Falha ao consultar OpenRouter, tentando fallback:', e);
    }
  }

  // 2. DeepSeek API Direta (api.deepseek.com)
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
            {
              role: 'system',
              content:
                'Você é um médico do esporte e nutricionista especialista em bioimpedância e hipertrofia.',
            },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const text = data?.choices?.[0]?.message?.content;
        if (text) {
          return { text, providerUsed: `DeepSeek API (${model})` };
        }
      }
    } catch (e) {
      console.warn('Falha ao consultar DeepSeek API, tentando fallback:', e);
    }
  }

  // 3. Google Gemini API Direta
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
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          return { text, providerUsed: 'Google Gemini 2.5 Flash' };
        }
      }
    } catch (e) {
      console.warn('Falha ao consultar API Gemini, usando motor heurístico local:', e);
    }
  }

  // 4. Motor Inteligente Local (Funciona imediatamente offline ou sem chave de API)
  const diffToTarget = Math.round((latest.weightKg - profile.targetWeightKg) * 10) / 10;
  const hydrationStatus =
    latest.waterPercent >= 55
      ? 'excelente hidratação celular (o que torna a leitura de bioimpedância ainda mais precisa)'
      : 'hidratação levemente abaixo do ideal (beber mais água melhora a condução elétrica da bioimpedância e o metabolismo)';

  const waistDiffText =
    firstTape && latestTape
      ? ` Desde a primeira medição, sua cintura variou **${(
          latestTape.waistCm - firstTape.waistCm
        ).toFixed(1)} cm** e seu bíceps **+${(
          latestTape.bicepsCm - firstTape.bicepsCm
        ).toFixed(1)} cm**.`
      : '';

  const tapeSection = latestTape
    ? `\n📐 **2. Simetria Corporal & Fita Métrica (Avatar)**\nSua relação Ombro/Cintura (V-Taper) está em **${(
        latestTape.shouldersCm / Math.max(latestTape.waistCm, 1)
      ).toFixed(2)}** (${latestTape.shouldersCm} cm de ombros para ${
        latestTape.waistCm
      } cm de cintura), e sua Relação Cintura/Quadril é **${
        latestTape.waistToHipRatio
      }**. O cálculo de gordura pela fita métrica (US Navy) estimou **${
        latestTape.navyBodyFatEstimate
      }%**, muito próximo dos **${
        latest.bodyFatPercent
      }%** lidos pela bioimpedância da sua balança Wellmix!${waistDiffText}\n`
    : '';

  return {
    providerUsed: 'Motor Bio-Heurístico Local (Configure OpenRouter/DeepSeek em Ajustes se desejar)',
    text: `📊 **1. Diagnóstico de Bioimpedância (Wellmix)**
Seu peso atual é **${latest.weightKg} kg** (faltam **${Math.abs(diffToTarget)} kg** para sua meta de ${profile.targetWeightKg} kg). Nas últimas ${history.length} pesagens, você teve uma variação de **${weightDelta > 0 ? '+' : ''}${weightDelta} kg** no peso e **${fatDelta > 0 ? '+' : ''}${fatDelta}%** na gordura corporal, mantendo **${latest.muscleMassKg} kg** de massa muscular. Você apresenta ${hydrationStatus}.
${tapeSection}
⌚ **3. Cruzamento com Samsung Health**
Hoje o Samsung Health registrou **${samsungHealth.stepsToday.toLocaleString('pt-BR')} passos**, **${samsungHealth.caloriesBurnedToday} kcal** queimadas e **${samsungHealth.sleepHoursLastNight}h de sono**. ${
      samsungHealth.sleepHoursLastNight >= 7
        ? 'Sua boa noite de sono reduz o cortisol e favorece a queima de gordura abdominal.'
        : 'Dormir menos de 7h pode causar retenção hídrica temporária na linha do abdômen.'
    }

🚀 **4. Recomendação para as próximas 48h**
• **Meta Calórica:** Sua Taxa Metabólica Basal é de **${latest.bmrKcal} kcal/dia**. Mantenha uma ingestão proteica de ~${Math.round(latest.weightKg * 1.8)}g de proteína/dia para hipertrofia de membros (${latestTape ? `Bíceps: ${latestTape.bicepsCm} cm | Coxa: ${latestTape.thighCm} cm` : `${latest.muscleMassKg} kg de músculo`}).
• **Atividade:** Complete 9.500 passos hoje no Samsung Health para acelerar a redução da cintura e gordura visceral (atualmente nível ${latest.visceralFat}).`,
  };
}
