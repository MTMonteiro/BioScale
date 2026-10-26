import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { LocalGemmaModelSpec } from '../types/health';

export const LOCAL_GEMMA_MODELS: LocalGemmaModelSpec[] = [
  {
    id: 'gemma-3-1b-q4',
    name: 'Google Gemma 3 1B Instruct (Q4_K_M)',
    family: 'Gemma 3 (Google)',
    sizeMb: 769,
    ramRequiredGb: 2.5,
    quantization: 'Q4_K_M (4-bit)',
    description:
      'Recomendado! Modelo oficial da família Gemma 3 quantizado em GGUF. Ótimo raciocínio clínico para treinos, dieta e exames rodando 100% offline no celular.',
    downloadUrl:
      'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf',
    filename: 'gemma-3-1b-it-Q4_K_M.gguf',
    recommended: true,
  },
  {
    id: 'gemma-3-270m-q4',
    name: 'Google Gemma 3 270M Ultra-Lite (Q4_K_M)',
    family: 'Gemma 3 Lite (Google)',
    sizeMb: 241,
    ramRequiredGb: 1.2,
    quantization: 'Q4_K_M (4-bit)',
    description:
      'Ultra-leve (apenas 241 MB)! Baixa muito rápido e roda instantaneamente em qualquer celular Android com baixo consumo de bateria.',
    downloadUrl:
      'https://huggingface.co/unsloth/gemma-3-270m-it-GGUF/resolve/main/gemma-3-270m-it-Q4_K_M.gguf',
    filename: 'gemma-3-270m-it-Q4_K_M.gguf',
  },
  {
    id: 'gemma-2-2b-q4',
    name: 'Google Gemma 2 2B Instruct (Q4_K_M)',
    family: 'Gemma 2 (Google)',
    sizeMb: 1629,
    ramRequiredGb: 4.0,
    quantization: 'Q4_K_M (4-bit)',
    description:
      'Versão robusta de 2 bilhões de parâmetros da família Google Gemma 2. Ideal para celulares com 6 GB+ de memória RAM.',
    downloadUrl:
      'https://huggingface.co/bartowski/gemma-2-2b-it-GGUF/resolve/main/gemma-2-2b-it-Q4_K_M.gguf',
    filename: 'gemma-2-2b-it-Q4_K_M.gguf',
  },
  {
    id: 'llama-3.2-1b-q4',
    name: 'Llama 3.2 1B Instruct (Q4_K_M)',
    family: 'Llama 3.2',
    sizeMb: 770,
    ramRequiredGb: 2.5,
    quantization: 'Q4_K_M (4-bit)',
    description:
      'Alternativa leve e rápida compatível com o motor GGUF local para análise de saúde e composição corporal.',
    downloadUrl:
      'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    filename: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
  },
];

export interface DownloadedModelStatus {
  modelId: string;
  isDownloaded: boolean;
  fileUri: string;
  sizeBytes: number;
}

let activeDownloadResumable: FileSystem.DownloadResumable | null = null;
let loadedLlamaContext: any = null;
let loadedModelUri: string | null = null;

function getModelsDirUri(): string {
  const base = FileSystem.documentDirectory || FileSystem.cacheDirectory || '';
  return `${base}bioscale_models/`;
}

export function getModelSpecById(
  modelId?: string,
  customUrl?: string
): LocalGemmaModelSpec {
  if (modelId === 'custom_gguf' && customUrl && customUrl.trim().length > 10) {
    const cleanUrl = customUrl.trim();
    const parts = cleanUrl.split('/');
    const rawName = parts[parts.length - 1]?.split('?')[0] || 'custom-model.gguf';
    const safeFilename = rawName.endsWith('.gguf') ? rawName : `${rawName}.gguf`;
    return {
      id: 'custom_gguf',
      name: `Modelo Customizado (${safeFilename})`,
      family: 'GGUF Custom',
      sizeMb: 800,
      ramRequiredGb: 2.5,
      quantization: 'GGUF',
      description: 'Modelo GGUF personalizado via link direto do HuggingFace.',
      downloadUrl: cleanUrl,
      filename: safeFilename,
    };
  }

  return (
    LOCAL_GEMMA_MODELS.find((m) => m.id === modelId) || LOCAL_GEMMA_MODELS[0]
  );
}

