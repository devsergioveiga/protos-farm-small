import { useEffect, useRef } from 'react';
import { X, Pencil, CheckCircle, MinusCircle, XCircle, Clock, Wrench } from 'lucide-react';
import { useAssetDetail } from '@/hooks/useAssetDetail';
import type { Asset, AssetStatus } from '@/types/asset';
import AssetGeneralTab from './AssetGeneralTab';
import AssetDocumentsTab from './AssetDocumentsTab';
import AssetFuelTab from './AssetFuelTab';
import AssetReadingsTab from './AssetReadingsTab';
import AssetMaintenanceTab from './AssetMaintenanceTab';
import AssetTimelineTab from './AssetTimelineTab';
import './AssetDrawer.css';

// ─── Tab definitions ──────────────────────────────────────────────────

type TabId = 'geral' | 'documentos' | 'combustivel' | 'leituras' | 'manutencao' | 'timeline';

const TABS: { id: TabId; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'combustivel', label: 'Combustivel' },
  { id: 'leituras', label: 'Leituras' },
  { id: 'manutencao', label: 'Manutencao' },
  { id: 'timeline', label: 'Timeline' },
];

// ─── Status badge ─────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  AssetStatus,
  { icon: React.ElementType; className: string; label: string }
> = {
  ATIVO: { icon: CheckCircle, className: 'asset-drawer__badge--ativo', label: 'Ativo' },
  INATIVO: { icon: MinusCircle, className: 'asset-drawer__badge--inativo', label: 'Inativo' },
  EM_MANUTENCAO: {
    icon: Wrench,
    className: 'asset-drawer__badge--manutencao',
    label: 'Em manutencao',
  },
  ALIENADO: { icon: XCircle, className: 'asset-drawer__badge--alienado', label: 'Alienado' },
  EM_ANDAMENTO: { icon: Clock, className: 'asset-drawer__badge--andamento', label: 'Em andamento' },
};

function StatusBadge({ status }: { status: AssetStatus }) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`asset-drawer__badge ${config.className}`}>
      <Icon size={12} aria-hidden="true" />
      {config.label}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function DrawerSkeleton() {
  return (
    <div className="asset-drawer__skeleton" role="status" aria-label="Carregando dados do ativo">
      <div className="asset-drawer__skeleton-block asset-drawer__skeleton-block--title" />
      <div className="asset-drawer__skeleton-block" />
      <div className="asset-drawer__skeleton-block" />
    </div>
  );
}

// ─── AssetDrawer ──────────────────────────────────────────────────────

interface AssetDrawerProps {
  assetId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (asset: Asset) => void;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

export default function AssetDrawer({
  assetId,
  isOpen,
  onClose,
  onEdit,
  activeTab = 'geral',
  onTabChange,
}: AssetDrawerProps) {
  const { asset, loading, error } = useAssetDetail(isOpen ? assetId : null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus close button when drawer opens
  useEffect(() => {
    if (isOpen && closeButtonRef.current) {
      closeButtonRef.current.focus();
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  function handleTabSelect(tab: TabId) {
    if (onTabChange) {
      onTabChange(tab);
    }
  }

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) {
      onClose();
    }
  }

  if (!isOpen) return null;

  return (
    <div className="asset-drawer__backdrop" onClick={handleBackdropClick} aria-hidden="false">
      <div
        ref={panelRef}
        className={`asset-drawer__panel${isOpen ? ' asset-drawer__panel--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={asset ? `Ficha do ativo: ${asset.name}` : 'Ficha do ativo'}
      >
        {/* Close button */}
        <button
          ref={closeButtonRef}
          type="button"
          className="asset-drawer__close"
          onClick={onClose}
          aria-label="Fechar"
        >
          <X size={20} aria-hidden="true" />
        </button>

        {/* Header */}
        {asset && !loading && (
          <header className="asset-drawer__header">
            <div className="asset-drawer__header-top">
              <h2 className="asset-drawer__title">{asset.name}</h2>
              <button
                type="button"
                className="asset-drawer__edit-btn"
                onClick={() => onEdit(asset)}
                aria-label={`Editar ativo ${asset.name}`}
              >
                <Pencil size={20} aria-hidden="true" />
              </button>
            </div>
            <div className="asset-drawer__header-meta">
              <span className="asset-drawer__tag" aria-label={`Tag: ${asset.assetTag}`}>
                {asset.assetTag}
              </span>
              <StatusBadge status={asset.status} />
            </div>
          </header>
        )}

        {loading && !asset && <DrawerSkeleton />}

        {error && !loading && (
          <div className="asset-drawer__error" role="alert">
            <p>{error}</p>
          </div>
        )}

        {/* Tab bar */}
        {asset && !loading && (
          <>
            <div className="asset-drawer__tabs" role="tablist" aria-label="Abas da ficha do ativo">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`tab-${tab.id}`}
                  aria-selected={activeTab === tab.id}
                  aria-controls={`tabpanel-${tab.id}`}
                  className={`asset-drawer__tab${activeTab === tab.id ? ' asset-drawer__tab--active' : ''}`}
                  onClick={() => handleTabSelect(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab panels */}
            <div className="asset-drawer__tab-content">
              <div
                id="tabpanel-geral"
                role="tabpanel"
                aria-labelledby="tab-geral"
                hidden={activeTab !== 'geral'}
                className="asset-drawer__tabpanel"
              >
                {activeTab === 'geral' && <AssetGeneralTab asset={asset} />}
              </div>

              <div
                id="tabpanel-documentos"
                role="tabpanel"
                aria-labelledby="tab-documentos"
                hidden={activeTab !== 'documentos'}
                className="asset-drawer__tabpanel"
              >
                {activeTab === 'documentos' && <AssetDocumentsTab assetId={asset.id} />}
              </div>

              <div
                id="tabpanel-combustivel"
                role="tabpanel"
                aria-labelledby="tab-combustivel"
                hidden={activeTab !== 'combustivel'}
                className="asset-drawer__tabpanel"
              >
                {activeTab === 'combustivel' && (
                  <AssetFuelTab assetId={asset.id} assetType={asset.assetType} />
                )}
              </div>

              <div
                id="tabpanel-leituras"
                role="tabpanel"
                aria-labelledby="tab-leituras"
                hidden={activeTab !== 'leituras'}
                className="asset-drawer__tabpanel"
              >
                {activeTab === 'leituras' && (
                  <AssetReadingsTab assetId={asset.id} assetType={asset.assetType} />
                )}
              </div>

              <div
                id="tabpanel-manutencao"
                role="tabpanel"
                aria-labelledby="tab-manutencao"
                hidden={activeTab !== 'manutencao'}
                className="asset-drawer__tabpanel"
              >
                {activeTab === 'manutencao' && <AssetMaintenanceTab assetId={asset.id} />}
              </div>

              <div
                id="tabpanel-timeline"
                role="tabpanel"
                aria-labelledby="tab-timeline"
                hidden={activeTab !== 'timeline'}
                className="asset-drawer__tabpanel"
              >
                {activeTab === 'timeline' && <AssetTimelineTab asset={asset} />}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
