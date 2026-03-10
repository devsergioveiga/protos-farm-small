import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
  Switch,
  Animated,
  AccessibilityInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import {
  ChevronDown,
  Check,
  CheckCircle,
  X,
  WifiOff,
  Users,
  MapPin,
  Clock,
  Zap,
  ChevronLeft,
  RotateCcw,
} from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { useConnectivity } from '@/stores/ConnectivityContext';
import { useAuth } from '@/stores/AuthContext';
import {
  createFieldPlotRepository,
  createFarmLocationRepository,
  createFieldTeamRepository,
  createQuickServiceRepository,
} from '@/services/db';
import { createOfflineQueue } from '@/services/offline-queue';
import type { ThemeColors } from '@/stores/ThemeContext';
import type {
  FieldOperationType,
  FieldOperationLocationType,
  OfflineFieldPlot,
  OfflineFarmLocation,
  OfflineFieldTeam,
  OfflineFieldTeamMember,
  OfflineQuickService,
} from '@/types/offline';

// ─── Constants ──────────────────────────────────────────────────────────────

const FAVORITE_TEAM_KEY = 'protos_favorite_team';

const OPERATION_TYPES: { value: FieldOperationType; label: string }[] = [
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

interface LocationItem {
  id: string;
  name: string;
  type: FieldOperationLocationType;
  typeLabel: string;
}

interface MemberPresence {
  id: string;
  userId: string;
  userName: string;
  present: boolean;
}

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => ({
  safeArea: { flex: 1 as const, backgroundColor: c.neutral[50] },
  container: { flex: 1 as const },
  scrollContent: { padding: spacing[4], paddingBottom: spacing[10], gap: spacing[4] },

  // Header
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    marginBottom: spacing[1],
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.xl,
    color: c.neutral[700],
    flex: 1 as const,
  },
  headerSubtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    marginBottom: spacing[2],
  },

  // Offline banner
  offlineBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.warning[100],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 8,
  },
  offlineText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.warning[500],
    flex: 1 as const,
  },

  // Field
  fieldContainer: { gap: spacing[1] },
  label: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[600],
    marginBottom: spacing[1],
  },
  requiredStar: { color: c.error[500] },

  // Picker button
  pickerButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: c.neutral[0],
    borderWidth: 1,
    borderColor: c.neutral[300],
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  pickerButtonActive: { borderColor: c.primary[500] },
  pickerText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
    flex: 1 as const,
  },
  pickerPlaceholder: { color: c.neutral[400] },

  // Time row
  timeRow: {
    flexDirection: 'row' as const,
    gap: spacing[3],
  },
  timeField: { flex: 1 as const, gap: spacing[1] },
  timeButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.neutral[0],
    borderWidth: 1,
    borderColor: c.neutral[300],
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  timeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },

  // Members section
  membersCard: {
    backgroundColor: c.neutral[0],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.neutral[200],
    overflow: 'hidden' as const,
  },
  membersHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  membersHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
  },
  membersTitle: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },
  membersBadge: {
    backgroundColor: c.primary[50],
    borderRadius: 12,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  membersBadgeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.xs,
    color: c.primary[600],
  },
  toggleAllButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  toggleAllText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.primary[600],
  },
  memberItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[50],
  },
  memberName: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
    flex: 1 as const,
  },
  memberNameAbsent: { color: c.neutral[400] },

  // Notes
  textInput: {
    backgroundColor: c.neutral[0],
    borderWidth: 1,
    borderColor: c.neutral[300],
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
    minHeight: 80,
    textAlignVertical: 'top' as const,
  },

  // Submit button
  submitButton: {
    backgroundColor: c.primary[600],
    borderRadius: 12,
    paddingVertical: spacing[4],
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: spacing[2],
    minHeight: 56,
  },
  submitButtonDisabled: { backgroundColor: c.neutral[300] },
  submitText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[0],
  },

  // Summary bar
  summaryBar: {
    backgroundColor: c.primary[50],
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing[3],
  },
  summaryItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
  },
  summaryText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.primary[700],
  },

  // Modal
  modalOverlay: {
    flex: 1 as const,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end' as const,
  },
  modalContent: {
    backgroundColor: c.neutral[0],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%' as const,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  modalTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[700],
  },
  modalCloseButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  modalItemSelected: { backgroundColor: c.primary[50] },
  modalItemText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },
  modalItemSubtext: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[500],
    marginTop: 2,
  },

  // Repeat yesterday button
  repeatButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
    backgroundColor: c.neutral[0],
    borderWidth: 1,
    borderColor: c.primary[300],
    borderRadius: 12,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 56,
  },
  repeatButtonContent: { flex: 1 as const },
  repeatTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.primary[700],
  },
  repeatDesc: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    marginTop: 2,
  },

  // Success toast
  successToast: {
    position: 'absolute' as const,
    bottom: spacing[8],
    left: spacing[4],
    right: spacing[4],
    backgroundColor: c.primary[600],
    borderRadius: 12,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[4],
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  successToastText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[0],
    flex: 1 as const,
  },
  successToastSub: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.85)',
  },

  // No team state
  emptyState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: spacing[10],
    gap: spacing[3],
  },
  emptyTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[600],
    textAlign: 'center' as const,
  },
  emptyDesc: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[500],
    textAlign: 'center' as const,
    paddingHorizontal: spacing[6],
  },
});

