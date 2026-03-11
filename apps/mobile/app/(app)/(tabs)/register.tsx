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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  PlusCircle,
  MapPin,
  Clock,
  ChevronDown,
  Check,
  Camera,
  FileText,
  X,
  Crosshair,
  WifiOff,
  Map as MapIcon,
  Trash2,
  Bookmark,
  Zap,
} from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { useConnectivity } from '@/stores/ConnectivityContext';
import {
  createFieldPlotRepository,
  createFarmLocationRepository,
  createOperationRepository,
  createTemplateRepository,
} from '@/services/db';
import { LocationMapPicker, type MapPickerResult } from '@/components/register/LocationMapPicker';
import { createOfflineQueue } from '@/services/offline-queue';
import type { ThemeColors } from '@/stores/ThemeContext';
import type {
  FieldOperationType,
  FieldOperationLocationType,
  OfflineFieldPlot,
  OfflineFarmLocation,
  OfflineOperationTemplate,
} from '@/types/offline';

// ─── Operation type labels ──────────────────────────────────────────────────

type ExtendedOperationType = FieldOperationType | 'MONITORAMENTO_MIP';

const OPERATION_TYPES: { value: ExtendedOperationType; label: string }[] = [
  { value: 'MONITORAMENTO_MIP', label: 'Monitoramento MIP' },
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

// ─── Location item (unified plots + pastures + facilities) ──────────────────

interface LocationItem {
  id: string;
  name: string;
  type: FieldOperationLocationType;
  typeLabel: string;
}

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

// ─── GeoJSON point-in-polygon for GPS auto-detect ──────────────────────────

interface LatLng {
  latitude: number;
  longitude: number;
}

function parseGeoJSONToCoords(geojsonStr: string | null): LatLng[] | null {
  if (!geojsonStr) return null;
  try {
    const geojson = JSON.parse(geojsonStr);
    const ring = geojson.coordinates?.[0];
    if (!ring || !Array.isArray(ring)) return null;
    return ring.map(([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng }));
  } catch {
    return null;
  }
}

function pointInPolygon(point: LatLng, polygon: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].latitude;
    const yi = polygon[i].longitude;
    const xj = polygon[j].latitude;
    const yj = polygon[j].longitude;
    const intersect =
      yi > point.longitude !== yj > point.longitude &&
      point.latitude < ((xj - xi) * (point.longitude - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => ({
  safeArea: { flex: 1 as const, backgroundColor: c.neutral[50] },
  container: { flex: 1 as const },
  scrollContent: { padding: spacing[4], paddingBottom: spacing[10], gap: spacing[4] },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    marginBottom: spacing[2],
  },
  headerTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.xl,
    color: c.neutral[700],
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
  gpsDetected: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.xs,
    color: c.primary[600],
  },
  mapPickerButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[1],
    minHeight: 36,
  },
  mapPickerText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.primary[600],
  },
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
});

