import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { UserProfile } from '../types/health';
import { BiomarkerFieldKey, LAB_BIOMARKERS_GUIDE } from '../utils/labExams';
import {
  getModelSpecById,
  runOnDeviceGemmaInference,
} from './localModelService';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const base64Pkg = require('base-64') as { decode: (input: string) => string };

export interface ImportedLabExamResult {
  cancelled: boolean;
  attachmentUri?: string;
  attachmentType?: 'photo' | 'pdf';
  attachmentName?: string;
  suggestedLabel?: string;
  extractedValues: Partial<Record<BiomarkerFieldKey, number>>;
  extractedCount: number;
  extractionMethod: 'vision_ai' | 'pdf_parser' | 'local_gemma' | 'manual_attached';
  statusMessage: string;
}

const BIOMARKER_PATTERNS: Array<{
  key: BiomarkerFieldKey;
  regexes: RegExp[];
  minValid: number;
  maxValid: number;
}> = [
  {
    key: 'fastingGlucoseMgDl',
    regexes: [
      /(?:glicose|glicemia(?:\s+de\s+jejum)?)[^0-9]{1,45}(\d{2,3}(?:[.,]\d{1,2})?)\s*(?:mg\/dl)?/i,
    ],
    minValid: 40,
    maxValid: 450,
  },
  {
    key: 'hba1cPercent',
    regexes: [
      /(?:hemoglobina\s+glicada|hba1c|a1c)[^0-9]{1,45}(\d{1,2}(?:[.,]\d{1,2})?)\s*%/i,
      /(?:hemoglobina\s+glicada|hba1c)[^0-9]{1,35}(\d{1,2}[.,]\d{1,2})/i,
    ],
    minValid: 3.0,
    maxValid: 18.0,
  },
  {
    key: 'fastingInsulinUiuMl',
    regexes: [
      /insulina(?:\s+basal|\s+de\s+jejum|\s+jejum)?[^0-9]{1,45}(\d{1,3}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 0.5,
    maxValid: 150,
  },
  {
    key: 'totalCholesterolMgDl',
    regexes: [
      /colesterol\s+total[^0-9]{1,45}(\d{2,3}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 70,
    maxValid: 500,
  },
  {
    key: 'hdlMgDl',
    regexes: [
      /(?:colesterol\s+hdl|hdl\s*-\s*colesterol|hdl(?:\s+colesterol)?)[^0-9]{1,45}(\d{2,3}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 15,
    maxValid: 140,
  },
  {
    key: 'ldlMgDl',
    regexes: [
      /(?:colesterol\s+ldl|ldl\s*-\s*colesterol|ldl(?:\s+colesterol)?)[^0-9]{1,45}(\d{2,3}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 25,
    maxValid: 350,
  },
  {
    key: 'triglyceridesMgDl',
    regexes: [
      /(?:triglicer[ií]deos|triglic[eé]rides)[^0-9]{1,45}(\d{2,4}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 25,
    maxValid: 1500,
  },
  {
    key: 'tshUiuMl',
    regexes: [
      /(?:\btsh\b|horm[oô]nio\s+tireoestimulante)[^0-9]{1,45}(\d{1,2}[.,]\d{1,3}|\d{1,2})/i,
    ],
    minValid: 0.05,
    maxValid: 40,
  },
  {
    key: 'freeT4NgDl',
    regexes: [
      /(?:t4\s+livre|tiroxina\s+livre)[^0-9]{1,45}(\d{1,2}[.,]\d{1,2})/i,
    ],
    minValid: 0.2,
    maxValid: 5.0,
  },
  {
    key: 'totalTestosteroneNgDl',
    regexes: [
      /testosterona\s+total[^0-9]{1,45}(\d{2,4}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 10,
    maxValid: 2500,
  },
  {
    key: 'morningCortisolUgDl',
    regexes: [
      /cortisol(?:\s+basal|\s+matinal|\s+s[eé]rico)?[^0-9]{1,45}(\d{1,2}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 1.0,
    maxValid: 50.0,
  },
  {
    key: 'vitaminDNgMl',
    regexes: [
      /(?:vitamina\s+d|25\s*-?\s*hidroxivitamina\s+d|25\s*\(\s*oh\s*\)\s*d)[^0-9]{1,45}(\d{1,3}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 4,
    maxValid: 160,
  },
  {
    key: 'vitaminB12PgMl',
    regexes: [
      /(?:vitamina\s+b\s*12|cobalamina)[^0-9]{1,45}(\d{2,4}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 80,
    maxValid: 2500,
  },
  {
    key: 'ferritinNgMl',
    regexes: [
      /ferritina(?:\s+s[eé]rica)?[^0-9]{1,45}(\d{1,4}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 3,
    maxValid: 2000,
  },
  {
    key: 'hsCrpMgL',
    regexes: [
      /(?:pcr\s+ultrassens[ií]vel|prote[ií]na\s+c\s+reativa(?:\s+ultrassens[ií]vel)?)[^0-9]{1,45}(\d{1,2}[.,]\d{1,2}|\d{1,2})/i,
    ],
    minValid: 0.05,
    maxValid: 50,
  },
  {
    key: 'creatinineMgDl',
    regexes: [
      /creatinina(?:\s+s[eé]rica)?[^0-9]{1,45}(\d{1}[.,]\d{1,2})/i,
    ],
    minValid: 0.3,
    maxValid: 10.0,
  },
  {
    key: 'astU_L',
    regexes: [
      /(?:\btgo\b|\bast\b|aspartato\s+aminotransferase)[^0-9]{1,45}(\d{1,3}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 4,
    maxValid: 500,
  },
  {
    key: 'altU_L',
    regexes: [
      /(?:\btgp\b|\balt\b|alanina\s+aminotransferase)[^0-9]{1,45}(\d{1,3}(?:[.,]\d{1,2})?)/i,
    ],
    minValid: 4,
    maxValid: 500,
  },
];

/**
 * Extrai valores numéricos dos 18 biomarcadores a partir de texto bruto de laudo (PDF ou OCR/colado).
 */
export function parseBiomarkersFromLabText(
  rawText: string
): Partial<Record<BiomarkerFieldKey, number>> {
  const result: Partial<Record<BiomarkerFieldKey, number>> = {};
  if (!rawText || !rawText.trim()) return result;

  const normalized = rawText.replace(/\r\n/g, ' ').replace(/\n/g, ' ');

  for (const spec of BIOMARKER_PATTERNS) {
    for (const rx of spec.regexes) {
      const m = normalized.match(rx);
      if (m && m[1]) {
        const val = parseFloat(m[1].replace(',', '.'));
        if (!isNaN(val) && val >= spec.minValid && val <= spec.maxValid) {
          result[spec.key] = val;
          break;
        }
      }
    }
  }

  return result;
}

/**
 * Extrai strings legíveis de dentro de um binário PDF (codificado em base64).
 */
function extractReadableTextFromPdfBase64(b64: string): string {
  try {
    const binary = base64Pkg.decode(b64);
    const chunks: string[] = [];

    // 1. Extrai blocos entre parênteses (operadores Tj/TJ do PDF)
    const parenRegex = /\(([^()]{2,200})\)/g;
    let match: RegExpExecArray | null;
    while ((match = parenRegex.exec(binary)) !== null) {
      const cleaned = match[1]
        .replace(/\\n/g, ' ')
        .replace(/\\r/g, ' ')
        .replace(/\\\(/g, '(')
        .replace(/\\\)/g, ')');
      if (/[a-zA-Z0-9]/.test(cleaned)) {
        chunks.push(cleaned);
      }
    }

    // 2. Também varre sequências ASCII imprimíveis diretas no PDF
    const asciiMatches = binary.match(/[A-Za-zÀ-ÿ0-9:.,/%()-]{4,}/g);
    if (asciiMatches) {
      chunks.push(asciiMatches.slice(0, 4000).join(' '));
    }

    return chunks.join(' ');
  } catch {
    return '';
  }
}

function parseJsonBiomarkersFromAiResponse(
  rawAiText: string
): Partial<Record<BiomarkerFieldKey, number>> {
  const extracted: Partial<Record<BiomarkerFieldKey, number>> = {};
  if (!rawAiText) return extracted;

  try {
    const jsonMatch = rawAiText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      for (const g of LAB_BIOMARKERS_GUIDE) {
        const rawVal = parsed[g.key];
        if (rawVal !== undefined && rawVal !== null && rawVal !== '') {
          const num =
            typeof rawVal === 'number'
              ? rawVal
              : parseFloat(String(rawVal).replace(',', '.'));
          if (!isNaN(num) && num > 0) {
            extracted[g.key] = num;
          }
        }
      }
    }
  } catch {
    // Fallback para regex caso o modelo não tenha retornado JSON puro
    return parseBiomarkersFromLabText(rawAiText);
  }

  return extracted;
}

const EXTRACTION_SYSTEM_PROMPT = `Você é um extrator biomédico de exames laboratoriais.
Analise a imagem/documento do laudo de exame de sangue e retorne APENAS um objeto JSON válido com as chaves encontradas (omita chaves não encontradas, use números com ponto decimal):
{
  "fastingGlucoseMgDl": number,
  "hba1cPercent": number,
  "fastingInsulinUiuMl": number,
  "totalCholesterolMgDl": number,
  "hdlMgDl": number,
  "ldlMgDl": number,
  "triglyceridesMgDl": number,
  "tshUiuMl": number,
  "freeT4NgDl": number,
  "totalTestosteroneNgDl": number,
  "morningCortisolUgDl": number,
  "vitaminDNgMl": number,
  "vitaminB12PgMl": number,
  "ferritinNgMl": number,
  "hsCrpMgL": number,
  "creatinineMgDl": number,
  "astU_L": number,
  "altU_L": number
}`;

async function runVisionOrMultimodalExtraction(
  base64Data: string,
  mimeType: string,
  profile: UserProfile
): Promise<Partial<Record<BiomarkerFieldKey, number>>> {
  // 1. Tenta Google Gemini Multimodal (aceita image/jpeg, image/png e application/pdf nativamente!)
  if (profile.geminiApiKey && profile.geminiApiKey.trim().length > 8) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${profile.geminiApiKey.trim()}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: EXTRACTION_SYSTEM_PROMPT },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Data,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json',
          },
        }),
      });

      if (resp.ok) {
        const json = await resp.json();
        const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const res = parseJsonBiomarkersFromAiResponse(text);
        if (Object.keys(res).length > 0) return res;
      }
    } catch {
      // Continua para próximo provedor
    }
  }

  // 2. Tenta OpenRouter Multimodal (para imagens ou PDF via Gemini Flash no OpenRouter)
  if (profile.openRouterApiKey && profile.openRouterApiKey.trim().length > 8) {
    try {
      const visionModel =
        profile.openRouterModel &&
        (profile.openRouterModel.includes('gemini') ||
          profile.openRouterModel.includes('gpt-4o') ||
          profile.openRouterModel.includes('claude'))
          ? profile.openRouterModel
          : 'google/gemini-2.0-flash-001';

      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${profile.openRouterApiKey.trim()}`,
        },
        body: JSON.stringify({
          model: visionModel,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: EXTRACTION_SYSTEM_PROMPT },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Data}`,
                  },
                },
              ],
            },
          ],
          temperature: 0.1,
        }),
      });

      if (resp.ok) {
        const json = await resp.json();
        const text = json?.choices?.[0]?.message?.content || '';
        const res = parseJsonBiomarkersFromAiResponse(text);
        if (Object.keys(res).length > 0) return res;
      }
    } catch {
      // Fallback
    }
  }

  return {};
}

/**
 * Abre a Câmera ou Galeria de Fotos para anexar e extrair um exame de sangue por foto.
 */
export async function importLabExamFromPhoto(
  source: 'camera' | 'gallery',
  profile: UserProfile
): Promise<ImportedLabExamResult> {
  try {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        return {
          cancelled: true,
          extractedValues: {},
          extractedCount: 0,
          extractionMethod: 'manual_attached',
          statusMessage: 'Permissão de câmera negada no Android.',
        };
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        return {
          cancelled: true,
          extractedValues: {},
          extractedCount: 0,
          extractionMethod: 'manual_attached',
          statusMessage: 'Permissão de galeria negada no Android.',
        };
      }
    }

    const pickerResult =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.85,
            base64: true,
          })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.85,
            base64: true,
          });

    if (pickerResult.canceled || !pickerResult.assets?.[0]) {
      return {
        cancelled: true,
        extractedValues: {},
        extractedCount: 0,
        extractionMethod: 'manual_attached',
        statusMessage: 'Seleção cancelada.',
      };
    }

    const asset = pickerResult.assets[0];
    const fileName =
      asset.fileName ||
      `Foto_Exame_${new Date().toISOString().slice(0, 10)}.jpg`;
    const mimeType = asset.mimeType || 'image/jpeg';

    let base64 = asset.base64 || '';
    if (!base64 && asset.uri) {
      try {
        base64 = await FileSystem.readAsStringAsync(asset.uri, {
          encoding: FileSystem.EncodingType.Base64,
        });
      } catch {
        base64 = '';
      }
    }

    if (base64) {
      const aiExtracted = await runVisionOrMultimodalExtraction(
        base64,
        mimeType,
        profile
      );
      const count = Object.keys(aiExtracted).length;
      if (count > 0) {
        return {
          cancelled: false,
          attachmentUri: asset.uri,
          attachmentType: 'photo',
          attachmentName: fileName,
          suggestedLabel: `Exame (Foto • ${new Date().toLocaleDateString('pt-BR')})`,
          extractedValues: aiExtracted,
          extractedCount: count,
          extractionMethod: 'vision_ai',
          statusMessage: `✅ IA Vision leu a foto e preencheu ${count} biomarcador(es) automaticamente! Revise abaixo e salve.`,
        };
      }
    }

    return {
      cancelled: false,
      attachmentUri: asset.uri,
      attachmentType: 'photo',
      attachmentName: fileName,
      suggestedLabel: `Exame (Foto • ${new Date().toLocaleDateString('pt-BR')})`,
      extractedValues: {},
      extractedCount: 0,
      extractionMethod: 'manual_attached',
      statusMessage:
        '📷 Foto do exame anexada! Confira a imagem abaixo para preencher os biomarcadores (ou configure uma chave Gemini/OpenRouter em ⚙️ para leitura automática por Visão IA).',
    };
  } catch (err: any) {
    return {
      cancelled: false,
      extractedValues: {},
      extractedCount: 0,
      extractionMethod: 'manual_attached',
      statusMessage: `Não foi possível processar a imagem: ${err?.message || 'Erro desconhecido'}`,
    };
  }
}

