import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import {
  ArrowRight,
  Calendar,
  Clock,
  Layers,
  Scale,
  Table2,
  Trash2,
} from 'lucide-react-native';
import {
  BioimpedanceMetrics,
  BodyMeasurementsEntry,
  BodyPartKey,
  DayPeriod,
  DayPeriodFilter,
  UserProfile,
} from '../types/health';
import {
  DAY_PERIOD_INFO,
  filterMeasurementsByPeriod,
  resolveMeasurementPeriod,
} from '../utils/bioimpedance';
import { BODY_PARTS_GUIDE, BODY_PART_ORDER } from '../utils/bodyMeasurements';
import { BodyAvatarSvg } from './BodyAvatarSvg';

interface Props {
  scaleHistory: BioimpedanceMetrics[];
  bodyHistory: BodyMeasurementsEntry[];
  profile: UserProfile;
  selectedPeriodFilter: DayPeriodFilter;
  onChangePeriodFilter: (filter: DayPeriodFilter) => void;
  onDeleteMeasurement: (id: string) => void;
  onUpdateMeasurementPeriod: (id: string, nextPeriod: DayPeriod) => void;
}

const PERIOD_FILTERS: Array<{
  key: DayPeriodFilter;
  label: string;
  icon: string;
  color: string;
}> = [
  { key: 'all', label: 'Todos', icon: '🕒', color: '#38BDF8' },
  { key: 'morning', label: 'Manhã', icon: '☀️', color: '#F59E0B' },
  { key: 'afternoon', label: 'Tarde', icon: '🌤️', color: '#38BDF8' },
  { key: 'night', label: 'Noite', icon: '🌙', color: '#A855F7' },
];

const NEXT_PERIOD_ORDER: Record<DayPeriod, DayPeriod> = {
  morning: 'afternoon',
  afternoon: 'night',
  night: 'morning',
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
}