export async function ensureModelsDirectory(): Promise<string> {
  const dir = getModelsDirUri();
  if (!dir || Platform.OS === 'web') return '';
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch {}
  return dir;
}

export async function checkModelDownloaded(
  spec: LocalGemmaModelSpec
): Promise<DownloadedModelStatus> {
  if (Platform.OS === 'web') {
    return {
      modelId: spec.id,
      isDownloaded: false,
      fileUri: '',
      sizeBytes: 0,
    };
  }

  try {
    const dir = await ensureModelsDirectory();
    const fileUri = `${dir}${spec.filename}`;
    const info = await FileSystem.getInfoAsync(fileUri);
    // Verifica se tem pelo menos 10 MB para evitar arquivos truncados/incompletos
    if (info.exists && (info.size || 0) > 10 * 1024 * 1024) {
      return {
        modelId: spec.id,
        isDownloaded: true,
        fileUri,
        sizeBytes: info.size || 0,
      };
    }
    return {
      modelId: spec.id,
      isDownloaded: false,
      fileUri,
      sizeBytes: 0,
    };
  } catch {
    return {
      modelId: spec.id,
      isDownloaded: false,
      fileUri: '',
      sizeBytes: 0,
    };
  }
}

export async function getAllModelsDownloadStatus(
  customUrl?: string
): Promise<Record<string, DownloadedModelStatus>> {
  const map: Record<string, DownloadedModelStatus> = {};
  for (const m of LOCAL_GEMMA_MODELS) {
    map[m.id] = await checkModelDownloaded(m);
  }
  if (customUrl && customUrl.trim().length > 10) {
    const customSpec = getModelSpecById('custom_gguf', customUrl);
    map.custom_gguf = await checkModelDownloaded(customSpec);
  }
  return map;
}

export async function downloadLocalGemmaModel(
  spec: LocalGemmaModelSpec,
  onProgress: (info: {
    progressPercent: number;
    downloadedMb: number;
    totalMb: number;
  }) => void
): Promise<DownloadedModelStatus> {
  if (Platform.OS === 'web') {
    throw new Error(
      'O download de modelos nativos GGUF (llama.rn) requer o APK instalado no celular Android.'
    );
  }

  const dir = await ensureModelsDirectory();
  const targetUri = `${dir}${spec.filename}`;

  // Se havia arquivo parcial anterior, remove antes de iniciar
  try {
    const existing = await FileSystem.getInfoAsync(targetUri);
    if (existing.exists) {
      await FileSystem.deleteAsync(targetUri, { idempotent: true });
    }
  } catch {}

  const callback = (downloadProgress: FileSystem.DownloadProgressData) => {
    const written = downloadProgress.totalBytesWritten || 0;
    const expected =
      downloadProgress.totalBytesExpectedToWrite > 0
        ? downloadProgress.totalBytesExpectedToWrite
        : spec.sizeMb * 1024 * 1024;
    const pct = Math.min(100, Math.max(0, Math.round((written / expected) * 100)));
    onProgress({
      progressPercent: pct,
      downloadedMb: Math.round((written / (1024 * 1024)) * 10) / 10,
      totalMb: Math.round((expected / (1024 * 1024)) * 10) / 10,
    });
  };

  activeDownloadResumable = FileSystem.createDownloadResumable(
    spec.downloadUrl,
    targetUri,
    {},
    callback
  );

  const result = await activeDownloadResumable.downloadAsync();
  activeDownloadResumable = null;

  if (!result || !result.uri) {
    throw new Error('Download cancelado ou interrompido.');
  }

  const finalStatus = await checkModelDownloaded(spec);
  if (!finalStatus.isDownloaded) {
    throw new Error(
      'O arquivo baixado parece incompleto. Verifique a conexão Wi-Fi e o espaço livre no aparelho.'
    );
  }

  return finalStatus;
}

