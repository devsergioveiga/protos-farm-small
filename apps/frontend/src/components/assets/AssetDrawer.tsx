import { useEffect, useRef, useState } from 'react';
import {
  X,
  Pencil,
  CheckCircle,
  MinusCircle,
  XCircle,
  Clock,
  Wrench,
  Settings,
  PackageMinus,
  ArrowRightLeft,
} from 'lucide-react';
import { useAssetDetail } from '@/hooks/useAssetDetail';
import { useFarms } from '@/hooks/useFarms';
import type { Asset, AssetStatus } from '@/types/asset';
import AssetGeneralTab from './AssetGeneralTab';
import AssetDocumentsTab from './AssetDocumentsTab';
import AssetFuelTab from './AssetFuelTab';
import AssetReadingsTab from './AssetReadingsTab';
import AssetMaintenanceTab from './AssetMaintenanceTab';
import AssetTimelineTab from './AssetTimelineTab';
import AssetCostTab from './AssetCostTab';
import AssetHierarchyTab from './AssetHierarchyTab';
import AssetWipContributionsTab from './AssetWipContributionsTab';
import DepreciationConfigModal from '../depreciation/DepreciationConfigModal';
import AssetDisposalModal from './AssetDisposalModal';
import AssetTransferModal from './AssetTransferModal';
import { useDepreciationConfig } from '@/hooks/useDepreciationConfig';
import { useDepreciationReport } from '@/hooks/useDepreciationReport';
import { METHOD_LABELS, TRACK_LABELS } from '@/types/depreciation';
import type { DepreciationEntry } from '@/types/depreciation';
import './AssetDrawer.css';

// ─── Tab definitions ──────────────────────────────────────────────────

export type TabId =
  | 'geral'
  | 'documentos'
  | 'combustivel'
  | 'leituras'
  | 'manutencao'
  | 'depreciacao'
  | 'custo'
  | 'timeline'
  | 'hierarquia'
  | 'andamento';

const BASE_TABS: { id: TabId; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'combustivel', label: 'Combustivel' },
  { id: 'leituras', label: 'Leituras' },
  { id: 'manutencao', label: 'Manutencao' },
  { id: 'depreciacao', label: 'Depreciacao' },
  { id: 'custo', label: 'Custo' },
  { id: 'timeline', label: 'Timeline' },
];

function getVisibleTabs(asset: Asset | null): { id: TabId; label: string }[] {
  const tabs = [...BASE_TABS];
  // Add WIP tab when asset is EM_ANDAMENTO (insert at position 1, after Geral)
  if (asset?.status === 'EM_ANDAMENTO') {
    tabs.splice(1, 0, { id: 'andamento', label: 'Andamento' });
  }
  // Add hierarchy tab when asset has parent or children (insert after Geral)
  if (asset?.parentAsset || (asset?.childAssets && asset.childAssets.length > 0)) {
    tabs.splice(1, 0, { id: 'hierarquia', label: 'Hierarquia' });
  }
  return tabs;
}

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

// ─── AssetDepreciationTab ──────────────────────────────────────────────

function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface AssetDepreciationTabProps {
  asset: Asset;
}

