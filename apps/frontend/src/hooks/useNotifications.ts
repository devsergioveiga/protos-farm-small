import { useState, useCallback, useEffect, useRef } from 'react';
import { api } from '../services/api';

export type NotificationType =
  | 'RC_APPROVED'
  | 'RC_REJECTED'
  | 'RC_RETURNED'
  | 'SLA_REMINDER'
  | 'RC_PENDING';

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

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const result = await api.get<Notification[]>('/org/notifications?unread=true&limit=20');
      setNotifications(result);
    } catch {
      // silently fail on background updates
    }
  }, []);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const result = await api.get<{ count: number }>('/org/notifications/unread-count');
      setUnreadCount(result.count);
    } catch {
      // silently fail on background updates
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();
    void fetchUnreadCount();

    // Poll unread count every 30 seconds
    intervalRef.current = setInterval(() => {
      void fetchUnreadCount();
    }, 30000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchNotifications, fetchUnreadCount]);

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
