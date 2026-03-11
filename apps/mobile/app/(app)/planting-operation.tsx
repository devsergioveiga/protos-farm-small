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
  ChevronDown,
  Check,
  Camera,
  X,
  Crosshair,
  WifiOff,
  Map as MapIcon,
  Trash2,
  Sprout,
  Plus,
  Minus,
  Calendar,
} from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { useConnectivity } from '@/stores/ConnectivityContext';
import {
  createFieldPlotRepository,
  createCultivarRepository,
  createPlantingOperationRepository,
} from '@/services/db';
import { LocationMapPicker, type MapPickerResult } from '@/components/register/LocationMapPicker';
import { createOfflineQueue } from '@/services/offline-queue';
import type { ThemeColors } from '@/stores/ThemeContext';
import type {
  OfflineFieldPlot,
  OfflineCultivar,
  SeasonType,
  SeedTreatmentDoseUnit,
  FertilizerApplicationMode,
} from '@/types/offline';

// ─── Constants ──────────────────────────────────────────────────────────────

const SEASON_TYPES: { value: SeasonType; label: string }[] = [
  { value: 'SAFRA', label: 'Safra' },
  { value: 'SAFRINHA', label: 'Safrinha' },
  { value: 'INVERNO', label: 'Inverno' },
];

const DOSE_UNITS: { value: SeedTreatmentDoseUnit; label: string }[] = [
  { value: 'KG_HA', label: 'kg/ha' },
  { value: 'L_HA', label: 'L/ha' },
  { value: 'ML_100KG', label: 'mL/100kg' },
];

const FERTILIZER_MODES: { value: FertilizerApplicationMode; label: string }[] = [
  { value: 'SULCO', label: 'Sulco' },
  { value: 'LANCO', label: 'A lanço' },
  { value: 'INCORPORADO', label: 'Incorporado' },
];

// ─── Seed treatment / Fertilization types ───────────────────────────────────

interface SeedTreatment {
  productName: string;
  dose: string;
  doseUnit: SeedTreatmentDoseUnit;
  responsibleTechnician: string;
}

interface BaseFertilization {
  formulation: string;
  doseKgHa: string;
  applicationMode: FertilizerApplicationMode;
}

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

function getCurrentSeasonYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // Brazilian season: Aug-Dec is start of new season
  if (month >= 8) return `${year}/${year + 1}`;
  return `${year - 1}/${year}`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
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
  // Photo
  photoButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.neutral[100],
    borderWidth: 1,
    borderColor: c.neutral[300],
    borderStyle: 'dashed' as const,
    borderRadius: 8,
    paddingVertical: spacing[5],
    minHeight: 48,
  },
  photoButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: c.neutral[500],
  },
  photoPreviewContainer: { gap: spacing[2] },
  photoPreview: {
    width: '100%' as const,
    height: 200,
    borderRadius: 8,
  },
  photoActions: {
    flexDirection: 'row' as const,
    gap: spacing[2],
  },
  photoActionButton: {
    flex: 1 as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderRadius: 8,
    minHeight: 40,
  },
  photoActionText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
  },
  // Footer
  footer: {
    padding: spacing[4],
    borderTopWidth: 1,
    borderTopColor: c.neutral[200],
    backgroundColor: c.neutral[0],
  },
  saveBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.primary[600],
    borderRadius: 8,
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[0],
  },
  // Modal
  modalOverlay: {
    flex: 1 as const,
    backgroundColor: 'rgba(0,0,0,0.5)' as const,
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
    borderBottomColor: c.neutral[200],
  },
  modalTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[700],
  },
  modalCloseBtn: {
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
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  modalItemText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
    flex: 1 as const,
  },
  modalItemSubText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
  // Repeating items (seed treatments, fertilizations)
  repeatingCard: {
    backgroundColor: c.neutral[50],
    borderWidth: 1,
    borderColor: c.neutral[200],
    borderRadius: 8,
    padding: spacing[3],
    gap: spacing[2],
  },
  repeatingCardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  repeatingCardTitle: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[600],
  },
  removeButton: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 8,
  },
  addButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderWidth: 1,
    borderColor: c.primary[300],
    borderStyle: 'dashed' as const,
    borderRadius: 8,
    minHeight: 40,
  },
  addButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.primary[600],
  },
  // Cost summary
  costRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing[1],
  },
  costLabel: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[600],
  },
  costValue: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[700],
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingTop: spacing[2],
    borderTopWidth: 1,
    borderTopColor: c.neutral[200],
  },
  totalLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },
  totalValue: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.primary[600],
  },
  emptyFarm: {
    flex: 1 as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[3],
    padding: spacing[8],
  },
  emptyFarmTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[600],
    textAlign: 'center' as const,
  },
  emptyFarmText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[500],
    textAlign: 'center' as const,
  },
});

