import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  AccessibilityInfo,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeft,
  MapPin,
  WifiOff,
  Clock,
  Coffee,
  LogIn,
  LogOut,
} from 'lucide-react-native';
import { spacing, fontSize, colors } from '@protos-farm/shared';
import { useAuth } from '@/stores/AuthContext';
import { useFarmContext } from '@/stores/FarmContext';
import { useConnectivity } from '@/stores/ConnectivityContext';
import { TimePunchRepository } from '@/services/db/time-punch-repository';
import type { LocalTimePunch, PunchType } from '@/services/db/time-punch-repository';
import { createOfflineQueue } from '@/services/offline-queue';
import { PRIORITY_CRITICAL } from '@/services/db/pending-operations-repository';

// ─── Types ───────────────────────────────────────────────────────────────────

type PunchState = 'IDLE' | 'CLOCKED_IN' | 'ON_BREAK';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Derive punch state from today's punches list (last punch determines state). */
function derivePunchState(punches: LocalTimePunch[]): PunchState {
  if (punches.length === 0) return 'IDLE';
  const last = punches[punches.length - 1];
  if (last.punchType === 'CLOCK_OUT') return 'IDLE';
  if (last.punchType === 'BREAK_START') return 'ON_BREAK';
  // CLOCK_IN or BREAK_END -> clocked in
  return 'CLOCKED_IN';
}

/** Format seconds as HH:MM:SS in a way suitable for monospace display. */
function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format an ISO timestamp to HH:MM (local time). */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Label for a punch type in Portuguese. */
function punchTypeLabel(type: PunchType): string {
  switch (type) {
    case 'CLOCK_IN':
      return 'Entrada';
    case 'BREAK_START':
      return 'Inicio intervalo';
    case 'BREAK_END':
      return 'Fim intervalo';
    case 'CLOCK_OUT':
      return 'Saida';
  }
}

/**
 * Simple point-in-polygon ray-casting algorithm.
 * Returns true if the point is inside the polygon.
 * Polygon is an array of [longitude, latitude] coordinate pairs (GeoJSON format).
 */
