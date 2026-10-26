# ⚖️ BioScale AI

Aplicativo mobile (**React Native + Expo**) desenvolvido para substituir o **OKOK International** em balanças inteligentes de bioimpedância **Wellmix / Chipsea BLE**, trazendo **Avatar Corporal Paramétrico**, **Tabela Completa de Evolução e Comparação de Períodos (Manhã/Tarde/Noite)**, integração bidirecional com **Samsung Health (Health Connect + Sono)**, **Módulo Clínico de Exames Laboratoriais** e **IA Coach Multi-Provedor + Modelos Locais On-Device (Gemma GGUF via `llama.rn`)** com **Avatar Interativo do Coach**.

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

4. **📊 Tabela Completa de Evolução & Comparador de Avatares (Manhã / Tarde / Noite)**
   - **Comparador de Períodos e Turnos** ([`EvolutionAndCompareView.tsx`](src/components/EvolutionAndCompareView.tsx)): filtre as pesagens por turno (**🌅 Manhã**, **☀️ Tarde**, **🌙 Noite** ou **Todos**) para evitar distorções de retenção hídrica ao longo do dia, compare **dois Avatares lado a lado** (*Período A vs. Período B*) e exclua registros incorretos com recálculo imediato das estatísticas.
   - **Tabela Histórica Completa**: visão tabular horizontal com todas as pesagens e medidas de fita métrica pareadas por data.

5. **❤️ Integração Bidirecional com Samsung Health (Android Health Connect)**
   - Exporta automaticamente Peso, Gordura Corporal (%), Massa Muscular, Água, Massa Óssea e TMB para o **Samsung Health** via **Health Connect** ([`samsungHealthService.ts`](src/services/samsungHealthService.ts)).
   - Importa Passos, Calorias Ativas, Distância, Frequência Cardíaca de Repouso e **Sessões de Sono (`SleepSession` com deduplicação de intervalos sobrepostos)** do Samsung Health / Galaxy Watch.

6. **🧪 Módulo Clínico de Exames de Sangue (`labExams.ts`)**
   - Registro e avaliação automática de **19 biomarcadores laboratoriais** ([`labExams.ts`](src/utils/labExams.ts)) divididos em 4 categorias:
     - **Glicemia & Insulina**: Glicemia de Jejum, Hemoglobina Glicada (`HbA1c`), Insulina de Jejum e cálculo automático do índice **HOMA-IR**.
     - **Perfil Lipídico**: Colesterol Total, HDL-c, LDL-c e Triglicerídeos.
     - **Hormônios & Tireoide**: TSH, T4 Livre, Testosterona Total e Cortisol Matinal.
     - **Vitaminas, Inflamação & Órgãos**: Vitamina D (`25-OH`), Vitamina B12, Ferritina, PCR Ultrassensível (`PCR-us`), Creatinina, TGO (`AST`) e TGP (`ALT`).

7. **🤖 Avatar do Coach IA + Modelos Locais On-Device (Gemma GGUF) & Nuvem**
   - **Avatar Vetorial do Coach ([`CoachAvatarSvg.tsx`](src/components/CoachAvatarSvg.tsx))**: 3 personas selecionáveis (**Dr. Atlas IA**, **Coach Aura IA** e **Gemma Neural Core**) com cálculo do **Bio Health Score (0–100)**.
   - **Download e Execução de IA Local no Celular ([`localModelService.ts`](src/services/localModelService.ts))**: baixe modelos **Google Gemma 3 (1B / 270M)**, **Gemma 2 (2B)** ou **Llama 3.2 (1B)** em formato `.gguf` direto pelo aplicativo e execute a inferência 100% offline na CPU/NPU ARM64 via `llama.rn` com streaming de tokens em tempo real.
   - **Provedores em Nuvem + Motor Clínico**: suporte simultâneo a **OpenRouter**, **DeepSeek API**, **Google Gemini API** e motor heurístico local ([`aiCoachService.ts`](src/services/aiCoachService.ts)).
   - **Plano Estruturado em 5 Pilares ([`AiCoachHubView.tsx`](src/components/AiCoachHubView.tsx))**: gera recomendações personalizadas de **Resumo Geral**, **Treinos**, **Alimentação (kcal + macros)**, **Hábitos & Sono** e **Interpretação de Exames**, além de **Chat Interativo** com o Coach.

