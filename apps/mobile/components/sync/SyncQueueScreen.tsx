import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  Alert,
  RefreshControl,
  type ListRenderItemInfo,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Activity,
  Plus,
  Edit3,
  Minus,
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { spacing, fontSize } from '@protos-farm/shared';
import { useSyncContext } from '@/stores/SyncContext';
import { useTheme, type ThemeColors } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { useOfflineData } from '@/hooks/useOfflineData';
import type { PendingOperation } from '@/services/db/pending-operations-repository';
import type { ConflictLogEntry } from '@/services/db/conflict-log-repository';
import type { SyncMetrics } from '@/services/offline-queue';

// ─── Entity labels ────────────────────────────────────────────────────────

const ENTITY_LABELS: Record<string, string> = {
  animals: 'Animais',
  animal_lots: 'Lotes',
  farm_locations: 'Locais',
  animal_weighings: 'Pesagens',
  animal_health_records: 'Registros sanitarios',
  animal_reproductive_records: 'Registros reprodutivos',
  animal_lot_movements: 'Movimentacoes',
  field_operations: 'Operacoes de campo',
  pesticide_applications: 'Aplicacoes defensivos',
  monitoring_records: 'Monitoramento MIP',
  planting_operations: 'Plantios',
  vaccinations: 'Vacinacoes',
  dewormings: 'Vermifugacoes',
  therapeutic_treatments: 'Tratamentos',
  heat_records: 'Registros de cio',
  inseminations: 'Inseminacoes',
  pregnancy_diagnoses: 'Diagnosticos gestacao',
  calving_events: 'Partos',
  mastitis_cases: 'Mastites',
};

const OPERATION_CONFIG: Record<string, { label: string; color: string; icon: LucideIcon }> = {
  CREATE: { label: 'Criar', color: '#16A34A', icon: Plus },
  UPDATE: { label: 'Atualizar', color: '#2563EB', icon: Edit3 },
  DELETE: { label: 'Excluir', color: '#DC2626', icon: Minus },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: '#F59E0B' },
  syncing: { label: 'Enviando...', color: '#3B82F6' },
  error: { label: 'Erro', color: '#DC2626' },
};

type SectionKey = 'pending' | 'conflicts' | 'metrics';

// ─── Styles ───────────────────────────────────────────────────────────────

const createStyles = (c: ThemeColors) => ({
  safeArea: { flex: 1 as const, backgroundColor: c.neutral[50] },
  container: { flex: 1 as const },
  header: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[3],
  },
  title: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.xl,
    color: c.neutral[800],
  },
  subtitle: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    marginTop: spacing[1],
  },
  actionsBar: {
    flexDirection: 'row' as const,
    gap: spacing[3],
    paddingHorizontal: spacing[4],
    paddingBottom: spacing[3],
  },
  actionButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderRadius: 8,
    backgroundColor: c.primary[600],
    minHeight: 48,
  },
  actionButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  actionButtonDestructive: {
    backgroundColor: c.error[500],
  },
  actionButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[0],
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    backgroundColor: c.neutral[100],
    minHeight: 48,
  },
  sectionHeaderPressed: {
    backgroundColor: c.neutral[200],
  },
  sectionHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
  },
  sectionTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },
  sectionBadge: {
    backgroundColor: c.primary[600],
    borderRadius: 12,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center' as const,
  },
  sectionBadgeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.xs,
    color: c.neutral[0],
  },
  opCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
    gap: spacing[3],
    minHeight: 56,
  },
  opIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  opContent: {
    flex: 1 as const,
  },
  opEntityLabel: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[700],
  },
  opTimestamp: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
    marginTop: 2,
  },
  opError: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.error[500],
    marginTop: 2,
  },
  opBadgeRow: {
    flexDirection: 'row' as const,
    gap: spacing[2],
    alignItems: 'center' as const,
    marginTop: spacing[1],
  },
  badge: {
    borderRadius: 4,
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
  },
  conflictCard: {
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  conflictHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing[2],
  },
  conflictEntity: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[700],
  },
  conflictTimestamp: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[400],
  },
  conflictResolution: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
    color: c.neutral[500],
    marginTop: spacing[1],
  },
  conflictAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 6,
    backgroundColor: c.primary[600],
    minHeight: 36,
    minWidth: 48,
    marginTop: spacing[2],
    alignSelf: 'flex-start' as const,
  },
  conflictActionText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.xs,
    color: c.neutral[0],
  },
  metricsContainer: {
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    gap: spacing[3],
  },
  metricsRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  metricsLabel: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
  metricsValue: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[700],
  },
  metricsDivider: {
    height: 1,
    backgroundColor: c.neutral[100],
  },
  emptyState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: spacing[8],
    paddingHorizontal: spacing[4],
  },
  emptyTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.md,
    color: c.neutral[700],
    marginTop: spacing[3],
  },
  emptyDescription: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
    marginTop: spacing[2],
    textAlign: 'center' as const,
  },
  progressBar: {
    height: 4,
    backgroundColor: c.neutral[200],
    borderRadius: 2,
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
  },
  progressFill: {
    height: 4,
    backgroundColor: c.primary[600],
    borderRadius: 2,
  },
  retryCount: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: fontSize.xs,
    color: '#9CA3AF',
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────

