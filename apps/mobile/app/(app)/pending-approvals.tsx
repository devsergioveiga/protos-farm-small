import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  TextInput,
  Modal,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  RotateCcw,
  ShoppingCart,
  Clock,
  AlertTriangle,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { spacing, fontSize } from '@protos-farm/shared';
import { useTheme } from '@/stores/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { api } from '@/services/api';
import type { ThemeColors } from '@/stores/ThemeContext';

// ─── Types ───────────────────────────────────────────────────────────────────

type ApprovalAction = 'APPROVE' | 'REJECT' | 'RETURN';

interface RCItem {
  productName: string;
  quantity: number;
  unitName: string;
  estimatedUnitPrice?: number;
}

interface PendingRC {
  id: string;
  rcNumber?: string;
  requestType: string;
  status: string;
  urgency: 'NORMAL' | 'URGENTE' | 'EMERGENCIAL';
  createdAt: string;
  requesterName?: string;
  totalEstimated?: number;
  slaDueAt?: string;
  items?: RCItem[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

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

function formatSlaCountdown(slaDueAt: string): { label: string; isExpired: boolean } {
  const diff = new Date(slaDueAt).getTime() - Date.now();
  if (diff <= 0) return { label: 'Prazo vencido', isExpired: true };
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return { label: 'Menos de 1h restante', isExpired: false };
  return { label: `${hours}h restantes`, isExpired: false };
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
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
  urgencyChip: {
    paddingHorizontal: spacing[2],
    paddingVertical: 2,
    borderRadius: 4,
  },
  urgencyText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.xs,
  },
  requesterName: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
  totalValue: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },
  slaRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[1],
  },
  slaText: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.xs,
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

  // Detail modal
  modalOverlay: {
    flex: 1 as const,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end' as const,
  },
  modalSheet: {
    backgroundColor: c.neutral[0],
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '90%' as const,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
  },
  modalTitle: {
    fontFamily: 'DMSans_700Bold',
    fontSize: fontSize.lg,
    color: c.neutral[800],
    flex: 1 as const,
  },
  modalCloseButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  modalScrollContent: { padding: spacing[4], gap: spacing[3] },
  modalLabel: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },
  modalValue: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: c.neutral[100],
    minHeight: 48,
  },
  itemName: {
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[700],
    flex: 1 as const,
  },
  itemQty: {
    fontFamily: 'JetBrainsMono_400Regular',
    fontSize: fontSize.sm,
    color: c.neutral[500],
  },

  // Action footer
  modalFooter: {
    padding: spacing[4],
    gap: spacing[3],
    borderTopWidth: 1,
    borderTopColor: c.neutral[100],
  },
  actionRow: {
    flexDirection: 'row' as const,
    gap: spacing[3],
  },
  approveButton: {
    flex: 1 as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.primary[600],
    borderRadius: 8,
    paddingVertical: spacing[3],
    minHeight: 48,
  },
  approveButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: '#fff',
  },
  returnButton: {
    flex: 1 as const,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    borderWidth: 1,
    borderColor: c.warning[500],
    borderRadius: 8,
    paddingVertical: spacing[3],
    minHeight: 48,
    backgroundColor: c.neutral[0],
  },
  returnButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.warning[500],
  },
  rejectButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: spacing[2],
    borderWidth: 1,
    borderColor: c.error[500],
    borderRadius: 8,
    paddingVertical: spacing[3],
    minHeight: 48,
    paddingHorizontal: spacing[4],
    backgroundColor: c.neutral[0],
  },
  rejectButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.error[500],
  },
  buttonDisabled: { opacity: 0.5 },

  // Comment sheet
  commentLabel: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: c.neutral[600],
    marginBottom: spacing[2],
  },
  commentInput: {
    backgroundColor: c.neutral[50],
    borderWidth: 1,
    borderColor: c.neutral[300],
    borderRadius: 8,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    minHeight: 96,
    fontFamily: 'SourceSans3_400Regular',
    fontSize: fontSize.base,
    color: c.neutral[700],
    textAlignVertical: 'top' as const,
  },
  confirmButton: {
    backgroundColor: c.primary[600],
    borderRadius: 8,
    paddingVertical: spacing[3],
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: spacing[3],
  },
  confirmButtonDanger: { backgroundColor: c.error[500] },
  confirmButtonWarning: { backgroundColor: c.warning[500] },
  confirmButtonText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.base,
    color: '#fff',
  },

  // Success toast
  toastBanner: {
    position: 'absolute' as const,
    top: spacing[4],
    left: spacing[4],
    right: spacing[4],
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    backgroundColor: c.primary[600],
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[3],
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 6,
    zIndex: 100,
  },
  toastText: {
    fontFamily: 'SourceSans3_600SemiBold',
    fontSize: fontSize.sm,
    color: '#fff',
    flex: 1 as const,
  },
});

