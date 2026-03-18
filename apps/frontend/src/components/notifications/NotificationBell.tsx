import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCircle, XCircle, RotateCcw, Clock, ShoppingCart, Settings } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationType } from '@/hooks/useNotifications';
import NotificationPreferencesModal from './NotificationPreferencesModal';
import './NotificationBell.css';

function getRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Agora';
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
}

interface NotificationIconProps {
  type: NotificationType;
}

function NotificationIcon({ type }: NotificationIconProps) {
  switch (type) {
    case 'RC_APPROVED':
      return (
        <CheckCircle
          size={20}
          aria-hidden="true"
          className="nb-item__icon nb-item__icon--success"
        />
      );
    case 'RC_REJECTED':
      return (
        <XCircle size={20} aria-hidden="true" className="nb-item__icon nb-item__icon--error" />
      );
    case 'RC_RETURNED':
      return (
        <RotateCcw size={20} aria-hidden="true" className="nb-item__icon nb-item__icon--warning" />
      );
    case 'SLA_REMINDER':
      return (
        <Clock size={20} aria-hidden="true" className="nb-item__icon nb-item__icon--warning" />
      );
    case 'RC_PENDING':
    default:
      return (
        <ShoppingCart
          size={20}
          aria-hidden="true"
          className="nb-item__icon nb-item__icon--neutral"
        />
      );
  }
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const { notifications, unreadCount, isOpen, setIsOpen, markAsRead, markAllAsRead } =
    useNotifications();
  const [showPrefs, setShowPrefs] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, setIsOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  async function handleItemClick(id: string, referenceId?: string) {
    await markAsRead(id);
    setIsOpen(false);
    if (referenceId) {
      navigate(`/purchase-requests?highlight=${referenceId}`);
    }
  }

  const ariaLabel = unreadCount > 0 ? `${unreadCount} notificacoes nao lidas` : 'Notificacoes';

  return (
    <div className="notification-bell">
      <button
        ref={buttonRef}
        type="button"
        className="notification-bell__btn"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Bell size={24} aria-hidden="true" />
        <span
          className={`notification-bell__badge${unreadCount === 0 ? ' notification-bell__badge--hidden' : ''}`}
          aria-hidden="true"
        >
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="notification-dropdown"
          role="menu"
          aria-label="Notificacoes"
        >
          {/* Dropdown header */}
          <div className="notification-dropdown__header">
            <h2 className="notification-dropdown__title">Notificacoes</h2>
            {notifications.some((n) => !n.isRead) && (
              <button
                type="button"
                className="notification-dropdown__mark-all"
                onClick={() => void markAllAsRead()}
              >
                Marcar todas como lidas
              </button>
            )}
          </div>

          {/* Items */}
          {notifications.length === 0 ? (
            <div className="notification-dropdown__empty">
              <Bell size={40} aria-hidden="true" className="notification-dropdown__empty-icon" />
              <p className="notification-dropdown__empty-text">
                Tudo em dia! Nenhuma notificacao nova.
              </p>
            </div>
          ) : (
            <ul className="notification-dropdown__list" role="none">
              {notifications.map((n) => (
                <li key={n.id} role="none">
                  <button
                    type="button"
                    className={`notification-item${!n.isRead ? ' notification-item--unread' : ''}`}
                    role="menuitem"
                    onClick={() => void handleItemClick(n.id, n.referenceId)}
                  >
                    <NotificationIcon type={n.type} />
                    <div className="notification-item__content">
                      <span className="notification-item__title">{n.title}</span>
                      <span className="notification-item__body">{n.body}</span>
                    </div>
                    <time
                      className="notification-item__time"
                      dateTime={n.createdAt}
                      title={new Date(n.createdAt).toLocaleString('pt-BR')}
                    >
                      {getRelativeTime(n.createdAt)}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* Preferences link */}
          <div className="notification-dropdown__footer">
            <button
              type="button"
              className="notification-dropdown__prefs-btn"
              onClick={() => {
                setShowPrefs(true);
                setIsOpen(false);
              }}
              aria-label="Configurar notificacoes"
            >
              <Settings size={16} aria-hidden="true" />
              <span>Preferencias</span>
            </button>
          </div>
        </div>
      )}

      <NotificationPreferencesModal isOpen={showPrefs} onClose={() => setShowPrefs(false)} />
    </div>
  );
}