function formatRelativeTime(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'agora';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}min atras`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h atras`;
  const days = Math.floor(hours / 24);
  return `${days}d atras`;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function PendingOperationCard({
  op,
  styles,
}: {
  op: PendingOperation;
  styles: ReturnType<typeof createStyles>;
}) {
  const opConfig = OPERATION_CONFIG[op.operation] ?? OPERATION_CONFIG.UPDATE;
  const statusConfig = STATUS_CONFIG[op.status] ?? STATUS_CONFIG.pending;
  const OpIcon = opConfig.icon;
  const entityLabel = ENTITY_LABELS[op.entity] ?? op.entity;
  const isCritical = op.priority === 1;

  return (
    <View
      style={styles.opCard}
      accessibilityRole="text"
      accessibilityLabel={`${entityLabel}, ${opConfig.label}, ${statusConfig.label}${isCritical ? ', prioridade critica' : ''}`}
    >
      <View style={[styles.opIconContainer, { backgroundColor: opConfig.color + '18' }]}>
        <OpIcon size={20} color={opConfig.color} aria-hidden />
      </View>
      <View style={styles.opContent}>
        <Text style={styles.opEntityLabel}>{entityLabel}</Text>
        <View style={styles.opBadgeRow}>
          <View style={[styles.badge, { backgroundColor: opConfig.color }]}>
            <Text style={styles.badgeText}>{opConfig.label}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: statusConfig.color }]}>
            <Text style={styles.badgeText}>{statusConfig.label}</Text>
          </View>
          {isCritical && (
            <View style={[styles.badge, { backgroundColor: '#DC2626' }]}>
              <Text style={styles.badgeText}>CRITICO</Text>
            </View>
          )}
        </View>
        <Text style={styles.opTimestamp}>{formatRelativeTime(op.created_at)}</Text>
        {op.last_error && (
          <Text style={styles.opError} numberOfLines={2}>
            {op.last_error}
          </Text>
        )}
      </View>
      {op.retries > 0 && (
        <View accessibilityLabel={`${op.retries} tentativas`} accessibilityRole="text">
          <Text style={styles.retryCount}>x{op.retries}</Text>
        </View>
      )}
    </View>
  );
}

function ConflictCard({
  conflict,
  styles,
  onReview,
}: {
  conflict: ConflictLogEntry;
  styles: ReturnType<typeof createStyles>;
  onReview: (id: number) => void;
}) {
  const entityLabel = ENTITY_LABELS[conflict.entity] ?? conflict.entity;

  return (
    <View style={styles.conflictCard}>
      <View style={styles.conflictHeader}>
        <View>
          <Text style={styles.conflictEntity}>
            {entityLabel} - {conflict.entity_id.slice(0, 8)}...
          </Text>
          <Text style={styles.conflictTimestamp}>{formatRelativeTime(conflict.resolved_at)}</Text>
        </View>
      </View>
      <Text style={styles.conflictResolution}>
        Resolucao:{' '}
        {conflict.resolution === 'server_wins' ? 'Servidor prevaleceu' : conflict.resolution}
      </Text>
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onReview(conflict.id);
        }}
        style={({ pressed }) => [styles.conflictAction, pressed && { opacity: 0.85 }]}
        accessibilityRole="button"
        accessibilityLabel={`Aceitar resolucao do conflito de ${entityLabel}`}
      >
        <CheckCircle size={14} color="#FFFFFF" aria-hidden />
        <Text style={styles.conflictActionText}>Aceitar servidor</Text>
      </Pressable>
    </View>
  );
}