export async function cancelActiveModelDownload(): Promise<void> {
  if (activeDownloadResumable) {
    try {
      await activeDownloadResumable.pauseAsync();
    } catch {}
    activeDownloadResumable = null;
  }
}

export async function deleteDownloadedGemmaModel(
  spec: LocalGemmaModelSpec
): Promise<void> {
  if (Platform.OS === 'web') return;
  const dir = await ensureModelsDirectory();
  const targetUri = `${dir}${spec.filename}`;

  if (loadedModelUri === targetUri) {
    await releaseLocalGemmaModel();
  }

  try {
    await FileSystem.deleteAsync(targetUri, { idempotent: true });
  } catch {}
}

export async function releaseLocalGemmaModel(): Promise<void> {
  try {
    if (loadedLlamaContext) {
      await loadedLlamaContext.release();
    }
  } catch {}
  try {
    const llamaRn = require('llama.rn');
    if (llamaRn?.releaseAllLlama) {
      await llamaRn.releaseAllLlama();
    }
  } catch {}
  loadedLlamaContext = null;
  loadedModelUri = null;
}

export function isLocalGemmaLoadedInRam(): {
  loaded: boolean;
  modelUri: string | null;
} {
  return {
    loaded: Boolean(loadedLlamaContext && loadedModelUri),
    modelUri: loadedModelUri,
  };
}

/**
 * Inicializa o modelo Gemma GGUF na memória RAM do celular via llama.rn e executa a inferência local.
 */
export async function runOnDeviceGemmaInference(params: {
  spec: LocalGemmaModelSpec;
  systemPrompt: string;
  userPrompt: string;
  maxTokens?: number;
  onToken?: (accumulatedText: string) => void;
}): Promise<{ text: string; modelUsedLabel: string }> {
  const status = await checkModelDownloaded(params.spec);
  if (!status.isDownloaded || !status.fileUri) {
    throw new Error(
      `O modelo local ${params.spec.name} ainda não foi baixado no aparelho.`
    );
  }

  const llamaRn = require('llama.rn');
  if (!llamaRn || typeof llamaRn.initLlama !== 'function') {
    throw new Error('Motor nativo llama.rn indisponível neste ambiente.');
  }

  // Carrega o contexto na RAM se ainda não estiver carregado para este arquivo
  if (!loadedLlamaContext || loadedModelUri !== status.fileUri) {
    await releaseLocalGemmaModel();
    loadedLlamaContext = await llamaRn.initLlama({
      model: status.fileUri,
      use_mlock: false,
      n_ctx: 2048,
      n_threads: 4,
      n_gpu_layers: 0, // CPU ARM64 dotprod/i8mm garante máxima compatibilidade sem crash de driver GPU
    });
    loadedModelUri = status.fileUri;
  }

  try {
    await loadedLlamaContext.clearCache(false);
  } catch {}

  let accumulated = '';
  const completionResult = await loadedLlamaContext.completion(
    {
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt },
      ],
      n_predict: params.maxTokens || 700,
      temperature: 0.45,
      top_p: 0.9,
      stop: [
        '<end_of_turn>',
        '<eos>',
        '<|eot_id|>',
        '<|im_end|>',
        '</s>',
      ],
    },
    (tokenData: { token?: string; accumulated_text?: string }) => {
      if (tokenData?.accumulated_text) {
        accumulated = tokenData.accumulated_text;
      } else if (tokenData?.token) {
        accumulated += tokenData.token;
      }
      if (params.onToken && accumulated) {
        params.onToken(accumulated);
      }
    }
  );

  const finalText = (
    completionResult?.content ||
    completionResult?.text ||
    accumulated ||
    ''
  ).trim();

  if (!finalText) {
    throw new Error('O modelo local retornou resposta vazia.');
  }

  return {
    text: finalText,
    modelUsedLabel: `${params.spec.name} (On-Device GGUF)`,
  };
}
