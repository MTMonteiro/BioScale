# ⚖️ BioScale AI

Aplicativo mobile (**React Native + Expo**) desenvolvido para substituir o **OKOK International** em balanças inteligentes de bioimpedância **Wellmix / Chipsea BLE**, trazendo **Avatar Corporal Paramétrico**, **Tabela Completa de Evolução e Comparação de Períodos**, integração bidirecional com **Samsung Health (Health Connect)** e **IA Coach Multi-Provedor** (**OpenRouter**, **DeepSeek**, **Google Gemini** e motor heurístico offline).

---

## ✨ Principais Funcionalidades

1. **📡 Conexão Bluetooth Low Energy (BLE) Direta com a Balança (`0xCA` Chipsea/OKOK)**
   - Leitura em tempo real dos pacotes de anúncio BLE da balança Wellmix sem necessidade de conta na nuvem do fabricante.
   - Decodificador binário ([`okokBleParser.ts`](src/services/okokBleParser.ts)) para peso, impedância em Ohms ($\Omega$) e flag de peso estabilizado.
   - Modo simulador integrado para testes rápidos sem a balança física.

2. **🧬 Motor Completo de Bioimpedância (BIA)**
   - Cálculo instantâneo de **11 indicadores corporais** ([`bioimpedance.ts`](src/utils/bioimpedance.ts)):
     - Peso (kg) e IMC
     - Gordura Corporal (%) e Gordura Visceral (nível)
     - Massa Muscular (kg e %)
     - Água Corporal Total (%)
     - Massa Óssea (kg) e Proteína (%)
     - Taxa Metabólica Basal (TMB em kcal) e Idade Metabólica

3. **🧍 Avatar Corporal Paramétrico Interativo + Guia de Medidas**
   - Silhueta SVG dinâmica ([`BodyAvatarSvg.tsx`](src/components/BodyAvatarSvg.tsx)) que se molda em tempo real conforme as **10 circunferências corporais** registradas em fita métrica:
     - Pescoço, Ombros, Peitoral, Bíceps, Antebraço, Cintura, Abdômen, Quadril, Coxa e Panturrilha.
   - Guia passo a passo integrado de como posicionar a fita métrica em cada região ([`bodyMeasurements.ts`](src/utils/bodyMeasurements.ts)).
   - Cálculo automático de **BF% Marinha dos EUA (US Navy)**, **Relação Cintura-Quadril (RCQ/WHR)** e **Índice V-Taper (Ombro/Cintura)**.

4. **📊 Tabela Completa de Evolução & Comparador de Avatares (Antes vs. Depois)**
   - **Comparador de Períodos** ([`EvolutionAndCompareView.tsx`](src/components/EvolutionAndCompareView.tsx)): selecione duas datas do histórico para visualizar **dois Avatares lado a lado** (*Período A vs. Período B*) e os deltas ($\Delta$) de peso, gordura, massa muscular, água e circunferências.
   - **Tabela Histórica Completa**: visão tabular horizontal com todas as pesagens e medidas de fita métrica pareadas por data.

5. **❤️ Integração Bidirecional com Samsung Health (Android Health Connect)**
   - Exporta automaticamente Peso, Gordura Corporal (%), Massa Muscular, Água, Massa Óssea e TMB para o **Samsung Health** via **Health Connect** ([`samsungHealthService.ts`](src/services/samsungHealthService.ts)).
   - Importa Passos, Calorias Ativas, Distância, Frequência Cardíaca de Repouso e Horas de Sono do Samsung Health / Galaxy Watch para enriquecer a análise da IA.

6. **🤖 IA Coach Multi-Provedor**
   - Suporte nativo para múltiplos motores de IA ([`aiCoachService.ts`](src/services/aiCoachService.ts)):
     - **OpenRouter** (`deepseek/deepseek-chat`, `deepseek/deepseek-r1`, `google/gemini-2.0-flash-001`, `openai/gpt-4o-mini`, etc.)
     - **DeepSeek API Direta** (`deepseek-chat` / `deepseek-reasoner`)
     - **Google Gemini API** (`gemini-1.5-flash`)
     - **Motor Heurístico Local (100% Offline, sem chave de API)**

