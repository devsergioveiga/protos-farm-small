import { useState, useEffect, useCallback } from 'react';
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
  Image,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Bug,
  MapPin,
  Clock,
  ChevronDown,
  Check,
  Camera,
  X,
  WifiOff,
  Trash2,
  Search,
  Leaf,
  AlertTriangle,
} from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { useConnectivity } from '@/stores/ConnectivityContext';
import {
  createFieldPlotRepository,
  createPestRepository,
  createMonitoringPointRepository,
  createMonitoringRecordRepository,
} from '@/services/db';
import { createOfflineQueue } from '@/services/offline-queue';
import type { ThemeColors } from '@/stores/ThemeContext';
import type {
  OfflineFieldPlot,
  OfflinePest,
  OfflineMonitoringPoint,
  InfestationLevel,
} from '@/types/offline';

// ─── Constants ──────────────────────────────────────────────────────────────

const INFESTATION_LEVELS: { value: InfestationLevel; label: string; color: string }[] = [
  { value: 'AUSENTE', label: 'Ausente', color: '#4CAF50' },
  { value: 'BAIXO', label: 'Baixo', color: '#8BC34A' },
  { value: 'MODERADO', label: 'Moderado', color: '#FF9800' },
  { value: 'ALTO', label: 'Alto', color: '#F44336' },
  { value: 'CRITICO', label: 'Crítico', color: '#B71C1C' },
];

const GROWTH_STAGES = [
  'VE',
  'V1',
  'V2',
  'V3',
  'V4',
  'V5',
  'V6',
  'V7',
  'V8',
  'V9',
  'V10',
  'VT',
  'R1',
  'R2',
  'R3',
  'R4',
  'R5',
  'R6',
  'R7',
  'R8',
  'R9',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `${timestamp}-${random}`;
}

