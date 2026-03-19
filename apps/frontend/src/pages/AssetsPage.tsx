import { useState, useEffect, useCallback } from 'react';
import {
  Tractor,
  DollarSign,
  Wrench,
  TrendingUp,
  Search,
  Download,
  FileText,
  Pencil,
  Trash2,
  Plus,
  Upload,
  CheckCircle,
  MinusCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useAssets } from '@/hooks/useAssets';
import { useFarms } from '@/hooks/useFarms';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { Asset, AssetType, AssetStatus, ListAssetsQuery } from '@/types/asset';
import { ASSET_TYPE_LABELS, ASSET_STATUS_LABELS } from '@/types/asset';
import './AssetsPage.css';

// ─── Lazy-load AssetModal ─────────────────────────────────────────────
// Using dynamic import to avoid circular dependency at module load time.
// The modal will be loaded when the user opens it.
import AssetModal from '@/components/assets/AssetModal';

// ─── Helpers ──────────────────────────────────────────────────────────

function formatBRL(value: string | null | undefined): string {
  if (!value) return '—';
  const num = parseFloat(value);
  if (isNaN(num)) return '—';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// ─── Status badge ─────────────────────────────────────────────────────

interface StatusBadgeProps {
  status: AssetStatus;
}

const STATUS_CONFIG: Record<
  AssetStatus,
  { icon: React.ElementType; className: string; label: string }
> = {
  ATIVO: { icon: CheckCircle, className: 'assets-page__badge--ativo', label: 'Ativo' },
  INATIVO: { icon: MinusCircle, className: 'assets-page__badge--inativo', label: 'Inativo' },
  EM_MANUTENCAO: {
    icon: Wrench,
    className: 'assets-page__badge--manutencao',
    label: 'Em manutencao',
  },
  ALIENADO: { icon: XCircle, className: 'assets-page__badge--alienado', label: 'Alienado' },
  EM_ANDAMENTO: {
    icon: Clock,
    className: 'assets-page__badge--andamento',
    label: 'Em andamento',
  },
};

function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  return (
    <span className={`assets-page__badge ${config.className}`}>
      <Icon size={14} aria-hidden="true" />
      {config.label}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────

function TableSkeleton() {
  return (
    <div className="assets-page__skeleton" aria-label="Carregando ativos" role="status">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="assets-page__skeleton-row" />
      ))}
    </div>
  );
}

// ─── Summary Cards ────────────────────────────────────────────────────

interface SummaryCardsProps {
  totalAssets: number;
  totalValue: string;
  inMaintenance: number;
  recentCount: number;
}

