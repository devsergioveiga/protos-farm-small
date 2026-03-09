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
  ArrowLeft,
  MapPin,
  Clock,
  ChevronDown,
  Check,
  Camera,
  X,
  Crosshair,
  WifiOff,
  Map as MapIcon,
  Trash2,
  Shield,
  Thermometer,
  Droplets,
  Wind,
  AlertTriangle,
} from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { useConnectivity } from '@/stores/ConnectivityContext';
import { createFieldPlotRepository, createPesticideApplicationRepository } from '@/services/db';
import { LocationMapPicker, type MapPickerResult } from '@/components/register/LocationMapPicker';
import { createOfflineQueue } from '@/services/offline-queue';
import type { ThemeColors } from '@/stores/ThemeContext';
import type { OfflineFieldPlot } from '@/types/offline';

// ─── Constants ──────────────────────────────────────────────────────────────

const PESTICIDE_TARGETS = [
  { value: 'PRAGA', label: 'Praga' },
  { value: 'DOENCA', label: 'Doença' },
  { value: 'PLANTA_DANINHA', label: 'Planta daninha' },
] as const;

const DOSE_UNITS = [
  { value: 'L_HA', label: 'L/ha' },
  { value: 'KG_HA', label: 'kg/ha' },
  { value: 'ML_HA', label: 'mL/ha' },
  { value: 'G_HA', label: 'g/ha' },
] as const;

// ─── Helpers ────────────────────────────────────────────────────────────────

interface LatLng {
  latitude: number;
  longitude: number;
}

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

// ─── Plot item ──────────────────────────────────────────────────────────────

interface PlotItem {
  id: string;
  name: string;
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
    marginBottom: spacing[1],
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 8,
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
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[700],
    marginTop: spacing[2],
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
  textInputMultiline: { minHeight: 80, textAlignVertical: 'top' as const },
  row: {
    flexDirection: 'row' as const,
    gap: spacing[3],
  },
  halfField: { flex: 1 as const },
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
  envAlert: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.warning[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 8,
    marginTop: spacing[1],
  },
  envAlertText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.warning[500],
    flex: 1 as const,
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
});

// ─── Component ──────────────────────────────────────────────────────────────