// ─── Component ───────────────────────────────────────────────────────────────

export default function PendingApprovalsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [items, setItems] = useState<PendingRC[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedRC, setSelectedRC] = useState<PendingRC | null>(null);
  const [pendingAction, setPendingAction] = useState<ApprovalAction | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await api.get<{ data: PendingRC[] }>(
        '/api/org/purchase-requests?status=PENDENTE&limit=50',
      );
      setItems(response.data ?? []);
    } catch {
      setItems([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchData();
  }, [fetchData]);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  }, []);

  const handleAction = useCallback(
    async (action: ApprovalAction, rc: PendingRC, actionComment: string) => {
      setIsSubmitting(true);
      try {
        const apiAction =
          action === 'APPROVE' ? 'APPROVE' : action === 'REJECT' ? 'REJECT' : 'RETURN';

        await api.post(`/api/org/purchase-requests/${rc.id}/transition`, {
          action: apiAction,
          comment: actionComment.trim() || undefined,
        });

        const messages: Record<ApprovalAction, string> = {
          APPROVE: 'Requisicao aprovada com sucesso.',
          REJECT: 'Requisicao rejeitada.',
          RETURN: 'Requisicao devolvida para correcao.',
        };
        showToast(messages[action]);
        setSelectedRC(null);
        setPendingAction(null);
        setComment('');
        // Refresh list
        void fetchData();
      } catch {
        showToast('Nao foi possivel processar. Tente novamente.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchData, showToast],
  );

  const renderCard = useCallback(
    ({ item }: { item: PendingRC }) => {
      const urgencyColors =
        item.urgency === 'EMERGENCIAL'
          ? { bg: colors.error[100], text: colors.error[500] }
          : item.urgency === 'URGENTE'
            ? { bg: colors.warning[100], text: colors.warning[500] }
            : null;

      const sla = item.slaDueAt ? formatSlaCountdown(item.slaDueAt) : null;

      return (
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedRC(item);
            setPendingAction(null);
            setComment('');
          }}
          accessibilityRole="button"
          accessibilityLabel={`Requisicao ${item.rcNumber ?? ''} de ${item.requesterName ?? 'solicitante'}, ${item.urgency === 'NORMAL' ? 'normal' : item.urgency.toLowerCase()}`}
        >
          <View style={styles.cardTopRow}>
            <Text style={styles.rcNumber}>{item.rcNumber ?? '—'}</Text>
            {urgencyColors && (
              <View style={[styles.urgencyChip, { backgroundColor: urgencyColors.bg }]}>
                <Text style={[styles.urgencyText, { color: urgencyColors.text }]}>
                  {item.urgency === 'URGENTE' ? 'Urgente' : 'Emergencial'}
                </Text>
              </View>
            )}
          </View>

          {item.requesterName && <Text style={styles.requesterName}>{item.requesterName}</Text>}

          {item.totalEstimated != null && (
            <Text style={styles.totalValue}>{formatCurrency(item.totalEstimated)}</Text>
          )}

          <View style={styles.cardTopRow}>
            <Text style={styles.dateText}>{formatRelativeTime(item.createdAt)}</Text>
            {sla && (
              <View style={styles.slaRow}>
                {sla.isExpired ? (
                  <AlertTriangle size={12} color={colors.error[500]} aria-hidden />
                ) : (
                  <Clock size={12} color={colors.warning[500]} aria-hidden />
                )}
                <Text
                  style={[
                    styles.slaText,
                    { color: sla.isExpired ? colors.error[500] : colors.warning[500] },
                  ]}
                >
                  {sla.label}
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      );
    },
    [styles, colors],
  );

  const keyExtractor = useCallback((item: PendingRC) => item.id, []);

  const ListEmptyComponent = useCallback(
    () => (
      <View style={styles.emptyContainer}>
        <CheckCircle size={48} color={colors.neutral[300]} aria-hidden />
        <Text style={styles.emptyTitle}>Nenhuma aprovacao pendente</Text>
        <Text style={styles.emptyDesc}>
          Voce esta em dia! Nao ha requisicoes aguardando sua acao.
        </Text>
      </View>
    ),
    [styles, colors],
  );

  // ─── Detail modal ───────────────────────────────────────────────────────────

  const renderDetailModal = () => {
    if (!selectedRC) return null;

    const isCommentRequired = pendingAction === 'REJECT' || pendingAction === 'RETURN';
    const canSubmit = !isCommentRequired || comment.trim().length > 0;

    return (
      <Modal
        visible={!!selectedRC}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setSelectedRC(null);
          setPendingAction(null);
        }}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            {/* Modal header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedRC.rcNumber ?? 'Requisicao'}</Text>
              <Pressable
                onPress={() => {
                  setSelectedRC(null);
                  setPendingAction(null);
                  setComment('');
                }}
                style={styles.modalCloseButton}
                accessibilityRole="button"
                accessibilityLabel="Fechar"
              >
                <X size={20} color={colors.neutral[500]} aria-hidden />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              {/* RC info */}
              {selectedRC.requesterName && (
                <>
                  <Text style={styles.modalLabel}>Solicitante</Text>
                  <Text style={styles.modalValue}>{selectedRC.requesterName}</Text>
                </>
              )}

              <Text style={styles.modalLabel}>Tipo</Text>
              <Text style={styles.modalValue}>{selectedRC.requestType}</Text>

              <Text style={styles.modalLabel}>Urgencia</Text>
              <Text style={styles.modalValue}>
                {selectedRC.urgency === 'NORMAL'
                  ? 'Normal'
                  : selectedRC.urgency === 'URGENTE'
                    ? 'Urgente'
                    : 'Emergencial'}
              </Text>

              {/* Items */}
              {selectedRC.items && selectedRC.items.length > 0 && (
                <>
                  <Text style={styles.modalLabel}>Itens</Text>
                  {selectedRC.items.map((item, idx) => (
                    <View key={idx} style={styles.itemRow}>
                      <Text style={styles.itemName}>{item.productName}</Text>
                      <Text style={styles.itemQty}>
                        {item.quantity} {item.unitName}
                      </Text>
                    </View>
                  ))}
                </>
              )}

              {selectedRC.totalEstimated != null && (
                <>
                  <Text style={styles.modalLabel}>Valor estimado</Text>
                  <Text style={styles.totalValue}>{formatCurrency(selectedRC.totalEstimated)}</Text>
                </>
              )}

              {/* Comment field for reject/return */}
              {pendingAction && (
                <View>
                  <Text style={styles.commentLabel}>
                    {pendingAction === 'REJECT' ? 'Motivo da rejeicao*' : ''}
                    {pendingAction === 'RETURN' ? 'Motivo da devolucao*' : ''}
                    {pendingAction === 'APPROVE' ? 'Comentario (opcional)' : ''}
                  </Text>
                  <TextInput
                    style={styles.commentInput}
                    value={comment}
                    onChangeText={setComment}
                    placeholder={
                      isCommentRequired
                        ? 'Descreva o motivo...'
                        : 'Adicione um comentario se necessario...'
                    }
                    placeholderTextColor={colors.neutral[400]}
                    multiline
                    numberOfLines={3}
                    accessibilityLabel={
                      pendingAction === 'REJECT'
                        ? 'Motivo da rejeicao'
                        : pendingAction === 'RETURN'
                          ? 'Motivo da devolucao'
                          : 'Comentario'
                    }
                    aria-required={isCommentRequired}
                  />
                  <Pressable
                    onPress={() => {
                      if (!canSubmit || isSubmitting) return;
                      void Haptics.notificationAsync(
                        pendingAction === 'APPROVE'
                          ? Haptics.NotificationFeedbackType.Success
                          : Haptics.NotificationFeedbackType.Warning,
                      );
                      void handleAction(pendingAction, selectedRC, comment);
                    }}
                    style={[
                      styles.confirmButton,
                      pendingAction === 'REJECT' && styles.confirmButtonDanger,
                      pendingAction === 'RETURN' && styles.confirmButtonWarning,
                      (!canSubmit || isSubmitting) && styles.buttonDisabled,
                    ]}
                    disabled={!canSubmit || isSubmitting}
                    accessibilityRole="button"
                    accessibilityLabel={
                      pendingAction === 'APPROVE'
                        ? 'Confirmar Aprovacao'
                        : pendingAction === 'REJECT'
                          ? 'Confirmar Rejeicao'
                          : 'Confirmar Devolucao'
                    }
                    accessibilityState={{ disabled: !canSubmit || isSubmitting }}
                  >
                    <Text style={styles.confirmButtonText}>
                      {pendingAction === 'APPROVE'
                        ? 'Confirmar Aprovacao'
                        : pendingAction === 'REJECT'
                          ? 'Confirmar Rejeicao'
                          : 'Confirmar Devolucao'}
                    </Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            {/* Action buttons */}
            {!pendingAction && (
              <View style={styles.modalFooter}>
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={() => setPendingAction('APPROVE')}
                    style={({ pressed }) => [styles.approveButton, { opacity: pressed ? 0.85 : 1 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Aprovar"
                    accessibilityState={{ disabled: isSubmitting }}
                  >
                    <CheckCircle size={20} color="#fff" aria-hidden />
                    <Text style={styles.approveButtonText}>Aprovar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setPendingAction('RETURN')}
                    style={({ pressed }) => [styles.returnButton, { opacity: pressed ? 0.85 : 1 }]}
                    accessibilityRole="button"
                    accessibilityLabel="Devolver"
                    accessibilityState={{ disabled: isSubmitting }}
                  >
                    <RotateCcw size={20} color={colors.warning[500]} aria-hidden />
                    <Text style={styles.returnButtonText}>Devolver</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => setPendingAction('REJECT')}
                  style={({ pressed }) => [styles.rejectButton, { opacity: pressed ? 0.85 : 1 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Rejeitar"
                  accessibilityState={{ disabled: isSubmitting }}
                >
                  <XCircle size={20} color={colors.error[500]} aria-hidden />
                  <Text style={styles.rejectButtonText}>Rejeitar</Text>
                </Pressable>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  };

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
          <Text style={styles.headerTitle}>Aprovacoes Pendentes</Text>
        </View>

        {/* List */}
        {isLoading ? (
          <View style={styles.emptyContainer}>
            <ActivityIndicator color={colors.primary[600]} />
          </View>
        ) : (
          <FlatList
            data={items}
            renderItem={renderCard}
            keyExtractor={keyExtractor}
            contentContainerStyle={[styles.listContent, items.length === 0 && { flex: 1 }]}
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

        {/* Detail modal */}
        {renderDetailModal()}

        {/* Toast */}
        {toastMessage && (
          <View style={styles.toastBanner} accessibilityLiveRegion="polite">
            <ShoppingCart size={16} color="#fff" aria-hidden />
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
