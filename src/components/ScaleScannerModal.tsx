import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { DayPeriod } from '../types/health';
import { obsidianTheme } from '../theme/obsidianTheme';

export interface ScaleScannerModalProps {
  visible: boolean;
  onClose: () => void;
  isScanning: boolean;
  liveWeight: number | null;
  liveImpedance: number | null;
  bleStatusMsg: string;
  rawLogs: string[];
  scannerPeriodChoice: 'auto' | DayPeriod;
  onChangePeriodChoice: (choice: 'auto' | DayPeriod) => void;
  onToggleBleScan: () => void;
  onSimulateScaleReading: () => void;
  onAddManualWeight: (weightKg: number, impedanceOhms: number) => void;
}

const PERIOD_OPTIONS: { key: 'auto' | DayPeriod; label: string }[] = [
  { key: 'auto', label: 'Automático (Hora Atual)' },
  { key: 'morning', label: '🌅 Manhã' },
  { key: 'afternoon', label: '☀️ Tarde' },
  { key: 'night', label: '🌙 Noite' },
];

export const ScaleScannerModal: React.FC<ScaleScannerModalProps> = ({
  visible,
  onClose,
  isScanning,
  liveWeight,
  liveImpedance,
  bleStatusMsg,
  rawLogs,
  scannerPeriodChoice,
  onChangePeriodChoice,
  onToggleBleScan,
  onSimulateScaleReading,
  onAddManualWeight,
}) => {
  const [showManualAccordion, setShowManualAccordion] = useState(false);
  const [showBleLogsAccordion, setShowBleLogsAccordion] = useState(false);
  const [manualWeightInput, setManualWeightInput] = useState('');
  const [manualImpedanceInput, setManualImpedanceInput] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const handleManualSubmit = () => {
    const parsedWeight = parseFloat(manualWeightInput.replace(',', '.'));
    if (isNaN(parsedWeight) || parsedWeight < 20 || parsedWeight > 300) {
      setManualError('Informe um peso válido entre 20 e 300 kg.');
      return;
    }
    const parsedImpedance = parseInt(manualImpedanceInput.trim(), 10);
    const impedanceOhms =
      !isNaN(parsedImpedance) && parsedImpedance > 50 ? parsedImpedance : 480;

    setManualError(null);
    onAddManualWeight(parsedWeight, impedanceOhms);
    setManualWeightInput('');
    setManualImpedanceInput('');
    setShowManualAccordion(false);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableOpacity
          style={styles.backdropDismissArea}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={styles.sheetContainer}>
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.headerTitleGroup}>
              <Text style={styles.headerTitle}>Pesagem Biométrica</Text>
              <View
                style={[
                  styles.statusPill,
                  isScanning ? styles.statusPillScanning : styles.statusPillReady,
                ]}
              >
                <View
                  style={[
                    styles.statusDot,
                    {
                      backgroundColor: isScanning
                        ? obsidianTheme.statusAttention
                        : obsidianTheme.accent,
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.statusPillText,
                    {
                      color: isScanning
                        ? obsidianTheme.statusAttention
                        : obsidianTheme.accent,
                    },
                  ]}
                >
                  {isScanning ? 'Conectando...' : 'Pronto'}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.75}
              accessibilityLabel="Fechar modal de pesagem"
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Shift Selector (Turno da Pesagem) */}
            <View style={styles.sectionBlock}>
              <Text style={styles.sectionLabel}>TURNO DA PESAGEM</Text>
              <View style={styles.periodPillsRow}>
                {PERIOD_OPTIONS.map((opt) => {
                  const active = scannerPeriodChoice === opt.key;
                  return (
                    <TouchableOpacity
                      key={opt.key}
                      onPress={() => onChangePeriodChoice(opt.key)}
                      activeOpacity={0.75}
                      style={[
                        styles.periodPill,
                        active && styles.periodPillActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.periodPillText,
                          active && styles.periodPillTextActive,
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Minimalist Digital Scale Display */}
            <View
              style={[
                styles.digitalDisplayCard,
                isScanning && styles.digitalDisplayCardScanning,
              ]}
            >
              <View style={styles.weightReadoutRow}>
                <Text style={styles.digitalWeightValue}>
                  {liveWeight !== null ? liveWeight.toFixed(2) : '00.00'}
                </Text>
                <Text style={styles.digitalWeightUnit}>kg</Text>
              </View>

              <View
                style={[
                  styles.impedanceBadge,
                  liveImpedance !== null && styles.impedanceBadgeCaptured,
                ]}
              >
                <Text
                  style={[
                    styles.impedanceReadoutText,
                    liveImpedance !== null && styles.impedanceReadoutTextCaptured,
                  ]}
                >
                  {liveImpedance !== null
                    ? `${liveImpedance} Ω (Bioimpedância capturada)`
                    : 'Suba descalço nos eletrodos metálicos'}
                </Text>
              </View>

              <Text style={styles.bleStatusSubtleText} numberOfLines={2}>
                {bleStatusMsg}
              </Text>
            </View>

            {/* Primary Actions */}
            <View style={styles.actionsBlock}>
              <TouchableOpacity
                onPress={onToggleBleScan}
                activeOpacity={0.85}
                style={[
                  styles.primaryButton,
                  isScanning && styles.primaryButtonStop,
                ]}
              >
                <Text
                  style={[
                    styles.primaryButtonText,
                    isScanning && styles.primaryButtonTextStop,
                  ]}
                >
                  {isScanning
                    ? 'Parar Escaneamento'
                    : 'Iniciar Leitura Bluetooth (Balança Wellmix)'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={onSimulateScaleReading}
                activeOpacity={0.75}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonText}>
                  Simular Pesagem Completa
                </Text>
              </TouchableOpacity>
            </View>

            {/* Progressive Disclosure Accordions */}
            <View style={styles.accordionsContainer}>
              {/* 1. Inserir Peso Manualmente */}
              <View style={styles.accordionCard}>
                <TouchableOpacity
                  onPress={() => setShowManualAccordion((prev) => !prev)}
                  activeOpacity={0.75}
                  style={styles.accordionHeader}
                >
                  <Text style={styles.accordionTitle}>
                    Inserir Peso Manualmente
                  </Text>
                  <Text style={styles.accordionChevron}>
                    {showManualAccordion ? '−' : '+'}
                  </Text>
                </TouchableOpacity>

                {showManualAccordion && (
                  <View style={styles.accordionBody}>
                    <View style={styles.manualInputsRow}>
                      <View style={styles.inputFieldWrapper}>
                        <Text style={styles.inputLabel}>Peso (kg)</Text>
                        <TextInput
                          value={manualWeightInput}
                          onChangeText={(txt) => {
                            setManualWeightInput(txt);
                            if (manualError) setManualError(null);
                          }}
                          placeholder="Ex: 78.4"
                          placeholderTextColor={obsidianTheme.textMuted}
                          keyboardType="decimal-pad"
                          style={styles.textInput}
                        />
                      </View>

                      <View style={styles.inputFieldWrapper}>
                        <Text style={styles.inputLabel}>
                          Impedância opcional (Ω)
                        </Text>
                        <TextInput
                          value={manualImpedanceInput}
                          onChangeText={setManualImpedanceInput}
                          placeholder="Ex: 485"
                          placeholderTextColor={obsidianTheme.textMuted}
                          keyboardType="number-pad"
                          style={styles.textInput}
                        />
                      </View>
                    </View>

                    {manualError && (
                      <Text style={styles.errorText}>{manualError}</Text>
                    )}

                    <TouchableOpacity
                      onPress={handleManualSubmit}
                      activeOpacity={0.8}
                      style={styles.manualSubmitButton}
                    >
                      <Text style={styles.manualSubmitButtonText}>
                        Registrar
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* 2. Diagnóstico Técnico BLE (Pacotes Hex) */}
              <View style={styles.accordionCard}>
                <TouchableOpacity
                  onPress={() => setShowBleLogsAccordion((prev) => !prev)}
                  activeOpacity={0.75}
                  style={styles.accordionHeader}
                >
                  <View style={styles.bleAccordionHeaderRow}>
                    <Text style={styles.accordionTitle}>
                      Diagnóstico Técnico BLE (Pacotes Hex)
                    </Text>
                    {rawLogs.length > 0 && (
                      <View style={styles.logCountBadge}>
                        <Text style={styles.logCountText}>{rawLogs.length}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.accordionChevron}>
                    {showBleLogsAccordion ? '−' : '+'}
                  </Text>
                </TouchableOpacity>

                {showBleLogsAccordion && (
                  <View style={styles.accordionBody}>
                    {rawLogs.length === 0 ? (
                      <Text style={styles.emptyLogsText}>
                        Nenhum pacote BLE 0xCA interceptado ainda. Inicie a leitura e suba na balança.
                      </Text>
                    ) : (
                      <View style={styles.logsTerminalBox}>
                        {rawLogs.slice(0, 12).map((logLine, idx) => (
                          <Text key={idx} style={styles.logLineText}>
                            {logLine}
                          </Text>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(9, 10, 15, 0.82)',
    justifyContent: 'flex-end',
  },
  backdropDismissArea: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: obsidianTheme.bg,
    borderTopLeftRadius: obsidianTheme.radiusXl,
    borderTopRightRadius: obsidianTheme.radiusXl,
    borderTopWidth: 1,
    borderColor: obsidianTheme.border,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    maxHeight: '90%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: obsidianTheme.borderHighlight,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  headerTitleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    flex: 1,
  },
  headerTitle: {
    color: obsidianTheme.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  statusPillReady: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accentBorder,
  },
  statusPillScanning: {
    backgroundColor: obsidianTheme.statusAttentionBg,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: obsidianTheme.surface,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: obsidianTheme.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  scrollContent: {
    gap: 16,
    paddingBottom: 8,
  },
  sectionBlock: {
    gap: 8,
  },
  sectionLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  periodPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  periodPill: {
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: obsidianTheme.radiusSm,
    backgroundColor: obsidianTheme.surface,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  periodPillActive: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accent,
  },
  periodPillText: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  periodPillTextActive: {
    color: obsidianTheme.accent,
    fontWeight: '700',
  },
  digitalDisplayCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusLg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: 'center',
    gap: 10,
  },
  digitalDisplayCardScanning: {
    borderColor: obsidianTheme.accentBorder,
  },
  weightReadoutRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  digitalWeightValue: {
    color: obsidianTheme.textPrimary,
    fontSize: 52,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1.5,
  },
  digitalWeightUnit: {
    color: obsidianTheme.accent,
    fontSize: 20,
    fontWeight: '700',
  },
  impedanceBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: obsidianTheme.surfaceElevated,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
  },
  impedanceBadgeCaptured: {
    backgroundColor: obsidianTheme.accentSoft,
    borderColor: obsidianTheme.accentBorder,
  },
  impedanceReadoutText: {
    color: obsidianTheme.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  impedanceReadoutTextCaptured: {
    color: obsidianTheme.accent,
  },
  bleStatusSubtleText: {
    color: obsidianTheme.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  actionsBlock: {
    gap: 10,
  },
  primaryButton: {
    backgroundColor: obsidianTheme.accent,
    borderRadius: obsidianTheme.radiusMd,
    paddingVertical: 15,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonStop: {
    backgroundColor: obsidianTheme.statusAlertBg,
    borderWidth: 1,
    borderColor: obsidianTheme.statusAlert,
  },
  primaryButtonText: {
    color: obsidianTheme.bg,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.1,
  },
  primaryButtonTextStop: {
    color: obsidianTheme.statusAlert,
  },
  secondaryButton: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: obsidianTheme.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  accordionsContainer: {
    gap: 8,
    marginTop: 4,
  },
  accordionCard: {
    backgroundColor: obsidianTheme.surface,
    borderRadius: obsidianTheme.radiusMd,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    overflow: 'hidden',
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  bleAccordionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  accordionTitle: {
    color: obsidianTheme.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  accordionChevron: {
    color: obsidianTheme.textMuted,
    fontSize: 16,
    fontWeight: '700',
  },
  logCountBadge: {
    backgroundColor: obsidianTheme.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: obsidianTheme.borderHighlight,
  },
  logCountText: {
    color: obsidianTheme.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  accordionBody: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: obsidianTheme.border,
    gap: 10,
  },
  manualInputsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  inputFieldWrapper: {
    flex: 1,
    gap: 5,
  },
  inputLabel: {
    color: obsidianTheme.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  textInput: {
    backgroundColor: obsidianTheme.bg,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    borderRadius: obsidianTheme.radiusSm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: obsidianTheme.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: obsidianTheme.statusAlert,
    fontSize: 11,
    fontWeight: '600',
  },
  manualSubmitButton: {
    backgroundColor: obsidianTheme.surfaceHighlight,
    borderWidth: 1,
    borderColor: obsidianTheme.accentBorder,
    borderRadius: obsidianTheme.radiusSm,
    paddingVertical: 11,
    alignItems: 'center',
  },
  manualSubmitButtonText: {
    color: obsidianTheme.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyLogsText: {
    color: obsidianTheme.textMuted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  logsTerminalBox: {
    backgroundColor: obsidianTheme.bg,
    borderRadius: obsidianTheme.radiusSm,
    borderWidth: 1,
    borderColor: obsidianTheme.border,
    padding: 10,
    gap: 4,
    marginTop: 4,
  },
  logLineText: {
    color: obsidianTheme.textSecondary,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