function formatTimeShort(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(
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

function computePeriodStats(items: BioimpedanceMetrics[]) {
  if (items.length === 0) return null;
  const weights = items.map((i) => i.weightKg);
  const sum = weights.reduce((a, b) => a + b, 0);
  const avg = Math.round((sum / weights.length) * 10) / 10;
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const first = items[0];
  const last = items[items.length - 1];
  const delta = Math.round((last.weightKg - first.weightKg) * 10) / 10;
  return { count: items.length, avg, min, max, delta, lastWeight: last.weightKg };
}

export const EvolutionAndCompareView: React.FC<Props> = ({
  scaleHistory,
  bodyHistory,
  selectedPeriodFilter,
  onChangePeriodFilter,
  onDeleteMeasurement,
  onUpdateMeasurementPeriod,
}) => {
  const [periodAIdx, setPeriodAIdx] = useState<number>(0);
  const [periodBIdx, setPeriodBIdx] = useState<number>(
    Math.max(0, bodyHistory.length - 1)
  );
  const [scaleAIdx, setScaleAIdx] = useState<number>(0);
  const [scaleBIdx, setScaleBIdx] = useState<number>(
    Math.max(0, scaleHistory.length - 1)
  );
  const [highlightPart, setHighlightPart] = useState<BodyPartKey>('waistCm');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const filteredScaleHistory = filterMeasurementsByPeriod(
    scaleHistory,
    selectedPeriodFilter
  );

  // Índices seguros para comparação de pesagens do turno selecionado
  const safeScaleAIdx = Math.min(
    scaleAIdx,
    Math.max(0, filteredScaleHistory.length - 1)
  );
  const safeScaleBIdx = Math.min(
    scaleBIdx >= filteredScaleHistory.length
      ? Math.max(0, filteredScaleHistory.length - 1)
      : scaleBIdx,
    Math.max(0, filteredScaleHistory.length - 1)
  );
  const directScaleA = filteredScaleHistory[safeScaleAIdx] || null;
  const directScaleB = filteredScaleHistory[safeScaleBIdx] || null;

  // Índices seguros para comparação de avatares
  const safeIdxA = Math.min(periodAIdx, Math.max(0, bodyHistory.length - 1));
  const safeIdxB = Math.min(periodBIdx, Math.max(0, bodyHistory.length - 1));

  const bodyA = bodyHistory[safeIdxA];
  const bodyB = bodyHistory[safeIdxB];

  const effectiveScaleForAvatars =
    filteredScaleHistory.length > 0 ? filteredScaleHistory : scaleHistory;
  const scaleA = bodyA
    ? findClosestScaleEntry(bodyA.timestamp, effectiveScaleForAvatars)
    : null;
  const scaleB = bodyB
    ? findClosestScaleEntry(bodyB.timestamp, effectiveScaleForAvatars)
    : null;

  const morningStats = computePeriodStats(
    filterMeasurementsByPeriod(scaleHistory, 'morning')
  );
  const afternoonStats = computePeriodStats(
    filterMeasurementsByPeriod(scaleHistory, 'afternoon')
  );
  const nightStats = computePeriodStats(
    filterMeasurementsByPeriod(scaleHistory, 'night')
  );

  const handleSelectPeriodFilter = (nextFilter: DayPeriodFilter) => {
    onChangePeriodFilter(nextFilter);
    const nextList = filterMeasurementsByPeriod(scaleHistory, nextFilter);
    setScaleAIdx(0);
    setScaleBIdx(Math.max(0, nextList.length - 1));
  };

  const handleConfirmDelete = (item: BioimpedanceMetrics) => {
    const pInfo = DAY_PERIOD_INFO[resolveMeasurementPeriod(item)];
    if (Platform.OS === 'web') {
      if (pendingDeleteId === item.id) {
        onDeleteMeasurement(item.id);
        setPendingDeleteId(null);
      } else {
        setPendingDeleteId(item.id);
      }
      return;
    }

    Alert.alert(
      'Excluir Registro de Peso',
      `Deseja remover a pesagem de ${item.weightKg} kg (${formatDateShort(
        item.timestamp
      )} • ${pInfo.icon} ${pInfo.label}) para que ela não afete suas estatísticas?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir Registro',
          style: 'destructive',
          onPress: () => onDeleteMeasurement(item.id),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* SEÇÃO 0: FILTRO DE TURNO (MANHÃ, TARDE, NOITE) & ESTATÍSTICAS POR HORÁRIO */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Clock size={20} color="#F59E0B" />
          <Text style={styles.cardTitle}>Separador por Turno (Manhã, Tarde e Noite)</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          O peso corporal varia ao longo do dia. Filtre por turno para comparar apenas pesagens do mesmo horário e evitar distorções nas estatísticas.
        </Text>

        {/* Chips de Filtro de Turno */}
        <View style={styles.periodFilterRow}>
          {PERIOD_FILTERS.map((pf) => {
            const active = selectedPeriodFilter === pf.key;
            const count =
              pf.key === 'all'
                ? scaleHistory.length
                : filterMeasurementsByPeriod(scaleHistory, pf.key).length;
            return (
              <TouchableOpacity
                key={pf.key}
                onPress={() => handleSelectPeriodFilter(pf.key)}
                style={[
                  styles.periodFilterChip,
                  active && {
                    backgroundColor: pf.color + '25',
                    borderColor: pf.color,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.periodFilterChipText,
                    active && { color: pf.color, fontWeight: '800' },
                  ]}
                >
                  {pf.icon} {pf.label} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Resumo Comparativo das Médias de Manhã vs Tarde vs Noite */}
        <View style={styles.shiftSummaryRow}>
          {(
            [
              { key: 'morning', stats: morningStats },
              { key: 'afternoon', stats: afternoonStats },
              { key: 'night', stats: nightStats },
            ] as Array<{
              key: DayPeriod;
              stats: ReturnType<typeof computePeriodStats>;
            }>
          ).map(({ key, stats }) => {
            const info = DAY_PERIOD_INFO[key];
            const isSelected = selectedPeriodFilter === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() =>
                  handleSelectPeriodFilter(isSelected ? 'all' : key)
                }
                style={[
                  styles.shiftStatCard,
                  isSelected && {
                    borderColor: info.color,
                    backgroundColor: info.color + '15',
                  },
                ]}
              >
                <Text style={[styles.shiftStatTitle, { color: info.color }]}>
                  {info.icon} {info.label}
                </Text>
                {stats ? (
                  <>
                    <Text style={styles.shiftStatMain}>{stats.avg} kg</Text>
                    <Text style={styles.shiftStatSub}>
                      Média ({stats.count}x)
                    </Text>
                    <Text
                      style={[
                        styles.shiftStatDelta,
                        { color: stats.delta <= 0 ? '#34D399' : '#FCA5A5' },
                      ]}
                    >
                      {stats.delta > 0 ? `+${stats.delta}` : stats.delta} kg
                    </Text>
                  </>
                ) : (
                  <Text style={styles.shiftStatEmpty}>Sem registros</Text>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* SEÇÃO 1: COMPARADOR DIRETO DE PESO POR TURNO (PESAGEM A vs PESAGEM B) */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Scale size={20} color="#38BDF8" />
          <Text style={styles.cardTitle}>
            Comparação de Peso (
            {selectedPeriodFilter === 'all'
              ? 'Todos os Horários'
              : `${DAY_PERIOD_INFO[selectedPeriodFilter].icon} Só ${DAY_PERIOD_INFO[selectedPeriodFilter].label}`}
            )
          </Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Compare duas pesagens diretamente dentro do turno selecionado acima.
        </Text>

        {filteredScaleHistory.length === 0 ? (
          <Text style={styles.emptyFilterText}>
            Nenhuma pesagem registrada neste turno ainda. Escolha outro turno acima ou registre uma nova pesagem na aba Balança.
          </Text>
        ) : (
          <>
            <View style={styles.periodSelectorsWrap}>
              <View style={styles.periodCol}>
                <View style={styles.periodLabelRow}>
                  <Calendar size={13} color="#F59E0B" />
                  <Text style={[styles.periodLabel, { color: '#F59E0B' }]}>
                    PESAGEM A (ANTES)
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {filteredScaleHistory.map((entry, idx) => {
                    const active = idx === safeScaleAIdx;
                    const pInfo = DAY_PERIOD_INFO[resolveMeasurementPeriod(entry)];
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        onPress={() => setScaleAIdx(idx)}
                        style={[
                          styles.dateChip,
                          active && {
                            backgroundColor: '#F59E0B25',
                            borderColor: '#F59E0B',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateChipText,
                            active && { color: '#F59E0B', fontWeight: '800' },
                          ]}
                        >
                          {pInfo.icon} {formatDateShort(entry.timestamp)} ({entry.weightKg}kg)
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
                    PESAGEM B (DEPOIS)
                  </Text>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {filteredScaleHistory.map((entry, idx) => {
                    const active = idx === safeScaleBIdx;
                    const pInfo = DAY_PERIOD_INFO[resolveMeasurementPeriod(entry)];
                    return (
                      <TouchableOpacity
                        key={entry.id}
                        onPress={() => setScaleBIdx(idx)}
                        style={[
                          styles.dateChip,
                          active && {
                            backgroundColor: '#10B98125',
                            borderColor: '#10B981',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateChipText,
                            active && { color: '#10B981', fontWeight: '800' },
                          ]}
                        >
                          {pInfo.icon} {formatDateShort(entry.timestamp)} ({entry.weightKg}kg)
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {directScaleA && directScaleB && (
              <View style={styles.deltaSummaryGrid}>
                <View style={styles.deltaBox}>
                  <Text style={styles.deltaBoxLabel}>Diferença de Peso</Text>
                  <Text
                    style={[
                      styles.deltaBoxMain,
                      {
                        color:
                          directScaleB.weightKg - directScaleA.weightKg <= 0
                            ? '#34D399'
                            : '#FCA5A5',
                      },
                    ]}
                  >
                    {(directScaleB.weightKg - directScaleA.weightKg > 0 ? '+' : '') +
                      (directScaleB.weightKg - directScaleA.weightKg).toFixed(1)}{' '}
                    kg
                  </Text>
                  <Text style={styles.deltaBoxSub}>
                    {directScaleA.weightKg} kg → {directScaleB.weightKg} kg
                  </Text>
                </View>

                <View style={styles.deltaBox}>
                  <Text style={styles.deltaBoxLabel}>Gordura (BIA)</Text>
                  <Text
                    style={[
                      styles.deltaBoxMain,
                      {
                        color:
                          directScaleB.bodyFatPercent - directScaleA.bodyFatPercent <= 0
                            ? '#34D399'
                            : '#FCA5A5',
                      },
                    ]}
                  >
                    {(directScaleB.bodyFatPercent - directScaleA.bodyFatPercent > 0
                      ? '+'
                      : '') +
                      (
                        directScaleB.bodyFatPercent - directScaleA.bodyFatPercent
                      ).toFixed(1)}
                    %
                  </Text>
                  <Text style={styles.deltaBoxSub}>
                    {directScaleA.bodyFatPercent}% → {directScaleB.bodyFatPercent}%
                  </Text>
                </View>

                <View style={styles.deltaBox}>
                  <Text style={styles.deltaBoxLabel}>Massa Muscular</Text>
                  <Text
                    style={[
                      styles.deltaBoxMain,
                      {
                        color:
                          directScaleB.muscleMassKg - directScaleA.muscleMassKg >= 0
                            ? '#34D399'
                            : '#FCA5A5',
                      },
                    ]}
                  >
                    {(directScaleB.muscleMassKg - directScaleA.muscleMassKg > 0
                      ? '+'
                      : '') +
                      (directScaleB.muscleMassKg - directScaleA.muscleMassKg).toFixed(
                        1
                      )}{' '}
                    kg
                  </Text>
                  <Text style={styles.deltaBoxSub}>
                    {directScaleA.muscleMassKg} kg → {directScaleB.muscleMassKg} kg
                  </Text>
                </View>

                <View style={styles.deltaBox}>
                  <Text style={styles.deltaBoxLabel}>Água Corporal</Text>
                  <Text style={styles.deltaBoxMain}>
                    {(directScaleB.waterPercent - directScaleA.waterPercent > 0
                      ? '+'
                      : '') +
                      (directScaleB.waterPercent - directScaleA.waterPercent).toFixed(1)}
                    %
                  </Text>
                  <Text style={styles.deltaBoxSub}>
                    {directScaleA.waterPercent}% → {directScaleB.waterPercent}%
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </View>

      {/* SEÇÃO 2: COMPARADOR DE DOIS PERÍODOS (AVATAR A vs AVATAR B) */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Layers size={20} color="#38BDF8" />
          <Text style={styles.cardTitle}>Comparador de Períodos & Avatares</Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Selecione duas datas abaixo para comparar visualmente a mudança na silhueta do seu Avatar e medidas de fita métrica.
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
          </>
        )}
      </View>

      {/* SEÇÃO 3: TABELA COMPLETA DE EVOLUÇÃO + EXCLUSÃO DE REGISTROS ERRADOS */}
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Table2 size={20} color="#10B981" />
          <Text style={styles.cardTitle}>
            Histórico de Pesagens & Exclusão ({filteredScaleHistory.length})
          </Text>
        </View>
        <Text style={styles.cardSubtitle}>
          Toque no turno (☀️/🌤️/🌙) para alterar entre Manhã, Tarde e Noite, ou toque na lixeira (🗑️) para excluir algum registro de peso errado e recalcular as estatísticas.
        </Text>

        {filteredScaleHistory.length === 0 ? (
          <Text style={styles.emptyFilterText}>
            Nenhum registro encontrado para este filtro de turno.
          </Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={true}>
            <View>
              {/* Cabeçalho da Tabela */}
              <View style={[styles.tRow, styles.tHeaderRow]}>
                <Text style={[styles.tCell, styles.tColAction, styles.tHeaderText]}>
                  Excluir
                </Text>
                <Text style={[styles.tCell, styles.tColDate, styles.tHeaderText]}>
                  Data/Hora
                </Text>
                <Text style={[styles.tCell, styles.tColPeriod, styles.tHeaderText]}>
                  Turno
                </Text>
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
              {[...filteredScaleHistory].reverse().map((sItem, idx) => {
                const bItem = findClosestBodyEntry(sItem.timestamp, bodyHistory);
                const curPeriod = resolveMeasurementPeriod(sItem);
                const pInfo = DAY_PERIOD_INFO[curPeriod];
                const isConfirmingWeb = pendingDeleteId === sItem.id;

                return (
                  <View
                    key={sItem.id}
                    style={[
                      styles.tRow,
                      idx % 2 === 0 ? styles.tRowEven : styles.tRowOdd,
                    ]}
                  >
                    <View style={[styles.tCell, styles.tColAction, styles.actionCellWrap]}>
                      <TouchableOpacity
                        style={[
                          styles.deleteRowBtn,
                          isConfirmingWeb && styles.deleteRowBtnConfirm,
                        ]}
                        onPress={() => handleConfirmDelete(sItem)}
                      >
                        <Trash2 size={14} color="#FCA5A5" />
                        {isConfirmingWeb && (
                          <Text style={styles.confirmDeleteText}>Confirmar</Text>
                        )}
                      </TouchableOpacity>
                    </View>

                    <View style={[styles.tCell, styles.tColDate, { alignItems: 'center' }]}>
                      <Text style={{ fontWeight: '800', color: '#38BDF8', fontSize: 12 }}>
                        {formatDateShort(sItem.timestamp)}
                      </Text>
                      <Text style={{ color: '#64748B', fontSize: 10 }}>
                        {formatTimeShort(sItem.timestamp)}
                      </Text>
                    </View>

                    <View style={[styles.tCell, styles.tColPeriod, { alignItems: 'center' }]}>
                      <TouchableOpacity
                        style={[
                          styles.periodBadgeBtn,
                          {
                            borderColor: pInfo.color,
                            backgroundColor: pInfo.color + '20',
                          },
                        ]}
                        onPress={() =>
                          onUpdateMeasurementPeriod(
                            sItem.id,
                            NEXT_PERIOD_ORDER[curPeriod]
                          )
                        }
                      >
                        <Text style={[styles.periodBadgeText, { color: pInfo.color }]}>
                          {pInfo.icon} {pInfo.shortLabel}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={[styles.tCell, { fontWeight: '700' }]}>
                      {sItem.weightKg} kg
                    </Text>
                    <Text style={[styles.tCell, { color: '#F43F5E' }]}>
                      {sItem.bodyFatPercent}%
                    </Text>
                    <Text style={[styles.tCell, { color: '#10B981' }]}>
                      {sItem.muscleMassKg} kg
                    </Text>
                    <Text style={[styles.tCell, { color: '#60A5FA' }]}>
                      {sItem.waterPercent}%
                    </Text>
                    <Text style={styles.tCell}>Nv {sItem.visceralFat}</Text>
                    <Text style={styles.tCell}>{sItem.bmrKcal}</Text>
                    <Text style={styles.tCell}>{bItem ? `${bItem.waistCm} cm` : '-'}</Text>
                    <Text style={styles.tCell}>
                      {bItem ? `${bItem.abdomenCm} cm` : '-'}
                    </Text>
                    <Text style={styles.tCell}>{bItem ? `${bItem.chestCm} cm` : '-'}</Text>
                    <Text style={styles.tCell}>
                      {bItem ? `${bItem.shouldersCm} cm` : '-'}
                    </Text>
                    <Text style={styles.tCell}>
                      {bItem ? `${bItem.bicepsCm} cm` : '-'}
                    </Text>
                    <Text style={styles.tCell}>{bItem ? `${bItem.thighCm} cm` : '-'}</Text>
                    <Text style={styles.tCell}>{bItem ? `${bItem.calfCm} cm` : '-'}</Text>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
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
    flexShrink: 1,
  },
  cardSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
    lineHeight: 17,
  },
  periodFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  periodFilterChip: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  periodFilterChipText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  shiftSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  shiftStatCard: {
    flex: 1,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1E293B',
    alignItems: 'center',
  },
  shiftStatTitle: {
    fontSize: 12,
    fontWeight: '800',
  },
  shiftStatMain: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 4,
  },
  shiftStatSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 1,
  },
  shiftStatDelta: {
    fontSize: 11,
    fontWeight: '700',
    marginTop: 3,
  },
  shiftStatEmpty: {
    color: '#475569',
    fontSize: 11,
    marginTop: 10,
  },
  emptyFilterText: {
    color: '#94A3B8',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 14,
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
  tColAction: {
    width: 68,
  },
  tColDate: {
    width: 76,
  },
  tColPeriod: {
    width: 92,
  },
  actionCellWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#7F1D1D60',
    borderWidth: 1,
    borderColor: '#EF444480',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  deleteRowBtnConfirm: {
    backgroundColor: '#DC2626',
    borderColor: '#FCA5A5',
  },
  confirmDeleteText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '800',
  },
  periodBadgeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  periodBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  tHeaderText: {
    color: '#94A3B8',
    fontWeight: '800',
    fontSize: 11,
  },
});
