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
