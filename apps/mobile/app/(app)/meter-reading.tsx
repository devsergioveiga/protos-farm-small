import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, Search, WifiOff, X, AlertCircle, Clock } from 'lucide-react-native';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { useConnectivity } from '@/stores/ConnectivityContext';
import { useSyncContext } from '@/stores/SyncContext';
import { createOfflineQueue } from '@/services/offline-queue';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';
import { useSQLiteContext } from 'expo-sqlite';
import type { ThemeColors } from '@/stores/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReadingType = 'HOURMETER' | 'ODOMETER';

interface CachedAsset {
  id: string;
  name: string;
  assetTag?: string;
  currentHourmeter?: number;
  currentOdometer?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateLocalId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `mr-${timestamp}-${random}`;
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
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
  hintText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[500],
    marginTop: spacing[1],
  },
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

  // Input with suffix row
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
  },
  inputFlex: { flex: 1 as const },
  suffixText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    minWidth: 32,
  },

  // Reading type toggle
  toggleRow: {
    flexDirection: 'row' as const,
    gap: spacing[2],
  },
  toggleButton: {
    flex: 1 as const,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.neutral[300],
    backgroundColor: c.neutral[100],
  },
  toggleButtonActive: {
    backgroundColor: c.primary[600],
    borderColor: c.primary[600],
  },
  toggleButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[700],
  },
  toggleButtonTextActive: {
    color: c.neutral[0],
  },

  // Asset autocomplete
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

