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
├── plugins/
│   └── withAndroidGradleFixes.js            # Config Plugin Expo (minSdk=26, arm64-v8a e intent Health Connect)
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
sdkmanager "platform-tools" "platforms;android-36" "platforms;android-37" "build-tools;36.0.0" "build-tools;37.0.0" "ndk;27.1.12297006"
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
- `@bioscale:user_profile_v1`: Perfil do usuário, provedor de IA ativo (`openrouter`, `deepseek`, `gemini`, `local`), chave de API e credenciais opcionais do Supabase.
- `@bioscale:weight_history_v1`: Histórico completo de pesagens e bioimpedância.
- `@bioscale:body_measurements_v1`: Histórico de circunferências corporais de fita métrica (10 regiões).

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
```