function SummaryCards({ totalAssets, totalValue, inMaintenance, recentCount }: SummaryCardsProps) {
  return (
    <div className="assets-page__summary-grid">
      <div className="assets-page__summary-card">
        <div className="assets-page__summary-icon">
          <Tractor size={24} aria-hidden="true" />
        </div>
        <div className="assets-page__summary-content">
          <span className="assets-page__summary-label">Total de ativos</span>
          <span className="assets-page__summary-value">{totalAssets}</span>
        </div>
      </div>

      <div className="assets-page__summary-card">
        <div className="assets-page__summary-icon">
          <DollarSign size={24} aria-hidden="true" />
        </div>
        <div className="assets-page__summary-content">
          <span className="assets-page__summary-label">Valor total patrimonio</span>
          <span className="assets-page__summary-value">{formatBRL(totalValue)}</span>
        </div>
      </div>

      <div className="assets-page__summary-card">
        <div
          className="assets-page__summary-icon"
          style={inMaintenance > 0 ? { color: 'var(--color-warning-500)' } : undefined}
        >
          <Wrench size={24} aria-hidden="true" />
        </div>
        <div className="assets-page__summary-content">
          <span className="assets-page__summary-label">Em manutencao</span>
          <span className="assets-page__summary-value">{inMaintenance}</span>
        </div>
      </div>

      <div className="assets-page__summary-card">
        <div className="assets-page__summary-icon">
          <TrendingUp size={24} aria-hidden="true" />
        </div>
        <div className="assets-page__summary-content">
          <span className="assets-page__summary-label">Ultimas aquisicoes</span>
          <span className="assets-page__summary-value">{recentCount}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Asset card (mobile) ──────────────────────────────────────────────

interface AssetCardProps {
  asset: Asset;
  onEdit: (asset: Asset) => void;
  onDelete: (asset: Asset) => void;
}

function AssetCard({ asset, onEdit, onDelete }: AssetCardProps) {
  return (
    <article className="assets-page__card">
      <div className="assets-page__card-header">
        <span className="assets-page__asset-tag">{asset.assetTag}</span>
        <StatusBadge status={asset.status} />
      </div>
      <h3 className="assets-page__card-name">{asset.name}</h3>
      <div className="assets-page__card-meta">
        <span className="assets-page__card-type">{ASSET_TYPE_LABELS[asset.assetType]}</span>
        {asset.farm && <span className="assets-page__card-farm">{asset.farm.name}</span>}
      </div>
      <div className="assets-page__card-value">{formatBRL(asset.acquisitionValue)}</div>
      <div className="assets-page__card-actions">
        <button
          type="button"
          className="assets-page__action-btn"
          onClick={() => onEdit(asset)}
          aria-label={`Editar ativo ${asset.name}`}
        >
          <Pencil size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="assets-page__action-btn assets-page__action-btn--danger"
          onClick={() => onDelete(asset)}
          aria-label={`Excluir ativo ${asset.name}`}
        >
          <Trash2 size={20} aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────

export default function AssetsPage() {
  const {
    assets,
    loading,
    error,
    summary,
    total,
    totalPages,
    fetchAssets,
    fetchSummary,
    deleteAsset,
    exportCsv,
    exportPdf,
  } = useAssets();
  const { farms } = useFarms();

  // Filters
  const [farmFilter, setFarmFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [acquisitionFrom, setAcquisitionFrom] = useState('');
  const [acquisitionTo, setAcquisitionTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal state
  const [showModal, setShowModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const currentQuery: ListAssetsQuery = {
    page: currentPage,
    limit: 20,
    farmId: farmFilter || undefined,
    assetType: (typeFilter as AssetType) || undefined,
    status: (statusFilter as AssetStatus) || undefined,
    search: search || undefined,
    acquisitionFrom: acquisitionFrom || undefined,
    acquisitionTo: acquisitionTo || undefined,
  };

  const loadData = useCallback(() => {
    void fetchAssets(currentQuery);
    void fetchSummary();
  }, [
    fetchAssets,
    fetchSummary,
    currentPage,
    farmFilter,
    typeFilter,
    statusFilter,
    search,
    acquisitionFrom,
    acquisitionTo,
  ]); // currentQuery is a derived object; using individual deps

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  function handleNewAsset() {
    setSelectedAsset(null);
    setShowModal(true);
  }

  function handleEditAsset(asset: Asset) {
    setSelectedAsset(asset);
    setShowModal(true);
  }

  function handleDeleteRequest(asset: Asset) {
    setAssetToDelete(asset);
    setShowDeleteConfirm(true);
  }

  async function handleDeleteConfirm() {
    if (!assetToDelete) return;
    setIsDeleting(true);
    try {
      await deleteAsset(assetToDelete.id, currentQuery);
      setToast('Ativo excluido com sucesso.');
    } catch {
      setToast('Nao foi possivel excluir o ativo.');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
      setAssetToDelete(null);
    }
  }

  function handleModalSuccess() {
    setShowModal(false);
    setSelectedAsset(null);
    void fetchAssets(currentQuery);
    void fetchSummary();
    setToast(selectedAsset ? 'Ativo atualizado com sucesso.' : 'Ativo cadastrado com sucesso.');
  }

  async function handleExportCsv() {
    try {
      await exportCsv(currentQuery);
    } catch {
      setToast('Nao foi possivel exportar o CSV.');
    }
  }

  async function handleExportPdf() {
    try {
      await exportPdf(currentQuery);
    } catch {
      setToast('Nao foi possivel exportar o PDF.');
    }
  }

  const hasFilters = Boolean(
    farmFilter || typeFilter || statusFilter || search || acquisitionFrom || acquisitionTo,
  );
  const isEmpty = !loading && !error && assets.length === 0;

  return (
    <main className="assets-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="assets-page__breadcrumb" aria-label="Caminho de navegacao">
        <span className="assets-page__breadcrumb-item">Inicio</span>
        <span className="assets-page__breadcrumb-sep" aria-hidden="true">
          &gt;
        </span>
        <span
          className="assets-page__breadcrumb-item assets-page__breadcrumb-item--current"
          aria-current="page"
        >
          Ativos Patrimoniais
        </span>
      </nav>

      {/* Header */}
      <header className="assets-page__header">
        <h1 className="assets-page__title">Ativos Patrimoniais</h1>
        <div className="assets-page__header-actions">
          <button
            type="button"
            className="assets-page__btn assets-page__btn--secondary"
            aria-disabled="true"
            title="Disponivel no plano de importacao"
            onClick={(e) => e.preventDefault()}
          >
            <Upload size={20} aria-hidden="true" />
            Importar ativos
          </button>
          <button
            type="button"
            className="assets-page__btn assets-page__btn--primary"
            onClick={handleNewAsset}
          >
            <Plus size={20} aria-hidden="true" />
            Novo ativo
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      {summary && (
        <SummaryCards
          totalAssets={summary.totalAssets}
          totalValue={summary.totalValue}
          inMaintenance={summary.inMaintenance}
          recentCount={summary.recentAcquisitions.length}
        />
      )}
      {!summary && !loading && (
        <SummaryCards totalAssets={0} totalValue="0" inMaintenance={0} recentCount={0} />
      )}

      {/* Filter bar */}
      <section className="assets-page__filters" aria-label="Filtros">
        <div className="assets-page__filter-row">
          {/* Fazenda */}
          <div className="assets-page__filter-field">
            <label htmlFor="filter-farm" className="assets-page__filter-label">
              Fazenda
            </label>
            <select
              id="filter-farm"
              className="assets-page__select"
              value={farmFilter}
              onChange={(e) => {
                setFarmFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Todas as fazendas</option>
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Tipo */}
          <div className="assets-page__filter-field">
            <label htmlFor="filter-type" className="assets-page__filter-label">
              Tipo
            </label>
            <select
              id="filter-type"
              className="assets-page__select"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Todos os tipos</option>
              {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div className="assets-page__filter-field">
            <label htmlFor="filter-status" className="assets-page__filter-label">
              Status
            </label>
            <select
              id="filter-status"
              className="assets-page__select"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="">Todos os status</option>
              {(Object.entries(ASSET_STATUS_LABELS) as [AssetStatus, string][]).map(
                ([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>

          {/* Periodo aquisicao */}
          <div className="assets-page__filter-field">
            <label htmlFor="filter-date-from" className="assets-page__filter-label">
              Aquisicao de
            </label>
            <input
              type="date"
              id="filter-date-from"
              className="assets-page__input"
              value={acquisitionFrom}
              onChange={(e) => {
                setAcquisitionFrom(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          <div className="assets-page__filter-field">
            <label htmlFor="filter-date-to" className="assets-page__filter-label">
              Ate
            </label>
            <input
              type="date"
              id="filter-date-to"
              className="assets-page__input"
              value={acquisitionTo}
              onChange={(e) => {
                setAcquisitionTo(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Search */}
          <div className="assets-page__filter-field assets-page__filter-field--search">
            <label htmlFor="filter-search" className="assets-page__filter-label">
              Busca
            </label>
            <div className="assets-page__search-wrapper">
              <Search size={16} aria-hidden="true" className="assets-page__search-icon" />
              <input
                type="search"
                id="filter-search"
                className="assets-page__input assets-page__input--search"
                placeholder="Buscar por nome, tag ou numero de serie..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
          </div>

          {/* Export buttons */}
          <div className="assets-page__export-btns">
            <button
              type="button"
              className="assets-page__btn assets-page__btn--outline"
              onClick={() => void handleExportCsv()}
              aria-label="Exportar CSV"
            >
              <Download size={16} aria-hidden="true" />
              CSV
            </button>
            <button
              type="button"
              className="assets-page__btn assets-page__btn--outline"
              onClick={() => void handleExportPdf()}
              aria-label="Exportar PDF"
            >
              <FileText size={16} aria-hidden="true" />
              PDF
            </button>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="assets-page__content" aria-label="Lista de ativos">
        {loading && <TableSkeleton />}

        {error && !loading && (
          <div className="assets-page__error" role="alert">
            <p>{error}</p>
            <button
              type="button"
              className="assets-page__btn assets-page__btn--secondary"
              onClick={loadData}
            >
              Tentar novamente
            </button>
          </div>
        )}

        {isEmpty && hasFilters && !error && (
          <div className="assets-page__empty">
            <Tractor size={64} aria-hidden="true" className="assets-page__empty-icon" />
            <p className="assets-page__empty-text">
              Nenhum ativo encontrado com esses filtros. Tente ajustar a busca.
            </p>
          </div>
        )}

        {isEmpty && !hasFilters && !error && (
          <div className="assets-page__empty">
            <Tractor size={64} aria-hidden="true" className="assets-page__empty-icon" />
            <h2 className="assets-page__empty-title">Nenhum ativo cadastrado</h2>
            <p className="assets-page__empty-desc">
              Cadastre maquinas, veiculos, implementos e benfeitorias para controlar seu patrimonio.
            </p>
            <button
              type="button"
              className="assets-page__btn assets-page__btn--primary"
              onClick={handleNewAsset}
            >
              <Plus size={20} aria-hidden="true" />
              Cadastrar primeiro ativo
            </button>
          </div>
        )}

        {!loading && !error && assets.length > 0 && (
          <>
            {/* Mobile: card stack */}
            <div className="assets-page__cards">
              {assets.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  onEdit={handleEditAsset}
                  onDelete={handleDeleteRequest}
                />
              ))}
            </div>

            {/* Desktop: table */}
            <div className="assets-page__table-wrapper">
              <table className="assets-page__table">
                <caption className="sr-only">Lista de ativos patrimoniais</caption>
                <thead>
                  <tr>
                    <th scope="col" className="assets-page__th">
                      Tag
                    </th>
                    <th scope="col" className="assets-page__th">
                      Nome
                    </th>
                    <th scope="col" className="assets-page__th">
                      Tipo
                    </th>
                    <th scope="col" className="assets-page__th">
                      Fazenda
                    </th>
                    <th scope="col" className="assets-page__th">
                      Status
                    </th>
                    <th scope="col" className="assets-page__th assets-page__th--right">
                      Valor Aquisicao
                    </th>
                    <th scope="col" className="assets-page__th assets-page__th--right">
                      Acoes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((asset) => (
                    <tr key={asset.id} className="assets-page__tr">
                      <td className="assets-page__td">
                        <span className="assets-page__tag">{asset.assetTag}</span>
                      </td>
                      <td className="assets-page__td">{asset.name}</td>
                      <td className="assets-page__td">{ASSET_TYPE_LABELS[asset.assetType]}</td>
                      <td className="assets-page__td">{asset.farm?.name ?? '—'}</td>
                      <td className="assets-page__td">
                        <StatusBadge status={asset.status} />
                      </td>
                      <td className="assets-page__td assets-page__td--right">
                        {formatBRL(asset.acquisitionValue)}
                      </td>
                      <td className="assets-page__td assets-page__td--right">
                        <div className="assets-page__row-actions">
                          <button
                            type="button"
                            className="assets-page__action-btn"
                            onClick={() => handleEditAsset(asset)}
                            aria-label="Editar ativo"
                          >
                            <Pencil size={20} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="assets-page__action-btn assets-page__action-btn--danger"
                            onClick={() => handleDeleteRequest(asset)}
                            aria-label="Excluir ativo"
                          >
                            <Trash2 size={20} aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="assets-page__pagination" aria-label="Paginacao">
                <button
                  type="button"
                  className="assets-page__pagination-btn"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  aria-label="Pagina anterior"
                >
                  <ChevronLeft size={20} aria-hidden="true" />
                </button>
                <span className="assets-page__pagination-info">
                  Pagina {currentPage} de {totalPages} ({total} ativos)
                </span>
                <button
                  type="button"
                  className="assets-page__pagination-btn"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  aria-label="Proxima pagina"
                >
                  <ChevronRight size={20} aria-hidden="true" />
                </button>
              </nav>
            )}
          </>
        )}
      </section>

      {/* Asset Modal (create/edit) */}
      {showModal && (
        <AssetModal
          isOpen={showModal}
          onClose={() => {
            setShowModal(false);
            setSelectedAsset(null);
          }}
          onSuccess={handleModalSuccess}
          asset={selectedAsset ?? undefined}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        title="Excluir ativo"
        message={`Esta acao nao pode ser desfeita. O ativo ${assetToDelete?.name ?? ''} sera removido do inventario.`}
        confirmLabel="Sim, excluir ativo"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={() => void handleDeleteConfirm()}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setAssetToDelete(null);
        }}
      />

      {/* Toast */}
      {toast && (
        <div className="assets-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </main>
  );
}