export default function MeterReadingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ assetId?: string }>();
  const db = useSQLiteContext();
  const { selectedFarm } = useFarmContext();
  const { isConnected } = useConnectivity();
  const { flushNow } = useSyncContext();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Asset picker state
  const [assetQuery, setAssetQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<CachedAsset | null>(null);
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);
  const [assetSuggestions, setAssetSuggestions] = useState<CachedAsset[]>([]);
  const [allAssets, setAllAssets] = useState<CachedAsset[]>([]);

  // Form state
  const [readingType, setReadingType] = useState<ReadingType>('HOURMETER');
  const [readingValue, setReadingValue] = useState('');
  const [readingDate, setReadingDate] = useState(todayIso());
  const [notes, setNotes] = useState('');

  // UI state
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // Load assets from API when online
  useEffect(() => {
    void (async () => {
      if (!selectedFarm?.id) return;
      try {
        if (isConnected) {
          const response = await api.get<{ data: CachedAsset[] }>(
            `/org/assets?farmId=${selectedFarm.id}&limit=200`,
          );
          const assets = response.data ?? [];
          setAllAssets(assets);

          // Pre-select asset if assetId param provided
          if (params.assetId) {
            const found = assets.find((a) => a.id === params.assetId);
            if (found) {
              setSelectedAsset(found);
              setAssetQuery(found.name);
            }
          }
        }
      } catch {
        // Proceed with empty list — user can still type asset name manually
      }
    })();
  }, [db, selectedFarm?.id, isConnected, params.assetId]);

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
      .filter(
        (a) =>
          a.name.toLowerCase().includes(lower) || (a.assetTag ?? '').toLowerCase().includes(lower),
      )
      .slice(0, 8);
    setAssetSuggestions(filtered);
    setShowAssetDropdown(filtered.length > 0);
  }, [assetQuery, allAssets, selectedAsset]);

  const handleSelectAsset = useCallback((asset: CachedAsset) => {
    setSelectedAsset(asset);
    setAssetQuery(asset.name);
    setShowAssetDropdown(false);
    setErrors((prev) => ({ ...prev, asset: '' }));
    setGlobalError(null);
  }, []);

  const handleReadingTypeChange = useCallback((type: ReadingType) => {
    setReadingType(type);
    setReadingValue('');
    setErrors((prev) => ({ ...prev, readingValue: '' }));
  }, []);

  const currentValue = selectedAsset
    ? readingType === 'HOURMETER'
      ? selectedAsset.currentHourmeter
      : selectedAsset.currentOdometer
    : undefined;

  const unit = readingType === 'HOURMETER' ? 'horas' : 'km';

  // Inline anti-regression check
  const parsedValue = parseFloat(readingValue.replace(',', '.'));
  const hasAntiRegressionError =
    readingValue.trim() !== '' &&
    !isNaN(parsedValue) &&
    currentValue !== undefined &&
    parsedValue <= currentValue;

  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!selectedAsset) {
      newErrors.asset = 'Selecione o ativo';
    }
    if (!readingValue.trim()) {
      newErrors.readingValue = 'Informe o valor da leitura';
    } else {
      const val = parseFloat(readingValue.replace(',', '.'));
      if (isNaN(val) || val <= 0) {
        newErrors.readingValue = 'O valor deve ser maior que zero';
      } else if (currentValue !== undefined && val <= currentValue) {
        newErrors.readingValue = `Leitura deve ser maior que ${currentValue} ${unit}`;
      }
    }
    if (!readingDate.trim()) {
      newErrors.readingDate = 'Informe a data da leitura';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [selectedAsset, readingValue, readingDate, currentValue, unit]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) return;

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsSaving(true);
    setGlobalError(null);

    try {
      const parsedVal = parseFloat(readingValue.replace(',', '.'));
      const payload = {
        assetId: selectedAsset!.id,
        readingType,
        readingValue: parsedVal,
        readingDate,
        notes: notes.trim() || undefined,
      };

      const orgId = user?.organizationId;

      if (isConnected && orgId) {
        try {
          await api.post(`/api/org/${orgId}/meter-readings`, payload);
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert('Leitura registrada', 'Leitura registrada com sucesso.');
          router.back();
        } catch (err) {
          const apiErr = err as Error & { status?: number; message?: string };
          if (apiErr.status === 409) {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setGlobalError(apiErr.message ?? `Leitura deve ser maior que a ultima registrada`);
          } else {
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            setGlobalError('Nao foi possivel registrar. Tente novamente.');
          }
        }
      } else {
        // Offline: queue the reading
        const localId = generateLocalId();
        const offlineQueue = createOfflineQueue(db);
        await offlineQueue.enqueue(
          'meter_readings',
          localId,
          'CREATE',
          payload,
          `/api/org/${orgId ?? 'unknown'}/meter-readings`,
          'POST',
        );

        if (isConnected) {
          await flushNow();
        }

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Leitura salva offline', 'Sera enviada ao reconectar.');
        router.back();
      }
    } catch {
      setGlobalError('Nao foi possivel registrar. Verifique sua conexao.');
    } finally {
      setIsSaving(false);
    }
  }, [
    validate,
    db,
    selectedAsset,
    readingType,
    readingValue,
    readingDate,
    notes,
    isConnected,
    flushNow,
    user,
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
        {item.assetTag ? <Text style={styles.dropdownItemTag}>{item.assetTag}</Text> : null}
      </Pressable>
    ),
    [styles, handleSelectAsset],
  );

  const isSubmitDisabled =
    isSaving || !selectedAsset || !readingValue.trim() || hasAntiRegressionError;

  return (
    <SafeAreaView style={styles.safeArea} accessibilityLabel="Tela de atualizar leitura">
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
            <Text style={styles.headerTitle}>Atualizar Leitura</Text>
          </View>

          {/* Offline banner */}
          {!isConnected && (
            <View style={styles.offlineBanner} accessibilityLiveRegion="polite">
              <WifiOff size={16} color={colors.warning[500]} aria-hidden />
              <Text style={styles.offlineText}>Sem conexao. A leitura sera enfileirada.</Text>
            </View>
          )}

          {/* Global error */}
          {globalError && (
            <View style={styles.errorRow} accessibilityLiveRegion="polite" role="alert">
              <AlertCircle size={14} color={colors.error[500]} aria-hidden />
              <Text style={styles.errorText}>{globalError}</Text>
            </View>
          )}

          {/* Asset picker */}
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

          {/* Reading type toggle */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Tipo de Leitura *</Text>
            <View style={styles.toggleRow}>
              {(['HOURMETER', 'ODOMETER'] as ReadingType[]).map((type) => {
                const isActive = readingType === type;
                const label = type === 'HOURMETER' ? 'Horimetro' : 'Odometro';
                return (
                  <Pressable
                    key={type}
                    style={[styles.toggleButton, isActive ? styles.toggleButtonActive : undefined]}
                    onPress={() => handleReadingTypeChange(type)}
                    accessibilityRole="radio"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isActive }}
                  >
                    <Text
                      style={[
                        styles.toggleButtonText,
                        isActive ? styles.toggleButtonTextActive : undefined,
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Value input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Valor da Leitura<Text style={styles.requiredStar}>*</Text>
            </Text>
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.textInput,
                  styles.inputFlex,
                  errors.readingValue || hasAntiRegressionError ? styles.textInputError : undefined,
                ]}
                value={readingValue}
                onChangeText={(text) => {
                  setReadingValue(text);
                  if (errors.readingValue) setErrors((prev) => ({ ...prev, readingValue: '' }));
                }}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.neutral[400]}
                accessibilityLabel="Valor da leitura"
                aria-required
                returnKeyType="done"
              />
              <Text style={styles.suffixText}>{unit}</Text>
            </View>
            {currentValue !== undefined && (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing[1],
                  marginTop: spacing[1],
                }}
              >
                <Clock size={12} color={colors.neutral[400]} aria-hidden />
                <Text style={styles.hintText}>
                  Ultima leitura: {currentValue} {unit}
                </Text>
              </View>
            )}
            {errors.readingValue || hasAntiRegressionError ? (
              <View style={styles.errorRow} accessibilityLiveRegion="polite" role="alert">
                <AlertCircle size={14} color={colors.error[500]} aria-hidden />
                <Text style={styles.errorText}>
                  {errors.readingValue ||
                    (hasAntiRegressionError
                      ? `Leitura deve ser maior que ${currentValue} ${unit}`
                      : '')}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Date input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>
              Data da Leitura<Text style={styles.requiredStar}>*</Text>
            </Text>
            <TextInput
              style={[styles.textInput, errors.readingDate ? styles.textInputError : undefined]}
              value={readingDate}
              onChangeText={(text) => {
                setReadingDate(text);
                if (errors.readingDate) setErrors((prev) => ({ ...prev, readingDate: '' }));
              }}
              placeholder="AAAA-MM-DD"
              placeholderTextColor={colors.neutral[400]}
              accessibilityLabel="Data da leitura"
              aria-required
              returnKeyType="next"
            />
            {errors.readingDate ? (
              <View style={styles.errorRow} accessibilityLiveRegion="polite" role="alert">
                <AlertCircle size={14} color={colors.error[500]} aria-hidden />
                <Text style={styles.errorText}>{errors.readingDate}</Text>
              </View>
            ) : null}
          </View>

          {/* Notes input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Observacoes</Text>
            <TextInput
              style={[styles.textInput, styles.textInputMultiline]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Informacoes adicionais sobre a leitura..."
              placeholderTextColor={colors.neutral[400]}
              multiline
              numberOfLines={3}
              accessibilityLabel="Observacoes da leitura"
            />
          </View>
        </ScrollView>

        {/* Sticky footer */}
        <View style={styles.footer}>
          <Pressable
            onPress={() => void handleSubmit()}
            style={({ pressed }) => [
              styles.primaryButton,
              isSubmitDisabled ? styles.primaryButtonDisabled : undefined,
              { opacity: pressed ? 0.9 : 1 },
            ]}
            disabled={isSubmitDisabled}
            accessibilityRole="button"
            accessibilityLabel="Registrar leitura"
            accessibilityState={{ disabled: isSubmitDisabled }}
          >
            <Text style={styles.primaryButtonText}>
              {isSaving ? 'Registrando...' : 'Registrar Leitura'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