8. **💾 Armazenamento Local-First + Sincronização Opcional com Supabase**
   - Todos os dados ficam salvos localmente no celular via `AsyncStorage` ([`storageAndCloud.ts`](src/services/storageAndCloud.ts)).
   - Sincronização em nuvem **100% opcional** com **Supabase** (configurável direto na aba *Ajustes*).

---

## 📁 Estrutura do Projeto

```text
bio-scale-ai/
├── App.tsx                                  # Navegação principal (6 abas) e estado global
├── plugins/
│   └── withAndroidGradleFixes.js            # Config Plugin Expo (minSdk=26, arm64-v8a, largeHeap, NDK e Health Connect)
├── src/
│   ├── components/
│   │   ├── AiCoachHubView.tsx               # Hub completo do Coach IA (Treinos, Nutrição, Hábitos, Exames, Gemma Local e Chat)
│   │   ├── BodyAvatarSvg.tsx                # Avatar SVG corporal paramétrico em tempo real
│   │   ├── CoachAvatarSvg.tsx               # Avatar SVG interativo do Coach IA (Dr. Atlas, Coach Aura, Gemma Core)
│   │   ├── EvolutionAndCompareView.tsx      # Tabela histórica, filtro de turnos e comparador Antes vs. Depois
│   │   └── TrendChart.tsx                   # Gráfico SVG de evolução temporal
│   ├── services/
│   │   ├── aiCoachService.ts                # Orquestrador Coach IA (Gemma Local llama.rn, OpenRouter, DeepSeek, Gemini e Clínico)
│   │   ├── bleScanner.ts                    # Scanner Bluetooth Low Energy (react-native-ble-plx)
│   │   ├── localModelService.ts             # Gerenciador de download GGUF e inferência local via llama.rn
│   │   ├── okokBleParser.ts                 # Parser hexadecimal do protocolo Chipsea/OKOK (0xCA)
│   │   ├── samsungHealthService.ts          # Ponte com Samsung Health via Android Health Connect (incluindo Sono)
│   │   └── storageAndCloud.ts               # Persistência AsyncStorage + Sync opcional Supabase
│   ├── types/
│   │   └── health.ts                        # Tipagens TypeScript do domínio (BIA, Medidas, Exames, Modelos GGUF e Coach)
│   └── utils/
│       ├── bioimpedance.ts                  # Fórmulas de composição corporal (BIA)
│       ├── bodyMeasurements.ts              # Guia de fita métrica e cálculos antropométricos
│       └── labExams.ts                      # Referências clínicas de 19 biomarcadores de sangue e cálculo HOMA-IR
└── .github/workflows/
    └── release-apk.yml                      # Workflow manual de build e release de APK Android
```

---

## 🐧 Guia Completo de Ambiente no WSL2 (Ubuntu)

> **Importante**: Ao trabalhar no WSL2, sempre clone o repositório dentro do sistema de arquivos nativo do Linux (ex.: `~/projects/BioScale`), **nunca** em `/mnt/c/...`. Isso garante performance máxima de I/O e elimina o limite de 260 caracteres (`MAX_PATH`) do Windows durante a compilação C++ (CMake/Ninja) do React Native New Architecture.

### 1. Clonar o projeto no filesystem do WSL2
```bash
mkdir -p ~/projects && cd ~/projects
git clone https://github.com/MTMonteiro/BioScale.git
cd BioScale
npm install
```

### 2. Instalar Java JDK 17 e Android SDK no WSL2 (apenas na 1ª vez)
```bash
# Instalar OpenJDK 17 e utilitários
sudo apt update && sudo apt install -y openjdk-17-jdk unzip wget

# Baixar Android Command Line Tools
mkdir -p ~/Android/Sdk/cmdline-tools
cd ~/Android/Sdk/cmdline-tools
wget https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O cmdline-tools.zip
unzip -q cmdline-tools.zip && mv cmdline-tools latest && rm cmdline-tools.zip

# Configurar variáveis de ambiente no ~/.bashrc (ou ~/.zshrc)
cat << 'EOF' >> ~/.bashrc
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools
EOF
source ~/.bashrc

# Aceitar licenças e instalar SDKs necessários para Expo 58 + Health Connect
yes | sdkmanager --licenses
sdkmanager "platform-tools" "platforms;android-36" "platforms;android-37.0" "build-tools;36.0.0" "build-tools;37.0.0" "ndk;27.1.12297006"
```

