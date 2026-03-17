import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ShoppingCart, ArrowLeft, Plus, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useFarmContext } from '@/stores/FarmContext';
import { useAuth } from '@/stores/AuthContext';
import { createPurchaseRequestRepository } from '@/services/db';
import { api } from '@/services/api';
import type { ThemeColors } from '@/stores/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusFilter = 'Todas' | 'Pendente' | 'Aprovada' | 'Rejeitada';

interface ServerRC {
  id: string;
  rcNumber?: string;
  requestType: string;
  status: string;
  urgency: string;
  createdAt: string;
  items?: Array<{ productName: string; quantity: number; unitName: string }>;
}

interface DisplayRC {
  id: string; // serverId or localId
  isLocal: boolean;
  rcNumber?: string;
  requestType?: string;
  status: string; // server status or 'local'
  urgency: string;
  createdAt: string;
  productSummary: string;
}

const STATUS_FILTER_OPTIONS: StatusFilter[] = ['Todas', 'Pendente', 'Aprovada', 'Rejeitada'];

const STATUS_LABELS: Record<string, string> = {
  RASCUNHO: 'Rascunho',
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  REJEITADA: 'Rejeitada',
  DEVOLVIDA: 'Devolvida',
  CANCELADA: 'Cancelada',
  local: 'Pendente envio',
};

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `${minutes}min atrás`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => ({
  safeArea: { flex: 1 as const, backgroundColor: c.neutral[50] },
  container: { flex: 1 as const },

  // Header
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    backgroundColor: c.neutral[0],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
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
  newButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
    backgroundColor: c.primary[600],
    borderRadius: 8,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    minHeight: 40,
  },
  newButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: '#fff',
  },

  // Filter tabs
  filterScrollContent: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    gap: spacing[2],
    flexDirection: 'row' as const,
  },
  filterTab: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.neutral[200],
    minHeight: 36,
    justifyContent: 'center' as const,
  },
  filterTabActive: {
    borderColor: c.primary[600],
    borderBottomWidth: 2,
  },
  filterTabText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
  filterTabTextActive: {
    color: c.primary[700],
    fontFamily: 'SourceSans3_600SemiBold',
  },

  // List
  listContent: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },

  // Card
  card: {
    backgroundColor: c.neutral[0],
    borderRadius: 12,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: c.neutral[200],
    gap: spacing[2],
  },
  cardPressed: { opacity: 0.85, backgroundColor: c.neutral[50] },
  cardTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing[2],
  },
  rcNumber: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[600],
  },
  badgeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
  },
  statusBadge: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  statusBadgeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.xs,
  },
  offlineBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: c.neutral[100],
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  offlineBadgeText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[500],
  },
  urgencyChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgencyText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
  },
  productText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },
  dateRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
  },
  dateText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
  },

  // Empty state
  emptyContainer: {
    flex: 1 as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    padding: spacing[8],
    gap: spacing[3],
  },
  emptyTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[700],
    textAlign: 'center' as const,
  },
  emptyDesc: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[500],
    textAlign: 'center' as const,
  },
  emptyButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.primary[600],
    borderRadius: 8,
    paddingHorizontal: spacing[5],
    paddingVertical: spacing[3],
    minHeight: 48,
    marginTop: spacing[2],
  },
  emptyButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: '#fff',
  },
});

// ─── Status badge colors ──────────────────────────────────────────────────────

function getStatusColors(status: string, colors: ThemeColors): { bg: string; text: string } {
  switch (status) {
    case 'PENDENTE':
      return { bg: colors.warning[100], text: colors.warning[500] };
    case 'APROVADA':
      return { bg: colors.primary[100], text: colors.primary[700] };
    case 'REJEITADA':
      return { bg: colors.error[100], text: colors.error[500] };
    case 'DEVOLVIDA':
      return { bg: colors.neutral[100], text: colors.neutral[600] };
    case 'CANCELADA':
    case 'RASCUNHO':
      return { bg: colors.neutral[100], text: colors.neutral[500] };
    case 'local':
      return { bg: colors.neutral[100], text: colors.neutral[400] };
    default:
      return { bg: colors.neutral[100], text: colors.neutral[500] };
  }
}

