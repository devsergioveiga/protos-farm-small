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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  ShoppingCart,
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
import { useAuth } from '@/stores/AuthContext';
import { createPurchaseRequestRepository, createReferenceDataRepository } from '@/services/db';
import { createOfflineQueue } from '@/services/offline-queue';
import type { ThemeColors } from '@/stores/ThemeContext';
import type { LocalPurchaseRequest } from '@/services/db/purchase-request-repository';

// ─── Constants ──────────────────────────────────────────────────────────────

const URGENCY_OPTIONS: { value: LocalPurchaseRequest['urgency']; label: string }[] = [
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENTE', label: 'Urgente' },
  { value: 'EMERGENCIAL', label: 'Emergencial' },
];

interface CachedProduct {
  id?: string;
  name: string;
  unitName?: string;
  unit?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateLocalId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `pr-${timestamp}-${random}`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

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
  dropdownItemUnit: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
    marginTop: 2,
  },

  // Segmented control (urgency)
  segmentedRow: {
    flexDirection: 'row' as const,
    backgroundColor: c.neutral[100],
    borderRadius: 8,
    padding: 2,
    minHeight: 48,
  },
  segmentButton: {
    flex: 1 as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 6,
    paddingVertical: spacing[2],
    minHeight: 44,
  },
  segmentButtonActive: { backgroundColor: c.neutral[0] },
  segmentButtonEmergencial: { backgroundColor: c.error[500] },
  segmentText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
  segmentTextActive: { color: c.primary[700] },
  segmentTextEmergencial: { color: '#fff' },

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
    gap: spacing[3],
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
  secondaryButton: {
    borderWidth: 1,
    borderColor: c.primary[600],
    borderRadius: 8,
    paddingVertical: spacing[3],
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: c.neutral[0],
  },
  secondaryButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: c.primary[600],
  },
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function PurchaseRequestScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { selectedFarm } = useFarmContext();
  const { isConnected } = useConnectivity();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Form state
  const [productQuery, setProductQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<CachedProduct | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [productSuggestions, setProductSuggestions] = useState<CachedProduct[]>([]);
  const [allCachedProducts, setAllCachedProducts] = useState<CachedProduct[]>([]);

  const [quantity, setQuantity] = useState('');
  const [unitName, setUnitName] = useState('');
  const [urgency, setUrgency] = useState<LocalPurchaseRequest['urgency']>('NORMAL');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [observation, setObservation] = useState('');

  // Geo
  const [geolat, setGeolat] = useState<number | null>(null);
  const [geolon, setGeolon] = useState<number | null>(null);

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
          setGeolat(loc.coords.latitude);
          setGeolon(loc.coords.longitude);
        }
      } catch {
        // Proceed without geolocation if permission denied or error
      }
    })();
  }, []);

  // Load cached products
  useEffect(() => {
    void (async () => {
      if (!selectedFarm?.id) return;
      try {
        const refRepo = createReferenceDataRepository(db);
        const products = await refRepo.getReferenceData<CachedProduct>(selectedFarm.id, 'products');
        setAllCachedProducts(products);
      } catch {
        // Offline without cache — fall back to free text
      }
    })();
  }, [db, selectedFarm?.id]);

  // Filter product suggestions on query change
  useEffect(() => {
    if (!productQuery.trim()) {
      setProductSuggestions([]);
      setShowDropdown(false);
      return;
    }
    if (selectedProduct && selectedProduct.name === productQuery) {
      setShowDropdown(false);
      return;
    }
    const lower = productQuery.toLowerCase();
    const filtered = allCachedProducts
      .filter((p) => p.name.toLowerCase().includes(lower))
      .slice(0, 8);
    setProductSuggestions(filtered);
    setShowDropdown(filtered.length > 0);
  }, [productQuery, allCachedProducts, selectedProduct]);

  // Show toast with auto-dismiss
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 4000);
  }, []);

  const handleSelectProduct = useCallback((product: CachedProduct) => {
    setSelectedProduct(product);
    setProductQuery(product.name);
    const unit = product.unitName ?? product.unit ?? '';
    setUnitName(unit);
    setShowDropdown(false);
    setErrors((prev) => ({ ...prev, product: '', unitName: '' }));
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
      });
      if (!result.canceled && result.assets[0]) {
        setPhotoUri(result.assets[0].uri);
      }
    } catch {
      // Ignore photo errors
    }
  }, []);

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    const trimmedProduct = productQuery.trim();
    if (!trimmedProduct) newErrors.product = 'Informe o produto';
    if (!quantity.trim() || Number(quantity.replace(',', '.')) <= 0)
      newErrors.quantity = 'Informe a quantidade';
    if (!unitName.trim()) newErrors.unitName = 'Informe a unidade';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [productQuery, quantity, unitName]);

  const buildApiPayload = useCallback(() => {
    return {
      requestType: 'INSUMO_AGRICOLA',
      farmId: selectedFarm?.id ?? '',
      urgency,
      geolat,
      geolon,
      photoUrl: photoUri ?? undefined,
      items: [
        {
          productName: productQuery.trim(),
          quantity: Number(quantity.replace(',', '.')),
          unitName: unitName.trim(),
        },
      ],
    };
  }, [selectedFarm?.id, urgency, geolat, geolon, photoUri, productQuery, quantity, unitName]);

  const handleSave = useCallback(
    async (submitForApproval: boolean) => {
      if (!validate()) return;
      if (!selectedFarm?.id) return;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsSaving(true);
      try {
        const localId = generateLocalId();
        const purchaseRepo = createPurchaseRequestRepository(db);
        await purchaseRepo.initPurchaseRequestTable();

        const localRecord: LocalPurchaseRequest = {
          localId,
          productName: productQuery.trim(),
          quantity: Number(quantity.replace(',', '.')),
          unitName: unitName.trim(),
          urgency,
          photoUri: photoUri ?? undefined,
          observation: observation.trim() || undefined,
          farmId: selectedFarm.id,
          geolat: geolat ?? undefined,
          geolon: geolon ?? undefined,
          status: 'local',
          createdAt: new Date().toISOString(),
        };

        await purchaseRepo.savePurchaseRequest(localRecord);

        if (submitForApproval) {
          const offlineQueue = createOfflineQueue(db);
          const apiPayload = buildApiPayload();

          // Two-step: create RC then transition to PENDENTE
          await offlineQueue.enqueue(
            'purchase_requests',
            localId,
            'CREATE',
            apiPayload,
            '/api/org/purchase-requests',
            'POST',
          );
          // Transition step will be handled by server after creation
          // (the backend should auto-submit on mobile create, or we enqueue a separate transition)

          if (isConnected) {
            showToast('Requisicao enviada para aprovacao.');
          } else {
            showToast('Requisicao salva. Sera enviada quando houver conexao.');
          }
        } else {
          showToast('Rascunho salvo localmente.');
        }

        setTimeout(() => router.back(), 1500);
      } catch {
        showToast('Nao foi possivel salvar. Verifique sua conexao.');
      } finally {
        setIsSaving(false);
      }
    },
    [
      validate,
      selectedFarm?.id,
      db,
      productQuery,
      quantity,
      unitName,
      urgency,
      photoUri,
      observation,
      geolat,
      geolon,
      isConnected,
      buildApiPayload,
      showToast,
      router,
    ],
  );

  const renderProductItem = useCallback(
    ({ item }: { item: CachedProduct }) => (
      <Pressable
        style={styles.dropdownItem}
        onPress={() => handleSelectProduct(item)}
        accessibilityRole="button"
        accessibilityLabel={`Selecionar produto ${item.name}`}
      >
        <Text style={styles.dropdownItemName}>{item.name}</Text>
        {(item.unitName ?? item.unit) ? (
          <Text style={styles.dropdownItemUnit}>{item.unitName ?? item.unit}</Text>
        ) : null}
      </Pressable>
    ),
    [styles, handleSelectProduct],
  );

  const farmName = selectedFarm?.name ?? user?.email ?? 'Fazenda nao selecionada';

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
            <Text style={styles.headerTitle}>Nova Requisicao</Text>
          </View>

          {/* Offline banner */}
          {!isConnected && (
            <View style={styles.offlineBanner}>
              <WifiOff size={16} color={colors.warning[500]} aria-hidden />
              <Text style={styles.offlineText}>
                Sem conexao. A requisicao sera enviada ao reconectar.
              </Text>
            </View>
          )}

          {/* Toast */}
          {toastMessage && (
            <View style={styles.toastBanner}>
              <ShoppingCart size={16} color={colors.primary[600]} aria-hidden />
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

          {/* Product field with autocomplete */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Produto<Text style={styles.requiredStar}>*</Text>
            </Text>
            <View
              style={[
                styles.searchInputWrapper,
                errors.product ? styles.searchInputWrapperError : undefined,
              ]}
            >
              <Search size={16} color={colors.neutral[400]} aria-hidden />
              <TextInput
                style={styles.searchInput}
                value={productQuery}
                onChangeText={(text) => {
                  setProductQuery(text);
                  setSelectedProduct(null);
                  if (errors.product) setErrors((prev) => ({ ...prev, product: '' }));
                }}
                placeholder="Buscar produto..."
                placeholderTextColor={colors.neutral[400]}
                accessibilityLabel="Produto"
                accessibilityRole="search"
                accessibilityHint="Digite para buscar no catalogo de produtos"
                returnKeyType="search"
              />
              {productQuery.length > 0 && (
                <Pressable
                  onPress={() => {
                    setProductQuery('');
                    setSelectedProduct(null);
                    setUnitName('');
                    setShowDropdown(false);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Limpar produto"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={16} color={colors.neutral[400]} aria-hidden />
                </Pressable>
              )}
            </View>
            {showDropdown && (
              <View style={styles.dropdown}>
                <FlatList
                  data={productSuggestions}
                  renderItem={renderProductItem}
                  keyExtractor={(item, idx) => item.id ?? `${item.name}-${idx}`}
                  keyboardShouldPersistTaps="handled"
                  scrollEnabled={true}
                />
              </View>
            )}
            {errors.product ? (
              <View style={styles.errorRow} accessibilityLiveRegion="polite">
                <AlertCircle size={14} color={colors.error[500]} aria-hidden />
                <Text style={styles.errorText}>{errors.product}</Text>
              </View>
            ) : null}
          </View>

          {/* Quantity */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Quantidade<Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.textInput, errors.quantity ? styles.textInputError : undefined]}
              value={quantity}
              onChangeText={(text) => {
                setQuantity(text);
                if (errors.quantity) setErrors((prev) => ({ ...prev, quantity: '' }));
              }}
              placeholder="0"
              placeholderTextColor={colors.neutral[400]}
              keyboardType="decimal-pad"
              accessibilityLabel="Quantidade"
            />
            {errors.quantity ? (
              <View style={styles.errorRow} accessibilityLiveRegion="polite">
                <AlertCircle size={14} color={colors.error[500]} aria-hidden />
                <Text style={styles.errorText}>{errors.quantity}</Text>
              </View>
            ) : null}
          </View>

          {/* Unit */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Unidade<Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.textInput, errors.unitName ? styles.textInputError : undefined]}
              value={unitName}
              onChangeText={(text) => {
                setUnitName(text);
                if (errors.unitName) setErrors((prev) => ({ ...prev, unitName: '' }));
              }}
              placeholder="ex: kg, L, saco"
              placeholderTextColor={colors.neutral[400]}
              accessibilityLabel="Unidade de medida"
            />
            {errors.unitName ? (
              <View style={styles.errorRow} accessibilityLiveRegion="polite">
                <AlertCircle size={14} color={colors.error[500]} aria-hidden />
                <Text style={styles.errorText}>{errors.unitName}</Text>
              </View>
            ) : null}
          </View>

          {/* Urgency segmented control */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Urgencia<Text style={styles.requiredStar}>*</Text>
            </Text>
            <View
              style={styles.segmentedRow}
              accessibilityRole="radiogroup"
              accessibilityLabel="Urgencia"
            >
              {URGENCY_OPTIONS.map((option) => {
                const isActive = urgency === option.value;
                const isEmergencial = option.value === 'EMERGENCIAL' && isActive;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      setUrgency(option.value);
                    }}
                    style={[
                      styles.segmentButton,
                      isEmergencial
                        ? styles.segmentButtonEmergencial
                        : isActive
                          ? styles.segmentButtonActive
                          : undefined,
                    ]}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isActive }}
                    accessibilityLabel={option.label}
                  >
                    <Text
                      style={[
                        styles.segmentText,
                        isEmergencial
                          ? styles.segmentTextEmergencial
                          : isActive
                            ? styles.segmentTextActive
                            : undefined,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Photo */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Foto (opcional)</Text>
            {photoUri ? (
              <View>
                <Image
                  source={{ uri: photoUri }}
                  style={styles.photoPreview}
                  accessibilityLabel="Foto da requisicao"
                  resizeMode="cover"
                />
                <Pressable
                  onPress={() => setPhotoUri(null)}
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
                accessibilityLabel="Tirar foto"
              >
                <Camera size={20} color={colors.neutral[400]} aria-hidden />
                <Text style={styles.photoButtonText}>Tirar foto do produto ou local</Text>
              </Pressable>
            )}
          </View>

          {/* Observation */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Observacao (opcional)</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              value={observation}
              onChangeText={setObservation}
              placeholder="Descreva mais detalhes sobre a requisicao..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={3}
              accessibilityLabel="Observacao"
            />
          </View>

          {/* Geolocation info row */}
          {geolat !== null && geolon !== null && (
            <View style={styles.geoRow}>
              <MapPin size={12} color={colors.neutral[300]} aria-hidden />
              <Text style={styles.geoText}>
                {geolat.toFixed(6)}, {geolon.toFixed(6)}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => void handleSave(true)}
            style={({ pressed }) => [
              styles.primaryButton,
              isSaving || !selectedFarm?.id ? styles.primaryButtonDisabled : undefined,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            disabled={isSaving || !selectedFarm?.id}
            accessibilityRole="button"
            accessibilityLabel="Enviar Requisicao"
            accessibilityState={{ disabled: isSaving || !selectedFarm?.id }}
          >
            <Text style={styles.primaryButtonText}>Enviar Requisicao</Text>
          </Pressable>
          <Pressable
            onPress={() => void handleSave(false)}
            style={({ pressed }) => [styles.secondaryButton, { opacity: pressed ? 0.85 : 1 }]}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Salvar Rascunho"
            accessibilityState={{ disabled: isSaving }}
          >
            <Text style={styles.secondaryButtonText}>Salvar Rascunho</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
