import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { ArrowRight, Calendar, Layers, Table2 } from 'lucide-react-native';
import {
  BioimpedanceMetrics,
  BodyMeasurementsEntry,
  BodyPartKey,
  UserProfile,
} from '../types/health';
import { BODY_PARTS_GUIDE, BODY_PART_ORDER } from '../utils/bodyMeasurements';
import { BodyAvatarSvg } from './BodyAvatarSvg';

interface Props {
  scaleHistory: BioimpedanceMetrics[];
  bodyHistory: BodyMeasurementsEntry[];
  profile: UserProfile;
}

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

function findClosestScaleEntry(
  targetIso: string,
  scaleHistory: BioimpedanceMetrics[]
): BioimpedanceMetrics | null {
  if (scaleHistory.length === 0) return null;
  const targetMs = new Date(targetIso).getTime();
  let best = scaleHistory[0];
  let bestDiff = Math.abs(new Date(best.timestamp).getTime() - targetMs);
  for (const item of scaleHistory) {
    const diff = Math.abs(new Date(item.timestamp).getTime() - targetMs);
    if (diff < bestDiff) {
      best = item;
      bestDiff = diff;
    }
  }
  return best;
}

function findClosestBodyEntry(
  targetIso: string,
  bodyHistory: BodyMeasurementsEntry[]
): BodyMeasurementsEntry | null {
  if (bodyHistory.length === 0) return null;
  const targetMs = new Date(targetIso).getTime();
  let best = bodyHistory[0];
  let bestDiff = Math.abs(new Date(best.timestamp).getTime() - targetMs);
  for (const item of bodyHistory) {
    const diff = Math.abs(new Date(item.timestamp).getTime() - targetMs);
    if (diff < bestDiff) {
      best = item;
      bestDiff = diff;
    }
  }
  return best;
}

