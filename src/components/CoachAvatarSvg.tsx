import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Polygon,
  Rect,
  Stop,
  G,
  Line,
  Text as SvgText,
} from 'react-native-svg';
import { CoachPersona } from '../types/health';
import { obsidianTheme } from '../theme/obsidianTheme';

export type CoachAvatarMood = 'idle' | 'analyzing' | 'ready' | 'alert';

interface Props {
  persona: CoachPersona;
  onSelectPersona?: (persona: CoachPersona) => void;
  mood?: CoachAvatarMood;
  healthScore?: number;
  activeModelBadge?: string;
  isLocalGemmaActive?: boolean;
  alertsCount?: number;
  statusLine?: string;
}

export const COACH_PERSONAS_INFO: Record<
  CoachPersona,
  {
    name: string;
    role: string;
    primaryColor: string;
    secondaryColor: string;
    tagline: string;
  }
> = {
  atlas: {
    name: 'Dr. Atlas IA',
    role: 'Fisiologista & Nutrólogo Esportivo',
    primaryColor: obsidianTheme.accent,
    secondaryColor: obsidianTheme.statusNormal,
    tagline: 'Especialista em Bioimpedância, Exames Clínicos & Recomposição',
  },
  aura: {
    name: 'Coach Aura IA',
    role: 'Treinadora de Hipertrofia & Hábitos',
    primaryColor: '#38BDF8',
    secondaryColor: obsidianTheme.accent,
    tagline: 'Foco em Simetria do Avatar, Periodização de Treino & Recuperação',
  },
  gemma_core: {
    name: 'Gemma Neural Core',
    role: 'Motor Biomédico On-Device (GGUF)',
    primaryColor: obsidianTheme.statusAttention,
    secondaryColor: obsidianTheme.accent,
    tagline: 'Inteligência Local Privada rodando direto no processador do celular',
  },
};

