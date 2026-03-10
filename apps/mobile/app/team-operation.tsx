import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  StyleSheet,
  Alert,
  AccessibilityInfo,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ClipboardList, Check, WifiOff } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useFarmContext } from '@/hooks/useFarmContext';
import { useConnectivity } from '@/hooks/useConnectivity';
import {
  createFieldTeamRepository,
  createFieldPlotRepository,
  createTeamOperationsRepository,
} from '@/services/db';
import { createOfflineQueue } from '@/services/offline-queue';
import type { OfflineFieldTeam, OfflineFieldTeamMember, FieldOperationType } from '@/types/offline';

const OPERATION_TYPES: Array<{ value: FieldOperationType; label: string }> = [
  { value: 'PULVERIZACAO', label: 'Pulverização' },
  { value: 'ADUBACAO', label: 'Adubação' },
  { value: 'PLANTIO', label: 'Plantio' },
  { value: 'COLHEITA', label: 'Colheita' },
  { value: 'IRRIGACAO', label: 'Irrigação' },
  { value: 'MANEJO_PASTO', label: 'Manejo de pasto' },
  { value: 'VACINACAO', label: 'Vacinação' },
  { value: 'VERMIFUGACAO', label: 'Vermifugação' },
  { value: 'INSEMINACAO', label: 'Inseminação' },
  { value: 'MOVIMENTACAO', label: 'Movimentação' },
  { value: 'PESAGEM', label: 'Pesagem' },
  { value: 'OUTRO', label: 'Outro' },
];

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 10)}`;
}

interface PlotOption {
  id: string;
  name: string;
}

export default function TeamOperationScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { selectedFarmId } = useFarmContext();
  const { isConnected } = useConnectivity();

  const teamRepo = useMemo(() => createFieldTeamRepository(db), [db]);
  const plotRepo = useMemo(() => createFieldPlotRepository(db), [db]);
  const toRepo = useMemo(() => createTeamOperationsRepository(db), [db]);
  const queue = useMemo(() => createOfflineQueue(db), [db]);

  // Data
  const [teams, setTeams] = useState<OfflineFieldTeam[]>([]);
  const [plots, setPlots] = useState<PlotOption[]>([]);
  const [members, setMembers] = useState<OfflineFieldTeamMember[]>([]);

  // Form
  const [operationType, setOperationType] = useState<FieldOperationType | ''>('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedPlotId, setSelectedPlotId] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [timeStart, setTimeStart] = useState('07:00');
  const [timeEnd, setTimeEnd] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Load teams and plots
  useEffect(() => {
    if (!selectedFarmId) return;
    void (async () => {
      const t = await teamRepo.getByFarmId(selectedFarmId);
      setTeams(t);
      const p = await plotRepo.getByFarmId(selectedFarmId);
      setPlots(p.map((pp: { id: string; name: string }) => ({ id: pp.id, name: pp.name })));
    })();
  }, [selectedFarmId, teamRepo, plotRepo]);

  // Load members when team changes
  useEffect(() => {
    if (!selectedTeamId) {
      setMembers([]);
      setSelectedMemberIds([]);
      return;
    }
    void (async () => {
      const m = await teamRepo.getActiveMembers(selectedTeamId);
      setMembers(m);
      setSelectedMemberIds(m.map((mm) => mm.user_id));
    })();
  }, [selectedTeamId, teamRepo]);

  const toggleMember = useCallback((userId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }, []);

  const selectedTeam = teams.find((t) => t.id === selectedTeamId);
  const selectedPlot = plots.find((p) => p.id === selectedPlotId);

  const canSave =
    operationType !== '' &&
    selectedTeamId !== '' &&
    selectedPlotId !== '' &&
    selectedMemberIds.length > 0 &&
    timeStart !== '' &&
    timeEnd !== '';

  const handleSave = useCallback(async () => {
    if (!canSave || !selectedFarmId || !selectedTeam || !selectedPlot) return;
    setIsSaving(true);

    try {
      const id = generateId();
      const now = new Date().toISOString();
      const today = now.split('T')[0];

      // Save locally
      await toRepo.create({
        id,
        farm_id: selectedFarmId,
        field_plot_id: selectedPlotId,
        field_plot_name: selectedPlot.name,
        team_id: selectedTeamId,
        team_name: selectedTeam.name,
        operation_type: operationType as FieldOperationType,
        performed_at: now,
        time_start: `${today}T${timeStart}:00`,
        time_end: `${today}T${timeEnd}:00`,
        member_ids: JSON.stringify(selectedMemberIds),
        entry_data: null,
        notes: notes.trim() || null,
        synced: 0,
        created_at: now,
        updated_at: now,
      });

      // Build server payload
      const payload = {
        fieldPlotId: selectedPlotId,
        teamId: selectedTeamId,
        operationType,
        performedAt: today,
        timeStart: `${today}T${timeStart}:00`,
        timeEnd: `${today}T${timeEnd}:00`,
        memberIds: selectedMemberIds,
        notes: notes.trim() || null,
      };

      const endpoint = `/org/farms/${selectedFarmId}/team-operations`;
      await queue.enqueue('field_operations', id, 'CREATE', payload, endpoint, 'POST');

      if (isConnected) {
        const result = await queue.flush();
        if (result.processed > 0) {
          await toRepo.markSynced(id);
        }
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      AccessibilityInfo.announceForAccessibility('Operação registrada com sucesso');

      Alert.alert('Operação registrada', 'A operação em bloco foi salva com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      Alert.alert('Erro', msg);
    } finally {
      setIsSaving(false);
    }
  }, [
    canSave,
    selectedFarmId,
    selectedTeam,
    selectedPlot,
    selectedPlotId,
    selectedTeamId,
    operationType,
    timeStart,
    timeEnd,
    selectedMemberIds,
    notes,
    toRepo,
    queue,
    isConnected,
    router,
  ]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityLabel="Voltar"
            accessibilityRole="button"
          >
            <ChevronLeft size={24} color="#3E3833" />
          </Pressable>
          <Text style={styles.headerTitle}>Operação em bloco</Text>
        </View>

        {!isConnected && (
          <View style={styles.offlineBanner} accessibilityRole="alert">
            <WifiOff size={16} color="#fff" />
            <Text style={styles.offlineText}>Sem conexão. Será sincronizado ao reconectar.</Text>
          </View>
        )}

        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          {/* Operation type */}
          <Text style={styles.label}>Tipo de operação *</Text>
          <View style={styles.chipGrid}>
            {OPERATION_TYPES.map((t) => (
              <Pressable
                key={t.value}
                style={[styles.chip, operationType === t.value && styles.chipSelected]}
                onPress={() => setOperationType(t.value)}
                accessibilityLabel={t.label}
                accessibilityRole="button"
                accessibilityState={{ selected: operationType === t.value }}
              >
                <Text
                  style={[styles.chipText, operationType === t.value && styles.chipTextSelected]}
                >
                  {t.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Plot */}
          <Text style={styles.label}>Talhão *</Text>
          <View style={styles.chipGrid}>
            {plots.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.chip, selectedPlotId === p.id && styles.chipSelected]}
                onPress={() => setSelectedPlotId(p.id)}
                accessibilityLabel={p.name}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedPlotId === p.id }}
              >
                <Text style={[styles.chipText, selectedPlotId === p.id && styles.chipTextSelected]}>
                  {p.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Team */}
          <Text style={styles.label}>Equipe *</Text>
          <View style={styles.chipGrid}>
            {teams.map((t) => (
              <Pressable
                key={t.id}
                style={[styles.chip, selectedTeamId === t.id && styles.chipSelected]}
                onPress={() => setSelectedTeamId(t.id)}
                accessibilityLabel={t.name}
                accessibilityRole="button"
                accessibilityState={{ selected: selectedTeamId === t.id }}
              >
                <Text style={[styles.chipText, selectedTeamId === t.id && styles.chipTextSelected]}>
                  {t.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Members */}
          {members.length > 0 && (
            <>
              <Text style={styles.label}>
                Membros ({selectedMemberIds.length}/{members.length})
              </Text>
              {members.map((m) => {
                const selected = selectedMemberIds.includes(m.user_id);
                return (
                  <Pressable
                    key={m.id}
                    style={[styles.memberRow, selected && styles.memberRowSelected]}
                    onPress={() => toggleMember(m.user_id)}
                    accessibilityLabel={`${m.user_name} ${selected ? 'selecionado' : 'não selecionado'}`}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: selected }}
                  >
                    <View style={[styles.memberCheck, selected && styles.memberCheckActive]}>
                      {selected && <Check size={14} color="#fff" />}
                    </View>
                    <Text style={styles.memberName}>{m.user_name}</Text>
                  </Pressable>
                );
              })}
            </>
          )}

          {/* Time */}
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.label}>Início *</Text>
              <TextInput
                style={styles.input}
                value={timeStart}
                onChangeText={setTimeStart}
                placeholder="07:00"
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Hora de início"
              />
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>Fim *</Text>
              <TextInput
                style={styles.input}
                value={timeEnd}
                onChangeText={setTimeEnd}
                placeholder="17:00"
                keyboardType="numbers-and-punctuation"
                accessibilityLabel="Hora de fim"
              />
            </View>
          </View>

          {/* Notes */}
          <Text style={styles.label}>Observações</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Informações adicionais..."
            multiline
            numberOfLines={3}
            accessibilityLabel="Observações"
          />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || isSaving}
            accessibilityLabel="Salvar operação"
            accessibilityRole="button"
          >
            <ClipboardList size={20} color="#fff" />
            <Text style={styles.saveBtnText}>
              {isSaving ? 'Salvando...' : 'Registrar operação'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E5E1',
  },
  backBtn: { minWidth: 48, minHeight: 48, justifyContent: 'center' },
  headerTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: 18,
    color: '#2A2520',
    marginLeft: 4,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#6B6560',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  offlineText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 13,
    color: '#fff',
  },
  body: { flex: 1 },
  bodyContent: { padding: 16, gap: 16, paddingBottom: 32 },
  label: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 14,
    color: '#3E3833',
    marginBottom: 4,
  },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D5D0CB',
    backgroundColor: '#fff',
    minHeight: 48,
    justifyContent: 'center',
  },
  chipSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#e8f5e9',
  },
  chipText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 14,
    color: '#6B6560',
  },
  chipTextSelected: {
    fontFamily: 'SourceSans3_600SemiBold',
    color: '#2E7D32',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E8E5E1',
    minHeight: 48,
  },
  memberRowSelected: {
    borderColor: '#2E7D32',
    backgroundColor: '#f1f8e9',
  },
  memberCheck: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D5D0CB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberCheckActive: {
    borderColor: '#2E7D32',
    backgroundColor: '#2E7D32',
  },
  memberName: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 15,
    color: '#3E3833',
  },
  timeRow: { flexDirection: 'row', gap: 16 },
  timeField: { flex: 1 },
  input: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#D5D0CB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 48,
    backgroundColor: '#fff',
    color: '#3E3833',
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E8E5E1',
    backgroundColor: '#FAFAF8',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2E7D32',
    borderRadius: 8,
    paddingVertical: 14,
    minHeight: 48,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 16,
    color: '#fff',
  },
});
