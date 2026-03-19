import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../services/api';

export type NotificationType =
  | 'RC_APPROVED'
  | 'RC_REJECTED'
  | 'RC_RETURNED'
  | 'SLA_REMINDER'
  | 'RC_PENDING'
  | 'QUOTATION_PENDING_APPROVAL'
  | 'QUOTATION_APPROVED'
  | 'QUOTATION_RECEIVED'
  | 'QUOTATION_DEADLINE_NEAR'
  | 'PO_OVERDUE'
  | 'PO_GOODS_RECEIVED'
  | 'BUDGET_EXCEEDED'
  | 'RETURN_REGISTERED'
  | 'RETURN_RESOLVED'
  | 'DAILY_DIGEST';

export const NOTIFICATION_LABELS: Record<NotificationType, string> = {
  RC_APPROVED: 'Requisicao aprovada',
  RC_REJECTED: 'Requisicao rejeitada',
  RC_RETURNED: 'Requisicao devolvida',
  SLA_REMINDER: 'Lembrete de SLA',
  RC_PENDING: 'Requisicao pendente',
  QUOTATION_PENDING_APPROVAL: 'Cotacao aguardando aprovacao',
  QUOTATION_APPROVED: 'Cotacao aprovada',
  QUOTATION_RECEIVED: 'Proposta recebida',
  QUOTATION_DEADLINE_NEAR: 'Prazo de cotacao proximo',
  PO_OVERDUE: 'Pedido em atraso',
  PO_GOODS_RECEIVED: 'Recebimento confirmado',
  BUDGET_EXCEEDED: 'Orcamento excedido',
  RETURN_REGISTERED: 'Devolucao registrada',
  RETURN_RESOLVED: 'Devolucao resolvida',
  DAILY_DIGEST: 'Resumo diario',
};

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceId?: string;
  referenceType?: string;
  isRead: boolean;
  createdAt: string;
}

interface UseNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  refresh: () => void;
}

async function loadNotifications(): Promise<Notification[]> {
  return api.get<Notification[]>('/org/notifications?unread=true&limit=20');
}

async function loadUnreadCount(): Promise<number> {
  const result = await api.get<{ count: number }>('/org/notifications/unread-count');
  return result.count;
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const data = await loadNotifications();
        if (!cancelled) setNotifications(data);
      } catch {
        // silently fail
      }
      try {
        const count = await loadUnreadCount();
        if (!cancelled) setUnreadCount(count);
      } catch {
        // silently fail
      }
    }

    void init();

    // Poll unread count every 30 seconds
    intervalRef.current = setInterval(async () => {
      try {
        const count = await loadUnreadCount();
        if (!cancelled) setUnreadCount(count);
      } catch {
        // silently fail
      }
    }, 30000);

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const fetchNotifications = useCallback(async () => {
    try {
      const result = await loadNotifications();
      setNotifications(result);
    } catch {
      // silently fail on background updates
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const count = await loadUnreadCount();
      setUnreadCount(count);
    } catch {
      // silently fail on background updates
    }
  }, []);

  async function markAsRead(id: string): Promise<void> {
    try {
      await api.patch<unknown>(`/org/notifications/${id}/read`, {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  }

  async function markAllAsRead(): Promise<void> {
    try {
      await api.patch<unknown>('/org/notifications/read-all', {});
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {
      // silently fail
    }
  }

  function refresh() {
    void fetchNotifications();
    void fetchUnreadCount();
  }

  return {
    notifications,
    unreadCount,
    isOpen,
    setIsOpen,
    markAsRead,
    markAllAsRead,
    refresh,
  };
}