// ─── Component ──────────────────────────────────────────────────────────────

export default function QuickServiceScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const { isConnected } = useConnectivity();
  const { user } = useAuth();

  // Data from offline DB
  const [teams, setTeams] = useState<OfflineFieldTeam[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [lastService, setLastService] = useState<OfflineQuickService | null>(null);

  // Form state
  const [selectedTeam, setSelectedTeam] = useState<OfflineFieldTeam | null>(null);
  const [members, setMembers] = useState<MemberPresence[]>([]);
  const [operationType, setOperationType] = useState<FieldOperationType | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationType, setLocationType] = useState<FieldOperationLocationType | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [timeStart, setTimeStart] = useState(() => {
    const d = new Date();
    d.setHours(7, 0, 0, 0);
    return d;
  });
  const [timeEnd, setTimeEnd] = useState(() => {
    const d = new Date();
    d.setHours(11, 0, 0, 0);
    return d;
  });
  const [notes, setNotes] = useState('');
  const [memberProductivity, setMemberProductivity] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Picker modals
  const [showTeamPicker, setShowTeamPicker] = useState(false);
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showTimeStartPicker, setShowTimeStartPicker] = useState(false);
  const [showTimeEndPicker, setShowTimeEndPicker] = useState(false);

  const presentCount = useMemo(() => members.filter((m) => m.present).length, [members]);
  const totalCount = members.length;

  const isFormValid = selectedTeam !== null && operationType !== null && presentCount > 0;

  // Load teams and locations
  useEffect(() => {
    if (!selectedFarmId) return;

    async function loadData() {
      const teamRepo = createFieldTeamRepository(db);
      const plotRepo = createFieldPlotRepository(db);
      const locRepo = createFarmLocationRepository(db);

      const [farmTeams, plots, farmLocs] = await Promise.all([
        teamRepo.getByFarmId(selectedFarmId!),
        plotRepo.getByFarmId(selectedFarmId!),
        locRepo.getByFarmId(selectedFarmId!),
      ]);

      setTeams(farmTeams);

      // Load last service for "Repeat yesterday"
      const qsRepo = createQuickServiceRepository(db);
      const latest = await qsRepo.getLatestByFarm(selectedFarmId!);
      setLastService(latest);

      const items: LocationItem[] = [
        ...plots.map((p: OfflineFieldPlot) => ({
          id: p.id,
          name: p.name,
          type: 'PLOT' as const,
          typeLabel: 'Talhão',
        })),
        ...farmLocs.map((l: OfflineFarmLocation) => ({
          id: l.id,
          name: l.name,
          type: (l.type === 'PASTURE' ? 'PASTURE' : 'FACILITY') as FieldOperationLocationType,
          typeLabel: l.type === 'PASTURE' ? 'Pasto' : 'Instalação',
        })),
      ];
      setLocations(items);

      // Auto-select favorite team
      if (user) {
        const favId = await SecureStore.getItemAsync(`${FAVORITE_TEAM_KEY}_${user.userId}`);
        if (favId) {
          const favTeam = farmTeams.find((t) => t.id === favId);
          if (favTeam) {
            await selectTeam(favTeam);
            return;
          }
        }
      }

      // If user is leader of exactly one team, auto-select it
      if (user) {
        const ledTeams = farmTeams.filter((t) => t.leader_id === user.userId);
        if (ledTeams.length === 1) {
          await selectTeam(ledTeams[0]);
        }
      }
    }

    void loadData();
  }, [db, selectedFarmId]); // selectTeam is stable via useCallback but defined after this effect

  const selectTeam = useCallback(
    async (team: OfflineFieldTeam) => {
      setSelectedTeam(team);
      const teamRepo = createFieldTeamRepository(db);
      const teamMembers = await teamRepo.getActiveMembers(team.id);
      setMembers(
        teamMembers.map((m: OfflineFieldTeamMember) => ({
          id: m.id,
          userId: m.user_id,
          userName: m.user_name,
          present: true,
        })),
      );

      // Save as favorite
      if (user) {
        await SecureStore.setItemAsync(`${FAVORITE_TEAM_KEY}_${user.userId}`, team.id);
      }
    },
    [db, user],
  );

  const handleRepeatYesterday = useCallback(async () => {
    if (!lastService) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    // Select the same team and load its members
    const team = teams.find((t) => t.id === lastService.team_id);
    if (team) {
      await selectTeam(team);
    }

    // Clone activity and location
    setOperationType(lastService.operation_type as FieldOperationType);
    setLocationId(lastService.location_id);
    setLocationType(lastService.location_type as FieldOperationLocationType | null);
    setLocationName(lastService.location_name);

    // Clone time start/end (parse HH:MM)
    const parseTime = (timeStr: string): Date => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date();
      d.setHours(h, m, 0, 0);
      return d;
    };
    setTimeStart(parseTime(lastService.time_start));
    setTimeEnd(parseTime(lastService.time_end));

    // Clone notes
    setNotes(lastService.notes ?? '');
  }, [lastService, teams, selectTeam]);

  const toggleMember = useCallback((memberId: string) => {
    setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, present: !m.present } : m)));
  }, []);

  const toggleAllMembers = useCallback(() => {
    const allPresent = members.every((m) => m.present);
    setMembers((prev) => prev.map((m) => ({ ...m, present: !allPresent })));
  }, [members]);

  const updateProductivity = useCallback((userId: string, value: string) => {
    setMemberProductivity((prev) => ({ ...prev, [userId]: value }));
  }, []);

  const handleTimeStartChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    setShowTimeStartPicker(false);
    if (date) setTimeStart(date);
  }, []);

  const handleTimeEndChange = useCallback((_: DateTimePickerEvent, date?: Date) => {
    setShowTimeEndPicker(false);
    if (date) setTimeEnd(date);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedTeam || !operationType || !selectedFarmId || presentCount === 0) return;

    setIsSaving(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const now = new Date().toISOString();
      const id = generateId();
      const presentIds = members.filter((m) => m.present).map((m) => m.userId);

      const qsRepo = createQuickServiceRepository(db);
      await qsRepo.create({
        id,
        farm_id: selectedFarmId,
        team_id: selectedTeam.id,
        team_name: selectedTeam.name,
        field_plot_id: locationType === 'PLOT' ? locationId : null,
        field_plot_name: locationType === 'PLOT' ? locationName : null,
        location_id: locationId,
        location_type: locationType,
        location_name: locationName,
        operation_type: operationType,
        performed_at: new Date().toISOString().split('T')[0],
        time_start: formatTime(timeStart),
        time_end: formatTime(timeEnd),
        present_member_ids: JSON.stringify(presentIds),
        notes: notes.trim() || null,
        synced: 0,
        created_at: now,
        updated_at: now,
      });

      // Enqueue for sync to team-operations API
      const queue = createOfflineQueue(db);
      const payload = {
        teamId: selectedTeam.id,
        fieldPlotId: locationType === 'PLOT' ? locationId : undefined,
        locationId: locationType !== 'PLOT' ? locationId : undefined,
        locationType: locationType !== 'PLOT' ? locationType : undefined,
        operationType,
        performedAt: new Date().toISOString(),
        timeStart: timeStart.toISOString(),
        timeEnd: timeEnd.toISOString(),
        notes: notes.trim() || undefined,
        entries: presentIds.map((uid) => {
          const prod = memberProductivity[uid];
          const prodNum = prod ? parseFloat(prod) : undefined;
          return {
            userId: uid,
            productivity: prodNum && !isNaN(prodNum) ? prodNum : undefined,
            productivityUnit: prodNum && !isNaN(prodNum) ? 'LITROS' : undefined,
          };
        }),
      };

      await queue.enqueue(
        'field_operations',
        id,
        'CREATE',
        payload,
        `/org/farms/${selectedFarmId}/team-operations`,
        'POST',
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSavedCount(presentIds.length);

      // Announce to screen readers
      AccessibilityInfo.announceForAccessibility(
        `Serviço registrado para ${presentIds.length} ${presentIds.length === 1 ? 'pessoa' : 'pessoas'}`,
      );

      // Show success toast and auto-navigate back
      Animated.sequence([
        Animated.timing(toastOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.delay(1200),
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start(() => {
        router.back();
      });
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erro ao salvar', 'Não foi possível registrar o serviço. Tente novamente.');
      setIsSaving(false);
    }
  }, [
    selectedTeam,
    operationType,
    selectedFarmId,
    presentCount,
    members,
    db,
    locationType,
    locationId,
    locationName,
    timeStart,
    timeEnd,
    notes,
    memberProductivity,
    router,
  ]);

  const operationLabel = operationType
    ? OPERATION_TYPES.find((t) => t.value === operationType)?.label
    : null;

  if (!selectedFarmId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyState}>
          <Users size={48} color={colors.neutral[400]} aria-hidden />
          <Text style={styles.emptyTitle}>Selecione uma fazenda</Text>
          <Text style={styles.emptyDesc}>Escolha uma fazenda para registrar o serviço do dia.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View>
            <View style={styles.headerRow}>
              <Pressable
                style={styles.backButton}
                onPress={() => router.back()}
                accessible
                accessibilityLabel="Voltar"
                accessibilityRole="button"
              >
                <ChevronLeft size={24} color={colors.neutral[600]} />
              </Pressable>
              <Text style={styles.headerTitle}>Serviço rápido</Text>
              <Zap size={24} color={colors.primary[600]} aria-hidden />
            </View>
            <Text style={styles.headerSubtitle}>{selectedFarm?.name ?? 'Fazenda'}</Text>
          </View>

          {/* Offline banner */}
          {!isConnected && (
            <View style={styles.offlineBanner} accessibilityRole="alert">
              <WifiOff size={16} color={colors.warning[500]} aria-hidden />
              <Text style={styles.offlineText}>
                Sem conexão. O serviço será enviado quando reconectar.
              </Text>
            </View>
          )}

          {/* Repeat yesterday */}
          {lastService && (
            <Pressable
              style={({ pressed }) => [
                styles.repeatButton,
                pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
              ]}
              onPress={handleRepeatYesterday}
              accessible
              accessibilityLabel="Repetir serviço anterior"
              accessibilityHint={`Clona ${lastService.team_name}, ${OPERATION_TYPES.find((t) => t.value === lastService.operation_type)?.label ?? lastService.operation_type}`}
              accessibilityRole="button"
            >
              <RotateCcw size={24} color={colors.primary[600]} />
              <View style={styles.repeatButtonContent}>
                <Text style={styles.repeatTitle}>Repetir ontem</Text>
                <Text style={styles.repeatDesc} numberOfLines={1}>
                  {lastService.team_name} ·{' '}
                  {OPERATION_TYPES.find((t) => t.value === lastService.operation_type)?.label ??
                    lastService.operation_type}
                  {lastService.location_name ? ` · ${lastService.location_name}` : ''}
                </Text>
              </View>
              <ChevronDown
                size={20}
                color={colors.primary[500]}
                style={{ transform: [{ rotate: '-90deg' }] }}
                aria-hidden
              />
            </Pressable>
          )}

          {/* Team selector */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Equipe <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable
              style={[styles.pickerButton, selectedTeam && styles.pickerButtonActive]}
              onPress={() => setShowTeamPicker(true)}
              accessible
              accessibilityLabel={
                selectedTeam ? `Equipe: ${selectedTeam.name}` : 'Selecionar equipe'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !selectedTeam && styles.pickerPlaceholder]}>
                {selectedTeam ? selectedTeam.name : 'Selecionar equipe'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          </View>

          {/* Members presence toggle */}
          {selectedTeam && members.length > 0 && (
            <View style={styles.membersCard}>
              <View style={styles.membersHeader}>
                <View style={styles.membersHeaderLeft}>
                  <Users size={20} color={colors.neutral[600]} aria-hidden />
                  <Text style={styles.membersTitle}>Presentes</Text>
                  <View style={styles.membersBadge}>
                    <Text style={styles.membersBadgeText}>
                      {presentCount}/{totalCount}
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.toggleAllButton}
                  onPress={toggleAllMembers}
                  accessible
                  accessibilityLabel={
                    members.every((m) => m.present) ? 'Desmarcar todos' : 'Marcar todos'
                  }
                  accessibilityRole="button"
                >
                  <Text style={styles.toggleAllText}>
                    {members.every((m) => m.present) ? 'Nenhum' : 'Todos'}
                  </Text>
                </Pressable>
              </View>
              {members.map((member) => (
                <Pressable
                  key={member.id}
                  style={styles.memberItem}
                  onPress={() => toggleMember(member.id)}
                  accessible
                  accessibilityLabel={`${member.userName}, ${member.present ? 'presente' : 'ausente'}`}
                  accessibilityRole="switch"
                  accessibilityState={{ checked: member.present }}
                >
                  <Text style={[styles.memberName, !member.present && styles.memberNameAbsent]}>
                    {member.userName}
                  </Text>
                  <Switch
                    value={member.present}
                    onValueChange={() => toggleMember(member.id)}
                    trackColor={{
                      false: colors.neutral[200],
                      true: colors.primary[200],
                    }}
                    thumbColor={member.present ? colors.primary[600] : colors.neutral[400]}
                    accessibilityElementsHidden
                  />
                </Pressable>
              ))}
            </View>
          )}

          {/* Activity type */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Atividade <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable
              style={[styles.pickerButton, operationType && styles.pickerButtonActive]}
              onPress={() => setShowTypePicker(true)}
              accessible
              accessibilityLabel={
                operationLabel ? `Atividade: ${operationLabel}` : 'Selecionar atividade'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !operationType && styles.pickerPlaceholder]}>
                {operationLabel ?? 'Selecionar atividade'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          </View>

          {/* Location */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Talhão / Pasto</Text>
            <Pressable
              style={[styles.pickerButton, locationId && styles.pickerButtonActive]}
              onPress={() => setShowLocationPicker(true)}
              accessible
              accessibilityLabel={locationName ? `Local: ${locationName}` : 'Selecionar local'}
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !locationId && styles.pickerPlaceholder]}>
                {locationName ?? 'Selecionar local (opcional)'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          </View>

          {/* Time start / end */}
          <View style={styles.timeRow}>
            <View style={styles.timeField}>
              <Text style={styles.label}>
                Início <Text style={styles.requiredStar}>*</Text>
              </Text>
              <Pressable
                style={styles.timeButton}
                onPress={() => setShowTimeStartPicker(true)}
                accessible
                accessibilityLabel={`Hora início: ${formatTime(timeStart)}`}
                accessibilityRole="button"
              >
                <Clock size={20} color={colors.neutral[500]} aria-hidden />
                <Text style={styles.timeText}>{formatTime(timeStart)}</Text>
              </Pressable>
            </View>
            <View style={styles.timeField}>
              <Text style={styles.label}>
                Fim <Text style={styles.requiredStar}>*</Text>
              </Text>
              <Pressable
                style={styles.timeButton}
                onPress={() => setShowTimeEndPicker(true)}
                accessible
                accessibilityLabel={`Hora fim: ${formatTime(timeEnd)}`}
                accessibilityRole="button"
              >
                <Clock size={20} color={colors.neutral[500]} aria-hidden />
                <Text style={styles.timeText}>{formatTime(timeEnd)}</Text>
              </Pressable>
            </View>
          </View>

          {/* Litros por pessoa — colheita café (CA4) */}
          {operationType === 'COLHEITA' && members.filter((m) => m.present).length > 0 && (
            <View style={styles.membersCard}>
              <View style={styles.membersHeader}>
                <View style={styles.membersHeaderLeft}>
                  <Text style={styles.membersTitle}>Litros por pessoa</Text>
                </View>
              </View>
              {members
                .filter((m) => m.present)
                .map((member) => (
                  <View key={member.id} style={styles.memberItem}>
                    <Text style={[styles.memberName, { flex: 1 }]} numberOfLines={1}>
                      {member.userName}
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: colors.neutral[50],
                        borderWidth: 1,
                        borderColor: colors.neutral[300],
                        borderRadius: 8,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        fontFamily: 'SourceSans3_600SemiBold',
                        fontSize: fontSize.base,
                        color: colors.neutral[700],
                        width: 80,
                        textAlign: 'center' as const,
                        minHeight: 40,
                      }}
                      value={memberProductivity[member.userId] ?? ''}
                      onChangeText={(v) => updateProductivity(member.userId, v)}
                      placeholder="0"
                      placeholderTextColor={colors.neutral[400]}
                      keyboardType="numeric"
                      accessible
                      accessibilityLabel={`Litros de ${member.userName}`}
                    />
                  </View>
                ))}
            </View>
          )}

          {/* Notes */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={styles.textInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observações sobre o serviço (opcional)"
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={3}
              accessible
              accessibilityLabel="Observações"
            />
          </View>

          {/* Summary bar */}
          {isFormValid && (
            <View style={styles.summaryBar} accessibilityRole="summary">
              <View style={styles.summaryItem}>
                <Users size={16} color={colors.primary[600]} aria-hidden />
                <Text style={styles.summaryText}>
                  {presentCount} {presentCount === 1 ? 'pessoa' : 'pessoas'}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Clock size={16} color={colors.primary[600]} aria-hidden />
                <Text style={styles.summaryText}>
                  {formatTime(timeStart)} – {formatTime(timeEnd)}
                </Text>
              </View>
              {locationName && (
                <View style={styles.summaryItem}>
                  <MapPin size={16} color={colors.primary[600]} aria-hidden />
                  <Text style={styles.summaryText}>{locationName}</Text>
                </View>
              )}
            </View>
          )}

          {/* Submit */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              (!isFormValid || isSaving) && styles.submitButtonDisabled,
              pressed &&
                isFormValid &&
                !isSaving && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleSave}
            disabled={!isFormValid || isSaving}
            accessible
            accessibilityLabel="Registrar serviço"
            accessibilityRole="button"
            accessibilityState={{ disabled: !isFormValid || isSaving }}
          >
            <Check size={24} color={colors.neutral[0]} aria-hidden />
            <Text style={styles.submitText}>{isSaving ? 'Salvando...' : 'Registrar serviço'}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Time pickers (native) */}
      {showTimeStartPicker && (
        <DateTimePicker value={timeStart} mode="time" is24Hour onChange={handleTimeStartChange} />
      )}
      {showTimeEndPicker && (
        <DateTimePicker value={timeEnd} mode="time" is24Hour onChange={handleTimeEndChange} />
      )}

      {/* Team picker modal */}
      <Modal
        visible={showTeamPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeamPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTeamPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar equipe</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowTeamPicker(false)}
                accessible
                accessibilityLabel="Fechar"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[600]} />
              </Pressable>
            </View>
            <FlatList
              data={teams}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.modalItem,
                    selectedTeam?.id === item.id && styles.modalItemSelected,
                  ]}
                  onPress={async () => {
                    await selectTeam(item);
                    setShowTeamPicker(false);
                  }}
                  accessible
                  accessibilityLabel={`Equipe ${item.name}`}
                  accessibilityRole="button"
                >
                  <View>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    <Text style={styles.modalItemSubtext}>{item.leader_name}</Text>
                  </View>
                  {selectedTeam?.id === item.id && (
                    <Check size={20} color={colors.primary[600]} aria-hidden />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Users size={48} color={colors.neutral[400]} aria-hidden />
                  <Text style={styles.emptyTitle}>Nenhuma equipe</Text>
                  <Text style={styles.emptyDesc}>
                    Cadastre equipes de campo no painel web para usar aqui.
                  </Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Activity type picker modal */}
      <Modal
        visible={showTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTypePicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Atividade do dia</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowTypePicker(false)}
                accessible
                accessibilityLabel="Fechar"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[600]} />
              </Pressable>
            </View>
            <FlatList
              data={OPERATION_TYPES}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={[
                    styles.modalItem,
                    operationType === item.value && styles.modalItemSelected,
                  ]}
                  onPress={() => {
                    setOperationType(item.value);
                    setShowTypePicker(false);
                  }}
                  accessible
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {operationType === item.value && (
                    <Check size={20} color={colors.primary[600]} aria-hidden />
                  )}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Location picker modal */}
      <Modal
        visible={showLocationPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLocationPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Talhão / Pasto</Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowLocationPicker(false)}
                accessible
                accessibilityLabel="Fechar"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[600]} />
              </Pressable>
            </View>
            <FlatList
              data={locations}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.modalItem, locationId === item.id && styles.modalItemSelected]}
                  onPress={() => {
                    setLocationId(item.id);
                    setLocationType(item.type);
                    setLocationName(item.name);
                    setShowLocationPicker(false);
                  }}
                  accessible
                  accessibilityLabel={`${item.typeLabel}: ${item.name}`}
                  accessibilityRole="button"
                >
                  <View>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    <Text style={styles.modalItemSubtext}>{item.typeLabel}</Text>
                  </View>
                  {locationId === item.id && (
                    <Check size={20} color={colors.primary[600]} aria-hidden />
                  )}
                </Pressable>
              )}
              ListHeaderComponent={
                locationId ? (
                  <Pressable
                    style={styles.modalItem}
                    onPress={() => {
                      setLocationId(null);
                      setLocationType(null);
                      setLocationName(null);
                      setShowLocationPicker(false);
                    }}
                    accessible
                    accessibilityLabel="Limpar seleção de local"
                    accessibilityRole="button"
                  >
                    <Text style={[styles.modalItemText, { color: colors.neutral[500] }]}>
                      Nenhum (limpar)
                    </Text>
                  </Pressable>
                ) : null
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* Success toast */}
      <Animated.View
        style={[styles.successToast, { opacity: toastOpacity }]}
        pointerEvents="none"
        accessibilityLiveRegion="polite"
      >
        <CheckCircle size={24} color={colors.neutral[0]} aria-hidden />
        <View>
          <Text style={styles.successToastText}>Serviço registrado</Text>
          <Text style={styles.successToastSub}>
            {savedCount} {savedCount === 1 ? 'pessoa' : 'pessoas'} registradas
          </Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}
