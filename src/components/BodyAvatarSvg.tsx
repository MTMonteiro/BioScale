import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  LinearGradient,
  Stop,
  G,
  Rect,
  Text as SvgText,
} from 'react-native-svg';
import { BodyMeasurementsEntry, BodyPartKey } from '../types/health';
import { BODY_PARTS_GUIDE } from '../utils/bodyMeasurements';

interface Props {
  measurements: Omit<
    BodyMeasurementsEntry,
    'id' | 'timestamp' | 'waistToHipRatio' | 'navyBodyFatEstimate'
  >;
  selectedPart?: BodyPartKey;
  onSelectPart?: (part: BodyPartKey) => void;
  compact?: boolean;
  accentColor?: string;
  badgeText?: string;
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

/**
 * Avatar Paramétrico Dinâmico:
 * Toda a geometria do corpo (pescoço, ombros, peitoral, bíceps, antebraço, cintura, abdômen,
 * quadril, coxas e panturrilhas) é calculada matematicamente em função das medidas (cm) fornecidas.
 * Suporta modo normal (interativo com fita métrica) e modo compacto (lado a lado para comparação de períodos).
 */
export const BodyAvatarSvg: React.FC<Props> = ({
  measurements,
  selectedPart = 'waistCm',
  onSelectPart,
  compact = false,
  accentColor = '#38BDF8',
  badgeText,
}) => {
  const cx = 140; // Centro horizontal do Avatar (Canvas 280 x 380)
  const svgWidth = compact ? 158 : 280;
  const svgHeight = compact ? 225 : 380;

  // Escalas proporcionais reais (meia-largura em pixels a partir do centro cx = 140)
  const neckW = clamp((measurements.neckCm / 38) * 11.5, 8, 18);
  const shoulderW = clamp((measurements.shouldersCm / 118) * 44, 30, 62);
  const chestW = clamp((measurements.chestCm / 102) * 34, 23, 50);
  const waistW = clamp((measurements.waistCm / 82) * 26, 17, 46);
  const abdomenW = clamp((measurements.abdomenCm / 85) * 28, 18, 49);
  const hipW = clamp((measurements.hipsCm / 98) * 33, 24, 50);

  // Espessuras dos membros
  const bicepThick = clamp((measurements.bicepsCm / 36) * 13.5, 8.5, 22);
  const forearmThick = clamp((measurements.forearmCm / 29) * 10.5, 7, 17);
  const thighThick = clamp((measurements.thighCm / 58) * 21, 13, 31);
  const calfThick = clamp((measurements.calfCm / 38) * 14, 9.5, 22);

  // Coordenadas Y anatômicas
  const yNeckTop = 58;
  const yNeckBot = 73;
  const yShoulder = 92;
  const yArmpit = 114;
  const yChest = 122;
  const yWaist = 162;
  const yAbdomen = 182;
  const yHips = 205;
  const yCrotch = 218;
  const yThighMid = 254;
  const yKnee = 288;
  const yCalfMid = 322;
  const yAnkle = 358;

  // Caminho SVG do Tronco + Pernas (Silhueta Paramétrica Contínua)
  const torsoAndLegsPath = `
    M ${cx - neckW} ${yNeckTop}
    L ${cx + neckW} ${yNeckTop}
    L ${cx + neckW + 2} ${yNeckBot}
    Q ${cx + shoulderW * 0.65} ${yNeckBot + 4} ${cx + shoulderW} ${yShoulder}
    Q ${cx + shoulderW + 3} ${yArmpit - 6} ${cx + chestW} ${yArmpit}
    Q ${cx + chestW + 1} ${yChest} ${cx + waistW} ${yWaist}
    Q ${cx + abdomenW + 1} ${yAbdomen} ${cx + hipW} ${yHips}
    Q ${cx + hipW + 1} ${yThighMid - 12} ${cx + 9 + thighThick} ${yThighMid}
    Q ${cx + 9 + thighThick * 0.78} ${yKnee - 8} ${cx + 11 + calfThick * 0.85} ${yKnee}
    Q ${cx + 12 + calfThick} ${yCalfMid} ${cx + 13 + calfThick * 0.58} ${yAnkle}
    L ${cx + 7} ${yAnkle}
    Q ${cx + 6} ${yCalfMid} ${cx + 7} ${yKnee}
    Q ${cx + 4} ${yThighMid} ${cx} ${yCrotch}
    Q ${cx - 4} ${yThighMid} ${cx - 7} ${yKnee}
    Q ${cx - 6} ${yCalfMid} ${cx - 7} ${yAnkle}
    L ${cx - 13 - calfThick * 0.58} ${yAnkle}
    Q ${cx - 12 - calfThick} ${yCalfMid} ${cx - 11 - calfThick * 0.85} ${yKnee}
    Q ${cx - 9 - thighThick * 0.78} ${yKnee - 8} ${cx - 9 - thighThick} ${yThighMid}
    Q ${cx - hipW - 1} ${yThighMid - 12} ${cx - hipW} ${yHips}
    Q ${cx - abdomenW - 1} ${yAbdomen} ${cx - waistW} ${yWaist}
    Q ${cx - chestW - 1} ${yChest} ${cx - chestW} ${yArmpit}
    Q ${cx - shoulderW - 3} ${yArmpit - 6} ${cx - shoulderW} ${yShoulder}
    Q ${cx - shoulderW * 0.65} ${yNeckBot + 4} ${cx - neckW - 2} ${yNeckBot}
    Z
  `;

  const leftArmOuterX = cx - shoulderW - 2;
  const rightArmOuterX = cx + shoulderW + 2;

  const leftArmPath = `
    M ${cx - shoulderW + 2} ${yShoulder + 2}
    Q ${leftArmOuterX - bicepThick * 0.95} 125 ${leftArmOuterX - bicepThick * 0.85} 152
    Q ${leftArmOuterX - bicepThick * 0.8 - forearmThick * 0.7} 175 ${leftArmOuterX - bicepThick * 0.7 - forearmThick * 0.45} 206
    L ${leftArmOuterX - bicepThick * 0.25} 206
    Q ${leftArmOuterX - bicepThick * 0.15} 175 ${cx - chestW - 3} 150
    L ${cx - chestW} ${yArmpit}
    Z
  `;

  const rightArmPath = `
    M ${cx + shoulderW - 2} ${yShoulder + 2}
    Q ${rightArmOuterX + bicepThick * 0.95} 125 ${rightArmOuterX + bicepThick * 0.85} 152
    Q ${rightArmOuterX + bicepThick * 0.8 + forearmThick * 0.7} 175 ${rightArmOuterX + bicepThick * 0.7 + forearmThick * 0.45} 206
    L ${rightArmOuterX + bicepThick * 0.25} 206
    Q ${rightArmOuterX + bicepThick * 0.15} 175 ${cx + chestW + 3} 150
    L ${cx + chestW} ${yArmpit}
    Z
  `;

  const getTapeMeasureGeometry = (
    part: BodyPartKey
  ): { x1: number; x2: number; y: number } => {
    switch (part) {
      case 'neckCm':
        return { x1: cx - neckW - 2, x2: cx + neckW + 2, y: 66 };
      case 'shouldersCm':
        return { x1: cx - shoulderW - 4, x2: cx + shoulderW + 4, y: yShoulder + 2 };
      case 'chestCm':
        return { x1: cx - chestW - 2, x2: cx + chestW + 2, y: yChest };
      case 'bicepsCm':
        return {
          x1: rightArmOuterX + 1,
          x2: rightArmOuterX + bicepThick * 0.95,
          y: 134,
        };
      case 'forearmCm':
        return {
          x1: rightArmOuterX + 2,
          x2: rightArmOuterX + bicepThick * 0.7 + forearmThick * 0.65,
          y: 176,
        };
      case 'waistCm':
        return { x1: cx - waistW - 2, x2: cx + waistW + 2, y: yWaist };
      case 'abdomenCm':
        return { x1: cx - abdomenW - 2, x2: cx + abdomenW + 2, y: yAbdomen };
      case 'hipsCm':
        return { x1: cx - hipW - 2, x2: cx + hipW + 2, y: yHips };
      case 'thighCm':
        return { x1: cx + 5, x2: cx + 10 + thighThick, y: yThighMid };
      case 'calfCm':
        return { x1: cx + 7, x2: cx + 12 + calfThick, y: yCalfMid };
    }
  };

  const activeGuide = BODY_PARTS_GUIDE[selectedPart];
  const activeTape = getTapeMeasureGeometry(selectedPart);

  const hotspots: Array<{ part: BodyPartKey; x: number; y: number }> = [
    { part: 'neckCm', x: cx, y: 66 },
    { part: 'shouldersCm', x: cx - shoulderW, y: yShoulder + 2 },
    { part: 'chestCm', x: cx, y: yChest },
    { part: 'bicepsCm', x: rightArmOuterX + bicepThick * 0.55, y: 134 },
    { part: 'forearmCm', x: rightArmOuterX + bicepThick * 0.45 + forearmThick * 0.3, y: 176 },
    { part: 'waistCm', x: cx, y: yWaist },
    { part: 'abdomenCm', x: cx, y: yAbdomen },
    { part: 'hipsCm', x: cx, y: yHips },
    { part: 'thighCm', x: cx + 8 + thighThick * 0.5, y: yThighMid },
    { part: 'calfCm', x: cx + 9 + calfThick * 0.5, y: yCalfMid },
  ];

  return (
    <View style={[styles.wrapper, compact && styles.wrapperCompact]}>
      <Svg width={svgWidth} height={svgHeight} viewBox="0 0 280 380">
        <Defs>
          <LinearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={accentColor} stopOpacity="0.45" />
            <Stop offset="50%" stopColor="#6366F1" stopOpacity="0.35" />
            <Stop offset="100%" stopColor="#10B981" stopOpacity="0.40" />
          </LinearGradient>
        </Defs>

        {/* Grade de fundo biométrica */}
        {[60, 120, 180, 240, 300, 360].map((gy) => (
          <Line
            key={gy}
            x1={20}
            y1={gy}
            x2={260}
            y2={gy}
            stroke="#1E293B"
            strokeDasharray="3 3"
            strokeWidth="1"
          />
        ))}
        <Line
          x1={cx}
          y1={15}
          x2={cx}
          y2={370}
          stroke="#1E293B"
          strokeDasharray="4 4"
          strokeWidth="1"
        />

        {/* Cabeça */}
        <Circle
          cx={cx}
          cy={36}
          r={19}
          fill="url(#bodyGrad)"
          stroke={accentColor}
          strokeWidth="2"
        />

        {/* Braços Paramétricos */}
        <Path
          d={leftArmPath}
          fill="url(#bodyGrad)"
          stroke={accentColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <Path
          d={rightArmPath}
          fill="url(#bodyGrad)"
          stroke={accentColor}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />

        {/* Tronco + Pernas Paramétricos */}
        <Path
          d={torsoAndLegsPath}
          fill="url(#bodyGrad)"
          stroke={accentColor}
          strokeWidth="2.2"
          strokeLinejoin="round"
        />

        {/* Linhas anatômicas de definição */}
        <Path
          d={`M ${cx - chestW * 0.75} ${yChest + 4} Q ${cx - chestW * 0.35} ${yChest + 10} ${cx - 2} ${yChest + 2}`}
          stroke="#7DD3FC"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          fill="none"
        />
        <Path
          d={`M ${cx + chestW * 0.75} ${yChest + 4} Q ${cx + chestW * 0.35} ${yChest + 10} ${cx + 2} ${yChest + 2}`}
          stroke="#7DD3FC"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          fill="none"
        />
        <Circle cx={cx} cy={yAbdomen} r={2} fill="#7DD3FC" opacity={0.6} />

        {/* Fita Métrica Destacada na Região Selecionada */}
        <G>
          <Line
            x1={activeTape.x1 - 6}
            y1={activeTape.y}
            x2={activeTape.x2 + 6}
            y2={activeTape.y}
            stroke={activeGuide.color}
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <Line
            x1={activeTape.x1 - 6}
            y1={activeTape.y}
            x2={activeTape.x2 + 6}
            y2={activeTape.y}
            stroke="#FFFFFF"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
          {!compact && (
            <>
              <Rect
                x={8}
                y={clamp(activeTape.y - 13, 10, 345)}
                width={68}
                height={24}
                rx={7}
                fill="#0F172A"
                stroke={activeGuide.color}
                strokeWidth="1.5"
              />
              <SvgText
                x={42}
                y={clamp(activeTape.y + 3, 26, 361)}
                fill="#F8FAFC"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
              >
                {`${measurements[selectedPart]} cm`}
              </SvgText>
            </>
          )}
        </G>

        {badgeText && (
          <G>
            <Rect
              x={70}
              y={346}
              width={140}
              height={26}
              rx={8}
              fill="#0F172A"
              stroke={accentColor}
              strokeWidth="1.5"
            />
            <SvgText
              x={140}
              y={363}
              fill="#F8FAFC"
              fontSize="13"
              fontWeight="bold"
              textAnchor="middle"
            >
              {badgeText}
            </SvgText>
          </G>
        )}

        {/* Hotspots clicáveis apenas no modo completo */}
        {!compact &&
          onSelectPart &&
          hotspots.map((h) => {
            const isSelected = h.part === selectedPart;
            const color = BODY_PARTS_GUIDE[h.part].color;
            return (
              <G key={h.part} onPress={() => onSelectPart(h.part)}>
                {isSelected && (
                  <Circle cx={h.x} cy={h.y} r={11} fill={color} opacity={0.28} />
                )}
                <Circle
                  cx={h.x}
                  cy={h.y}
                  r={isSelected ? 6 : 4.5}
                  fill={isSelected ? color : '#0F172A'}
                  stroke={color}
                  strokeWidth="2"
                />
              </G>
            );
          })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B1120',
    borderRadius: 20,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  wrapperCompact: {
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: 16,
  },
});