function formatDateTime(date: Date): string {
  const d = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const t = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${d} às ${t}`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => ({
  safeArea: { flex: 1 as const, backgroundColor: c.neutral[50] },
  container: { flex: 1 as const },
  scrollContent: { padding: spacing[4], paddingBottom: spacing[10], gap: spacing[4] },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
    marginBottom: spacing[2],
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
  fieldContainer: { gap: spacing[1] },
  label: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[600],
    marginBottom: spacing[1],
  },
  requiredStar: { color: c.error[500] },
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
  textInput: {
    backgroundColor: c.neutral[0],
    borderWidth: 1,
    borderColor: c.neutral[300],
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },
  textInputMultiline: { minHeight: 96, textAlignVertical: 'top' as const },
  dateTimeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.neutral[100],
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  dateTimeText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[600],
  },
  gpsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    paddingVertical: spacing[1],
  },
  gpsText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[500],
  },
  // Infestation level chips
  levelRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing[2],
  },
  levelChip: {
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 20,
    borderWidth: 1,
    minHeight: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  levelChipText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
  },
  // Switch row
  switchRow: {
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
  switchLabel: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
    flex: 1 as const,
  },
  // Photo
  photoButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.neutral[0],
    borderWidth: 1,
    borderColor: c.neutral[300],
    borderRadius: 8,
    borderStyle: 'dashed' as const,
    paddingVertical: spacing[5],
    minHeight: 48,
  },
  photoButtonText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[500],
  },
  photoPreviewContainer: {
    borderRadius: 8,
    overflow: 'hidden' as const,
    backgroundColor: c.neutral[100],
  },
  photoPreview: {
    width: '100%' as const,
    height: 200,
    borderRadius: 8,
  },
  photoActions: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing[2],
    gap: spacing[2],
  },
  photoActionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    minHeight: 40,
    borderRadius: 8,
  },
  retakeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.primary[600],
  },
  removeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.error[500],
  },
  // Submit
  submitButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.primary[600],
    borderRadius: 8,
    paddingVertical: spacing[4],
    minHeight: 48,
    marginTop: spacing[2],
  },
  submitButtonDisabled: { opacity: 0.5 },
  submitButtonText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[0],
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
    paddingBottom: spacing[8],
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[200],
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
  modalSearchContainer: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  modalSearchInput: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.neutral[100],
    borderRadius: 8,
    paddingHorizontal: spacing[3],
    minHeight: 44,
  },
  modalSearchText: {
    flex: 1 as const,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
    padding: 0,
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
  // Empty state
  emptyContainer: {
    flex: 1 as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: spacing[8],
  },
  emptyTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[700],
    marginTop: spacing[4],
    textAlign: 'center' as const,
  },
  emptyDesc: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[500],
    textAlign: 'center' as const,
    marginTop: spacing[2],
  },
  // Growth stage chips
  stageRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: spacing[1],
  },
  stageChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
    borderRadius: 4,
    borderWidth: 1,
    minHeight: 32,
    minWidth: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  stageChipText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: fontSize.xs,
  },
});

// ─── Component ──────────────────────────────────────────────────────────────

export default function MonitoringRecordScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const { isConnected } = useConnectivity();

  // Form state
  const [fieldPlotId, setFieldPlotId] = useState<string | null>(null);
  const [fieldPlotName, setFieldPlotName] = useState<string | null>(null);
  const [monitoringPointId, setMonitoringPointId] = useState<string | null>(null);
  const [monitoringPointCode, setMonitoringPointCode] = useState<string | null>(null);
  const [pestId, setPestId] = useState<string | null>(null);
  const [pestName, setPestName] = useState<string | null>(null);
  const [infestationLevel, setInfestationLevel] = useState<InfestationLevel | null>(null);
  const [sampleCount, setSampleCount] = useState('');
  const [pestCount, setPestCount] = useState('');
  const [growthStage, setGrowthStage] = useState<string | null>(null);
  const [hasNaturalEnemies, setHasNaturalEnemies] = useState(false);
  const [naturalEnemiesDesc, setNaturalEnemiesDesc] = useState('');
  const [damagePercentage, setDamagePercentage] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [observedAt] = useState(() => new Date());
  const [isSaving, setIsSaving] = useState(false);

  // GPS state
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );

  // Picker modals
  const [showPlotPicker, setShowPlotPicker] = useState(false);
  const [showPointPicker, setShowPointPicker] = useState(false);
  const [showPestPicker, setShowPestPicker] = useState(false);
  const [showStagePicker, setShowStagePicker] = useState(false);

  // Data from offline DB
  const [plots, setPlots] = useState<OfflineFieldPlot[]>([]);
  const [monitoringPoints, setMonitoringPoints] = useState<OfflineMonitoringPoint[]>([]);
  const [pests, setPests] = useState<OfflinePest[]>([]);
  const [pestSearch, setPestSearch] = useState('');

  // Load field plots
  useEffect(() => {
    if (!selectedFarmId) return;
    async function loadPlots() {
      const plotRepo = createFieldPlotRepository(db);
      const data = await plotRepo.getByFarmId(selectedFarmId!);
      setPlots(data);
    }
    void loadPlots();
  }, [db, selectedFarmId]);

  // Load monitoring points when plot changes
  useEffect(() => {
    if (!fieldPlotId) {
      setMonitoringPoints([]);
      return;
    }
    async function loadPoints() {
      const pointRepo = createMonitoringPointRepository(db);
      const data = await pointRepo.getByFieldPlotId(fieldPlotId!);
      setMonitoringPoints(data);
    }
    void loadPoints();
  }, [db, fieldPlotId]);

  // Load pests
  useEffect(() => {
    async function loadPests() {
      const pestRepo = createPestRepository(db);
      const data = pestSearch ? await pestRepo.search(pestSearch) : await pestRepo.getAll();
      setPests(data);
    }
    void loadPests();
  }, [db, pestSearch]);

  // Request GPS
  useEffect(() => {
    let cancelled = false;
    async function getLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (!cancelled) {
        setUserCoords({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
      }
    }
    void getLocation();
    return () => {
      cancelled = true;
    };
  }, []);

  const isFormValid =
    selectedFarmId !== null &&
    fieldPlotId !== null &&
    monitoringPointId !== null &&
    pestId !== null &&
    infestationLevel !== null;

  const handleSelectPlot = useCallback((plot: OfflineFieldPlot) => {
    setFieldPlotId(plot.id);
    setFieldPlotName(plot.name);
    // Reset point selection when plot changes
    setMonitoringPointId(null);
    setMonitoringPointCode(null);
    setShowPlotPicker(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSelectPoint = useCallback((point: OfflineMonitoringPoint) => {
    setMonitoringPointId(point.id);
    setMonitoringPointCode(point.code);
    setShowPointPicker(false);
    // Use point GPS as coordinates
    setUserCoords({ latitude: point.latitude, longitude: point.longitude });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSelectPest = useCallback((pest: OfflinePest) => {
    setPestId(pest.id);
    setPestName(pest.common_name);
    setShowPestPicker(false);
    setPestSearch('');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSelectLevel = useCallback((level: InfestationLevel) => {
    setInfestationLevel(level);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permissão necessária',
        'Permita o acesso à câmera nas configurações do dispositivo para tirar fotos.',
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      exif: true,
    });

    if (result.canceled || result.assets.length === 0) return;

    const asset = result.assets[0];
    setPhotoUri(asset.uri);

    // Use photo GPS exif if we don't have coords
    if (!userCoords && asset.exif) {
      const lat = asset.exif.GPSLatitude as number | undefined;
      const lng = asset.exif.GPSLongitude as number | undefined;
      if (lat && lng) {
        setUserCoords({ latitude: lat, longitude: lng });
      }
    }

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [userCoords]);

  const handleRemovePhoto = useCallback(() => {
    setPhotoUri(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSave = useCallback(async () => {
    if (!isFormValid || !selectedFarmId || isSaving) return;
    setIsSaving(true);

    try {
      const recRepo = createMonitoringRecordRepository(db);
      const queue = createOfflineQueue(db);
      const now = new Date().toISOString();
      const recId = generateId();

      const parsedSampleCount = sampleCount ? parseInt(sampleCount, 10) : null;
      const parsedPestCount = pestCount ? parseInt(pestCount, 10) : null;
      const parsedDamage = damagePercentage ? parseFloat(damagePercentage) : null;

      await recRepo.create({
        id: recId,
        farm_id: selectedFarmId,
        field_plot_id: fieldPlotId!,
        monitoring_point_id: monitoringPointId!,
        monitoring_point_code: monitoringPointCode!,
        pest_id: pestId!,
        pest_name: pestName!,
        observed_at: observedAt.toISOString(),
        infestation_level: infestationLevel!,
        sample_count: parsedSampleCount,
        pest_count: parsedPestCount,
        growth_stage: growthStage,
        has_natural_enemies: hasNaturalEnemies ? 1 : 0,
        natural_enemies_desc: naturalEnemiesDesc.trim() || null,
        damage_percentage: parsedDamage,
        photo_uri: photoUri,
        latitude: userCoords?.latitude ?? null,
        longitude: userCoords?.longitude ?? null,
        notes: notes.trim() || null,
        synced: 0,
        created_at: now,
        updated_at: now,
      });

      // Enqueue for backend sync
      await queue.enqueue(
        'monitoring_records',
        recId,
        'CREATE',
        {
          monitoringPointId: monitoringPointId!,
          pestId: pestId!,
          observedAt: observedAt.toISOString(),
          infestationLevel: infestationLevel!,
          sampleCount: parsedSampleCount,
          pestCount: parsedPestCount,
          growthStage: growthStage,
          hasNaturalEnemies: hasNaturalEnemies,
          naturalEnemiesDesc: naturalEnemiesDesc.trim() || null,
          damagePercentage: parsedDamage,
          photoUrl: null, // Photo will be uploaded separately when online
          notes: notes.trim() || null,
        },
        `/org/farms/${selectedFarmId}/field-plots/${fieldPlotId}/monitoring-records`,
        'POST',
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('Registro MIP salvo', 'Monitoramento registrado com sucesso.', [
        {
          text: 'Novo registro',
          onPress: () => {
            // Reset form but keep plot and point
            setPestId(null);
            setPestName(null);
            setInfestationLevel(null);
            setSampleCount('');
            setPestCount('');
            setHasNaturalEnemies(false);
            setNaturalEnemiesDesc('');
            setDamagePercentage('');
            setNotes('');
            setPhotoUri(null);
          },
        },
        {
          text: 'Voltar',
          onPress: () => router.back(),
        },
      ]);
    } catch {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erro', 'Não foi possível salvar o registro. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  }, [
    isFormValid,
    selectedFarmId,
    isSaving,
    db,
    fieldPlotId,
    monitoringPointId,
    monitoringPointCode,
    pestId,
    pestName,
    observedAt,
    infestationLevel,
    sampleCount,
    pestCount,
    growthStage,
    hasNaturalEnemies,
    naturalEnemiesDesc,
    damagePercentage,
    photoUri,
    userCoords,
    notes,
    router,
  ]);

  // No farm selected
  if (!selectedFarmId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Bug size={64} color={colors.neutral[300]} aria-hidden />
          <Text style={styles.emptyTitle} accessibilityRole="header">
            Selecione uma fazenda
          </Text>
          <Text style={styles.emptyDesc}>
            Para registrar monitoramento MIP, primeiro selecione uma fazenda na tela Início.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
              onPress={() => router.back()}
              accessible
              accessibilityLabel="Voltar"
              accessibilityRole="button"
            >
              <ArrowLeft size={24} color={colors.neutral[700]} />
            </Pressable>
            <Text style={styles.headerTitle} accessibilityRole="header">
              Monitoramento MIP
            </Text>
          </View>

          {/* Offline banner */}
          {!isConnected && (
            <View style={styles.offlineBanner} accessibilityRole="alert">
              <WifiOff size={16} color={colors.warning[500]} aria-hidden />
              <Text style={styles.offlineText}>
                Sem conexão. O registro será sincronizado quando voltar online.
              </Text>
            </View>
          )}

          {/* Farm info */}
          <View style={styles.dateTimeRow}>
            <MapPin size={16} color={colors.neutral[500]} aria-hidden />
            <Text style={styles.dateTimeText}>{selectedFarm?.name ?? 'Fazenda'}</Text>
          </View>

          {/* Field plot picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Talhão <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable
              style={[styles.pickerButton, fieldPlotId && styles.pickerButtonActive]}
              onPress={() => setShowPlotPicker(true)}
              accessible
              accessibilityLabel={
                fieldPlotName ? `Talhão: ${fieldPlotName}. Toque para alterar` : 'Selecionar talhão'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !fieldPlotName && styles.pickerPlaceholder]}>
                {fieldPlotName ?? 'Selecione o talhão'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          </View>

          {/* Monitoring point picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Ponto de monitoramento <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable
              style={[styles.pickerButton, monitoringPointId && styles.pickerButtonActive]}
              onPress={() => {
                if (!fieldPlotId) {
                  Alert.alert('Atenção', 'Selecione um talhão primeiro.');
                  return;
                }
                setShowPointPicker(true);
              }}
              accessible
              accessibilityLabel={
                monitoringPointCode
                  ? `Ponto: ${monitoringPointCode}. Toque para alterar`
                  : 'Selecionar ponto de monitoramento'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !monitoringPointCode && styles.pickerPlaceholder]}>
                {monitoringPointCode ?? 'Selecione o ponto'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          </View>

          {/* Pest picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Praga / Doença <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable
              style={[styles.pickerButton, pestId && styles.pickerButtonActive]}
              onPress={() => setShowPestPicker(true)}
              accessible
              accessibilityLabel={
                pestName ? `Praga: ${pestName}. Toque para alterar` : 'Selecionar praga ou doença'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !pestName && styles.pickerPlaceholder]}>
                {pestName ?? 'Selecione a praga'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          </View>

          {/* Infestation level */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Nível de infestação <Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.levelRow}>
              {INFESTATION_LEVELS.map((level) => {
                const isSelected = infestationLevel === level.value;
                return (
                  <Pressable
                    key={level.value}
                    style={[
                      styles.levelChip,
                      {
                        backgroundColor: isSelected ? level.color + '20' : colors.neutral[0],
                        borderColor: isSelected ? level.color : colors.neutral[300],
                      },
                    ]}
                    onPress={() => handleSelectLevel(level.value)}
                    accessible
                    accessibilityLabel={`Nível ${level.label}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                  >
                    <Text
                      style={[
                        styles.levelChipText,
                        { color: isSelected ? level.color : colors.neutral[600] },
                      ]}
                    >
                      {level.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Sample count + pest count in a row */}
          <View style={{ flexDirection: 'row', gap: spacing[3] }}>
            <View style={[styles.fieldContainer, { flex: 1 }]}>
              <Text style={styles.label}>Amostras</Text>
              <TextInput
                style={styles.textInput}
                value={sampleCount}
                onChangeText={setSampleCount}
                placeholder="Qtd."
                placeholderTextColor={colors.neutral[400]}
                keyboardType="number-pad"
                accessible
                accessibilityLabel="Quantidade de amostras"
              />
            </View>
            <View style={[styles.fieldContainer, { flex: 1 }]}>
              <Text style={styles.label}>Contagem</Text>
              <TextInput
                style={styles.textInput}
                value={pestCount}
                onChangeText={setPestCount}
                placeholder="Indivíduos"
                placeholderTextColor={colors.neutral[400]}
                keyboardType="number-pad"
                accessible
                accessibilityLabel="Contagem de indivíduos da praga"
              />
            </View>
          </View>

          {/* Damage percentage */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Dano estimado (%)</Text>
            <TextInput
              style={styles.textInput}
              value={damagePercentage}
              onChangeText={setDamagePercentage}
              placeholder="Ex: 15.5"
              placeholderTextColor={colors.neutral[400]}
              keyboardType="decimal-pad"
              accessible
              accessibilityLabel="Percentual de dano estimado"
            />
          </View>

          {/* Growth stage */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Estádio fenológico</Text>
            <Pressable
              style={[styles.pickerButton, growthStage && styles.pickerButtonActive]}
              onPress={() => setShowStagePicker(true)}
              accessible
              accessibilityLabel={
                growthStage
                  ? `Estádio: ${growthStage}. Toque para alterar`
                  : 'Selecionar estádio fenológico'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !growthStage && styles.pickerPlaceholder]}>
                {growthStage ?? 'Selecione o estádio'}
              </Text>
              <Leaf size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          </View>

          {/* Natural enemies */}
          <View style={styles.fieldContainer}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Presença de inimigos naturais</Text>
              <Switch
                value={hasNaturalEnemies}
                onValueChange={setHasNaturalEnemies}
                trackColor={{ false: colors.neutral[300], true: colors.primary[300] }}
                thumbColor={hasNaturalEnemies ? colors.primary[600] : colors.neutral[0]}
                accessible
                accessibilityLabel="Inimigos naturais presentes"
                accessibilityRole="switch"
              />
            </View>
            {hasNaturalEnemies && (
              <TextInput
                style={[styles.textInput, { marginTop: spacing[2] }]}
                value={naturalEnemiesDesc}
                onChangeText={setNaturalEnemiesDesc}
                placeholder="Descreva os inimigos naturais encontrados..."
                placeholderTextColor={colors.neutral[400]}
                multiline
                numberOfLines={2}
                accessible
                accessibilityLabel="Descrição dos inimigos naturais"
              />
            )}
          </View>

          {/* Date/time */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Data e hora</Text>
            <View
              style={styles.dateTimeRow}
              accessibilityLabel={`Data e hora: ${formatDateTime(observedAt)}`}
            >
              <Clock size={16} color={colors.neutral[500]} aria-hidden />
              <Text style={styles.dateTimeText}>{formatDateTime(observedAt)}</Text>
            </View>
          </View>

          {/* GPS coordinates */}
          {userCoords && (
            <View style={styles.gpsRow}>
              <MapPin size={12} color={colors.neutral[400]} aria-hidden />
              <Text style={styles.gpsText}>
                {userCoords.latitude.toFixed(6)}, {userCoords.longitude.toFixed(6)}
              </Text>
            </View>
          )}

          {/* Photo capture */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Foto</Text>
            {photoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                  accessibilityLabel="Foto do monitoramento capturada"
                />
                <View style={styles.photoActions}>
                  <Pressable
                    style={({ pressed }) => [styles.photoActionButton, pressed && { opacity: 0.7 }]}
                    onPress={handleTakePhoto}
                    accessible
                    accessibilityLabel="Tirar outra foto"
                    accessibilityRole="button"
                  >
                    <Camera size={16} color={colors.primary[600]} aria-hidden />
                    <Text style={styles.retakeText}>Tirar outra</Text>
                  </Pressable>
                  <Pressable
                    style={({ pressed }) => [styles.photoActionButton, pressed && { opacity: 0.7 }]}
                    onPress={handleRemovePhoto}
                    accessible
                    accessibilityLabel="Remover foto"
                    accessibilityRole="button"
                  >
                    <Trash2 size={16} color={colors.error[500]} aria-hidden />
                    <Text style={styles.removeText}>Remover</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.photoButton, pressed && { opacity: 0.85 }]}
                onPress={handleTakePhoto}
                accessible
                accessibilityLabel="Tirar foto do monitoramento"
                accessibilityRole="button"
              >
                <Camera size={24} color={colors.neutral[400]} aria-hidden />
                <Text style={styles.photoButtonText}>Tirar foto</Text>
              </Pressable>
            )}
          </View>

          {/* Notes */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Condições climáticas, detalhes da praga..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessible
              accessibilityLabel="Observações"
            />
          </View>

          {/* Submit button */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              !isFormValid && styles.submitButtonDisabled,
              pressed && isFormValid && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleSave}
            disabled={!isFormValid || isSaving}
            accessible
            accessibilityLabel="Salvar registro de monitoramento"
            accessibilityRole="button"
            accessibilityState={{ disabled: !isFormValid || isSaving }}
          >
            <Check size={20} color={colors.neutral[0]} aria-hidden />
            <Text style={styles.submitButtonText}>
              {isSaving ? 'Salvando...' : 'Salvar monitoramento'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Plot picker modal ──────────────────────────────────────────── */}
      <Modal
        visible={showPlotPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPlotPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPlotPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Selecionar talhão
              </Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowPlotPicker(false)}
                accessible
                accessibilityLabel="Fechar seleção de talhão"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[500]} />
              </Pressable>
            </View>
            {plots.length === 0 ? (
              <View style={{ padding: spacing[8], alignItems: 'center' }}>
                <AlertTriangle size={48} color={colors.neutral[300]} aria-hidden />
                <Text style={styles.emptyTitle}>Nenhum talhão disponível</Text>
                <Text style={styles.emptyDesc}>
                  Sincronize os dados da fazenda para ver os talhões.
                </Text>
              </View>
            ) : (
              <FlatList
                data={plots}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.modalItem, fieldPlotId === item.id && styles.modalItemSelected]}
                    onPress={() => handleSelectPlot(item)}
                    accessible
                    accessibilityLabel={`Talhão ${item.name}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: fieldPlotId === item.id }}
                  >
                    <View>
                      <Text style={styles.modalItemText}>{item.name}</Text>
                      {item.current_crop && (
                        <Text style={styles.modalItemSubtext}>{item.current_crop}</Text>
                      )}
                    </View>
                    {fieldPlotId === item.id && <Check size={20} color={colors.primary[600]} />}
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Monitoring point picker modal ──────────────────────────────── */}
      <Modal
        visible={showPointPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPointPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowPointPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Ponto de monitoramento
              </Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowPointPicker(false)}
                accessible
                accessibilityLabel="Fechar seleção de ponto"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[500]} />
              </Pressable>
            </View>
            {monitoringPoints.length === 0 ? (
              <View style={{ padding: spacing[8], alignItems: 'center' }}>
                <MapPin size={48} color={colors.neutral[300]} aria-hidden />
                <Text style={styles.emptyTitle}>Nenhum ponto configurado</Text>
                <Text style={styles.emptyDesc}>
                  Configure pontos de monitoramento no web para este talhão.
                </Text>
              </View>
            ) : (
              <FlatList
                data={monitoringPoints}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={[
                      styles.modalItem,
                      monitoringPointId === item.id && styles.modalItemSelected,
                    ]}
                    onPress={() => handleSelectPoint(item)}
                    accessible
                    accessibilityLabel={`Ponto ${item.code}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: monitoringPointId === item.id }}
                  >
                    <View>
                      <Text style={styles.modalItemText}>{item.code}</Text>
                      <Text style={styles.modalItemSubtext}>
                        {item.latitude.toFixed(6)}, {item.longitude.toFixed(6)}
                      </Text>
                    </View>
                    {monitoringPointId === item.id && (
                      <Check size={20} color={colors.primary[600]} />
                    )}
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Pest picker modal ──────────────────────────────────────────── */}
      <Modal
        visible={showPestPicker}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowPestPicker(false);
          setPestSearch('');
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowPestPicker(false);
            setPestSearch('');
          }}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Selecionar praga
              </Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => {
                  setShowPestPicker(false);
                  setPestSearch('');
                }}
                accessible
                accessibilityLabel="Fechar seleção de praga"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[500]} />
              </Pressable>
            </View>
            <View style={styles.modalSearchContainer}>
              <View style={styles.modalSearchInput}>
                <Search size={16} color={colors.neutral[400]} aria-hidden />
                <TextInput
                  style={styles.modalSearchText}
                  value={pestSearch}
                  onChangeText={setPestSearch}
                  placeholder="Buscar praga..."
                  placeholderTextColor={colors.neutral[400]}
                  autoFocus
                  accessible
                  accessibilityLabel="Buscar praga por nome"
                />
              </View>
            </View>
            {pests.length === 0 ? (
              <View style={{ padding: spacing[8], alignItems: 'center' }}>
                <Bug size={48} color={colors.neutral[300]} aria-hidden />
                <Text style={styles.emptyTitle}>Nenhuma praga encontrada</Text>
                <Text style={styles.emptyDesc}>
                  {pestSearch
                    ? 'Tente outro termo de busca.'
                    : 'Sincronize os dados para carregar a biblioteca de pragas.'}
                </Text>
              </View>
            ) : (
              <FlatList
                data={pests}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.modalItem, pestId === item.id && styles.modalItemSelected]}
                    onPress={() => handleSelectPest(item)}
                    accessible
                    accessibilityLabel={`${item.common_name}, ${item.category}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: pestId === item.id }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.modalItemText}>{item.common_name}</Text>
                      <Text style={styles.modalItemSubtext}>
                        {item.scientific_name ? `${item.scientific_name} · ` : ''}
                        {item.category}
                      </Text>
                    </View>
                    {pestId === item.id && <Check size={20} color={colors.primary[600]} />}
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Growth stage picker modal ──────────────────────────────────── */}
      <Modal
        visible={showStagePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowStagePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowStagePicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Estádio fenológico
              </Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowStagePicker(false)}
                accessible
                accessibilityLabel="Fechar seleção de estádio"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[500]} />
              </Pressable>
            </View>
            <View style={{ padding: spacing[4] }}>
              <View style={styles.stageRow}>
                {GROWTH_STAGES.map((stage) => {
                  const isSelected = growthStage === stage;
                  return (
                    <Pressable
                      key={stage}
                      style={[
                        styles.stageChip,
                        {
                          backgroundColor: isSelected ? colors.primary[50] : colors.neutral[0],
                          borderColor: isSelected ? colors.primary[500] : colors.neutral[300],
                        },
                      ]}
                      onPress={() => {
                        setGrowthStage(stage);
                        setShowStagePicker(false);
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }}
                      accessible
                      accessibilityLabel={`Estádio ${stage}`}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                    >
                      <Text
                        style={[
                          styles.stageChipText,
                          { color: isSelected ? colors.primary[600] : colors.neutral[600] },
                        ]}
                      >
                        {stage}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