function getUrgencyColors(urgency: string, colors: ThemeColors): { bg: string; text: string } {
  switch (urgency) {
    case 'EMERGENCIAL':
      return { bg: colors.error[100], text: colors.error[500] };
    case 'URGENTE':
      return { bg: colors.warning[100], text: colors.warning[500] };
    default:
      return { bg: colors.neutral[100], text: colors.neutral[500] };
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function MyRequestsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { selectedFarm } = useFarmContext();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [activeFilter, setActiveFilter] = useState<StatusFilter>('Todas');
  const [items, setItems] = useState<DisplayRC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const purchaseRepo = createPurchaseRequestRepository(db);
      await purchaseRepo.initPurchaseRequestTable();

      // Local unsynced records
      const localRecords = await purchaseRepo.listPurchaseRequests(selectedFarm?.id);
      const unsyncedLocal = localRecords.filter((r) => r.status !== 'synced');

      // Server records
      let serverItems: DisplayRC[] = [];
      try {
        const params = new URLSearchParams({ limit: '50' });
        if (user?.userId) params.set('createdBy', user.userId);
        const response = await api.get<{ data: ServerRC[] }>(
          `/api/org/purchase-requests?${params.toString()}`,
        );
        serverItems = (response.data ?? []).map((rc) => ({
          id: rc.id,
          isLocal: false,
          rcNumber: rc.rcNumber,
          requestType: rc.requestType,
          status: rc.status,
          urgency: rc.urgency ?? 'NORMAL',
          createdAt: rc.createdAt,
          productSummary: rc.items?.[0]?.productName ?? rc.requestType,
        }));
      } catch {
        // Offline — show only local data
      }

      // Build local display items (exclude those already synced on server)
      const syncedServerIds = new Set(serverItems.map((s) => s.id));
      const localDisplayItems: DisplayRC[] = unsyncedLocal
        .filter((r) => !r.serverId || !syncedServerIds.has(r.serverId))
        .map((r, idx) => ({
          id: r.localId,
          isLocal: true,
          rcNumber: `Local #${idx + 1}`,
          status: r.status,
          urgency: r.urgency,
          createdAt: r.createdAt,
          productSummary: r.productName,
        }));

      const merged = [...localDisplayItems, ...serverItems].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      setItems(merged);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [db, selectedFarm?.id, user?.userId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchData();
  }, [fetchData]);

  // Filter items based on active tab
  const filteredItems = items.filter((item) => {
    if (activeFilter === 'Todas') return true;
    if (activeFilter === 'Pendente')
      return item.status === 'PENDENTE' || item.status === 'local' || item.status === 'syncing';
    if (activeFilter === 'Aprovada') return item.status === 'APROVADA';
    if (activeFilter === 'Rejeitada') return item.status === 'REJEITADA';
    return true;
  });

  const renderCard = useCallback(
    ({ item }: { item: DisplayRC }) => {
      const statusColors = getStatusColors(item.status, colors);
      const urgencyColors = getUrgencyColors(item.urgency, colors);
      const statusLabel = STATUS_LABELS[item.status] ?? item.status;

      return (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          accessibilityRole="button"
          accessibilityLabel={`Requisicao ${item.rcNumber ?? ''}: ${item.productSummary}, status ${statusLabel}`}
          onPress={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
        >
          <View style={styles.cardTopRow}>
            <Text style={styles.rcNumber}>{item.rcNumber ?? '—'}</Text>
            <View style={styles.badgeRow}>
              {item.isLocal && (
                <View
                  style={styles.offlineBadge}
                  accessibilityRole="text"
                  accessibilityLabel="Pendente envio"
                >
                  <Clock size={10} color={colors.neutral[400]} aria-hidden />
                  <Text style={styles.offlineBadgeText}>Pendente envio</Text>
                </View>
              )}
              <View
                style={[styles.statusBadge, { backgroundColor: statusColors.bg }]}
                accessibilityRole="text"
                accessibilityLabel={`Status: ${statusLabel}`}
              >
                <Text style={[styles.statusBadgeText, { color: statusColors.text }]}>
                  {statusLabel}
                </Text>
              </View>
            </View>
          </View>

          <Text style={styles.productText} numberOfLines={1}>
            {item.productSummary}
          </Text>

          <View style={styles.cardTopRow}>
            <View style={styles.dateRow}>
              <Clock size={12} color={colors.neutral[300]} aria-hidden />
              <Text style={styles.dateText}>{formatRelativeTime(item.createdAt)}</Text>
            </View>
            {item.urgency !== 'NORMAL' && (
              <View style={[styles.urgencyChip, { backgroundColor: urgencyColors.bg }]}>
                <Text style={[styles.urgencyText, { color: urgencyColors.text }]}>
                  {item.urgency === 'URGENTE' ? 'Urgente' : 'Emergencial'}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      );
    },
    [styles, colors],
  );

  const keyExtractor = useCallback((item: DisplayRC) => item.id, []);

  const ListEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <ShoppingCart size={48} color={colors.neutral[300]} aria-hidden />
        <Text style={styles.emptyTitle}>
          {activeFilter === 'Todas'
            ? 'Voce nao tem requisicoes ainda.'
            : `Nenhuma requisicao ${activeFilter.toLowerCase()}.`}
        </Text>
        <Text style={styles.emptyDesc}>
          Crie uma nova requisicao de compra diretamente do campo.
        </Text>
        {activeFilter === 'Todas' && (
          <Pressable
            style={({ pressed }) => [styles.emptyButton, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(app)/purchase-request');
            }}
            accessibilityRole="button"
            accessibilityLabel="Nova Requisicao"
          >
            <Plus size={20} color="#fff" aria-hidden />
            <Text style={styles.emptyButtonText}>Nova Requisicao</Text>
          </Pressable>
        )}
      </View>
    ),
    [styles, colors, activeFilter, router],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <ArrowLeft size={24} color={colors.neutral[700]} aria-hidden />
          </Pressable>
          <Text style={styles.headerTitle}>Minhas Requisicoes</Text>
          <Pressable
            style={({ pressed }) => [styles.newButton, { opacity: pressed ? 0.85 : 1 }]}
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/(app)/purchase-request');
            }}
            accessibilityRole="button"
            accessibilityLabel="Nova Requisicao"
          >
            <Plus size={16} color="#fff" aria-hidden />
            <Text style={styles.newButtonText}>Nova</Text>
          </Pressable>
        </View>

        {/* Filter tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {STATUS_FILTER_OPTIONS.map((filter) => (
            <Pressable
              key={filter}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setActiveFilter(filter);
              }}
              style={[styles.filterTab, activeFilter === filter && styles.filterTabActive]}
              accessibilityRole="button"
              accessibilityLabel={filter}
              accessibilityState={{ selected: activeFilter === filter }}
            >
              <Text
                style={[
                  styles.filterTabText,
                  activeFilter === filter && styles.filterTabTextActive,
                ]}
              >
                {filter}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* List */}
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator color={colors.primary[600]} />
          </View>
        ) : (
          <FlatList
            data={filteredItems}
            renderItem={renderCard}
            keyExtractor={keyExtractor}
            contentContainerStyle={[styles.listContent, filteredItems.length === 0 && { flex: 1 }]}
            ListEmptyComponent={ListEmptyComponent}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={colors.primary[600]}
              />
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