// ─── Component ──────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const { isConnected } = useConnectivity();

  // Form state
  const [operationType, setOperationType] = useState<FieldOperationType | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [locationType, setLocationType] = useState<FieldOperationLocationType | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [recordedAt] = useState(() => new Date());
  const [isSaving, setIsSaving] = useState(false);

  // GPS state
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [gpsDetectedLocation, setGpsDetectedLocation] = useState<string | null>(null);

  // Picker modals
  const [showTypePicker, setShowTypePicker] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Templates
  const [templates, setTemplates] = useState<OfflineOperationTemplate[]>([]);

  // Location data from offline DB
  const [locations, setLocations] = useState<LocationItem[]>([]);

  // Load locations from offline DB
  useEffect(() => {
    if (!selectedFarmId) return;

    async function loadLocations() {
      const plotRepo = createFieldPlotRepository(db);
      const locRepo = createFarmLocationRepository(db);
      const [plots, farmLocs] = await Promise.all([
        plotRepo.getByFarmId(selectedFarmId!),
        locRepo.getByFarmId(selectedFarmId!),
      ]);

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

      // Load templates
      const tplRepo = createTemplateRepository(db);
      const tpls = await tplRepo.getByFarmId(selectedFarmId!);
      setTemplates(tpls);
    }

    void loadLocations();
  }, [db, selectedFarmId]);

  // Request GPS and auto-detect location
  useEffect(() => {
    let cancelled = false;

    async function getLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      if (cancelled) return;

      const coords: LatLng = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserCoords(coords);

      // Auto-detect location from boundaries
      if (!selectedFarmId) return;
      const plotRepo = createFieldPlotRepository(db);
      const locRepo = createFarmLocationRepository(db);
      const [plots, farmLocs] = await Promise.all([
        plotRepo.getByFarmId(selectedFarmId),
        locRepo.getByFarmId(selectedFarmId),
      ]);

      // Check plots
      for (const p of plots) {
        const polygon = parseGeoJSONToCoords(
          (p as OfflineFieldPlot & { boundary_geojson: string | null }).boundary_geojson,
        );
        if (polygon && pointInPolygon(coords, polygon)) {
          if (!cancelled) {
            setLocationId(p.id);
            setLocationType('PLOT');
            setLocationName(p.name);
            setGpsDetectedLocation(p.name);
          }
          return;
        }
      }

      // Check pastures/facilities
      for (const l of farmLocs) {
        const polygon = parseGeoJSONToCoords(
          (l as OfflineFarmLocation & { boundary_geojson: string | null }).boundary_geojson,
        );
        if (polygon && pointInPolygon(coords, polygon)) {
          if (!cancelled) {
            setLocationId(l.id);
            setLocationType(l.type === 'PASTURE' ? 'PASTURE' : 'FACILITY');
            setLocationName(l.name);
            setGpsDetectedLocation(l.name);
          }
          return;
        }
      }
    }

    void getLocation();
    return () => {
      cancelled = true;
    };
  }, [db, selectedFarmId]);

  const isFormValid = operationType !== null && selectedFarmId !== null;

  const handleSave = useCallback(async () => {
    if (!isFormValid || !selectedFarmId || isSaving) return;
    setIsSaving(true);

    try {
      const opRepo = createOperationRepository(db);
      const queue = createOfflineQueue(db);
      const now = new Date().toISOString();
      const opId = generateId();
      await opRepo.create({
        id: opId,
        farm_id: selectedFarmId,
        location_id: locationId,
        location_type: locationType,
        location_name: locationName,
        operation_type: operationType!,
        notes: notes.trim() || null,
        photo_uri: photoUri,
        latitude: userCoords?.latitude ?? null,
        longitude: userCoords?.longitude ?? null,
        recorded_at: recordedAt.toISOString(),
        synced: 0,
        created_at: now,
        updated_at: now,
      });

      // Enqueue for backend sync
      await queue.enqueue(
        'field_operations',
        opId,
        'CREATE',
        {
          id: opId,
          operationType: operationType!,
          locationId,
          locationType,
          locationName,
          notes: notes.trim() || null,
          photoUri,
          latitude: userCoords?.latitude ?? null,
          longitude: userCoords?.longitude ?? null,
          recordedAt: recordedAt.toISOString(),
        },
        `/org/farms/${selectedFarmId}/field-operations`,
        'POST',
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('Operação registrada', 'Registro salvo com sucesso.', [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setOperationType(null);
            setLocationId(null);
            setLocationType(null);
            setLocationName(null);
            setNotes('');
            setPhotoUri(null);
            setGpsDetectedLocation(null);
          },
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
    locationId,
    locationType,
    locationName,
    operationType,
    notes,
    photoUri,
    userCoords,
    recordedAt,
  ]);

  const handleSelectLocation = useCallback((item: LocationItem) => {
    setLocationId(item.id);
    setLocationType(item.type);
    setLocationName(item.name);
    setGpsDetectedLocation(null);
    setShowLocationPicker(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleMapSelect = useCallback((result: MapPickerResult) => {
    setLocationId(result.id);
    setLocationType(result.type);
    setLocationName(result.name);
    setGpsDetectedLocation(null);
    setShowMapPicker(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  const handleSelectType = useCallback(
    (type: ExtendedOperationType) => {
      if (type === 'PULVERIZACAO') {
        setShowTypePicker(false);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/pesticide-application');
        return;
      }
      if (type === 'MONITORAMENTO_MIP') {
        setShowTypePicker(false);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/monitoring-record');
        return;
      }
      if (type === 'PLANTIO') {
        setShowTypePicker(false);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push('/planting-operation');
        return;
      }
      setOperationType(type as FieldOperationType);
      setShowTypePicker(false);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [router],
  );

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

    // If photo has GPS exif and we don't have coords yet, use them
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

  const handleUseTemplate = useCallback(
    (tpl: OfflineOperationTemplate) => {
      setOperationType(tpl.operation_type);
      if (tpl.default_notes) setNotes(tpl.default_notes);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      // Increment usage
      const tplRepo = createTemplateRepository(db);
      void tplRepo.incrementUsage(tpl.id);
    },
    [db],
  );

  const handleSaveAsTemplate = useCallback(async () => {
    if (!operationType || !selectedFarmId) return;
    const typeLabel =
      OPERATION_TYPES.find((t) => t.value === operationType)?.label ?? operationType;
    const tplRepo = createTemplateRepository(db);
    await tplRepo.create({
      id: generateId(),
      farm_id: selectedFarmId,
      name: typeLabel,
      operation_type: operationType,
      default_notes: notes.trim() || null,
      usage_count: 0,
      created_at: new Date().toISOString(),
    });
    const updated = await tplRepo.getByFarmId(selectedFarmId);
    setTemplates(updated);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert('Template salvo', `"${typeLabel}" foi salvo como template.`);
  }, [db, operationType, selectedFarmId, notes]);

  // No farm selected
  if (!selectedFarmId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[8] }}
        >
          <FileText size={64} color={colors.neutral[300]} aria-hidden />
          <Text
            style={{
              fontFamily: 'DMSans_700Bold',
              fontSize: fontSize.lg,
              color: colors.neutral[700],
              marginTop: spacing[4],
              textAlign: 'center',
            }}
            accessibilityRole="header"
          >
            Selecione uma fazenda
          </Text>
          <Text
            style={{
              fontFamily: 'SourceSans3_400Regular',
              fontSize: fontSize.base,
              color: colors.neutral[500],
              textAlign: 'center',
              marginTop: spacing[2],
            }}
          >
            Para registrar operações, primeiro selecione uma fazenda na tela Início.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedTypeLabel = operationType
    ? OPERATION_TYPES.find((t) => t.value === operationType)?.label
    : null;

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
            <PlusCircle size={24} color={colors.primary[600]} aria-hidden />
            <Text style={styles.headerTitle} accessibilityRole="header">
              Registrar operação
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

          {/* Quick team service shortcut */}
          <Pressable
            style={({ pressed }) => [
              {
                flexDirection: 'row' as const,
                alignItems: 'center' as const,
                gap: spacing[3],
                backgroundColor: colors.primary[50],
                borderWidth: 1,
                borderColor: colors.primary[200],
                borderRadius: 12,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
                minHeight: 56,
              },
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/quick-service');
            }}
            accessible
            accessibilityLabel="Serviço rápido da equipe"
            accessibilityHint="Lançar o serviço do dia para sua equipe"
            accessibilityRole="button"
          >
            <Zap size={24} color={colors.primary[600]} />
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: 'DMSans_700Bold',
                  fontSize: fontSize.base,
                  color: colors.primary[700],
                }}
              >
                Serviço rápido da equipe
              </Text>
              <Text
                style={{
                  fontFamily: 'SourceSans3_400Regular',
                  fontSize: fontSize.sm,
                  color: colors.primary[600],
                }}
              >
                Lançar o serviço do dia em menos de 2 min
              </Text>
            </View>
            <ChevronDown
              size={20}
              color={colors.primary[500]}
              style={{ transform: [{ rotate: '-90deg' }] }}
              aria-hidden
            />
          </Pressable>

          {/* Farm info */}
          <View style={styles.dateTimeRow}>
            <MapPin size={16} color={colors.neutral[500]} aria-hidden />
            <Text style={styles.dateTimeText}>{selectedFarm?.name ?? 'Fazenda'}</Text>
          </View>

          {/* Templates (CA5) */}
          {templates.length > 0 && (
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>
                <Zap size={12} color={colors.neutral[600]} aria-hidden /> Atalhos
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: spacing[2] }}
              >
                {templates.map((tpl) => (
                  <Pressable
                    key={tpl.id}
                    style={({ pressed }) => [
                      {
                        backgroundColor:
                          operationType === tpl.operation_type
                            ? colors.primary[50]
                            : colors.neutral[0],
                        borderWidth: 1,
                        borderColor:
                          operationType === tpl.operation_type
                            ? colors.primary[500]
                            : colors.neutral[300],
                        borderRadius: 8,
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        minHeight: 40,
                        justifyContent: 'center' as const,
                      },
                      pressed && { opacity: 0.85 },
                    ]}
                    onPress={() => handleUseTemplate(tpl)}
                    accessible
                    accessibilityLabel={`Usar template ${tpl.name}`}
                    accessibilityRole="button"
                  >
                    <Text
                      style={{
                        fontFamily: 'SourceSans3_600SemiBold',
                        fontSize: fontSize.sm,
                        color:
                          operationType === tpl.operation_type
                            ? colors.primary[600]
                            : colors.neutral[700],
                      }}
                    >
                      {tpl.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Operation type picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Tipo de operação <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable
              style={[styles.pickerButton, operationType && styles.pickerButtonActive]}
              onPress={() => setShowTypePicker(true)}
              accessible
              accessibilityLabel={
                selectedTypeLabel
                  ? `Tipo de operação: ${selectedTypeLabel}. Toque para alterar`
                  : 'Selecionar tipo de operação'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !operationType && styles.pickerPlaceholder]}>
                {selectedTypeLabel ?? 'Selecione o tipo'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          </View>

          {/* Location picker */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Talhão / Pasto</Text>
            <Pressable
              style={[styles.pickerButton, locationId && styles.pickerButtonActive]}
              onPress={() => setShowLocationPicker(true)}
              accessible
              accessibilityLabel={
                locationName
                  ? `Local: ${locationName}. Toque para alterar`
                  : 'Selecionar talhão ou pasto'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !locationName && styles.pickerPlaceholder]}>
                {locationName ?? 'Selecione o local'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.mapPickerButton, pressed && { opacity: 0.85 }]}
              onPress={() => {
                setShowLocationPicker(false);
                setShowMapPicker(true);
              }}
              accessible
              accessibilityLabel="Selecionar local no mapa"
              accessibilityRole="button"
            >
              <MapIcon size={16} color={colors.primary[600]} aria-hidden />
              <Text style={styles.mapPickerText}>Selecionar no mapa</Text>
            </Pressable>
            {gpsDetectedLocation && (
              <View style={styles.gpsRow}>
                <Crosshair size={12} color={colors.primary[600]} aria-hidden />
                <Text style={styles.gpsDetected}>Detectado por GPS</Text>
              </View>
            )}
          </View>

          {/* Date/time (auto-filled, read-only) */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Data e hora</Text>
            <View
              style={styles.dateTimeRow}
              accessibilityLabel={`Data e hora: ${formatDateTime(recordedAt)}`}
            >
              <Clock size={16} color={colors.neutral[500]} aria-hidden />
              <Text style={styles.dateTimeText}>{formatDateTime(recordedAt)}</Text>
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

          {/* Notes */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Adicione observações sobre a operação..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessible
              accessibilityLabel="Observações"
            />
          </View>

          {/* Photo capture (CA3) */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Foto</Text>
            {photoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                  accessibilityLabel="Foto da operação capturada"
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
                accessibilityLabel="Tirar foto da operação"
                accessibilityRole="button"
              >
                <Camera size={24} color={colors.neutral[400]} aria-hidden />
                <Text style={styles.photoButtonText}>Tirar foto</Text>
              </Pressable>
            )}
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
            accessibilityLabel="Salvar registro de operação"
            accessibilityRole="button"
            accessibilityState={{ disabled: !isFormValid || isSaving }}
          >
            <Check size={20} color={colors.neutral[0]} aria-hidden />
            <Text style={styles.submitButtonText}>
              {isSaving ? 'Salvando...' : 'Salvar registro'}
            </Text>
          </Pressable>

          {/* Save as template (CA5) */}
          {operationType && (
            <Pressable
              style={({ pressed }) => [
                {
                  flexDirection: 'row' as const,
                  alignItems: 'center' as const,
                  justifyContent: 'center' as const,
                  gap: spacing[2],
                  paddingVertical: spacing[3],
                  minHeight: 48,
                },
                pressed && { opacity: 0.7 },
              ]}
              onPress={handleSaveAsTemplate}
              accessible
              accessibilityLabel="Salvar como template para uso futuro"
              accessibilityRole="button"
            >
              <Bookmark size={16} color={colors.primary[600]} aria-hidden />
              <Text style={styles.retakeText}>Salvar como atalho</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Operation type picker modal ─────────────────────────────────── */}
      <Modal
        visible={showTypePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTypePicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTypePicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Tipo de operação
              </Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowTypePicker(false)}
                accessible
                accessibilityLabel="Fechar seleção de tipo"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[500]} />
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
                  onPress={() => handleSelectType(item.value)}
                  accessible
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: operationType === item.value }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {operationType === item.value && <Check size={20} color={colors.primary[600]} />}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Location picker modal ───────────────────────────────────────── */}
      <Modal
        visible={showLocationPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLocationPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLocationPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Selecionar local
              </Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowLocationPicker(false)}
                accessible
                accessibilityLabel="Fechar seleção de local"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[500]} />
              </Pressable>
            </View>
            {locations.length === 0 ? (
              <View style={{ padding: spacing[8], alignItems: 'center' }}>
                <MapPin size={48} color={colors.neutral[300]} aria-hidden />
                <Text
                  style={{
                    fontFamily: 'DMSans_700Bold',
                    fontSize: fontSize.base,
                    color: colors.neutral[700],
                    marginTop: spacing[3],
                    textAlign: 'center',
                  }}
                >
                  Nenhum local disponível
                </Text>
                <Text
                  style={{
                    fontFamily: 'SourceSans3_400Regular',
                    fontSize: fontSize.sm,
                    color: colors.neutral[500],
                    marginTop: spacing[1],
                    textAlign: 'center',
                  }}
                >
                  Sincronize os dados da fazenda para ver talhões e pastos.
                </Text>
              </View>
            ) : (
              <FlatList
                data={locations}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.modalItem, locationId === item.id && styles.modalItemSelected]}
                    onPress={() => handleSelectLocation(item)}
                    accessible
                    accessibilityLabel={`${item.name}, ${item.typeLabel}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: locationId === item.id }}
                  >
                    <View>
                      <Text style={styles.modalItemText}>{item.name}</Text>
                      <Text style={styles.modalItemSubtext}>{item.typeLabel}</Text>
                    </View>
                    {locationId === item.id && <Check size={20} color={colors.primary[600]} />}
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Map picker modal (CA2) ──────────────────────────────────────── */}
      <Modal
        visible={showMapPicker}
        animationType="slide"
        onRequestClose={() => setShowMapPicker(false)}
      >
        {selectedFarmId && (
          <LocationMapPicker
            farmId={selectedFarmId}
            onSelect={handleMapSelect}
            onClose={() => setShowMapPicker(false)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}