// ─── Component ──────────────────────────────────────────────────────────────

export default function PlantingOperationScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { selectedFarmId } = useFarmContext();
  const { isConnected } = useConnectivity();

  // ─── State: plots & cultivars ──────────────────────────────────────────
  const [plots, setPlots] = useState<OfflineFieldPlot[]>([]);
  const [cultivars, setCultivars] = useState<OfflineCultivar[]>([]);

  // ─── State: form fields (CA1 — basics) ────────────────────────────────
  const [fieldPlotId, setFieldPlotId] = useState<string | null>(null);
  const [fieldPlotName, setFieldPlotName] = useState<string | null>(null);
  const [cultivarId, setCultivarId] = useState<string | null>(null);
  const [cultivarName, setCultivarName] = useState<string | null>(null);
  const [crop, setCrop] = useState('');
  const [plantingDate] = useState(new Date());
  const [seasonYear, setSeasonYear] = useState(getCurrentSeasonYear());
  const [seasonType, setSeasonType] = useState<SeasonType>('SAFRA');
  const [plantedAreaPercent, setPlantedAreaPercent] = useState('100');

  // ─── State: form fields (CA2 — technical) ─────────────────────────────
  const [populationPerM, setPopulationPerM] = useState('');
  const [rowSpacingCm, setRowSpacingCm] = useState('');
  const [depthCm, setDepthCm] = useState('');
  const [seedRateKgHa, setSeedRateKgHa] = useState('');

  // ─── State: seed treatments (CA3) ─────────────────────────────────────
  const [seedTreatments, setSeedTreatments] = useState<SeedTreatment[]>([]);

  // ─── State: base fertilizations (CA4) ─────────────────────────────────
  const [baseFertilizations, setBaseFertilizations] = useState<BaseFertilization[]>([]);

  // ─── State: machine & operator (CA5) ──────────────────────────────────
  const [machineName, setMachineName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [averageSpeedKmH, setAverageSpeedKmH] = useState('');

  // ─── State: costs (CA8) ───────────────────────────────────────────────
  const [seedCost, setSeedCost] = useState('');
  const [fertilizerCost, setFertilizerCost] = useState('');
  const [treatmentCost, setTreatmentCost] = useState('');
  const [operationCost, setOperationCost] = useState('');

  // ─── State: notes & photo ─────────────────────────────────────────────
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // ─── State: GPS ───────────────────────────────────────────────────────
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);
  const [gpsDetectedPlot, setGpsDetectedPlot] = useState<string | null>(null);

  // ─── State: modals ────────────────────────────────────────────────────
  const [showPlotPicker, setShowPlotPicker] = useState(false);
  const [showCultivarPicker, setShowCultivarPicker] = useState(false);
  const [showSeasonTypePicker, setShowSeasonTypePicker] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  // ─── State: saving ────────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);

  // ─── Load plots & cultivars from offline DB ───────────────────────────
  useEffect(() => {
    if (!selectedFarmId) return;
    void (async () => {
      const plotRepo = createFieldPlotRepository(db);
      const allPlots = await plotRepo.getByFarmId(selectedFarmId);
      setPlots(allPlots.filter((p) => p.status === 'ACTIVE'));

      const cultivarRepo = createCultivarRepository(db);
      const allCultivars = await cultivarRepo.getAll();
      setCultivars(allCultivars);
    })();
  }, [db, selectedFarmId]);

  // ─── GPS auto-detect ──────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function getLocation() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      if (cancelled) return;

      const coords: LatLng = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserCoords(coords);

      // Auto-detect plot from GPS
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

  // ─── Auto-fill crop from cultivar ─────────────────────────────────────
  const handleSelectCultivar = useCallback(
    (c: OfflineCultivar) => {
      setCultivarId(c.id);
      setCultivarName(c.name);
      if (!crop || crop.length === 0) {
        setCrop(c.crop);
      }
      setShowCultivarPicker(false);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [crop],
  );

  // ─── Seed treatments handlers ─────────────────────────────────────────
  const addSeedTreatment = useCallback(() => {
    setSeedTreatments((prev) => [
      ...prev,
      {
        productName: '',
        dose: '',
        doseUnit: 'L_HA' as SeedTreatmentDoseUnit,
        responsibleTechnician: '',
      },
    ]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const removeSeedTreatment = useCallback((index: number) => {
    setSeedTreatments((prev) => prev.filter((_, i) => i !== index));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const updateSeedTreatment = useCallback(
    (index: number, field: keyof SeedTreatment, value: string) => {
      setSeedTreatments((prev) => prev.map((t, i) => (i === index ? { ...t, [field]: value } : t)));
    },
    [],
  );

  // ─── Base fertilizations handlers ─────────────────────────────────────
  const addBaseFertilization = useCallback(() => {
    setBaseFertilizations((prev) => [
      ...prev,
      { formulation: '', doseKgHa: '', applicationMode: 'SULCO' as FertilizerApplicationMode },
    ]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const removeBaseFertilization = useCallback((index: number) => {
    setBaseFertilizations((prev) => prev.filter((_, i) => i !== index));
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const updateBaseFertilization = useCallback(
    (index: number, field: keyof BaseFertilization, value: string) => {
      setBaseFertilizations((prev) =>
        prev.map((f, i) => (i === index ? { ...f, [field]: value } : f)),
      );
    },
    [],
  );

  // ─── Photo handler ────────────────────────────────────────────────────
  const handleTakePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Câmera desabilitada',
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

    // Extract GPS from photo EXIF if not already available
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

  // ─── Map picker handler ───────────────────────────────────────────────
  const handleMapPickerSelect = useCallback((result: MapPickerResult) => {
    setFieldPlotId(result.id);
    setFieldPlotName(result.name);
    setGpsDetectedPlot(null);
    setShowMapPicker(false);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  // ─── Compute total cost ───────────────────────────────────────────────
  const totalCost =
    (parseFloat(seedCost) || 0) +
    (parseFloat(fertilizerCost) || 0) +
    (parseFloat(treatmentCost) || 0) +
    (parseFloat(operationCost) || 0);

  // ─── Validation ───────────────────────────────────────────────────────
  const isFormValid =
    fieldPlotId !== null && crop.trim().length > 0 && seasonYear.trim().length > 0;

  // ─── Save handler ─────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!isFormValid || !selectedFarmId) return;
    setIsSaving(true);

    try {
      const repo = createPlantingOperationRepository(db);
      const appId = generateId();
      const now = new Date().toISOString();
      const dateStr = plantingDate.toISOString().split('T')[0];

      // Build seed treatments for API (validated items only)
      const validTreatments = seedTreatments
        .filter((t) => t.productName.trim() && parseFloat(t.dose) > 0)
        .map((t) => ({
          productName: t.productName.trim(),
          dose: parseFloat(t.dose),
          doseUnit: t.doseUnit,
          responsibleTechnician: t.responsibleTechnician.trim() || null,
        }));

      // Build fertilizations for API (validated items only)
      const validFertilizations = baseFertilizations
        .filter((f) => f.formulation.trim() && parseFloat(f.doseKgHa) > 0)
        .map((f) => ({
          formulation: f.formulation.trim(),
          doseKgHa: parseFloat(f.doseKgHa),
          applicationMode: f.applicationMode,
        }));

      // Save locally
      await repo.create({
        id: appId,
        farm_id: selectedFarmId,
        field_plot_id: fieldPlotId,
        field_plot_name: fieldPlotName ?? '',
        cultivar_id: cultivarId,
        cultivar_name: cultivarName,
        crop: crop.trim(),
        planting_date: dateStr,
        season_year: seasonYear.trim(),
        season_type: seasonType,
        planted_area_percent: parseFloat(plantedAreaPercent) || 100,
        population_per_m: parseFloat(populationPerM) || null,
        row_spacing_cm: parseFloat(rowSpacingCm) || null,
        depth_cm: parseFloat(depthCm) || null,
        seed_rate_kg_ha: parseFloat(seedRateKgHa) || null,
        seed_treatments: validTreatments.length > 0 ? JSON.stringify(validTreatments) : null,
        base_fertilizations:
          validFertilizations.length > 0 ? JSON.stringify(validFertilizations) : null,
        machine_name: machineName.trim() || null,
        operator_name: operatorName.trim() || null,
        average_speed_km_h: parseFloat(averageSpeedKmH) || null,
        seed_cost: parseFloat(seedCost) || null,
        fertilizer_cost: parseFloat(fertilizerCost) || null,
        treatment_cost: parseFloat(treatmentCost) || null,
        operation_cost: parseFloat(operationCost) || null,
        notes: notes.trim() || null,
        photo_uri: photoUri,
        latitude: userCoords?.latitude ?? null,
        longitude: userCoords?.longitude ?? null,
        synced: 0,
        created_at: now,
        updated_at: now,
      });

      // Enqueue for server sync (camelCase payload)
      const queue = createOfflineQueue(db);
      await queue.enqueue(
        'planting_operations',
        appId,
        'CREATE',
        {
          fieldPlotId,
          cultivarId: cultivarId || undefined,
          crop: crop.trim(),
          plantingDate: dateStr,
          seasonYear: seasonYear.trim(),
          seasonType,
          plantedAreaPercent: parseFloat(plantedAreaPercent) || 100,
          populationPerM: parseFloat(populationPerM) || null,
          rowSpacingCm: parseFloat(rowSpacingCm) || null,
          depthCm: parseFloat(depthCm) || null,
          seedRateKgHa: parseFloat(seedRateKgHa) || null,
          seedTreatments: validTreatments.length > 0 ? validTreatments : undefined,
          baseFertilizations: validFertilizations.length > 0 ? validFertilizations : undefined,
          machineName: machineName.trim() || null,
          operatorName: operatorName.trim() || null,
          averageSpeedKmH: parseFloat(averageSpeedKmH) || null,
          seedCost: parseFloat(seedCost) || null,
          fertilizerCost: parseFloat(fertilizerCost) || null,
          treatmentCost: parseFloat(treatmentCost) || null,
          operationCost: parseFloat(operationCost) || null,
          notes: notes.trim() || null,
          photoUrl: photoUri,
          latitude: userCoords?.latitude ?? null,
          longitude: userCoords?.longitude ?? null,
        },
        `/org/farms/${selectedFarmId}/planting-operations`,
        'POST',
      );

      // Flush immediately if online
      if (isConnected) {
        const result = await queue.flush();
        if (result.processed > 0) {
          await repo.markSynced(appId);
        }
      }

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Plantio registrado', 'Dados salvos com sucesso.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert(
        'Erro ao salvar',
        err instanceof Error ? err.message : 'Não foi possível salvar o plantio.',
      );
    } finally {
      setIsSaving(false);
    }
  }, [
    isFormValid,
    selectedFarmId,
    db,
    isConnected,
    router,
    fieldPlotId,
    fieldPlotName,
    cultivarId,
    cultivarName,
    crop,
    plantingDate,
    seasonYear,
    seasonType,
    plantedAreaPercent,
    populationPerM,
    rowSpacingCm,
    depthCm,
    seedRateKgHa,
    seedTreatments,
    baseFertilizations,
    machineName,
    operatorName,
    averageSpeedKmH,
    seedCost,
    fertilizerCost,
    treatmentCost,
    operationCost,
    notes,
    photoUri,
    userCoords,
  ]);

  // ─── Guard: no farm selected ──────────────────────────────────────────
  if (!selectedFarmId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyFarm}>
          <Sprout size={64} color={colors.neutral[300]} accessibilityElementsHidden />
          <Text style={styles.emptyFarmTitle}>Selecione uma fazenda</Text>
          <Text style={styles.emptyFarmText}>
            Escolha uma fazenda antes de registrar um plantio.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Filtered cultivars by selected crop ──────────────────────────────
  const filteredCultivars =
    crop.trim().length > 0
      ? cultivars.filter((c) => c.crop.toLowerCase() === crop.trim().toLowerCase())
      : cultivars;

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => router.back()}
              accessible
              accessibilityLabel="Voltar"
              accessibilityRole="button"
            >
              <ArrowLeft size={24} color={colors.neutral[600]} aria-hidden />
            </Pressable>
            <Text style={styles.headerTitle}>Registro de Plantio</Text>
          </View>

          {/* Offline banner */}
          {!isConnected && (
            <View style={styles.offlineBanner} accessibilityRole="alert">
              <WifiOff size={16} color={colors.warning[500]} aria-hidden />
              <Text style={styles.offlineText}>
                Sem conexão. Dados serão enviados quando reconectar.
              </Text>
            </View>
          )}

          {/* GPS info */}
          {userCoords && (
            <View style={styles.gpsRow}>
              <MapPin size={12} color={colors.neutral[400]} aria-hidden />
              <Text style={styles.gpsText}>
                {userCoords.latitude.toFixed(6)}, {userCoords.longitude.toFixed(6)}
              </Text>
              {gpsDetectedPlot && (
                <Text style={styles.gpsDetected}>
                  <Crosshair size={10} color={colors.primary[600]} aria-hidden /> Talhão detectado
                  por GPS
                </Text>
              )}
            </View>
          )}

          {/* ─── SECTION: Dados básicos (CA1) ───────────────────────────── */}
          <Text style={styles.sectionTitle}>Dados básicos</Text>

          {/* Talhão */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Talhão <Text style={styles.requiredStar}>*</Text>
            </Text>
            <Pressable
              style={[styles.pickerButton, fieldPlotId && styles.pickerButtonActive]}
              onPress={() => setShowPlotPicker(true)}
              accessible
              accessibilityLabel={fieldPlotName ? `Talhão: ${fieldPlotName}` : 'Selecionar talhão'}
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !fieldPlotName && styles.pickerPlaceholder]}>
                {fieldPlotName ?? 'Selecionar talhão'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
            {/* Map picker link */}
            <Pressable
              style={styles.mapPickerButton}
              onPress={() => setShowMapPicker(true)}
              accessible
              accessibilityLabel="Selecionar talhão no mapa"
              accessibilityRole="button"
            >
              <MapIcon size={16} color={colors.primary[600]} aria-hidden />
              <Text style={styles.mapPickerText}>Selecionar no mapa</Text>
            </Pressable>
          </View>

          {/* Cultura */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Cultura <Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={styles.textInput}
              value={crop}
              onChangeText={setCrop}
              placeholder="Ex.: Soja, Milho, Café"
              placeholderTextColor={colors.neutral[400]}
              accessible
              accessibilityLabel="Cultura"
            />
          </View>

          {/* Cultivar */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Cultivar</Text>
            <Pressable
              style={[styles.pickerButton, cultivarId && styles.pickerButtonActive]}
              onPress={() => setShowCultivarPicker(true)}
              accessible
              accessibilityLabel={
                cultivarName ? `Cultivar: ${cultivarName}` : 'Selecionar cultivar'
              }
              accessibilityRole="button"
            >
              <Text style={[styles.pickerText, !cultivarName && styles.pickerPlaceholder]}>
                {cultivarName ?? 'Selecionar cultivar (opcional)'}
              </Text>
              <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
            </Pressable>
          </View>

          {/* Data / Safra / Tipo */}
          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Data do plantio</Text>
              <View style={styles.pickerButton}>
                <Calendar size={16} color={colors.neutral[400]} aria-hidden />
                <Text style={[styles.pickerText, { marginLeft: spacing[2] }]}>
                  {formatDate(plantingDate)}
                </Text>
              </View>
            </View>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>
                Safra <Text style={styles.requiredStar}>*</Text>
              </Text>
              <TextInput
                style={styles.textInput}
                value={seasonYear}
                onChangeText={setSeasonYear}
                placeholder="2025/2026"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Ano-safra"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Tipo de safra</Text>
              <Pressable
                style={styles.pickerButton}
                onPress={() => setShowSeasonTypePicker(true)}
                accessible
                accessibilityLabel={`Tipo de safra: ${SEASON_TYPES.find((s) => s.value === seasonType)?.label}`}
                accessibilityRole="button"
              >
                <Text style={styles.pickerText}>
                  {SEASON_TYPES.find((s) => s.value === seasonType)?.label}
                </Text>
                <ChevronDown size={20} color={colors.neutral[400]} aria-hidden />
              </Pressable>
            </View>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Área plantada (%)</Text>
              <TextInput
                style={styles.textInput}
                value={plantedAreaPercent}
                onChangeText={setPlantedAreaPercent}
                keyboardType="numeric"
                placeholder="100"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Percentual de área plantada"
              />
            </View>
          </View>

          {/* ─── SECTION: Dados técnicos (CA2) ──────────────────────────── */}
          <Text style={styles.sectionTitle}>Dados técnicos</Text>

          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Pop. sem/m</Text>
              <TextInput
                style={styles.textInput}
                value={populationPerM}
                onChangeText={setPopulationPerM}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="População de sementes por metro"
              />
            </View>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Espaçamento (cm)</Text>
              <TextInput
                style={styles.textInput}
                value={rowSpacingCm}
                onChangeText={setRowSpacingCm}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Espaçamento entre linhas em centímetros"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Profundidade (cm)</Text>
              <TextInput
                style={styles.textInput}
                value={depthCm}
                onChangeText={setDepthCm}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Profundidade de plantio em centímetros"
              />
            </View>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Taxa semeadura (kg/ha)</Text>
              <TextInput
                style={styles.textInput}
                value={seedRateKgHa}
                onChangeText={setSeedRateKgHa}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Taxa de semeadura em quilos por hectare"
              />
            </View>
          </View>

          {/* ─── SECTION: Tratamento de sementes (CA3) ───────────────────── */}
          <Text style={styles.sectionTitle}>Tratamento de sementes</Text>

          {seedTreatments.map((treatment, index) => (
            <View key={`st-${index}`} style={styles.repeatingCard}>
              <View style={styles.repeatingCardHeader}>
                <Text style={styles.repeatingCardTitle}>Tratamento {index + 1}</Text>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeSeedTreatment(index)}
                  accessible
                  accessibilityLabel={`Remover tratamento ${index + 1}`}
                  accessibilityRole="button"
                >
                  <Minus size={16} color={colors.error[500]} aria-hidden />
                </Pressable>
              </View>
              <TextInput
                style={styles.textInput}
                value={treatment.productName}
                onChangeText={(v) => updateSeedTreatment(index, 'productName', v)}
                placeholder="Produto"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel={`Produto do tratamento ${index + 1}`}
              />
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <TextInput
                    style={styles.textInput}
                    value={treatment.dose}
                    onChangeText={(v) => updateSeedTreatment(index, 'dose', v)}
                    keyboardType="numeric"
                    placeholder="Dose"
                    placeholderTextColor={colors.neutral[400]}
                    accessible
                    accessibilityLabel={`Dose do tratamento ${index + 1}`}
                  />
                </View>
                <View style={styles.halfField}>
                  <Pressable
                    style={styles.pickerButton}
                    onPress={() => {
                      // Cycle through dose units
                      const currentIdx = DOSE_UNITS.findIndex(
                        (u) => u.value === treatment.doseUnit,
                      );
                      const nextIdx = (currentIdx + 1) % DOSE_UNITS.length;
                      updateSeedTreatment(index, 'doseUnit', DOSE_UNITS[nextIdx].value);
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    accessible
                    accessibilityLabel={`Unidade: ${DOSE_UNITS.find((u) => u.value === treatment.doseUnit)?.label}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.pickerText}>
                      {DOSE_UNITS.find((u) => u.value === treatment.doseUnit)?.label}
                    </Text>
                    <ChevronDown size={16} color={colors.neutral[400]} aria-hidden />
                  </Pressable>
                </View>
              </View>
              <TextInput
                style={styles.textInput}
                value={treatment.responsibleTechnician}
                onChangeText={(v) => updateSeedTreatment(index, 'responsibleTechnician', v)}
                placeholder="Responsável técnico (opcional)"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel={`Responsável técnico do tratamento ${index + 1}`}
              />
            </View>
          ))}

          <Pressable
            style={styles.addButton}
            onPress={addSeedTreatment}
            accessible
            accessibilityLabel="Adicionar tratamento de sementes"
            accessibilityRole="button"
          >
            <Plus size={16} color={colors.primary[600]} aria-hidden />
            <Text style={styles.addButtonText}>Adicionar tratamento</Text>
          </Pressable>

          {/* ─── SECTION: Adubação de base (CA4) ─────────────────────────── */}
          <Text style={styles.sectionTitle}>Adubação de base</Text>

          {baseFertilizations.map((fert, index) => (
            <View key={`bf-${index}`} style={styles.repeatingCard}>
              <View style={styles.repeatingCardHeader}>
                <Text style={styles.repeatingCardTitle}>Adubação {index + 1}</Text>
                <Pressable
                  style={styles.removeButton}
                  onPress={() => removeBaseFertilization(index)}
                  accessible
                  accessibilityLabel={`Remover adubação ${index + 1}`}
                  accessibilityRole="button"
                >
                  <Minus size={16} color={colors.error[500]} aria-hidden />
                </Pressable>
              </View>
              <TextInput
                style={styles.textInput}
                value={fert.formulation}
                onChangeText={(v) => updateBaseFertilization(index, 'formulation', v)}
                placeholder="Formulação (ex.: 04-14-08)"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel={`Formulação da adubação ${index + 1}`}
              />
              <View style={styles.row}>
                <View style={styles.halfField}>
                  <TextInput
                    style={styles.textInput}
                    value={fert.doseKgHa}
                    onChangeText={(v) => updateBaseFertilization(index, 'doseKgHa', v)}
                    keyboardType="numeric"
                    placeholder="Dose (kg/ha)"
                    placeholderTextColor={colors.neutral[400]}
                    accessible
                    accessibilityLabel={`Dose da adubação ${index + 1} em quilos por hectare`}
                  />
                </View>
                <View style={styles.halfField}>
                  <Pressable
                    style={styles.pickerButton}
                    onPress={() => {
                      // Cycle through application modes
                      const currentIdx = FERTILIZER_MODES.findIndex(
                        (m) => m.value === fert.applicationMode,
                      );
                      const nextIdx = (currentIdx + 1) % FERTILIZER_MODES.length;
                      updateBaseFertilization(
                        index,
                        'applicationMode',
                        FERTILIZER_MODES[nextIdx].value,
                      );
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    accessible
                    accessibilityLabel={`Modo de aplicação: ${FERTILIZER_MODES.find((m) => m.value === fert.applicationMode)?.label}`}
                    accessibilityRole="button"
                  >
                    <Text style={styles.pickerText}>
                      {FERTILIZER_MODES.find((m) => m.value === fert.applicationMode)?.label}
                    </Text>
                    <ChevronDown size={16} color={colors.neutral[400]} aria-hidden />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}

          <Pressable
            style={styles.addButton}
            onPress={addBaseFertilization}
            accessible
            accessibilityLabel="Adicionar adubação de base"
            accessibilityRole="button"
          >
            <Plus size={16} color={colors.primary[600]} aria-hidden />
            <Text style={styles.addButtonText}>Adicionar adubação</Text>
          </Pressable>

          {/* ─── SECTION: Máquina & Operador (CA5) ───────────────────────── */}
          <Text style={styles.sectionTitle}>Máquina e operador</Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Máquina plantadeira</Text>
            <TextInput
              style={styles.textInput}
              value={machineName}
              onChangeText={setMachineName}
              placeholder="Nome/modelo da máquina"
              placeholderTextColor={colors.neutral[400]}
              accessible
              accessibilityLabel="Nome da máquina plantadeira"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Operador</Text>
              <TextInput
                style={styles.textInput}
                value={operatorName}
                onChangeText={setOperatorName}
                placeholder="Nome do operador"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Nome do operador"
              />
            </View>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Vel. média (km/h)</Text>
              <TextInput
                style={styles.textInput}
                value={averageSpeedKmH}
                onChangeText={setAverageSpeedKmH}
                keyboardType="numeric"
                placeholder="0"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Velocidade média em quilômetros por hora"
              />
            </View>
          </View>

          {/* ─── SECTION: Custos (CA8) ───────────────────────────────────── */}
          <Text style={styles.sectionTitle}>Custos</Text>

          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Sementes (R$)</Text>
              <TextInput
                style={styles.textInput}
                value={seedCost}
                onChangeText={setSeedCost}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Custo de sementes em reais"
              />
            </View>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Adubação (R$)</Text>
              <TextInput
                style={styles.textInput}
                value={fertilizerCost}
                onChangeText={setFertilizerCost}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Custo de adubação em reais"
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Tratamento (R$)</Text>
              <TextInput
                style={styles.textInput}
                value={treatmentCost}
                onChangeText={setTreatmentCost}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Custo de tratamento em reais"
              />
            </View>
            <View style={[styles.fieldContainer, styles.halfField]}>
              <Text style={styles.label}>Operação (R$)</Text>
              <TextInput
                style={styles.textInput}
                value={operationCost}
                onChangeText={setOperationCost}
                keyboardType="numeric"
                placeholder="0,00"
                placeholderTextColor={colors.neutral[400]}
                accessible
                accessibilityLabel="Custo de operação em reais"
              />
            </View>
          </View>

          {totalCost > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>R$ {totalCost.toFixed(2).replace('.', ',')}</Text>
            </View>
          )}

          {/* ─── SECTION: Foto (CA11-specific) ──────────────────────────── */}
          <Text style={styles.sectionTitle}>Foto do plantio</Text>

          {!photoUri ? (
            <Pressable
              style={styles.photoButton}
              onPress={handleTakePhoto}
              accessible
              accessibilityLabel="Tirar foto do plantio"
              accessibilityRole="button"
            >
              <Camera size={24} color={colors.neutral[500]} aria-hidden />
              <Text style={styles.photoButtonText}>Tirar foto</Text>
            </Pressable>
          ) : (
            <View style={styles.photoPreviewContainer}>
              <Image
                source={{ uri: photoUri }}
                style={styles.photoPreview}
                accessible
                accessibilityLabel="Foto capturada do plantio"
              />
              <View style={styles.photoActions}>
                <Pressable
                  style={[styles.photoActionButton, { backgroundColor: colors.error[100] }]}
                  onPress={handleRemovePhoto}
                  accessible
                  accessibilityLabel="Remover foto"
                  accessibilityRole="button"
                >
                  <Trash2 size={16} color={colors.error[500]} aria-hidden />
                  <Text style={[styles.photoActionText, { color: colors.error[500] }]}>
                    Remover
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.photoActionButton, { backgroundColor: colors.primary[100] }]}
                  onPress={handleTakePhoto}
                  accessible
                  accessibilityLabel="Capturar nova foto"
                  accessibilityRole="button"
                >
                  <Camera size={16} color={colors.primary[600]} aria-hidden />
                  <Text style={[styles.photoActionText, { color: colors.primary[600] }]}>
                    Nova foto
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ─── SECTION: Observações ────────────────────────────────────── */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Observações</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
              placeholder="Anotações adicionais sobre o plantio"
              placeholderTextColor={colors.neutral[400]}
              accessible
              accessibilityLabel="Observações"
            />
          </View>
        </ScrollView>

        {/* Footer — Save button */}
        <View style={styles.footer}>
          <Pressable
            style={[styles.saveBtn, (!isFormValid || isSaving) && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isFormValid || isSaving}
            accessible
            accessibilityLabel={isSaving ? 'Salvando plantio' : 'Registrar plantio'}
            accessibilityRole="button"
          >
            <Sprout size={20} color={colors.neutral[0]} aria-hidden />
            <Text style={styles.saveBtnText}>{isSaving ? 'Salvando...' : 'Registrar plantio'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ─── Modal: Plot picker ────────────────────────────────────────── */}
      <Modal visible={showPlotPicker} transparent animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowPlotPicker(false)}
          accessible={false}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar talhão</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setShowPlotPicker(false)}
                accessible
                accessibilityLabel="Fechar"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[600]} aria-hidden />
              </Pressable>
            </View>
            <FlatList
              data={plots}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => {
                    setFieldPlotId(item.id);
                    setFieldPlotName(item.name);
                    setGpsDetectedPlot(null);
                    setShowPlotPicker(false);
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  accessible
                  accessibilityLabel={item.name}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    {item.boundary_area_ha && (
                      <Text style={styles.modalItemSubText}>
                        {item.boundary_area_ha.toFixed(2)} ha
                        {item.current_crop ? ` · ${item.current_crop}` : ''}
                      </Text>
                    )}
                  </View>
                  {fieldPlotId === item.id && (
                    <Check size={20} color={colors.primary[600]} aria-hidden />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ padding: spacing[8], alignItems: 'center' }}>
                  <Text style={styles.modalItemText}>Nenhum talhão encontrado</Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Modal: Cultivar picker ────────────────────────────────────── */}
      <Modal visible={showCultivarPicker} transparent animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowCultivarPicker(false)}
          accessible={false}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar cultivar</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setShowCultivarPicker(false)}
                accessible
                accessibilityLabel="Fechar"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[600]} aria-hidden />
              </Pressable>
            </View>
            <FlatList
              data={filteredCultivars}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalItem}
                  onPress={() => handleSelectCultivar(item)}
                  accessible
                  accessibilityLabel={`${item.name} — ${item.crop}`}
                  accessibilityRole="button"
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemText}>{item.name}</Text>
                    <Text style={styles.modalItemSubText}>
                      {item.crop}
                      {item.technology ? ` · ${item.technology}` : ''}
                      {item.cycle_days ? ` · ${item.cycle_days}d` : ''}
                    </Text>
                  </View>
                  {cultivarId === item.id && (
                    <Check size={20} color={colors.primary[600]} aria-hidden />
                  )}
                </Pressable>
              )}
              ListEmptyComponent={
                <View style={{ padding: spacing[8], alignItems: 'center' }}>
                  <Text style={styles.modalItemText}>
                    {cultivars.length === 0
                      ? 'Nenhuma cultivar sincronizada'
                      : 'Nenhuma cultivar para esta cultura'}
                  </Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Modal: Season type picker ─────────────────────────────────── */}
      <Modal visible={showSeasonTypePicker} transparent animationType="slide">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowSeasonTypePicker(false)}
          accessible={false}
        >
          <Pressable style={styles.modalContent} onPress={() => {}}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Tipo de safra</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setShowSeasonTypePicker(false)}
                accessible
                accessibilityLabel="Fechar"
                accessibilityRole="button"
              >
                <X size={24} color={colors.neutral[600]} aria-hidden />
              </Pressable>
            </View>
            {SEASON_TYPES.map((st) => (
              <Pressable
                key={st.value}
                style={styles.modalItem}
                onPress={() => {
                  setSeasonType(st.value);
                  setShowSeasonTypePicker(false);
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                accessible
                accessibilityLabel={st.label}
                accessibilityRole="button"
              >
                <Text style={styles.modalItemText}>{st.label}</Text>
                {seasonType === st.value && (
                  <Check size={20} color={colors.primary[600]} aria-hidden />
                )}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ─── Map picker ────────────────────────────────────────────────── */}
      <Modal
        visible={showMapPicker}
        animationType="slide"
        onRequestClose={() => setShowMapPicker(false)}
      >
        {selectedFarmId && (
          <LocationMapPicker
            farmId={selectedFarmId}
            onSelect={handleMapPickerSelect}
            onClose={() => setShowMapPicker(false)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}