/**
 * Abre o seletor de arquivos do Android para importar um laudo em PDF (ou imagem de documento)
 * e extrai os biomarcadores automaticamente via Parser Local + IA.
 */
export async function importLabExamFromPdf(
  profile: UserProfile
): Promise<ImportedLabExamResult> {
  try {
    const docResult = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'image/*'],
      copyToCacheDirectory: true,
    });

    if (docResult.canceled || !docResult.assets?.[0]) {
      return {
        cancelled: true,
        extractedValues: {},
        extractedCount: 0,
        extractionMethod: 'manual_attached',
        statusMessage: 'Seleção de PDF cancelada.',
      };
    }

    const asset = docResult.assets[0];
    const fileName = asset.name || 'Laudo_Exame.pdf';
    const cleanLabel = fileName.replace(/\.(pdf|jpg|jpeg|png)$/i, '');
    const mimeType = asset.mimeType || 'application/pdf';

    let base64 = '';
    try {
      base64 = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
    } catch {
      base64 = '';
    }

    let extractedValues: Partial<Record<BiomarkerFieldKey, number>> = {};
    let method: ImportedLabExamResult['extractionMethod'] = 'manual_attached';

    // 1. Extração local instantânea do texto embutido no PDF
    if (base64 && mimeType.includes('pdf')) {
      const pdfText = extractReadableTextFromPdfBase64(base64);
      if (pdfText.length > 20) {
        const regexParsed = parseBiomarkersFromLabText(pdfText);
        if (Object.keys(regexParsed).length > 0) {
          extractedValues = { ...regexParsed };
          method = 'pdf_parser';
        } else if (profile.aiProvider === 'gemma_local') {
          try {
            const spec = getModelSpecById(profile.selectedLocalModelId);
            const llmRes = await runOnDeviceGemmaInference({
              spec,
              systemPrompt: EXTRACTION_SYSTEM_PROMPT,
              userPrompt: pdfText.slice(0, 2500),
            });
            const gemmaParsed = parseJsonBiomarkersFromAiResponse(llmRes.text);
            if (Object.keys(gemmaParsed).length > 0) {
              extractedValues = gemmaParsed;
              method = 'local_gemma';
            }
          } catch {
            // Segue para fallback
          }
        }
      }
    }

    // 2. Se ainda não extraiu tudo ou se o PDF for escaneado (imagem), tenta IA Multimodal (Gemini / OpenRouter)
    if (base64 && Object.keys(extractedValues).length < 3) {
      const aiExtracted = await runVisionOrMultimodalExtraction(
        base64,
        mimeType,
        profile
      );
      if (Object.keys(aiExtracted).length > Object.keys(extractedValues).length) {
        extractedValues = { ...extractedValues, ...aiExtracted };
        method = 'vision_ai';
      }
    }

    const count = Object.keys(extractedValues).length;
    if (count > 0) {
      return {
        cancelled: false,
        attachmentUri: asset.uri,
        attachmentType: mimeType.startsWith('image/') ? 'photo' : 'pdf',
        attachmentName: fileName,
        suggestedLabel: cleanLabel.slice(0, 40),
        extractedValues,
        extractedCount: count,
        extractionMethod: method,
        statusMessage: `📄 PDF "${fileName}" importado! Extraímos ${count} biomarcador(es) automaticamente. Revise os valores antes de salvar.`,
      };
    }

    return {
      cancelled: false,
      attachmentUri: asset.uri,
      attachmentType: mimeType.startsWith('image/') ? 'photo' : 'pdf',
      attachmentName: fileName,
      suggestedLabel: cleanLabel.slice(0, 40),
      extractedValues: {},
      extractedCount: 0,
      extractionMethod: 'manual_attached',
      statusMessage: `📄 Arquivo "${fileName}" anexado ao exame! Caso o PDF seja digitalizado como imagem, você pode colar o texto do laudo ou preencher os campos abaixo.`,
    };
  } catch (err: any) {
    return {
      cancelled: false,
      extractedValues: {},
      extractedCount: 0,
      extractionMethod: 'manual_attached',
      statusMessage: `Erro ao ler o PDF: ${err?.message || 'Erro desconhecido'}`,
    };
  }
}