function AssetDepreciationTab({ asset }: AssetDepreciationTabProps) {
  const {
    config,
    loading: configLoading,
    fetchConfig,
    refetch: refetchConfig,
  } = useDepreciationConfig(asset.id);
  const { data: reportData, fetchReport } = useDepreciationReport();

  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  useEffect(() => {
    if (config) {
      void fetchReport(
        new Date().getFullYear(),
        new Date().getMonth() + 1,
        config.activeTrack,
        asset.id,
        1,
        12,
      );
    }
  }, [config, asset.id, fetchReport]);

  if (configLoading) {
    return (
      <div className="asset-drawer__skeleton" role="status" aria-label="Carregando depreciacao">
        <div className="asset-drawer__skeleton-block" />
        <div className="asset-drawer__skeleton-block" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="asset-depreciation-tab__empty">
        <Settings size={48} aria-hidden="true" style={{ color: 'var(--color-neutral-400)' }} />
        <h3 className="asset-depreciation-tab__empty-title">
          Ativo sem configuracao de depreciacao
        </h3>
        <p className="asset-depreciation-tab__empty-desc">
          Configure o metodo e as taxas para calcular o valor contabil deste ativo.
        </p>
        <button
          type="button"
          className="asset-depreciation-tab__cta"
          onClick={() => setShowConfigModal(true)}
        >
          Configurar depreciacao
        </button>
        {showConfigModal && (
          <DepreciationConfigModal
            isOpen={showConfigModal}
            onClose={() => setShowConfigModal(false)}
            onSuccess={() => {
              setShowConfigModal(false);
              refetchConfig();
            }}
            asset={{ id: asset.id, assetType: asset.assetType, name: asset.name }}
            config={null}
          />
        )}
      </div>
    );
  }

  const entries: DepreciationEntry[] = reportData?.entries ?? [];

  return (
    <div className="asset-depreciation-tab">
      {/* Config summary */}
      <div className="asset-depreciation-tab__card">
        <div className="asset-depreciation-tab__card-header">
          <h3 className="asset-depreciation-tab__card-title">Configuracao de depreciacao</h3>
          <button
            type="button"
            className="asset-depreciation-tab__edit-btn"
            onClick={() => setShowConfigModal(true)}
          >
            Editar configuracao
          </button>
        </div>
        <dl className="asset-depreciation-tab__dl">
          <div className="asset-depreciation-tab__dl-row">
            <dt>Metodo</dt>
            <dd>{METHOD_LABELS[config.method]}</dd>
          </div>
          <div className="asset-depreciation-tab__dl-row">
            <dt>Taxa fiscal</dt>
            <dd>{config.fiscalAnnualRate != null ? `${config.fiscalAnnualRate}%` : '—'}</dd>
          </div>
          <div className="asset-depreciation-tab__dl-row">
            <dt>Taxa gerencial</dt>
            <dd>{config.managerialAnnualRate != null ? `${config.managerialAnnualRate}%` : '—'}</dd>
          </div>
          <div className="asset-depreciation-tab__dl-row">
            <dt>Valor residual</dt>
            <dd>{formatBRL(config.residualValue)}</dd>
          </div>
          <div className="asset-depreciation-tab__dl-row">
            <dt>Track ativo</dt>
            <dd>{TRACK_LABELS[config.activeTrack]}</dd>
          </div>
        </dl>
      </div>

      {/* Mini entries table */}
      {entries.length > 0 && (
        <div className="asset-depreciation-tab__entries">
          <h4 className="asset-depreciation-tab__entries-title">Ultimos lancamentos</h4>
          <table className="asset-depreciation-tab__table">
            <caption className="sr-only">Lancamentos de depreciacao deste ativo</caption>
            <thead>
              <tr>
                <th scope="col">Periodo</th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Depreciacao
                </th>
                <th scope="col" style={{ textAlign: 'right' }}>
                  Valor Contabil
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td>
                    {String(entry.periodMonth).padStart(2, '0')}/{entry.periodYear}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {formatBRL(entry.depreciationAmount)}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                    {formatBRL(entry.closingBookValue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showConfigModal && (
        <DepreciationConfigModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
          onSuccess={() => {
            setShowConfigModal(false);
            refetchConfig();
          }}
          asset={{ id: asset.id, assetType: asset.assetType, name: asset.name }}
          config={config}
        />
      )}
    </div>
  );
}

// ─── AssetDrawer ──────────────────────────────────────────────────────

interface AssetDrawerProps {
  assetId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit: (asset: Asset) => void;
  onRefresh?: () => void;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
}

export default function AssetDrawer({
  assetId,
  isOpen,
  onClose,
  onEdit,
  onRefresh,
  activeTab = 'geral',
  onTabChange,
}: AssetDrawerProps) {
  const { asset, loading, error, refetch } = useAssetDetail(isOpen ? assetId : null);
  const { farms } = useFarms();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const [showDisposalModal, setShowDisposalModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);

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
              <div className="asset-drawer__header-actions">
                <button
                  type="button"
                  className="asset-drawer__action-btn"
                  onClick={() => setShowDisposalModal(true)}
                  aria-label={`Alienar ativo ${asset.name}`}
                  disabled={asset.status === 'ALIENADO'}
                  title="Alienar"
                >
                  <PackageMinus size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="asset-drawer__action-btn"
                  onClick={() => setShowTransferModal(true)}
                  aria-label={`Transferir ativo ${asset.name}`}
                  disabled={asset.status === 'ALIENADO'}
                  title="Transferir"
                >
                  <ArrowRightLeft size={18} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="asset-drawer__edit-btn"
                  onClick={() => onEdit(asset)}
                  aria-label={`Editar ativo ${asset.name}`}
                >
                  <Pencil size={20} aria-hidden="true" />
                </button>
              </div>
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
              {getVisibleTabs(asset).map((tab) => (
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
                {activeTab === 'geral' && <AssetGeneralTab asset={asset} onRefresh={refetch} />}
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
                id="tabpanel-depreciacao"
                role="tabpanel"
                aria-labelledby="tab-depreciacao"
                hidden={activeTab !== 'depreciacao'}
                className="asset-drawer__tabpanel"
              >
                {activeTab === 'depreciacao' && <AssetDepreciationTab asset={asset} />}
              </div>

              <div
                id="tabpanel-custo"
                role="tabpanel"
                aria-labelledby="tab-custo"
                hidden={activeTab !== 'custo'}
                className="asset-drawer__tabpanel"
              >
                {activeTab === 'custo' && <AssetCostTab assetId={asset.id} />}
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

              {/* Hierarquia tab — conditional */}
              <div
                id="tabpanel-hierarquia"
                role="tabpanel"
                aria-labelledby="tab-hierarquia"
                hidden={activeTab !== 'hierarquia'}
                className="asset-drawer__tabpanel"
              >
                {activeTab === 'hierarquia' && (
                  <AssetHierarchyTab
                    asset={asset}
                    onNavigate={(id) => {
                      // Navigate to a different asset by re-fetching it
                      // Parent component manages assetId; here we use the closest mechanism
                      void refetch();
                      // Note: full navigation handled via parent's assetId prop change
                      // For drawer-internal navigation, we emit via onRefresh which can be used
                      // by parent to open a new drawer for the target asset
                      onRefresh?.();
                    }}
                  />
                )}
              </div>

              {/* Andamento tab — conditional, only for EM_ANDAMENTO */}
              <div
                id="tabpanel-andamento"
                role="tabpanel"
                aria-labelledby="tab-andamento"
                hidden={activeTab !== 'andamento'}
                className="asset-drawer__tabpanel"
              >
                {activeTab === 'andamento' && (
                  <AssetWipContributionsTab
                    assetId={asset.id}
                    onRefresh={() => {
                      refetch();
                      onRefresh?.();
                    }}
                    onSwitchToDepreciation={() => {
                      if (onTabChange) onTabChange('depreciacao');
                    }}
                  />
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Disposal modal */}
      {asset && showDisposalModal && (
        <AssetDisposalModal
          isOpen={showDisposalModal}
          onClose={() => setShowDisposalModal(false)}
          onSuccess={() => {
            setShowDisposalModal(false);
            refetch();
            onRefresh?.();
          }}
          asset={asset}
        />
      )}

      {/* Transfer modal */}
      {asset && showTransferModal && (
        <AssetTransferModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          onSuccess={() => {
            setShowTransferModal(false);
            refetch();
            onRefresh?.();
          }}
          asset={asset}
          farms={farms}
        />
      )}
    </div>
  );
}