### 3. Gerar o APK direto pelo WSL2 (1 comando)
O projeto já inclui o plugin [`plugins/withAndroidGradleFixes.js`](plugins/withAndroidGradleFixes.js), que configura automaticamente `android.minSdkVersion=26`, `reactNativeArchitectures=arm64-v8a` e o `intent-filter` do Health Connect durante o `prebuild`. Para compilar o APK no WSL:

```bash
npm run build:apk:wsl
```
O instalador final será copiado automaticamente para `./BioScale-AI.apk` na raiz do projeto.

### 4. Conectando seu Celular Android ao WSL2 (Depuração Sem Fio)
Como a balança usa **Bluetooth Low Energy (BLE)** e **Health Connect**, o teste em tempo real é feito no aparelho Android físico:
1. No celular Android, ative **Opções do Desenvolvedor -> Depuração por Wi-Fi**.
2. Toque em **Parear dispositivo com código de pareamento** e execute no WSL:
   ```bash
   adb pair IP_DO_CELULAR:PORTA_DE_PAREAMENTO
   adb connect IP_DO_CELULAR:PORTA_DE_CONEXAO
   ```
3. Para instalar o APK recém-gerado no celular:
   ```bash
   adb install -r BioScale-AI.apk
   ```
4. Ou para rodar com Fast Refresh / Metro Bundler:
   ```bash
   npx expo start --dev-client --lan
   ```

---

## 📦 Gerando Releases pelo GitHub Actions

1. Acesse a aba **Actions** no repositório [`MTMonteiro/BioScale`](https://github.com/MTMonteiro/BioScale/actions).
2. Selecione o workflow **Build Android APK & Release**.
3. Clique em **Run workflow** e informe a nova versão SemVer (ex.: `1.0.0`).
   - *Regra de proteção*: A Action verifica automaticamente a última tag publicada no GitHub Releases e **bloqueia o build** caso a versão informada seja igual ou inferior à última release.
4. Ao finalizar, o arquivo `BioScale-AI-vX.Y.Z.apk` é anexado automaticamente na aba **Releases**.

---

## 🔬 Especificação Técnica do Protocolo BLE (`0xCA` Wellmix / Chipsea / OKOK)

O parser em [`src/services/okokBleParser.ts`](src/services/okokBleParser.ts) decodifica os pacotes `Manufacturer Specific Data` transmitidos via Bluetooth Low Energy pelas balanças compatíveis com o app OKOK:

| Offset (Byte) | Descrição | Formato / Cálculo |
| :--- | :--- | :--- |
| `0` | Header / Magic Byte | `0xCA` (Protocolo Chipsea V2) ou `0xCF` / `0xC0` |
| `1` | Versão do Protocolo | Ex.: `0x10` ou `0x11` |
| `2` | Flags de Estado | Bit `0` (`0x01`): Peso estabilizado / medição finalizada |
| `3..4` | Peso Bruto (`uint16` Big-Endian) | `(byte[3] << 8 \| byte[4]) / 100` (ou `/ 10` conforme escala) $\rightarrow$ **kg** |
| `5..6` | Impedância Bioelétrica (`uint16` BE) | `(byte[5] << 8 \| byte[6])` $\rightarrow$ **Ohms ($\Omega$)** |
| `7..12` | Endereço MAC da Balança | 6 bytes finais do pacote |

---

## 🗄️ Chaves de Armazenamento Local (`AsyncStorage`) & Schema Supabase

Por padrão, o app funciona **100% offline** salvando tudo no celular com as chaves:
- `@bioscale:user_profile_v1`: Perfil do usuário, persona do Coach, provedor de IA ativo (`gemma_local`, `openrouter`, `deepseek`, `gemini`, `local`), modelo GGUF selecionado, chave de API e credenciais opcionais do Supabase.
- `@bioscale:weight_history_v1`: Histórico completo de pesagens e bioimpedância.
- `@bioscale:body_measurements_v1`: Histórico de circunferências corporais de fita métrica (10 regiões).
- `@bioscale:lab_exams_v1`: Histórico de resultados de exames laboratoriais de sangue (19 biomarcadores + HOMA-IR).

### SQL Opcional para Nuvem (Supabase)
Caso deseje ativar o backup em nuvem na aba **Ajustes**, execute o SQL abaixo no SQL Editor do seu projeto Supabase:

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

create table if not exists public.lab_exams_logs (
  id text primary key,
  timestamp bigint not null,
  lab_name text,
  payload jsonb not null,
  notes text
);
```