export const CoachAvatarSvg: React.FC<Props> = ({
  persona,
  onSelectPersona,
  mood = 'ready',
  healthScore = 86,
  activeModelBadge = 'Gemma 3 1B Local',
  isLocalGemmaActive = false,
  alertsCount = 0,
  statusLine,
}) => {
  const info = COACH_PERSONAS_INFO[persona] || COACH_PERSONAS_INFO.atlas;
  const ringColor =
    mood === 'analyzing'
      ? obsidianTheme.statusAttention
      : alertsCount > 2
      ? obsidianTheme.statusAlert
      : info.primaryColor;

  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        {/* Avatar SVG Ilustrado do Coach */}
        <View style={styles.svgWrapper}>
          <Svg width={122} height={132} viewBox="0 0 140 150">
            <Defs>
              <LinearGradient id="coachBgGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={info.primaryColor} stopOpacity="0.22" />
                <Stop offset="100%" stopColor={obsidianTheme.bg} stopOpacity="0.9" />
              </LinearGradient>
              <LinearGradient id="coachVisorGrad" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor={info.primaryColor} stopOpacity="1" />
                <Stop offset="100%" stopColor={info.secondaryColor} stopOpacity="1" />
              </LinearGradient>
              <LinearGradient id="coachSuitGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={obsidianTheme.surfaceHighlight} stopOpacity="1" />
                <Stop offset="100%" stopColor={obsidianTheme.bg} stopOpacity="1" />
              </LinearGradient>
            </Defs>

            {/* Anel Biométrico Externo (HUD) */}
            <Circle
              cx="70"
              cy="70"
              r="62"
              fill="url(#coachBgGrad)"
              stroke={obsidianTheme.border}
              strokeWidth="1.5"
            />
            <Circle
              cx="70"
              cy="70"
              r="62"
              fill="none"
              stroke={ringColor}
              strokeWidth="2"
              strokeDasharray="18 8 6 8"
              opacity={0.85}
            />
            <Circle
              cx="70"
              cy="70"
              r="54"
              fill="none"
              stroke={info.secondaryColor}
              strokeWidth="1"
              strokeDasharray="4 6"
              opacity={0.45}
            />

            {persona === 'atlas' && (
              <G>
                {/* Ombros / Jaleco Clínico Tecnológico Dr. Atlas */}
                <Path
                  d="M 24 128 C 26 98, 46 92, 70 92 C 94 92, 114 98, 116 128 Z"
                  fill="url(#coachSuitGrad)"
                  stroke={info.primaryColor}
                  strokeWidth="1.8"
                />
                {/* Lapela médica luminosa + Core peitoral */}
                <Path
                  d="M 55 93 L 70 116 L 85 93"
                  fill="none"
                  stroke={info.secondaryColor}
                  strokeWidth="2"
                />
                <Circle
                  cx="70"
                  cy="115"
                  r="5"
                  fill={info.primaryColor}
                  opacity={0.9}
                />
                {/* Pescoço */}
                <Rect
                  x="61"
                  y="78"
                  width="18"
                  height="16"
                  rx="6"
                  fill="#2B3145"
                />
                {/* Cabeça / Rosto */}
                <Path
                  d="M 46 52 C 46 30, 94 30, 94 52 C 94 72, 82 84, 70 84 C 58 84, 46 72, 46 52 Z"
                  fill="#E2E8F0"
                  stroke={info.primaryColor}
                  strokeWidth="1.6"
                />
                {/* Cabelo / Contorno Superior */}
                <Path
                  d="M 45 48 C 45 28, 95 28, 95 48 C 90 38, 80 35, 70 35 C 60 35, 50 38, 45 48 Z"
                  fill={obsidianTheme.bg}
                />
                {/* Visor Holográfico Clínico (HUD) */}
                <Rect
                  x="50"
                  y="48"
                  width="40"
                  height="12"
                  rx="6"
                  fill="url(#coachVisorGrad)"
                />
                {/* Olhos digitais no visor */}
                <Circle cx="61" cy="54" r="2.2" fill={obsidianTheme.bg} />
                <Circle cx="79" cy="54" r="2.2" fill={obsidianTheme.bg} />
                {/* Sorriso confiante / Expressão */}
                {mood === 'analyzing' ? (
                  <Line
                    x1="63"
                    y1="71"
                    x2="77"
                    y2="71"
                    stroke={obsidianTheme.bg}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                ) : (
                  <Path
                    d="M 62 69 Q 70 75 78 69"
                    fill="none"
                    stroke={obsidianTheme.bg}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                )}
                {/* Headset / Sensor Auricular */}
                <Rect
                  x="41"
                  y="49"
                  width="5"
                  height="14"
                  rx="2.5"
                  fill={info.secondaryColor}
                />
                <Rect
                  x="94"
                  y="49"
                  width="5"
                  height="14"
                  rx="2.5"
                  fill={info.secondaryColor}
                />
              </G>
            )}

            {persona === 'aura' && (
              <G>
                {/* Traje Esportivo de Alta Performance Coach Aura */}
                <Path
                  d="M 26 128 C 30 98, 48 92, 70 92 C 92 92, 110 98, 114 128 Z"
                  fill="url(#coachSuitGrad)"
                  stroke={info.primaryColor}
                  strokeWidth="1.8"
                />
                {/* Linhas atléticas V-Taper no traje */}
                <Path
                  d="M 46 96 L 70 122 L 94 96"
                  fill="none"
                  stroke="url(#coachVisorGrad)"
                  strokeWidth="2.6"
                />
                {/* Pescoço */}
                <Rect
                  x="62"
                  y="78"
                  width="16"
                  height="15"
                  rx="6"
                  fill="#2B3145"
                />
                {/* Cabelo longo / estilizado */}
                <Path
                  d="M 40 56 C 38 26, 102 26, 100 56 C 102 74, 96 88, 90 92 L 50 92 C 44 88, 38 74, 40 56 Z"
                  fill={obsidianTheme.surfaceElevated}
                  stroke={info.primaryColor}
                  strokeWidth="1.2"
                />
                {/* Rosto */}
                <Path
                  d="M 48 53 C 48 34, 92 34, 92 53 C 92 71, 81 83, 70 83 C 59 83, 48 71, 48 53 Z"
                  fill="#F1F5F9"
                  stroke={info.primaryColor}
                  strokeWidth="1.5"
                />
                {/* Tiara / Visor Neural Esportivo */}
                <Path
                  d="M 49 49 Q 70 43 91 49 L 89 58 Q 70 53 51 58 Z"
                  fill="url(#coachVisorGrad)"
                />
                <Circle cx="61" cy="53" r="2.2" fill="#FFFFFF" />
                <Circle cx="79" cy="53" r="2.2" fill="#FFFFFF" />
                {/* Sorriso motivador */}
                <Path
                  d="M 63 69 Q 70 75 77 69"
                  fill="none"
                  stroke={obsidianTheme.bg}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
              </G>
            )}

            {persona === 'gemma_core' && (
              <G>
                {/* Base Neural & Cristal Multifacetado Google Gemma */}
                <Polygon
                  points="70,22 104,46 94,90 46,90 36,46"
                  fill="url(#coachSuitGrad)"
                  stroke={info.primaryColor}
                  strokeWidth="2"
                />
                <Polygon
                  points="70,30 95,50 86,84 54,84 45,50"
                  fill="url(#coachVisorGrad)"
                  opacity={0.32}
                />
                {/* Linhas de Faceta do Cristal Gemma */}
                <Line
                  x1="70"
                  y1="22"
                  x2="70"
                  y2="90"
                  stroke={info.primaryColor}
                  strokeWidth="1.4"
                />
                <Line
                  x1="36"
                  y1="46"
                  x2="104"
                  y2="46"
                  stroke={info.secondaryColor}
                  strokeWidth="1.2"
                />
                <Line
                  x1="46"
                  y1="90"
                  x2="95"
                  y2="50"
                  stroke={info.primaryColor}
                  strokeWidth="1"
                  opacity={0.7}
                />
                <Line
                  x1="94"
                  y1="90"
                  x2="45"
                  y2="50"
                  stroke={info.primaryColor}
                  strokeWidth="1"
                  opacity={0.7}
                />
                {/* Núcleo Neural Central */}
                <Circle
                  cx="70"
                  cy="58"
                  r="12"
                  fill={obsidianTheme.bg}
                  stroke={obsidianTheme.statusAttention}
                  strokeWidth="2.2"
                />
                <Circle cx="70" cy="58" r="5" fill={obsidianTheme.accent} />
                {/* Ondas de pulso de inferência local */}
                <Path
                  d="M 32 110 L 50 110 L 57 98 L 65 120 L 73 102 L 80 114 L 88 110 L 108 110"
                  fill="none"
                  stroke={obsidianTheme.accent}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </G>
            )}

            {/* Badge de Score de Saúde Integrado na Base do Avatar */}
            <Rect
              x="28"
              y="124"
              width="84"
              height="20"
              rx="10"
              fill={obsidianTheme.bg}
              stroke={ringColor}
              strokeWidth="1.2"
            />
            <SvgText
              x="70"
              y="138"
              fill={obsidianTheme.textPrimary}
              fontSize="9.5"
              fontWeight="bold"
              textAnchor="middle"
            >
              {`SCORE BIO: ${healthScore}/100`}
            </SvgText>
          </Svg>
        </View>

        {/* Informações do Coach + Status do Motor IA */}
        <View style={styles.infoCol}>
          <View style={styles.badgeRow}>
            <View
              style={[
                styles.engineBadge,
                {
                  borderColor: isLocalGemmaActive
                    ? obsidianTheme.statusAttention
                    : obsidianTheme.accentBorder,
                  backgroundColor: isLocalGemmaActive
                    ? obsidianTheme.statusAttentionBg
                    : obsidianTheme.accentSoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.engineBadgeText,
                  {
                    color: isLocalGemmaActive
                      ? obsidianTheme.statusAttention
                      : obsidianTheme.accent,
                  },
                ]}
              >
                {isLocalGemmaActive ? '⚡ GEMMA ON-DEVICE' : '⚡ MOTOR IA ATIVO'}
              </Text>
            </View>
            {alertsCount > 0 && (
              <View style={styles.examAlertBadge}>
                <Text style={styles.examAlertBadgeText}>
                  {alertsCount} alerta{alertsCount > 1 ? 's' : ''} clínico{alertsCount > 1 ? 's' : ''}
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.coachName}>{info.name}</Text>
          <Text style={[styles.coachRole, { color: info.primaryColor }]}>
            {info.role}
          </Text>
          <Text style={styles.coachTagline}>{info.tagline}</Text>

          <View style={styles.modelLineBox}>
            <Text style={styles.modelLineLabel}>MOTOR</Text>
            <Text style={styles.modelLineValue} numberOfLines={1}>
              {activeModelBadge}
            </Text>
          </View>

          {statusLine ? (
            <Text style={styles.statusLineText} numberOfLines={2}>
              {statusLine}
            </Text>
          ) : null}
        </View>
      </View>

      {/* Seletor Rápido de Avatar do Coach */}
      {onSelectPersona && (
        <View style={styles.personaSwitchRow}>
          <Text style={styles.personaSwitchLabel}>PERSONA:</Text>
          {(['atlas', 'aura', 'gemma_core'] as CoachPersona[]).map((key) => {
            const p = COACH_PERSONAS_INFO[key];
            const active = persona === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => onSelectPersona(key)}
                style={[
                  styles.personaChip,
                  active && {
                    borderColor: obsidianTheme.accentBorder,
                    backgroundColor: obsidianTheme.accentSoft,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.personaChipText,
                    active && { color: obsidianTheme.accent, fontWeight: '700' },
                  ]}
                >
                  {p.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    padding: 14,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  svgWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCol: {
    flex: 1,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  engineBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  engineBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  examAlertBadge: {
    backgroundColor: obsidianTheme.statusAlertBg,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  examAlertBadgeText: {
    color: obsidianTheme.statusAlert,
    fontSize: 9,
    fontWeight: '700',
  },
  coachName: {
    color: obsidianTheme.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  coachRole: {
    fontSize: 11.5,
    fontWeight: '600',
    marginTop: 1,
  },
  coachTagline: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  modelLineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 7,
    backgroundColor: obsidianTheme.bg,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  modelLineLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  modelLineValue: {
    color: obsidianTheme.textPrimary,
    fontSize: 10.5,
    fontWeight: '600',
    flex: 1,
  },
  statusLineText: {
    color: obsidianTheme.accent,
    fontSize: 10.5,
    fontWeight: '600',
    marginTop: 5,
  },
  personaSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
  },
  personaSwitchLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginRight: 2,
  },
  personaChip: {
    backgroundColor: obsidianTheme.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  personaChipText: {
    color: obsidianTheme.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
});