export const EvolutionAndCompareView: React.FC<Props> = ({
  scaleHistory,
  bodyHistory,
}) => {
  const [periodAIdx, setPeriodAIdx] = useState<number>(0);
  const [periodBIdx, setPeriodBIdx] = useState<number>(
    Math.max(0, bodyHistory.length - 1)
  );
  const [highlightPart, setHighlightPart] = useState<BodyPartKey>('waistCm');

  const safeIdxA = Math.min(periodAIdx, Math.max(0, bodyHistory.length - 1));
  const safeIdxB = Math.min(periodBIdx, Math.max(0, bodyHistory.length - 1));

  const bodyA = bodyHistory[safeIdxA];
  const bodyB = bodyHistory[safeIdxB];

  const scaleA = bodyA ? findClosestScaleEntry(bodyA.timestamp, scaleHistory) : null;
  const scaleB = bodyB ? findClosestScaleEntry(bodyB.timestamp, scaleHistory) : null;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* SEÇÃO 1: COMPARADOR DE DOIS PERÍODOS (AVATAR A vs AVATAR B) */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Layers size={20} color="#38BDF8" />
          <Text style={styles.cardTitle}>Comparador de Períodos & Avatares</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Selecione duas datas abaixo para comparar visualmente a mudança na silhueta do seu Avatar, peso, gordura e medidas de fita métrica.
        </Text>

        {/* Seletores de Período A (Antes) e Período B (Depois) */}
        <View style={styles.periodSelectorsWrap}>
          <View style={styles.periodCol}>
            <View style={styles.periodLabelRow}>
              <Calendar size={13} color="#F59E0B" />
              <Text style={[styles.periodLabel, { color: '#F59E0B' }]}>
                PERÍODO A (ANTES)
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {bodyHistory.map((entry, idx) => {
                const active = idx === safeIdxA;
                return (
                  <TouchableOpacity
                    key={entry.id}
                    onPress={() => setPeriodAIdx(idx)}
                    style={[
                      styles.dateChip,
                      active && { backgroundColor: '#F59E0B25', borderColor: '#F59E0B' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateChipText,
                        active && { color: '#F59E0B', fontWeight: '800' },
                      ]}
                    >
                      {formatDateShort(entry.timestamp)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          <ArrowRight size={18} color="#64748B" style={{ marginTop: 18 }} />

          <View style={styles.periodCol}>
            <View style={styles.periodLabelRow}>
              <Calendar size={13} color="#10B981" />
              <Text style={[styles.periodLabel, { color: '#10B981' }]}>
                PERÍODO B (DEPOIS)
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {bodyHistory.map((entry, idx) => {
                const active = idx === safeIdxB;
                return (
                  <TouchableOpacity
                    key={entry.id}
                    onPress={() => setPeriodBIdx(idx)}
                    style={[
                      styles.dateChip,
                      active && { backgroundColor: '#10B98125', borderColor: '#10B981' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dateChipText,
                        active && { color: '#10B981', fontWeight: '800' },
                      ]}
                    >
                      {formatDateShort(entry.timestamp)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>

        {/* Dois Avatares Lado a Lado */}
        {bodyA && bodyB && (
          <>
            <View style={styles.avatarsSideBySide}>
              <View style={styles.avatarBox}>
                <BodyAvatarSvg
                  measurements={bodyA}
                  selectedPart={highlightPart}
                  compact
                  accentColor="#F59E0B"
                  badgeText={`${formatDateShort(bodyA.timestamp)} • ${
                    scaleA ? `${scaleA.weightKg}kg` : ''
                  }`}
                />
                <Text style={styles.avatarFooterStat}>
                  {BODY_PARTS_GUIDE[highlightPart].shortLabel}:{' '}
                  <Text style={{ color: '#F59E0B', fontWeight: '800' }}>
                    {bodyA[highlightPart]} cm
                  </Text>
                </Text>
              </View>

              <View style={styles.avatarBox}>
                <BodyAvatarSvg
                  measurements={bodyB}
                  selectedPart={highlightPart}
                  compact
                  accentColor="#10B981"
                  badgeText={`${formatDateShort(bodyB.timestamp)} • ${
                    scaleB ? `${scaleB.weightKg}kg` : ''
                  }`}
                />
                <Text style={styles.avatarFooterStat}>
                  {BODY_PARTS_GUIDE[highlightPart].shortLabel}:{' '}
                  <Text style={{ color: '#10B981', fontWeight: '800' }}>
                    {bodyB[highlightPart]} cm
                  </Text>
                </Text>
              </View>
            </View>

            {/* Chips para trocar qual parte a fita métrica destaca nos 2 Avatares */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: 10 }}
            >
              {BODY_PART_ORDER.map((pk) => {
                const g = BODY_PARTS_GUIDE[pk];
                const isSel = pk === highlightPart;
                const diff = Math.round((bodyB[pk] - bodyA[pk]) * 10) / 10;
                return (
                  <TouchableOpacity
                    key={pk}
                    onPress={() => setHighlightPart(pk)}
                    style={[
                      styles.partDiffChip,
                      isSel && { borderColor: g.color, backgroundColor: g.color + '20' },
                    ]}
                  >
                    <Text style={[styles.partDiffTitle, isSel && { color: g.color }]}>
                      {g.shortLabel}
                    </Text>
                    <Text
                      style={[
                        styles.partDiffVal,
                        { color: diff <= 0 ? '#38BDF8' : '#10B981' },
                      ]}
                    >
                      {diff > 0 ? `+${diff}` : diff} cm
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Resumo Comparativo Direto (Período A vs Período B) */}
            <View style={styles.deltaSummaryGrid}>
              {scaleA && scaleB && (
                <>
                  <View style={styles.deltaBox}>
                    <Text style={styles.deltaBoxLabel}>Peso</Text>
                    <Text style={styles.deltaBoxMain}>
                      {(scaleB.weightKg - scaleA.weightKg > 0 ? '+' : '') +
                        (scaleB.weightKg - scaleA.weightKg).toFixed(1)}{' '}
                      kg
                    </Text>
                    <Text style={styles.deltaBoxSub}>
                      {scaleA.weightKg} → {scaleB.weightKg} kg
                    </Text>
                  </View>

                  <View style={styles.deltaBox}>
                    <Text style={styles.deltaBoxLabel}>Gordura (BIA)</Text>
                    <Text style={styles.deltaBoxMain}>
                      {(scaleB.bodyFatPercent - scaleA.bodyFatPercent > 0 ? '+' : '') +
                        (scaleB.bodyFatPercent - scaleA.bodyFatPercent).toFixed(1)}
                      %
                    </Text>
                    <Text style={styles.deltaBoxSub}>
                      {scaleA.bodyFatPercent}% → {scaleB.bodyFatPercent}%
                    </Text>
                  </View>

                  <View style={styles.deltaBox}>
                    <Text style={styles.deltaBoxLabel}>Músculo</Text>
                    <Text style={styles.deltaBoxMain}>
                      {(scaleB.muscleMassKg - scaleA.muscleMassKg > 0 ? '+' : '') +
                        (scaleB.muscleMassKg - scaleA.muscleMassKg).toFixed(1)}{' '}
                      kg
                    </Text>
                    <Text style={styles.deltaBoxSub}>
                      {scaleA.muscleMassKg} → {scaleB.muscleMassKg} kg
                    </Text>
                  </View>
                </>
              )}

              <View style={styles.deltaBox}>
                <Text style={styles.deltaBoxLabel}>Cintura</Text>
                <Text style={styles.deltaBoxMain}>
                  {(bodyB.waistCm - bodyA.waistCm > 0 ? '+' : '') +
                    (bodyB.waistCm - bodyA.waistCm).toFixed(1)}{' '}
                  cm
                </Text>
                <Text style={styles.deltaBoxSub}>
                  {bodyA.waistCm} → {bodyB.waistCm} cm
                </Text>
              </View>
            </View>
          </>
        )}
      </View>

      {/* SEÇÃO 2: TABELA COMPLETA DE EVOLUÇÃO (PESO, GORDURA, MÚSCULO, ÁGUA, MEDIDAS) */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Table2 size={20} color="#10B981" />
          <Text style={styles.cardTitle}>Tabela Completa de Evolução</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Deslize horizontalmente para ver todas as colunas (Peso, % Gordura, Músculo, % Água, Gordura Visceral, Cintura, Abdômen, Peitoral, Bíceps e Coxa).
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View>
            {/* Cabeçalho da Tabela */}
            <View style={[styles.tRow, styles.tHeaderRow]}>
              <Text style={[styles.tCell, styles.tColDate, styles.tHeaderText]}>Data</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Peso</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Gordura</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Músculo</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Água</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Visceral</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>TMB</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Cintura</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Abdômen</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Peitoral</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Ombros</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Bíceps</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Coxa</Text>
              <Text style={[styles.tCell, styles.tHeaderText]}>Pantur.</Text>
            </View>

            {/* Linhas da Tabela (Mais recente no topo) */}
            {[...scaleHistory].reverse().map((sItem, idx) => {
              const bItem = findClosestBodyEntry(sItem.timestamp, bodyHistory);
              return (
                <View
                  key={sItem.id}
                  style={[
                    styles.tRow,
                    idx % 2 === 0 ? styles.tRowEven : styles.tRowOdd,
                  ]}
                >
                  <Text style={[styles.tCell, styles.tColDate, { fontWeight: '800', color: '#38BDF8' }]}>
                    {formatDateShort(sItem.timestamp)}
                  </Text>
                  <Text style={[styles.tCell, { fontWeight: '700' }]}>{sItem.weightKg} kg</Text>
                  <Text style={[styles.tCell, { color: '#F43F5E' }]}>{sItem.bodyFatPercent}%</Text>
                  <Text style={[styles.tCell, { color: '#10B981' }]}>{sItem.muscleMassKg} kg</Text>
                  <Text style={[styles.tCell, { color: '#60A5FA' }]}>{sItem.waterPercent}%</Text>
                  <Text style={styles.tCell}>Nv {sItem.visceralFat}</Text>
                  <Text style={styles.tCell}>{sItem.bmrKcal}</Text>
                  <Text style={styles.tCell}>{bItem ? `${bItem.waistCm} cm` : '-'}</Text>
                  <Text style={styles.tCell}>{bItem ? `${bItem.abdomenCm} cm` : '-'}</Text>
                  <Text style={styles.tCell}>{bItem ? `${bItem.chestCm} cm` : '-'}</Text>
                  <Text style={styles.tCell}>{bItem ? `${bItem.shouldersCm} cm` : '-'}</Text>
                  <Text style={styles.tCell}>{bItem ? `${bItem.bicepsCm} cm` : '-'}</Text>
                  <Text style={styles.tCell}>{bItem ? `${bItem.thighCm} cm` : '-'}</Text>
                  <Text style={styles.tCell}>{bItem ? `${bItem.calfCm} cm` : '-'}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingVertical: 12,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 17,
  },
  periodSelectorsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 6,
  },
  periodCol: {
    flex: 1,
  },
  periodLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  periodLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  dateChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginRight: 6,
  },
  dateChipText: {
    color: '#CBD5E1',
    fontSize: 12,
  },
  avatarsSideBySide: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  avatarBox: {
    flex: 1,
    alignItems: 'center',
  },
  avatarFooterStat: {
    color: '#CBD5E1',
    fontSize: 12,
    marginTop: 6,
  },
  partDiffChip: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  partDiffTitle: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
  },
  partDiffVal: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  deltaSummaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 6,
  },
  deltaBox: {
    width: '48%',
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  deltaBoxLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  deltaBoxMain: {
    color: '#F8FAFC',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 2,
  },
  deltaBoxSub: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  tRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingVertical: 10,
  },
  tHeaderRow: {
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  tRowEven: {
    backgroundColor: '#111827',
  },
  tRowOdd: {
    backgroundColor: '#0B1120',
  },
  tCell: {
    width: 78,
    color: '#E2E8F0',
    fontSize: 12,
    textAlign: 'center',
  },
  tColDate: {
    width: 68,
  },
  tHeaderText: {
    color: '#94A3B8',
    fontWeight: '800',
    fontSize: 11,
  },
});