function MetricsSection({
  metrics,
  styles,
}: {
  metrics: SyncMetrics;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.metricsContainer}>
      <View style={styles.metricsRow}>
        <Text style={styles.metricsLabel}>Ultima sincronizacao</Text>
        <Text style={styles.metricsValue}>
          {metrics.startedAt ? formatRelativeTime(metrics.startedAt) : '--'}
        </Text>
      </View>
      <View style={styles.metricsDivider} />
      <View style={styles.metricsRow}>
        <Text style={styles.metricsLabel}>Duracao</Text>
        <Text style={styles.metricsValue}>{formatDuration(metrics.durationMs)}</Text>
      </View>
      <View style={styles.metricsDivider} />
      <View style={styles.metricsRow}>
        <Text style={styles.metricsLabel}>Enviado</Text>
        <Text style={styles.metricsValue}>{formatBytes(metrics.payloadBytesUp)}</Text>
      </View>
      <View style={styles.metricsDivider} />
      <View style={styles.metricsRow}>
        <Text style={styles.metricsLabel}>Recebido</Text>
        <Text style={styles.metricsValue}>{formatBytes(metrics.payloadBytesDown)}</Text>
      </View>
      <View style={styles.metricsDivider} />
      <View style={styles.metricsRow}>
        <Text style={styles.metricsLabel}>Operacoes processadas</Text>
        <Text style={styles.metricsValue}>{metrics.operationsProcessed}</Text>
      </View>
      <View style={styles.metricsDivider} />
      <View style={styles.metricsRow}>
        <Text style={styles.metricsLabel}>Operacoes com falha</Text>
        <Text style={styles.metricsValue}>{metrics.operationsFailed}</Text>
      </View>
      <View style={styles.metricsDivider} />
      <View style={styles.metricsRow}>
        <Text style={styles.metricsLabel}>Conflitos</Text>
        <Text style={styles.metricsValue}>{metrics.conflictsCount}</Text>
      </View>
    </View>
  );
}

// ─── List item types ──────────────────────────────────────────────────────

type ListItem =
  | { type: 'header' }
  | { type: 'actions' }
  | { type: 'progress' }
  | { type: 'section_header'; section: SectionKey; title: string; count: number }
  | { type: 'pending_op'; op: PendingOperation }
  | { type: 'conflict'; conflict: ConflictLogEntry }
  | { type: 'metrics'; metrics: SyncMetrics }
  | { type: 'empty'; section: SectionKey; message: string };

// ─── Main component ───────────────────────────────────────────────────────