7. **💾 Armazenamento Local-First + Sincronização Opcional com Supabase**
   - Todos os dados ficam salvos localmente no celular via `AsyncStorage` ([`storageAndCloud.ts`](src/services/storageAndCloud.ts)).
   - Sincronização em nuvem **100% opcional** com **Supabase** (configurável direto na aba *Ajustes*).

---

## 📁 Estrutura do Projeto

```text
bio-scale-ai/
├── App.tsx                                  # Navegação principal (6 abas) e estado global
├── src/
│   ├── components/
│   │   ├── BodyAvatarSvg.tsx                # Avatar SVG paramétrico em tempo real
│   │   ├── EvolutionAndCompareView.tsx      # Tabela histórica e comparador Antes vs. Depois
│   │   └── TrendChart.tsx                   # Gráfico SVG de evolução temporal
│   ├── services/
│   │   ├── aiCoachService.ts                # Cliente OpenRouter, DeepSeek, Gemini e Offline
│   │   ├── bleScanner.ts                    # Scanner Bluetooth Low Energy (react-native-ble-plx)
│   │   ├── okokBleParser.ts                 # Parser hexadecimal do protocolo Chipsea/OKOK (0xCA)
│   │   ├── samsungHealthService.ts          # Ponte com Samsung Health via Android Health Connect
│   │   └── storageAndCloud.ts               # Persistência AsyncStorage + Sync opcional Supabase
│   ├── types/
│   │   └── health.ts                        # Tipagens TypeScript do domínio
│   └── utils/
│       ├── bioimpedance.ts                  # Fórmulas de composição corporal (BIA)
│       └── bodyMeasurements.ts              # Guia de fita métrica e cálculos antropométricos
└── .github/workflows/
    └── release-apk.yml                      # Workflow manual de build e release de APK Android
```

---

## 🚀 Como Executar em Desenvolvimento

### Pré-requisitos
- **Node.js** 20+
- **Java JDK 17** e **Android SDK** (para compilar o módulo nativo Bluetooth e Health Connect)

### Instalação

```bash
npm install
```

### Rodando no Android
```bash
npx expo run:android
```

---

## 📦 Gerando o APK de Release

### Opção 1: Via GitHub Actions (Manual com Validação SemVer)
1. Acesse a aba **Actions** no repositório do GitHub.
2. Selecione o workflow **Build Android APK & Release**.
3. Clique em **Run workflow** e informe a nova versão (ex.: `1.0.0`).
   - *Nota*: A Action valida automaticamente que a versão informada é **estritamente maior** que a última release publicada.
4. Ao finalizar, o arquivo `BioScale-AI-vX.Y.Z.apk` estará disponível na aba **Releases** do GitHub.

### Opção 2: Build Local
```bash
npx expo prebuild --platform android --clean
cd android
./gradlew assembleRelease --no-daemon -x lint -x lintVitalRelease -x lintVitalAnalyzeRelease
```
O APK compilado será gerado em `android/app/build/outputs/apk/release/app-release.apk`.

---

## 🗄️ Schema Opcional do Supabase

Caso deseje ativar o backup em nuvem na aba **Ajustes**, execute o SQL abaixo no seu projeto do Supabase:

```sql
create table if not exists public.bioimpedance_logs (
  id text primary key,
  timestamp bigint not null,
  weight numeric not null,
  impedance numeric,
  bmi numeric,
  body_fat_percentage numeric,
  muscle_mass_kg numeric,
  water_percentage numeric,
  bone_mass_kg numeric,
  visceral_fat numeric,
  bmr numeric,
  metabolic_age integer,
  protein_percentage numeric,
  payload jsonb
);

create table if not exists public.body_measurements_logs (
  id text primary key,
  timestamp bigint not null,
  weight_kg numeric,
  measurements jsonb not null,
  notes text
);
```