export default function PesticideApplicationScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { selectedFarmId, selectedFarm } = useFarmContext();
  const { isConnected } = useConnectivity();

  // Form state — required fields
  const [fieldPlotId, setFieldPlotId] = useState<string | null>(null);
  const [fieldPlotName, setFieldPlotName] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [activeIngredient, setActiveIngredient] = useState('');
  const [dose, setDose] = useState('');
  const [doseUnit, setDoseUnit] = useState('L_HA');
  const [sprayVolume, setSprayVolume] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const [targetDescription, setTargetDescription] = useState('');

  // Prescription
  const [artNumber, setArtNumber] = useState('');
  const [agronomistCrea, setAgronomistCrea] = useState('');
  const [technicalJustification, setTechnicalJustification] = useState('');

  // Environmental conditions
  const [temperature, setTemperature] = useState('');
  const [relativeHumidity, setRelativeHumidity] = useState('');
  const [windSpeed, setWindSpeed] = useState('');

  // Withdrawal period
  const [withdrawalPeriodDays, setWithdrawalPeriodDays] = useState('');

  // Notes + photo
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [recordedAt] = useState(() => new Date());
  const [isSaving, setIsSaving] = useState(false);

  // GPS state
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [gpsDetectedPlot, setGpsDetectedPlot] = useState<string | null>(null);

  // Picker modals
  const [showPlotPicker, setShowPlotPicker] = useState(false);
  const [showTargetPicker, setShowTargetPicker] = useState(false);
  const [showDoseUnitPicker, setShowDoseUnitPicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // Plot data from offline DB
  const [plots, setPlots] = useState<PlotItem[]>([]);

  // Load field plots
  useEffect(() => {
    if (!selectedFarmId) return;
    async function loadPlots() {
      const plotRepo = createFieldPlotRepository(db);
      const items = await plotRepo.getByFarmId(selectedFarmId!);
      setPlots(items.map((p: OfflineFieldPlot) => ({ id: p.id, name: p.name })));
    }
    void loadPlots();
  }, [db, selectedFarmId]);

  // Request GPS and auto-detect plot
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

      if (!selectedFarmId) return;
      const plotRepo = createFieldPlotRepository(db);
      const allPlots = await plotRepo.getByFarmId(selectedFarmId);

      for (const p of allPlots) {
        const polygon = parseGeoJSONToCoords(
          (p as OfflineFieldPlot & { boundary_geojson: string | null }).boundary_geojson,
        );
        if (polygon && pointInPolygon(coords, polygon)) {
          if (!cancelled) {
            setFieldPlotId(p.id);
            setFieldPlotName(p.name);
            setGpsDetectedPlot(p.name);
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

  // Environment condition warnings
  const tempVal = parseFloat(temperature);
  const humidityVal = parseFloat(relativeHumidity);
  const windVal = parseFloat(windSpeed);
  const envWarnings: string[] = [];
  if (!isNaN(tempVal) && tempVal > 30) envWarnings.push(`Temperatura alta (${tempVal}°C > 30°C)`);
  if (!isNaN(humidityVal) && humidityVal < 55)
    envWarnings.push(`Umidade baixa (${humidityVal}% < 55%)`);
  if (!isNaN(windVal) && windVal > 10) envWarnings.push(`Vento forte (${windVal} km/h > 10 km/h)`);

  const isFormValid =
    fieldPlotId !== null &&
    productName.trim().length > 0 &&
    activeIngredient.trim().length > 0 &&
    parseFloat(dose) > 0 &&
    parseFloat(sprayVolume) > 0 &&
    target !== null &&
    selectedFarmId !== null;

  const handleSave = useCallback(async () => {
    if (!isFormValid || !selectedFarmId || isSaving) return;
    setIsSaving(true);

    try {
      const appRepo = createPesticideApplicationRepository(db);
      const queue = createOfflineQueue(db);
      const now = new Date().toISOString();
      const appId = generateId();

      await appRepo.create({
        id: appId,
        farm_id: selectedFarmId,
        field_plot_id: fieldPlotId!,
        field_plot_name: fieldPlotName ?? '',
        applied_at: recordedAt.toISOString(),
        product_name: productName.trim(),
        active_ingredient: activeIngredient.trim(),
        dose: parseFloat(dose),
        dose_unit: doseUnit,
        spray_volume: parseFloat(sprayVolume),
        target: target!,
        target_description: targetDescription.trim() || null,
        art_number: artNumber.trim() || null,
        agronomist_crea: agronomistCrea.trim() || null,
        technical_justification: technicalJustification.trim() || null,
        temperature: temperature ? parseFloat(temperature) : null,
        relative_humidity: relativeHumidity ? parseFloat(relativeHumidity) : null,
        wind_speed: windSpeed ? parseFloat(windSpeed) : null,
        withdrawal_period_days: withdrawalPeriodDays ? parseInt(withdrawalPeriodDays, 10) : null,
        notes: notes.trim() || null,
        photo_uri: photoUri,
        latitude: userCoords?.latitude ?? null,
        longitude: userCoords?.longitude ?? null,
        synced: 0,
        created_at: now,
        updated_at: now,
      });

      // Enqueue for backend sync
      await queue.enqueue(
        'pesticide_applications',
        appId,
        'CREATE',
        {
          id: appId,
          fieldPlotId: fieldPlotId!,
          appliedAt: recordedAt.toISOString(),
          productName: productName.trim(),
          activeIngredient: activeIngredient.trim(),
          dose: parseFloat(dose),
          doseUnit,
          sprayVolume: parseFloat(sprayVolume),
          target: target!,
          targetDescription: targetDescription.trim() || null,
          artNumber: artNumber.trim() || null,
          agronomistCrea: agronomistCrea.trim() || null,
          technicalJustification: technicalJustification.trim() || null,
          temperature: temperature ? parseFloat(temperature) : null,
          relativeHumidity: relativeHumidity ? parseFloat(relativeHumidity) : null,
          windSpeed: windSpeed ? parseFloat(windSpeed) : null,
          withdrawalPeriodDays: withdrawalPeriodDays ? parseInt(withdrawalPeriodDays, 10) : null,
          notes: notes.trim() || null,
          photoUrl: photoUri,
          latitude: userCoords?.latitude ?? null,
          longitude: userCoords?.longitude ?? null,
        },
        `/org/farms/${selectedFarmId}/pesticide-applications`,
        'POST',
      );

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      Alert.alert('Aplicação registrada', 'Registro de defensivo salvo com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
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
    fieldPlotName,
    recordedAt,
    productName,
    activeIngredient,
    dose,
    doseUnit,
    sprayVolume,
    target,
    targetDescription,
    artNumber,
    agronomistCrea,
    technicalJustification,
    temperature,
    relativeHumidity,
    windSpeed,
    withdrawalPeriodDays,
    notes,
    photoUri,
    userCoords,
    router,
  ]);

  const handleSelectPlot = useCallback((item: PlotItem) => {
    setFieldPlotId(item.id);
    setFieldPlotName(item.name);
    setGpsDetectedPlot(null);
    setShowPlotPicker(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleMapSelect = useCallback((result: MapPickerResult) => {
    if (result.type === 'PLOT') {
      setFieldPlotId(result.id);
      setFieldPlotName(result.name);
      setGpsDetectedPlot(null);
    }
    setShowMapPicker(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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

  if (!selectedFarmId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View
          style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing[8] }}
        >
          <Shield size={64} color={colors.neutral[300]} aria-hidden />
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
            Para registrar aplicação de defensivo, primeiro selecione uma fazenda.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const selectedTargetLabel = target
    ? PESTICIDE_TARGETS.find((t) => t.value === target)?.label
    : null;
  const selectedDoseUnitLabel = DOSE_UNITS.find((u) => u.value === doseUnit)?.label ?? 'L/ha';

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
              Aplicação de defensivo
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

          {/* Farm info + date */}
          <View style={styles.dateTimeRow}>
            <MapPin size={16} color={colors.neutral[500]} aria-hidden />
            <Text style={styles.dateTimeText}>{selectedFarm?.name ?? 'Fazenda'}</Text>
          </View>
          <View
            style={styles.dateTimeRow}
            accessibilityLabel={`Data e hora: ${formatDateTime(recordedAt)}`}
          >
            <Clock size={16} color={colors.neutral[500]} aria-hidden />
            <Text style={styles.dateTimeText}>{formatDateTime(recordedAt)}</Text>
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

          {/* ─── Talhão (required) ──────────────────────────────────────── */}
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
            <Pressable
              style={({ pressed }) => [styles.mapPickerButton, pressed && { opacity: 0.85 }]}
              onPress={() => setShowMapPicker(true)}
              accessible
              accessibilityLabel="Selecionar talhão no mapa"
              accessibilityRole="button"
            >
              <MapIcon size={16} color={colors.primary[600]} aria-hidden />
              <Text style={styles.mapPickerText}>Selecionar no mapa</Text>
            </Pressable>
            {gpsDetectedPlot && (
              <View style={styles.gpsRow}>
                <Crosshair size={12} color={colors.primary[600]} aria-hidden />
                <Text style={styles.gpsDetected}>Detectado por GPS</Text>
              </View>
            )}
          </View>

          {/* ─── Produto ─────────────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Produto</Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Produto comercial <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={productName}
              onChangeText={setProductName}
              placeholder="Ex: Roundup Original"
              placeholderTextColor={colors.neutral[400]}
              accessible
              accessibilityLabel="Produto comercial"
            />
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Ingrediente ativo <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={activeIngredient}
              onChangeText={setActiveIngredient}
              placeholder="Ex: Glifosato"
              placeholderTextColor={colors.neutral[400]}
              accessible
              accessibilityLabel="Ingrediente ativo"
            />
          </View>

          {/* Target */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Alvo <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable
              style={[styles.pickerButton, target && styles.pickerButtonActive]}
              onPress={() => setShowTargetPicker(true)}
              accessible
              accessibilityLabel={
                selectedTargetLabel
                  ? `Alvo: ${selectedTargetLabel}. Toque para alterar`
                  : 'Selecionar alvo'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !target && styles.pickerPlaceholder]}>
                {selectedTargetLabel ?? 'Selecione o alvo'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Descrição do alvo</Text>
            <TextInput
              style={styles.textInput}
              value={targetDescription}
              onChangeText={setTargetDescription}
              placeholder="Ex: Lagarta do cartucho"
              placeholderTextColor={colors.neutral[400]}
              accessible
              accessibilityLabel="Descrição do alvo"
            />
          </View>

          {/* ─── Dose ────────────────────────────────────────────────────── */}
          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>
                Dose <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={dose}
                onChangeText={setDose}
                placeholder="0,00"
                placeholderTextColor={colors.neutral[400]}
                keyboardType="decimal-pad"
                accessible
                accessibilityLabel="Dose"
              />
            </View>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Unidade</Text>
              <Pressable
                style={styles.pickerButton}
                onPress={() => setShowDoseUnitPicker(true)}
                accessible
                accessibilityLabel={`Unidade: ${selectedDoseUnitLabel}`}
                accessibilityRole="button"
              >
                <Text style={styles.pickerText}>{selectedDoseUnitLabel}</Text>
                <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
              </Pressable>
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Volume de calda (L/ha) <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={sprayVolume}
              onChangeText={setSprayVolume}
              placeholder="0,00"
              placeholderTextColor={colors.neutral[400]}
              keyboardType="decimal-pad"
              accessible
              accessibilityLabel="Volume de calda em litros por hectare"
            />
          </View>

          {/* ─── Receituário ─────────────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Receituário agronômico</Text>

          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>ART</Text>
              <TextInput
                style={styles.textInput}
                value={artNumber}
                onChangeText={setArtNumber}
                placeholder="Nº ART"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Número da ART"
              />
            </View>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>CREA</Text>
              <TextInput
                style={styles.textInput}
                value={agronomistCrea}
                onChangeText={setAgronomistCrea}
                placeholder="CREA"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="CREA do agrônomo"
              />
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Justificativa técnica</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              value={technicalJustification}
              onChangeText={setTechnicalJustification}
              placeholder="Justificativa da aplicação..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              accessible
              accessibilityLabel="Justificativa técnica"
            />
          </View>

          {/* ─── Condições ambientais ────────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Condições da aplicação</Text>

          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>
                <Thermometer size={12} color={colors.neutral[600]} aria-hidden /> Temp (°C)
              </Text>
              <TextInput
                style={styles.textInput}
                value={temperature}
                onChangeText={setTemperature}
                placeholder="25"
                placeholderTextColor={colors.neutral[400]}
                keyboardType="decimal-pad"
                accessible
                accessibilityLabel="Temperatura em graus Celsius"
              />
            </View>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>
                <Droplets size={12} color={colors.neutral[600]} aria-hidden /> Umid. (%)
              </Text>
              <TextInput
                style={styles.textInput}
                value={relativeHumidity}
                onChangeText={setRelativeHumidity}
                placeholder="60"
                placeholderTextColor={colors.neutral[400]}
                keyboardType="decimal-pad"
                accessible
                accessibilityLabel="Umidade relativa em porcentagem"
              />
            </View>
          </View>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              <Wind size={12} color={colors.neutral[600]} aria-hidden /> Vento (km/h)
            </Text>
            <TextInput
              style={styles.textInput}
              value={windSpeed}
              onChangeText={setWindSpeed}
              placeholder="5"
              placeholderTextColor={colors.neutral[400]}
              keyboardType="decimal-pad"
              accessible
              accessibilityLabel="Velocidade do vento em quilômetros por hora"
            />
          </View>

          {envWarnings.length > 0 && (
            <View style={styles.envAlert} accessibilityRole="alert">
              <AlertTriangle size={16} color={colors.warning[500]} aria-hidden />
              <Text style={styles.envAlertText}>{envWarnings.join(' • ')}</Text>
            </View>
          )}

          {/* ─── Carência ────────────────────────────────────────────────── */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Período de carência (dias)</Text>
            <TextInput
              style={styles.textInput}
              value={withdrawalPeriodDays}
              onChangeText={setWithdrawalPeriodDays}
              placeholder="Ex: 14"
              placeholderTextColor={colors.neutral[400]}
              keyboardType="number-pad"
              accessible
              accessibilityLabel="Período de carência em dias"
            />
          </View>

          {/* ─── Observações ─────────────────────────────────────────────── */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Observações adicionais..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              accessible
              accessibilityLabel="Observações"
            />
          </View>

          {/* ─── Foto ────────────────────────────────────────────────────── */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Foto da aplicação</Text>
            {photoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoPreview}
                  resizeMode="cover"
                  accessibilityLabel="Foto da aplicação capturada"
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
                accessibilityLabel="Tirar foto da aplicação"
                accessibilityRole="button"
              >
                <Camera size={24} color={colors.neutral[400]} aria-hidden />
                <Text style={styles.photoButtonText}>Tirar foto</Text>
              </Pressable>
            )}
          </View>

          {/* ─── Submit ──────────────────────────────────────────────────── */}
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              !isFormValid && styles.submitButtonDisabled,
              pressed && isFormValid && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
            onPress={handleSave}
            disabled={!isFormValid || isSaving}
            accessible
            accessibilityLabel="Salvar aplicação de defensivo"
            accessibilityRole="button"
            accessibilityState={{ disabled: !isFormValid || isSaving }}
          >
            <Check size={20} color={colors.neutral[0]} aria-hidden />
            <Text style={styles.submitButtonText}>
              {isSaving ? 'Salvando...' : 'Salvar aplicação'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ─── Plot picker modal ─────────────────────────────────────────── */}
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
                  Nenhum talhão disponível
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
                    accessibilityLabel={item.name}
                    accessibilityRole="button"
                    accessibilityState={{ selected: fieldPlotId === item.id }}
                  >
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    {fieldPlotId === item.id && <Check size={20} color={colors.primary[600]} />}
                  </Pressable>
                )}
              />
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Target picker modal ───────────────────────────────────────── */}
      <Modal
        visible={showTargetPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTargetPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowTargetPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Selecionar alvo
              </Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowTargetPicker(false)}
                accessible
                accessibilityLabel="Fechar seleção de alvo"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[500]} />
              </Pressable>
            </View>
            <FlatList
              data={PESTICIDE_TARGETS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.modalItem, target === item.value && styles.modalItemSelected]}
                  onPress={() => {
                    setTarget(item.value);
                    setShowTargetPicker(false);
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  accessible
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: target === item.value }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {target === item.value && <Check size={20} color={colors.primary[600]} />}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Dose unit picker modal ────────────────────────────────────── */}
      <Modal
        visible={showDoseUnitPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDoseUnitPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDoseUnitPicker(false)}>
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} accessibilityRole="header">
                Unidade de dose
              </Text>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setShowDoseUnitPicker(false)}
                accessible
                accessibilityLabel="Fechar seleção de unidade"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[500]} />
              </Pressable>
            </View>
            <FlatList
              data={DOSE_UNITS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.modalItem, doseUnit === item.value && styles.modalItemSelected]}
                  onPress={() => {
                    setDoseUnit(item.value);
                    setShowDoseUnitPicker(false);
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  accessible
                  accessibilityLabel={item.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: doseUnit === item.value }}
                >
                  <Text style={styles.modalItemText}>{item.label}</Text>
                  {doseUnit === item.value && <Check size={20} color={colors.primary[600]} />}
                </Pressable>
              )}
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Map picker modal ──────────────────────────────────────────── */}
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
