import { useState } from 'react';
import { AlertTriangle, Clock, AlertCircle, Bell } from 'lucide-react';
import type { DocumentAlerts, ExpiringDocItem } from '@/hooks/useAssetDocumentAlerts';
import './AssetDocumentAlertsView.css';

// ─── Types ────────────────────────────────────────────────────────────

interface AssetDocumentAlertsViewProps {
  alerts: DocumentAlerts | null;
  loading: boolean;
  onAssetClick: (assetId: string) => void;
}

type BucketKey = 'expired' | 'urgent' | 'warning' | 'upcoming';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function AlertsSkeleton() {
  return (
    <div className="alerts-view" aria-label="Carregando alertas" role="status">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="alerts-view__card alerts-view__card--skeleton" />
      ))}
    </div>
  );
}

// ─── Items List ───────────────────────────────────────────────────────

interface ItemsListProps {
  items: ExpiringDocItem[];
  onAssetClick: (assetId: string) => void;
}

function ItemsList({ items, onAssetClick }: ItemsListProps) {
  if (items.length === 0) return null;
  return (
    <ul className="alerts-view__items">
      {items.map((item) => (
        <li key={item.documentId} className="alerts-view__item">
          <div className="alerts-view__item-info">
            <span className="alerts-view__item-name">{item.assetName}</span>
            <span className="alerts-view__item-doc">
              {item.documentType} — {item.documentName}
            </span>
            <span className="alerts-view__item-date">Vencimento: {formatDate(item.expiresAt)}</span>
          </div>
          <button
            type="button"
            className="alerts-view__item-btn"
            onClick={() => onAssetClick(item.assetId)}
            aria-label={`Ver ativo ${item.assetName}`}
          >
            Ver ativo
          </button>
        </li>
      ))}
    </ul>
  );
}

// ─── Main Component ───────────────────────────────────────────────────

export default function AssetDocumentAlertsView({
  alerts,
  loading,
  onAssetClick,
}: AssetDocumentAlertsViewProps) {
  const [expandedBucket, setExpandedBucket] = useState<BucketKey | null>(null);

  if (loading) return <AlertsSkeleton />;

  // If no alerts or all counts are 0, render nothing
  if (
    !alerts ||
    (alerts.expired.count === 0 &&
      alerts.urgent.count === 0 &&
      alerts.warning.count === 0 &&
      alerts.upcoming.count === 0)
  ) {
    return null;
  }

  const buckets: Array<{
    key: BucketKey;
    label: string;
    icon: React.ElementType;
    className: string;
    count: number;
    items: ExpiringDocItem[];
  }> = [
    {
      key: 'expired',
      label: 'Vencidos',
      icon: AlertCircle,
      className: 'alerts-view__card--expired',
      count: alerts.expired.count,
      items: alerts.expired.items,
    },
    {
      key: 'urgent',
      label: 'Urgente (7 dias)',
      icon: AlertTriangle,
      className: 'alerts-view__card--urgent',
      count: alerts.urgent.count,
      items: alerts.urgent.items,
    },
    {
      key: 'warning',
      label: 'Atencao (15 dias)',
      icon: Clock,
      className: 'alerts-view__card--warning',
      count: alerts.warning.count,
      items: alerts.warning.items,
    },
    {
      key: 'upcoming',
      label: 'Proximos (30 dias)',
      icon: Bell,
      className: 'alerts-view__card--upcoming',
      count: alerts.upcoming.count,
      items: alerts.upcoming.items,
    },
  ];

  function handleCardClick(key: BucketKey) {
    setExpandedBucket((prev) => (prev === key ? null : key));
  }

  const expandedBucketData = expandedBucket ? buckets.find((b) => b.key === expandedBucket) : null;

  return (
    <section aria-label="Alertas de documentos" className="alerts-view__section">
      <div className="alerts-view">
        {buckets.map(({ key, label, icon: Icon, className, count }) => (
          <button
            key={key}
            type="button"
            className={`alerts-view__card ${className}${expandedBucket === key ? ' alerts-view__card--expanded' : ''}`}
            onClick={() => handleCardClick(key)}
            aria-expanded={expandedBucket === key}
            aria-controls={`alerts-items-${key}`}
          >
            <div className="alerts-view__card-icon">
              <Icon size={20} aria-hidden="true" />
            </div>
            <span className="alerts-view__count">{count}</span>
            <span className="alerts-view__label">{label}</span>
          </button>
        ))}
      </div>

      {expandedBucketData && expandedBucketData.items.length > 0 && (
        <div
          id={`alerts-items-${expandedBucket}`}
          className="alerts-view__items-container"
          role="region"
          aria-label={`Documentos: ${expandedBucketData.label}`}
        >
          <ItemsList items={expandedBucketData.items} onAssetClick={onAssetClick} />
        </div>
      )}
    </section>
  );
}