export default function SyncQueueScreen() {
  const {
    pendingCount,
    isFlushing,
    flushProgress,
    flushNow,
    conflictCount,
    conflicts,
    reviewConflict,
    syncMetrics,
    priorityCounts,
  } = useSyncContext();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { queue } = useOfflineData();

  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    pending: true,
    conflicts: true,
    metrics: true,
  });

  const [pendingOps, setPendingOps] = useState<PendingOperation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const wasFlushing = useRef(false);

  const loadPendingOps = useCallback(async () => {
    const ops = await queue.getPending();
    setPendingOps(ops);
  }, [queue]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPendingOps();
    setRefreshing(false);
  }, [loadPendingOps]);

  // Load on mount
  useEffect(() => {
    void loadPendingOps();
  }, [loadPendingOps]);

  // Reload after flush completes
  useEffect(() => {
    if (wasFlushing.current && !isFlushing) {
      void loadPendingOps();
    }
    wasFlushing.current = isFlushing;
  }, [isFlushing, loadPendingOps]);

  const toggleSection = useCallback((section: SectionKey) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  }, []);

  const handleSyncNow = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    void flushNow();
  }, [flushNow]);

  const handleClearQueue = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      'Limpar fila de operacoes',
      'Todas as operacoes pendentes serao removidas. Esta acao nao pode ser desfeita.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: async () => {
            await queue.clear();
            await loadPendingOps();
          },
        },
      ],
    );
  }, [queue, loadPendingOps]);

  const handleReviewConflict = useCallback(
    (id: number) => {
      void reviewConflict(id);
    },
    [reviewConflict],
  );

  const flushPercent = useMemo(() => {
    if (flushProgress.total === 0) return 0;
    return ((flushProgress.processed + flushProgress.failed) / flushProgress.total) * 100;
  }, [flushProgress]);

  const listData = useMemo<ListItem[]>(() => {
    const items: ListItem[] = [{ type: 'header' }, { type: 'actions' }];

    if (isFlushing) {
      items.push({ type: 'progress' });
    }

    // Pending operations section
    items.push({
      type: 'section_header',
      section: 'pending',
      title: 'Operacoes pendentes',
      count: pendingCount,
    });

    if (expandedSections.pending) {
      if (pendingOps.length === 0) {
        items.push({ type: 'empty', section: 'pending', message: 'Nenhuma operacao pendente' });
      } else {
        for (const op of pendingOps) {
          items.push({ type: 'pending_op', op });
        }
      }
    }

    // Conflicts section
    items.push({
      type: 'section_header',
      section: 'conflicts',
      title: 'Conflitos',
      count: conflictCount,
    });

    if (expandedSections.conflicts) {
      if (conflicts.length === 0) {
        items.push({
          type: 'empty',
          section: 'conflicts',
          message: 'Nenhum conflito nao revisado',
        });
      } else {
        for (const c of conflicts) {
          items.push({ type: 'conflict', conflict: c });
        }
      }
    }

    // Metrics section
    items.push({
      type: 'section_header',
      section: 'metrics',
      title: 'Metricas de sincronizacao',
      count: 0,
    });

    if (expandedSections.metrics) {
      if (syncMetrics) {
        items.push({ type: 'metrics', metrics: syncMetrics });
      } else {
        items.push({
          type: 'empty',
          section: 'metrics',
          message: 'Nenhuma sincronizacao realizada ainda',
        });
      }
    }

    return items;
  }, [
    isFlushing,
    pendingCount,
    pendingOps,
    conflictCount,
    conflicts,
    syncMetrics,
    expandedSections,
  ]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ListItem>) => {
      switch (item.type) {
        case 'header':
          return (
            <View style={styles.header}>
              <Text style={styles.title}>Fila de sincronizacao</Text>
              <Text style={styles.subtitle}>
                {pendingCount === 0
                  ? 'Tudo sincronizado'
                  : `${pendingCount} operacao${pendingCount > 1 ? 'es' : ''} pendente${pendingCount > 1 ? 's' : ''}`}
                {priorityCounts.critical > 0 &&
                  ` (${priorityCounts.critical} critica${priorityCounts.critical > 1 ? 's' : ''})`}
              </Text>
            </View>
          );

        case 'actions':
          return (
            <View style={styles.actionsBar}>
              <Pressable
                onPress={handleSyncNow}
                disabled={isFlushing || pendingCount === 0}
                style={({ pressed }) => [
                  styles.actionButton,
                  pressed && styles.actionButtonPressed,
                  (isFlushing || pendingCount === 0) && styles.actionButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Sincronizar agora"
                accessibilityState={{ disabled: isFlushing || pendingCount === 0 }}
              >
                <RefreshCw size={16} color={colors.neutral[0]} aria-hidden />
                <Text style={styles.actionButtonText}>
                  {isFlushing ? 'Sincronizando...' : 'Sincronizar agora'}
                </Text>
              </Pressable>

              <Pressable
                onPress={handleClearQueue}
                disabled={isFlushing || pendingCount === 0}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionButtonDestructive,
                  pressed && styles.actionButtonPressed,
                  (isFlushing || pendingCount === 0) && styles.actionButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Limpar fila"
                accessibilityState={{ disabled: isFlushing || pendingCount === 0 }}
              >
                <Trash2 size={16} color={colors.neutral[0]} aria-hidden />
                <Text style={styles.actionButtonText}>Limpar fila</Text>
              </Pressable>
            </View>
          );

        case 'progress':
          return (
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${flushPercent}%` }]} />
            </View>
          );

        case 'section_header': {
          const isExpanded = expandedSections[item.section];
          const ChevronIcon = isExpanded ? ChevronUp : ChevronDown;
          return (
            <Pressable
              onPress={() => toggleSection(item.section)}
              style={({ pressed }) => [
                styles.sectionHeader,
                pressed && styles.sectionHeaderPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`${item.title}, ${item.count} item${item.count !== 1 ? 's' : ''}, ${isExpanded ? 'recolher' : 'expandir'}`}
            >
              <View style={styles.sectionHeaderLeft}>
                <Text style={styles.sectionTitle}>{item.title}</Text>
                {item.count > 0 && (
                  <View style={styles.sectionBadge}>
                    <Text style={styles.sectionBadgeText}>{item.count}</Text>
                  </View>
                )}
              </View>
              <ChevronIcon size={20} color={colors.neutral[500]} aria-hidden />
            </Pressable>
          );
        }

        case 'pending_op':
          return <PendingOperationCard op={item.op} styles={styles} />;

        case 'conflict':
          return (
            <ConflictCard
              conflict={item.conflict}
              styles={styles}
              onReview={handleReviewConflict}
            />
          );

        case 'metrics':
          return <MetricsSection metrics={item.metrics} styles={styles} />;

        case 'empty': {
          const EmptyIcon =
            item.section === 'pending'
              ? CheckCircle
              : item.section === 'conflicts'
                ? AlertTriangle
                : Activity;
          const emptyTitle =
            item.section === 'pending'
              ? 'Fila vazia'
              : item.section === 'conflicts'
                ? 'Sem conflitos'
                : 'Sem metricas';
          return (
            <View style={styles.emptyState}>
              <EmptyIcon size={48} color={colors.neutral[300]} aria-hidden />
              <Text style={styles.emptyTitle}>{emptyTitle}</Text>
              <Text style={styles.emptyDescription}>{item.message}</Text>
            </View>
          );
        }

        default:
          return null;
      }
    },
    [
      styles,
      colors,
      pendingCount,
      priorityCounts,
      isFlushing,
      flushPercent,
      expandedSections,
      toggleSection,
      handleSyncNow,
      handleClearQueue,
      handleReviewConflict,
    ],
  );

  const keyExtractor = useCallback((_item: ListItem, index: number) => `sync-item-${index}`, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['bottom']}>
      <FlatList
        data={listData}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      />
    </SafeAreaView>
  );
}
