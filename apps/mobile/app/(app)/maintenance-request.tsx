import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  Wrench,
  Camera,
  X,
  WifiOff,
  Search,
  AlertCircle,
  MapPin,
} from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { useConnectivity } from '@/stores/ConnectivityContext';
import { useSyncContext } from '@/stores/SyncContext';
import { createMaintenanceRequestRepository } from '@/services/db/maintenance-request-repository';
import { createOfflineQueue } from '@/services/offline-queue';
import { api } from '@/services/api';
import type { ThemeColors } from '@/stores/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CachedAsset {
  id: string;
  name: string;
  assetTag?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateLocalId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `mr-${timestamp}-${random}`;
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => ({
  safeArea: { flex: 1 as const, backgroundColor: c.neutral[50] },
  container: { flex: 1 as const },
  scrollContent: { padding: spacing[4], paddingBottom: 120, gap: spacing[4] },

  // Header
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
    color: c.neutral[800],
    flex: 1 as const,
  },

  // Banners
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
  toastBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.primary[50],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.primary[200],
  },
  toastText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.primary[700],
    flex: 1 as const,
  },

  // Farm chip
  farmChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.neutral[100],
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    minHeight: 48,
  },
  farmChipText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[600],
    flex: 1 as const,
  },

  // Form fields
  fieldContainer: { gap: spacing[1] },
  label: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[600],
    marginBottom: spacing[1],
  },
  requiredStar: { color: c.error[500] },
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
  textInputError: { borderColor: c.error[500] },
  textInputMultiline: { minHeight: 96, textAlignVertical: 'top' as const },
  errorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
    marginTop: spacing[1],
  },
  errorText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.error[500],
  },

  // Autocomplete
  searchContainer: { position: 'relative' as const },
  searchInputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: c.neutral[0],
    borderWidth: 1,
    borderColor: c.neutral[300],
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    minHeight: 48,
  },
  searchInputWrapperError: { borderColor: c.error[500] },
  searchInput: {
    flex: 1 as const,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
    paddingVertical: spacing[3],
  },
  dropdown: {
    backgroundColor: c.neutral[0],
    borderWidth: 1,
    borderColor: c.neutral[200],
    borderRadius: 8,
    marginTop: spacing[1],
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 4,
  },
  dropdownItem: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
    minHeight: 48,
    justifyContent: 'center' as const,
  },
  dropdownItemName: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },
  dropdownItemTag: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
    marginTop: 2,
  },

  // Photo
  photoButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    borderWidth: 1,
    borderColor: c.neutral[300],
    borderStyle: 'dashed' as const,
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
    backgroundColor: c.neutral[0],
  },
  photoButtonText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    flex: 1 as const,
  },
  photoPreview: {
    width: '100%' as const,
    height: 160,
    borderRadius: 8,
    marginTop: spacing[2],
  },
  photoThumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginTop: spacing[2],
  },
  photoRemoveButton: {
    position: 'absolute' as const,
    top: spacing[3],
    right: spacing[2],
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },

  // Geolocation row
  geoRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.neutral[50],
    borderRadius: 8,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
  },
  geoText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
  },
  geoUnavailableText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
    fontStyle: 'italic' as const,
  },

  // Footer
  footer: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: c.neutral[0],
    borderTopWidth: 1,
    borderTopColor: c.neutral[200],
    padding: spacing[4],
  },
  primaryButton: {
    backgroundColor: c.primary[600],
    borderRadius: 8,
    paddingVertical: spacing[3],
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryButtonDisabled: { backgroundColor: c.neutral[300] },
  primaryButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: '#fff',
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

export default function MaintenanceRequestScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { selectedFarm } = useFarmContext();
  const { isConnected } = useConnectivity();
  const { flushNow } = useSyncContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Asset picker state
  const [assetQuery, setAssetQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<CachedAsset | null>(null);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [assetSuggestions, setAssetSuggestions] = useState<CachedAsset[]>([]);
  const [allAssets, setAllAssets] = useState<CachedAsset[]>([]);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);

  // Geo
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLon, setGeoLon] = useState<number | null>(null);
  const [geoUnavailable, setGeoUnavailable] = useState(false);

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-capture geolocation on mount
  useEffect(() => {
    void (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          setGeoLat(loc.coords.latitude);
          setGeoLon(loc.coords.longitude);
        } else {
          setGeoUnavailable(true);
        }
      } catch {
        setGeoUnavailable(true);
      }
    })();
  }, []);

  // Load assets from API when online, or from reference cache when offline
  useEffect(() => {
    void (async () => {
      if (!selectedFarm?.id) return;
      try {
        if (isConnected) {
          const response = await api.get<{ data: CachedAsset[] }>(
            `/org/assets?farmId=${selectedFarm.id}&limit=200`,
          );
          setAllAssets(response.data ?? []);
        }
      } catch {
        // Proceed with empty list — user can still type asset name manually
      }
    })();
  }, [db, selectedFarm?.id, isConnected]);

  // Filter asset suggestions on query change
  useEffect(() => {
    if (!assetQuery.trim()) {
      setAssetSuggestions([]);
      setShowAssetDropdown(false);
      return;
    }
    if (selectedAsset && selectedAsset.name === assetQuery) {
      setShowAssetDropdown(false);
      return;
    }
    const lower = assetQuery.toLowerCase();
    const filtered = allAssets
      .filter((a) => a.name.toLowerCase().includes(lower) || (a.assetTag ?? '').toLowerCase().includes(lower))
      .slice(0, 8);
    setAssetSuggestions(filtered);
    setShowAssetDropdown(filtered.length > 0);
  }, [assetQuery, allAssets, selectedAsset]);

  // Show toast with auto-dismiss
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const handleSelectAsset = useCallback((asset: CachedAsset) => {
    setSelectedAsset(asset);
    setAssetQuery(asset.name);
    setShowAssetDropdown(false);
    setErrors((prev) => ({ ...prev, asset: '' }));
  }, []);

  const handleTakePhoto = useCallback(async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return;
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
        base64: true,
        exif: false,
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
        setPhotoBase64(result.assets[0].base64 ?? null);
      }
    } catch {
      // Ignore photo errors
    }
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedAsset && !assetQuery.trim()) {
      newErrors.asset = 'Selecione ou informe o ativo';
    }
    if (!title.trim()) {
      newErrors.title = 'Informe o titulo da solicitacao';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedAsset, assetQuery, title]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);
    try {
      const localId = generateLocalId();
      const assetId = selectedAsset?.id ?? assetQuery.trim();

      const maintenanceRepo = createMaintenanceRequestRepository(db);
      await maintenanceRepo.initTable();

      await maintenanceRepo.saveRequest({
        localId,
        assetId,
        title: title.trim(),
        description: description.trim() || null,
        photoBase64: photoBase64 ?? null,
        geoLat,
        geoLon,
        status: 'local',
        createdAt: new Date().toISOString(),
      });

      const payload = {
        assetId,
        title: title.trim(),
        description: description.trim() || undefined,
        type: 'SOLICITACAO',
        photoUrls: photoBase64 ? [photoBase64] : [],
        geoLat: geoLat ?? null,
        geoLon: geoLon ?? null,
      };

      const offlineQueue = createOfflineQueue(db);
      await offlineQueue.enqueue(
        'maintenance_requests',
        localId,
        'CREATE',
        payload,
        '/api/org/work-orders',
        'POST',
      );

      if (isConnected) {
        await flushNow();
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Solicitacao enviada', 'OS criada com sucesso.');
      } else {
        showToast('Solicitacao salva. Sera enviada quando houver conexao.');
      }

      setTimeout(() => router.back(), isConnected ? 0 : 1500);
    } catch {
      showToast('Nao foi possivel salvar. Verifique sua conexao.');
    } finally {
      setIsSaving(false);
    }
  }, [
    validate,
    db,
    selectedAsset,
    assetQuery,
    title,
    description,
    photoBase64,
    geoLat,
    geoLon,
    isConnected,
    flushNow,
    showToast,
    router,
  ]);

  const renderAssetItem = useCallback(
    ({ item }: { item: CachedAsset }) => (
      <Pressable
        style={styles.dropdownItem}
        onPress={() => handleSelectAsset(item)}
        accessibilityRole="button"
        accessibilityLabel={`Selecionar ativo ${item.name}`}
      >
        <Text style={styles.dropdownItemName}>{item.name}</Text>
        {item.assetTag ? (
          <Text style={styles.dropdownItemTag}>{item.assetTag}</Text>
        ) : null}
      </Pressable>
    ),
    [styles, handleSelectAsset],
  );

  const farmName = selectedFarm?.name ?? 'Fazenda nao selecionada';

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
          <View style={styles.header}>
            <Pressable
              onPress={() => router.back()}
              style={styles.backButton}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <ArrowLeft size={24} color={colors.neutral[700]} aria-hidden />
            </Pressable>
            <Text style={styles.headerTitle}>Solicitar Manutencao</Text>
          </View>

          {/* Offline banner */}
          {!isConnected && (
            <View style={styles.offlineBanner}>
              <WifiOff size={16} color={colors.warning[500]} aria-hidden />
              <Text style={styles.offlineText}>
                Sem conexao. A solicitacao sera enviada ao reconectar.
              </Text>
            </View>
          )}

          {/* Toast */}
          {toastMessage && (
            <View style={styles.toastBanner}>
              <Wrench size={16} color={colors.primary[600]} aria-hidden />
              <Text style={styles.toastText}>{toastMessage}</Text>
            </View>
          )}

          {/* Farm chip (read-only) */}
          <View
            style={styles.farmChip}
            accessibilityLabel={`Fazenda: ${farmName}`}
            accessibilityRole="text"
          >
            <MapPin size={16} color={colors.neutral[400]} aria-hidden />
            <Text style={styles.farmChipText} numberOfLines={1}>
              {farmName}
            </Text>
          </View>

          {/* Asset picker with autocomplete */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Ativo<Text style={styles.requiredStar}>*</Text>
            </Text>
            <View
              style={[
                styles.searchInputWrapper,
                errors.asset ? styles.searchInputWrapperError : undefined,
              ]}
            >
              <Search size={16} color={colors.neutral[400]} aria-hidden />
              <TextInput
                style={styles.searchInput}
                value={assetQuery}
                onChangeText={(text) => {
                  setAssetQuery(text);
                  setSelectedAsset(null);
                  if (errors.asset) setErrors((prev) => ({ ...prev, asset: '' }));
                }}
                placeholder="Buscar ativo..."
                placeholderTextColor={colors.neutral[400]}
                accessibilityLabel="Ativo vinculado"
                accessibilityRole="search"
                accessibilityHint="Digite para buscar no cadastro de ativos"
                returnKeyType="search"
              />
              {assetQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    setAssetQuery('');
                    setSelectedAsset(null);
                    setShowAssetDropdown(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar ativo"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={colors.neutral[400]} aria-hidden />
                </Pressable>
              )}
            </View>
            {showAssetDropdown && (
              <View style={styles.dropdown}>
                <FlatList
                  data={assetSuggestions}
                  renderItem={renderAssetItem}
                  keyExtractor={(item) => item.id}
                  keyboardShouldPersistTaps="handled"
                  scrollEnabled
                />
              </View>
            )}
            {errors.asset ? (
              <View style={styles.errorRow} accessibilityLiveRegion="polite" role="alert">
                <AlertCircle size={14} color={colors.error[500]} aria-hidden />
                <Text style={styles.errorText}>{errors.asset}</Text>
              </View>
            ) : null}
          </View>

          {/* Title */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Titulo<Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.textInput, errors.title ? styles.textInputError : undefined]}
              value={title}
              onChangeText={(text) => {
                setTitle(text);
                if (errors.title) setErrors((prev) => ({ ...prev, title: '' }));
              }}
              placeholder="Ex: Vazamento de oleo, motor nao liga..."
              placeholderTextColor={colors.neutral[400]}
              accessibilityLabel="Titulo da solicitacao"
              aria-required
              returnKeyType="next"
            />
            {errors.title ? (
              <View style={styles.errorRow} accessibilityLiveRegion="polite" role="alert">
                <AlertCircle size={14} color={colors.error[500]} aria-hidden />
                <Text style={styles.errorText}>{errors.title}</Text>
              </View>
            ) : null}
          </View>

          {/* Description */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Descricao (opcional)</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              value={description}
              onChangeText={setDescription}
              placeholder="Descreva o problema com mais detalhes..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={3}
              accessibilityLabel="Descricao do problema"
            />
          </View>

          {/* Photo */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Foto (opcional)</Text>
            {photoUri ? (
              <View>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoPreview}
                  accessibilityLabel="Foto da solicitacao de manutencao"
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => {
                    setPhotoUri(null);
                    setPhotoBase64(null);
                  }}
                  style={styles.photoRemoveButton}
                  accessibilityRole="button"
                  accessibilityLabel="Remover foto"
                >
                  <X size={16} color="#fff" aria-hidden />
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => void handleTakePhoto()}
                style={({ pressed }) => [styles.photoButton, { opacity: pressed ? 0.8 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="Tirar foto para solicitacao"
              >
                <Camera size={20} color={colors.neutral[400]} aria-hidden />
                <Text style={styles.photoButtonText}>Tirar foto do problema</Text>
              </Pressable>
            )}
          </View>

          {/* Geolocation info row */}
          {geoLat !== null && geoLon !== null ? (
            <View style={styles.geoRow}>
              <MapPin size={12} color={colors.neutral[300]} aria-hidden />
              <Text style={styles.geoText}>
                {geoLat.toFixed(6)}, {geoLon.toFixed(6)}
              </Text>
            </View>
          ) : geoUnavailable ? (
            <View style={styles.geoRow}>
              <MapPin size={12} color={colors.neutral[300]} aria-hidden />
              <Text style={styles.geoUnavailableText}>Localizacao nao disponivel</Text>
            </View>
          ) : null}
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.primaryButton,
              isSaving ? styles.primaryButtonDisabled : undefined,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Enviar solicitacao de manutencao"
            accessibilityState={{ disabled: isSaving }}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? 'Enviando...' : 'Enviar Solicitacao'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