function isPointInPolygon(
  lat: number,
  lng: number,
  polygon: [number, number][],
): boolean {
  let inside = false;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    const intersect =
      yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Extract polygon ring from farm boundary GeoJSON.
 * Supports Polygon and MultiPolygon (uses first ring of first polygon).
 */
function extractPolygonRing(
  geojson: unknown,
): [number, number][] | null {
  try {
    const g = geojson as {
      type: string;
      coordinates?: unknown;
    };
    if (g.type === 'Polygon') {
      return (g.coordinates as [number, number][][])[0] ?? null;
    }
    if (g.type === 'MultiPolygon') {
      return ((g.coordinates as [number, number][][][])[0]?.[0]) ?? null;
    }
    if (g.type === 'Feature') {
      return extractPolygonRing((geojson as unknown as { geometry: unknown }).geometry);
    }
    return null;
  } catch {
    return null;
  }
}

// ─── Sync dots ────────────────────────────────────────────────────────────────

interface SyncDotProps {
  status: 'synced' | 'syncing' | 'pending';
}

function SyncDot({ status }: SyncDotProps) {
  const bgColor =
    status === 'synced'
      ? '#43A047'
      : status === 'syncing'
        ? '#FFB300'
        : '#78909C';
  return (
    <View
      style={[styles.syncDot, { backgroundColor: bgColor }]}
      accessibilityRole="text"
      accessibilityLabel={
        status === 'synced'
          ? 'Sincronizado'
          : status === 'syncing'
            ? 'Sincronizando'
            : 'Pendente de sincronizacao'
      }
    />
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TimePunchScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { selectedFarm } = useFarmContext();
  const { isConnected } = useConnectivity();

  const repository = useRef(new TimePunchRepository(db)).current;
  const queue = useRef(createOfflineQueue(db)).current;

  const [todayPunches, setTodayPunches] = useState<LocalTimePunch[]>([]);
  const [punchState, setPunchState] = useState<PunchState>('IDLE');
  const [isRegistering, setIsRegistering] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<'inside' | 'outside' | 'unknown' | 'denied'>('unknown');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Pulse animation state (manual, respects reduced motion)
  const [pulseOpacity, setPulseOpacity] = useState(1);

  // ─── Load today's punches on mount ────────────────────────────────────────

  const loadPunches = useCallback(async () => {
    if (!user) return;
    const punches = await repository.getTodayPunches(user.userId);
    setTodayPunches(punches);
    setPunchState(derivePunchState(punches));
    const count = await repository.getPendingCount();
    setPendingCount(count);
  }, [user, repository]);

  useEffect(() => {
    void loadPunches();
  }, [loadPunches]);

  // ─── Check reduced motion ─────────────────────────────────────────────────

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);

  // ─── Pulse animation while clocked in ────────────────────────────────────

  useEffect(() => {
    if (punchState !== 'CLOCKED_IN' || reduceMotion) {
      setPulseOpacity(1);
      return;
    }
    let increasing = false;
    const interval = setInterval(() => {
      setPulseOpacity((prev) => {
        if (prev <= 0.3) increasing = true;
        if (prev >= 1) increasing = false;
        return increasing ? Math.min(prev + 0.05, 1) : Math.max(prev - 0.05, 0.3);
      });
    }, 50);
    return () => clearInterval(interval);
  }, [punchState, reduceMotion]);

  // ─── Elapsed timer while clocked in ───────────────────────────────────────

  useEffect(() => {
    if (punchState !== 'CLOCKED_IN') {
      setElapsedSeconds(0);
      return;
    }
    // Find last CLOCK_IN or BREAK_END
    const clockInPunch = [...todayPunches]
      .reverse()
      .find((p) => p.punchType === 'CLOCK_IN' || p.punchType === 'BREAK_END');

    if (!clockInPunch) return;

    const startTime = new Date(clockInPunch.punchedAt).getTime();
    const update = () => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [punchState, todayPunches]);

  // ─── GPS capture + geofence check ─────────────────────────────────────────

  const captureGpsAndCheck = useCallback(async (): Promise<{
    latitude: number | null;
    longitude: number | null;
    outOfRange: boolean;
    gpsAvailable: boolean;
  }> => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      setGpsStatus('denied');
      return { latitude: null, longitude: null, outOfRange: false, gpsAvailable: false };
    }

    let coords: { latitude: number; longitude: number } | null = null;
    try {
      const loc = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('GPS timeout')), 3000),
        ),
      ]);
      coords = loc.coords;
    } catch {
      // GPS timeout or error — register without coordinates
      setGpsStatus('unknown');
      return { latitude: null, longitude: null, outOfRange: false, gpsAvailable: false };
    }

    // Geofence check using farm boundary if available
    let outOfRange = false;
    if (selectedFarm) {
      const farmRecord = await db.getFirstAsync<{ boundary_geojson: string | null }>(
        'SELECT boundary_geojson FROM farms WHERE id = ?',
        [selectedFarm.id],
      );
      if (farmRecord?.boundary_geojson) {
        try {
          const geojson = JSON.parse(farmRecord.boundary_geojson) as unknown;
          const ring = extractPolygonRing(geojson);
          if (ring) {
            const inside = isPointInPolygon(coords.latitude, coords.longitude, ring);
            outOfRange = !inside;
            setGpsStatus(inside ? 'inside' : 'outside');
          } else {
            setGpsStatus('unknown');
          }
        } catch {
          setGpsStatus('unknown');
        }
      } else {
        // No boundary cached — treat as unknown
        setGpsStatus('unknown');
      }
    }

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      outOfRange,
      gpsAvailable: true,
    };
  }, [selectedFarm, db]);

  // ─── Register a punch ─────────────────────────────────────────────────────

  const registerPunch = useCallback(
    async (punchType: PunchType) => {
      if (!user || !selectedFarm || isRegistering) return;

      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsRegistering(true);

      try {
        const { latitude, longitude, outOfRange, gpsAvailable } = await captureGpsAndCheck();

        // Warn if out of range, but do NOT block
        if (outOfRange && gpsAvailable) {
          await new Promise<void>((resolve, reject) => {
            Alert.alert(
              'Fora do perimetro',
              'Voce esta fora do perimetro da fazenda. Registrar mesmo assim?',
              [
                {
                  text: 'Cancelar',
                  style: 'cancel',
                  onPress: () => reject(new Error('cancelled')),
                },
                { text: 'Registrar', onPress: () => resolve() },
              ],
              { cancelable: false },
            );
          });
        }

        const punchedAt = new Date().toISOString();
        const organizationId = user.organizationId ?? '';

        const punch = await repository.create({
          employeeId: user.userId,
          organizationId,
          farmId: selectedFarm.id,
          punchType,
          punchedAt,
          latitude,
          longitude,
          outOfRange,
        });

        // Enqueue for sync
        const endpoint = `/api/org/${organizationId}/employees/${user.userId}/time-entries`;
        await queue.enqueue(
          'time_punches',
          punch.id,
          'CREATE',
          {
            id: punch.id,
            employeeId: punch.employeeId,
            organizationId: punch.organizationId,
            farmId: punch.farmId,
            punchType: punch.punchType,
            punchedAt: punch.punchedAt,
            latitude: punch.latitude,
            longitude: punch.longitude,
            outOfRange: punch.outOfRange,
          },
          endpoint,
          'POST',
          PRIORITY_CRITICAL,
        );

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        await loadPunches();
      } catch (err) {
        if (err instanceof Error && err.message === 'cancelled') {
          // User cancelled — nothing to do
        } else {
          Alert.alert('Erro', 'Nao foi possivel registrar o ponto. Tente novamente.');
        }
      } finally {
        setIsRegistering(false);
      }
    },
    [user, selectedFarm, isRegistering, captureGpsAndCheck, repository, queue, loadPunches],
  );

  // ─── Button action dispatch ───────────────────────────────────────────────

  const handlePrimaryPress = useCallback(() => {
    switch (punchState) {
      case 'IDLE':
        void registerPunch('CLOCK_IN');
        break;
      case 'CLOCKED_IN':
        void registerPunch('CLOCK_OUT');
        break;
      case 'ON_BREAK':
        void registerPunch('BREAK_END');
        break;
    }
  }, [punchState, registerPunch]);

  const handleBreakPress = useCallback(() => {
    void registerPunch('BREAK_START');
  }, [registerPunch]);

  // ─── Derived UI state ─────────────────────────────────────────────────────

  const primaryButtonLabel =
    punchState === 'IDLE'
      ? 'Entrar'
      : punchState === 'CLOCKED_IN'
        ? 'Sair'
        : 'Retornar';

  const primaryButtonSubLabel =
    punchState === 'IDLE'
      ? 'Registrar entrada'
      : punchState === 'CLOCKED_IN'
        ? 'Registrar saida'
        : 'Registrar retorno';

  const primaryAccessibilityLabel =
    punchState === 'IDLE'
      ? 'Registrar entrada'
      : punchState === 'CLOCKED_IN'
        ? 'Registrar saida'
        : 'Registrar retorno do intervalo';

  const gpsChipLabel =
    gpsStatus === 'inside'
      ? 'Dentro da fazenda'
      : gpsStatus === 'outside'
        ? 'Fora do perimetro'
        : gpsStatus === 'denied'
          ? 'GPS negado'
          : 'Verificando GPS...';

  const gpsChipColor =
    gpsStatus === 'inside'
      ? colors.primary[600]
      : gpsStatus === 'outside'
        ? '#F57F17'
        : colors.neutral[400];

  const syncDotStatus: 'synced' | 'syncing' | 'pending' =
    pendingCount === 0 ? 'synced' : isConnected ? 'syncing' : 'pending';

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ArrowLeft size={24} color={colors.neutral[700]} aria-hidden />
        </Pressable>
        <Text style={styles.headerTitle}>Registro de Ponto</Text>
        <View style={styles.syncRow}>
          <SyncDot status={syncDotStatus} />
        </View>
      </View>

      {/* Offline banner */}
      {!isConnected && (
        <View style={styles.offlineBanner} accessibilityRole="alert">
          <WifiOff size={16} color={colors.neutral[0]} aria-hidden />
          <Text style={styles.offlineBannerText}>
            Sem conexao. Os registros serao enviados quando voce voltar online.
          </Text>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Employee / farm card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {selectedFarm?.name ?? 'Nenhuma fazenda selecionada'}
          </Text>
          <Text style={styles.cardSubtitle} numberOfLines={1}>
            {user?.email ?? ''}
          </Text>
        </View>

        {/* GPS status chip */}
        <View style={styles.gpsRow}>
          <MapPin size={16} color={gpsChipColor} aria-hidden />
          <Text
            style={[styles.gpsChipText, { color: gpsChipColor }]}
            accessibilityRole="text"
            accessibilityLabel={`Status GPS: ${gpsChipLabel}`}
          >
            {gpsChipLabel}
          </Text>
        </View>

        {/* Elapsed time while clocked in */}
        {punchState === 'CLOCKED_IN' && (
          <View style={styles.elapsedContainer}>
            <Clock size={16} color={colors.primary[600]} aria-hidden />
            <Text style={styles.elapsedText}>{formatElapsed(elapsedSeconds)}</Text>
          </View>
        )}

        {/* Primary clock-in/out button */}
        <View style={styles.primaryButtonWrapper}>
          {punchState === 'CLOCKED_IN' && (
            <View
              style={[
                styles.pulseRing,
                { opacity: reduceMotion ? 0 : pulseOpacity },
              ]}
            />
          )}
          <Pressable
            onPress={handlePrimaryPress}
            disabled={isRegistering || !selectedFarm}
            accessible
            accessibilityLabel={primaryAccessibilityLabel}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && styles.primaryButtonPressed,
              (isRegistering || !selectedFarm) && styles.primaryButtonDisabled,
            ]}
          >
            {punchState === 'IDLE' ? (
              <LogIn size={28} color={colors.neutral[0]} aria-hidden />
            ) : punchState === 'CLOCKED_IN' ? (
              <LogOut size={28} color={colors.neutral[0]} aria-hidden />
            ) : (
              <LogIn size={28} color={colors.neutral[0]} aria-hidden />
            )}
            <Text style={styles.primaryButtonLabel}>{primaryButtonLabel}</Text>
            <Text style={styles.primaryButtonSubLabel}>{primaryButtonSubLabel}</Text>
          </Pressable>
        </View>

        {/* Break button — only while clocked in */}
        {punchState === 'CLOCKED_IN' && (
          <Pressable
            onPress={handleBreakPress}
            disabled={isRegistering}
            accessible
            accessibilityLabel="Iniciar intervalo"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.secondaryButton,
              pressed && styles.secondaryButtonPressed,
              isRegistering && styles.primaryButtonDisabled,
            ]}
          >
            <Coffee size={20} color={colors.primary[600]} aria-hidden />
            <Text style={styles.secondaryButtonLabel}>Iniciar Intervalo</Text>
          </Pressable>
        )}

        {/* Today's entries list */}
        {todayPunches.length > 0 && (
          <View style={styles.entriesSection}>
            <Text style={styles.entriesSectionTitle}>Registros de hoje</Text>
            {todayPunches.map((punch) => (
              <View key={punch.id} style={styles.punchRow}>
                <Text style={styles.punchTypeLabel}>{punchTypeLabel(punch.punchType)}</Text>
                <Text style={styles.punchTime}>{formatTime(punch.punchedAt)}</Text>
                <View style={styles.punchSyncDot}>
                  <SyncDot status={punch.synced ? 'synced' : 'pending'} />
                </View>
              </View>
            ))}
          </View>
        )}

        {todayPunches.length === 0 && (
          <View style={styles.emptyState}>
            <Clock size={48} color={colors.neutral[300]} aria-hidden />
            <Text style={styles.emptyStateTitle}>Nenhum registro hoje</Text>
            <Text style={styles.emptyStateDesc}>
              Toque no botao acima para registrar sua entrada.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: colors.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    minHeight: 56,
  },
  backButton: {
    minWidth: 48,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  headerTitle: {
    flex: 1,
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.md,
    color: colors.neutral[800],
    marginLeft: spacing[2],
  },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[1],
  },
  syncDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    backgroundColor: '#78909C',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
  },
  offlineBannerText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: colors.neutral[0],
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing[4],
    gap: spacing[4],
    alignItems: 'center',
  },
  card: {
    width: '100%',
    backgroundColor: colors.neutral[0],
    borderRadius: 12,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  cardTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: colors.neutral[800],
  },
  cardSubtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: colors.neutral[500],
    marginTop: spacing[1],
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    alignSelf: 'flex-start',
    backgroundColor: colors.neutral[100],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 20,
  },
  gpsChipText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
  },
  elapsedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  elapsedText: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: fontSize.xl,
    color: colors.primary[600],
    letterSpacing: 2,
  },
  primaryButtonWrapper: {
    position: 'relative',
    width: 88,
    height: 88,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: spacing[4],
  },
  pulseRing: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary[200],
  },
  primaryButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary[600],
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  primaryButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonLabel: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.xs,
    color: colors.neutral[0],
    marginTop: 2,
  },
  primaryButtonSubLabel: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: 10,
    color: colors.neutral[100],
    textAlign: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    borderWidth: 1.5,
    borderColor: colors.primary[600],
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 48,
    backgroundColor: colors.neutral[0],
  },
  secondaryButtonPressed: {
    opacity: 0.7,
    backgroundColor: colors.neutral[100],
  },
  secondaryButtonLabel: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: colors.primary[600],
  },
  entriesSection: {
    width: '100%',
    backgroundColor: colors.neutral[0],
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
    marginTop: spacing[2],
  },
  entriesSectionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.sm,
    color: colors.neutral[600],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  punchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[100],
  },
  punchTypeLabel: {
    flex: 1,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: colors.neutral[700],
  },
  punchTime: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: fontSize.base,
    color: colors.neutral[800],
    marginRight: spacing[3],
  },
  punchSyncDot: {
    width: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing[3],
    paddingVertical: spacing[8],
  },
  emptyStateTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.md,
    color: colors.neutral[600],
  },
  emptyStateDesc: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: colors.neutral[400],
    textAlign: 'center',
  },
});
