import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { BioimpedanceMetrics } from '../types/health';
import { DAY_PERIOD_INFO, resolveMeasurementPeriod } from '../utils/bioimpedance';
import { obsidianTheme } from '../theme/obsidianTheme';

export interface TrendChartProps {
  data: BioimpedanceMetrics[];
  title?: string;
  color?: string;
}

type MetricKey = 'weightKg' | 'bodyFatPercent' | 'muscleMassKg' | 'waterPercent';

const METRIC_CONFIG: Record<MetricKey, { label: string; unit: string }> = {
  weightKg: { label: 'Peso', unit: 'kg' },
  bodyFatPercent: { label: 'Gordura', unit: '%' },
  muscleMassKg: { label: 'Músculo', unit: 'kg' },
  waterPercent: { label: 'Água', unit: '%' },
};

export const TrendChart: React.FC<TrendChartProps> = ({
  data,
  title = 'Evolução Histórica',
  color = obsidianTheme.accent,
}) => {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey>('weightKg');

  const recent = data.slice(-7);
  const cfg = METRIC_CONFIG[selectedMetric];
  const chartWidth = Math.min(Dimensions.get('window').width - 64, 520);
  const chartHeight = 165;
  const padX = 28;
  const padY = 26;

  if (recent.length === 0) {
    return null;
  }

  const values = recent.map((d) => d[selectedMetric]);
  const minVal = Math.min(...values) - 0.8;
  const maxVal = Math.max(...values) + 0.8;
  const range = Math.max(maxVal - minVal, 1);

  const points = recent.map((item, index) => {
    const x =
      recent.length === 1
        ? chartWidth / 2
        : padX + (index / (recent.length - 1)) * (chartWidth - padX * 2);
    const y =
      chartHeight -
      padY -
      ((item[selectedMetric] - minVal) / range) * (chartHeight - padY * 2);
    const dateObj = new Date(item.timestamp);
    const pIcon = DAY_PERIOD_INFO[resolveMeasurementPeriod(item)].icon;
    const label = `${pIcon}${String(dateObj.getDate()).padStart(2, '0')}/${String(
      dateObj.getMonth() + 1
    ).padStart(2, '0')}`;
    return { x, y, val: item[selectedMetric], label };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(
    chartHeight - padY
  ).toFixed(1)} L ${points[0].x.toFixed(1)} ${(chartHeight - padY).toFixed(1)} Z`;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>
            {cfg.label} ({cfg.unit}) • Últimos {recent.length} registros
          </Text>
        </View>
        <View style={styles.tabsRow}>
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((key) => {
            const active = key === selectedMetric;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setSelectedMetric(key)}
                activeOpacity={0.75}
                style={[
                  styles.tabButton,
                  active && {
                    backgroundColor: obsidianTheme.accentSoft,
                    borderColor: color,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    active && { color: color, fontWeight: '700' },
                  ]}
                >
                  {METRIC_CONFIG[key].label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Svg width={chartWidth} height={chartHeight}>
        <Defs>
          <LinearGradient id="gradArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity="0.22" />
            <Stop offset="100%" stopColor={color} stopOpacity="0.0" />
          </LinearGradient>
        </Defs>

        {/* Linhas guias horizontais */}
        {[0.2, 0.5, 0.8].map((ratio, idx) => {
          const y = padY + ratio * (chartHeight - padY * 2);
          return (
            <Line
              key={idx}
              x1={padX}
              y1={y}
              x2={chartWidth - padX}
              y2={y}
              stroke={obsidianTheme.border}
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          );
        })}

        {points.length > 1 && <Path d={areaPath} fill="url(#gradArea)" />}
        {points.length > 1 && (
          <Path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
        )}

        {points.map((p, idx) => (
          <React.Fragment key={idx}>
            <Circle
              cx={p.x}
              cy={p.y}
              r="4.5"
              fill={obsidianTheme.bg}
              stroke={color}
              strokeWidth="2.5"
            />
            <SvgText
              x={p.x}
              y={p.y - 10}
              fill={obsidianTheme.textPrimary}
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
            >
              {`${p.val}`}
            </SvgText>
            <SvgText
              x={p.x}
              y={chartHeight - 6}
              fill={obsidianTheme.textMuted}
              fontSize="10"
              textAnchor="middle"
            >
              {p.label}
            </SvgText>
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  headerRow: {
    marginBottom: 12,
    gap: 10,
  },
  titleBlock: {
    gap: 2,
  },
  title: {
    color: obsidianTheme.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: obsidianTheme.textMuted,
    fontSize: 11,
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tabButton: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    backgroundColor: obsidianTheme.bg,
  },
  tabText: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
});
