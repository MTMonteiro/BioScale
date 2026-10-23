import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient, Stop, Line, Text as SvgText } from 'react-native-svg';
import { BioimpedanceMetrics } from '../types/health';

interface Props {
  data: BioimpedanceMetrics[];
}

type MetricKey = 'weightKg' | 'bodyFatPercent' | 'muscleMassKg' | 'waterPercent';

const METRIC_CONFIG: Record<MetricKey, { label: string; unit: string; color: string }> = {
  weightKg: { label: 'Peso', unit: 'kg', color: '#38BDF8' },
  bodyFatPercent: { label: 'Gordura', unit: '%', color: '#F43F5E' },
  muscleMassKg: { label: 'Músculo', unit: 'kg', color: '#10B981' },
  waterPercent: { label: 'Água', unit: '%', color: '#6366F1' },
};

export const TrendChart: React.FC<Props> = ({ data }) => {
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
    const label = `${String(dateObj.getDate()).padStart(2, '0')}/${String(
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
        <Text style={styles.title}>Evolução Histórica</Text>
        <View style={styles.tabsRow}>
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((key) => {
            const active = key === selectedMetric;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setSelectedMetric(key)}
                style={[
                  styles.tabButton,
                  active && { backgroundColor: METRIC_CONFIG[key].color + '25', borderColor: METRIC_CONFIG[key].color },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    active && { color: METRIC_CONFIG[key].color, fontWeight: '700' },
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
            <Stop offset="0%" stopColor={cfg.color} stopOpacity="0.38" />
            <Stop offset="100%" stopColor={cfg.color} stopOpacity="0.0" />
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
              stroke="#1E293B"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          );
        })}

        {points.length > 1 && <Path d={areaPath} fill="url(#gradArea)" />}
        {points.length > 1 && (
          <Path d={linePath} fill="none" stroke={cfg.color} strokeWidth="3" strokeLinecap="round" />
        )}

        {points.map((p, idx) => (
          <React.Fragment key={idx}>
            <Circle cx={p.x} cy={p.y} r="4.5" fill="#0F172A" stroke={cfg.color} strokeWidth="2.5" />
            <SvgText
              x={p.x}
              y={p.y - 10}
              fill="#F8FAFC"
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
            >
              {`${p.val}`}
            </SvgText>
            <SvgText
              x={p.x}
              y={chartHeight - 6}
              fill="#64748B"
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
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  headerRow: {
    marginBottom: 12,
    gap: 10,
  },
  title: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tabButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  tabText: {
    color: '#94A3B8',
    fontSize: 12,
  },
});
