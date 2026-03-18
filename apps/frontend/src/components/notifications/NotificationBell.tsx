import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCircle,
  XCircle,
  RotateCcw,
  Clock,
  ShoppingCart,
  FileCheck,
  PackageCheck,
  AlertTriangle,
  Undo2,
  FileSearch,
} from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import type { NotificationType } from '@/hooks/useNotifications';
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
    case 'QUOTATION_PENDING_APPROVAL':
    case 'QUOTATION_APPROVED':
      return (
        <CheckCircle
          size={20}
          aria-hidden="true"
          className="nb-item__icon nb-item__icon--success"
        />
      );
    case 'QUOTATION_RECEIVED':
      return (
        <FileCheck size={20} aria-hidden="true" className="nb-item__icon nb-item__icon--info" />
      );
    case 'QUOTATION_DEADLINE_NEAR':
      return (
        <FileSearch size={20} aria-hidden="true" className="nb-item__icon nb-item__icon--warning" />
      );
    case 'PO_OVERDUE':
      return (
        <AlertTriangle
          size={20}
          aria-hidden="true"
          className="nb-item__icon nb-item__icon--error"
        />
      );
    case 'PO_GOODS_RECEIVED':
      return (
        <PackageCheck
          size={20}
          aria-hidden="true"
          className="nb-item__icon nb-item__icon--success"
        />
      );
    case 'BUDGET_EXCEEDED':
      return (
        <AlertTriangle
          size={20}
          aria-hidden="true"
          className="nb-item__icon nb-item__icon--warning"
        />
      );
    case 'RETURN_REGISTERED':
      return (
        <Undo2 size={20} aria-hidden="true" className="nb-item__icon nb-item__icon--warning" />
      );
    case 'RETURN_RESOLVED':
      return (
        <CheckCircle
          size={20}
          aria-hidden="true"
          className="nb-item__icon nb-item__icon--success"
        />
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

  function getNavigationTarget(type: NotificationType, referenceId?: string): string {
    switch (type) {
      case 'QUOTATION_PENDING_APPROVAL':
      case 'QUOTATION_APPROVED':
      case 'QUOTATION_RECEIVED':
      case 'QUOTATION_DEADLINE_NEAR':
        return referenceId ? `/quotations?highlight=${referenceId}` : '/quotations';
      case 'PO_OVERDUE':
        return referenceId ? `/purchase-orders?highlight=${referenceId}` : '/purchase-orders';
      case 'PO_GOODS_RECEIVED':
        return referenceId ? `/goods-receipts?highlight=${referenceId}` : '/goods-receipts';
      case 'BUDGET_EXCEEDED':
        return '/purchase-budgets';
      case 'RETURN_REGISTERED':
      case 'RETURN_RESOLVED':
        return referenceId ? `/goods-returns?highlight=${referenceId}` : '/goods-returns';
      default:
        return referenceId ? `/purchase-requests?highlight=${referenceId}` : '/purchase-requests';
    }
  }

  async function handleItemClick(id: string, type: NotificationType, referenceId?: string) {
    await markAsRead(id);
    setIsOpen(false);
    navigate(getNavigationTarget(type, referenceId));
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
                    onClick={() => void handleItemClick(n.id, n.type, n.referenceId)}
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
        </div>
      )}
    </div>
  );
}
