import { useState, useEffect, useRef, useCallback } from 'react';
import { HardHat, Plus, Search, Shield, Pencil, Package } from 'lucide-react';
import { useEpiProducts } from '@/hooks/useEpiProducts';
import { ComplianceStatusBadge } from '@/components/shared/ComplianceStatusBadge';
import EpiProductModal from '@/components/epi-products/EpiProductModal';
import PositionEpiRequirementsModal from '@/components/epi-products/PositionEpiRequirementsModal';
import EpiDeliveryModal from '@/components/epi-deliveries/EpiDeliveryModal';
import type { EpiProduct, PositionWithEpiCount } from '@/types/epi';
import { EPI_TYPE_LABELS, EPI_TYPES } from '@/types/epi';
import type { ComplianceAlertLevel } from '@/types/safety';
import './EpiProductsPage.css';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

function getCaExpiryStatus(caExpiry: string | null): ComplianceAlertLevel {
  if (!caExpiry) return 'OK';
  const now = new Date();
  const expiry = new Date(caExpiry);
  const diffDays = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= 15) return 'RED';
  if (diffDays <= 30) return 'YELLOW';
  return 'OK';
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <tr className="epi-products-page__skeleton-row">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i}>
          <div className="epi-products-page__skeleton" />
        </td>
      ))}
    </tr>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

type TabKey = 'products' | 'requirements';

const LIMIT = 20;

export default function EpiProductsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('products');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [epiTypeFilter, setEpiTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [toast, setToast] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<EpiProduct | null>(null);
  const [positionForRequirements, setPositionForRequirements] =
    useState<PositionWithEpiCount | null>(null);
  const [deliveryProduct, setDeliveryProduct] = useState<EpiProduct | null>(null);

  const [positionRequirements, setPositionRequirements] = useState<PositionWithEpiCount[]>([]);
  const [posReqLoading, setPosReqLoading] = useState(false);

  const {
    epiProducts,
    loading,
    error,
    successMessage,
    setSuccessMessage,
    fetchEpiProducts,
    fetchPositionRequirements,
  } = useEpiProducts();

  // ─── Debounced search ──────────────────────────────────────────────────────

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchInput]);

  // ─── Fetch data ────────────────────────────────────────────────────────────

  const loadProducts = useCallback(() => {
    void fetchEpiProducts({
      search: search || undefined,
      epiType: epiTypeFilter || undefined,
      page,
      limit: LIMIT,
    });
  }, [fetchEpiProducts, search, epiTypeFilter, page]);

  useEffect(() => {
    if (activeTab === 'products') {
      loadProducts();
    }
  }, [activeTab, loadProducts]);

  useEffect(() => {
    if (activeTab === 'requirements') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPosReqLoading(true);
      void fetchPositionRequirements()
        .then(setPositionRequirements)
        .finally(() => setPosReqLoading(false));
    }
  }, [activeTab, fetchPositionRequirements]);

  // ─── Toast ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (successMessage) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToast(successMessage);
      setSuccessMessage(null);
      const timer = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage, setSuccessMessage]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  };

  // ─── Pagination ────────────────────────────────────────────────────────────

  const totalPages = epiProducts ? Math.ceil(epiProducts.total / LIMIT) : 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="epi-products-page" id="main-content">
      {/* Toast */}
      {toast && (
        <div className="epi-products-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="epi-products-page__header">
        <h1 className="epi-products-page__title">
          <HardHat size={24} aria-hidden="true" />
          EPIs
        </h1>
        <button
          type="button"
          className="epi-products-page__btn-primary"
          onClick={() => setShowCreateModal(true)}
        >
          <Plus size={20} aria-hidden="true" />
          Novo EPI
        </button>
      </div>

      {/* Tabs */}
      <div className="epi-products-page__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'products'}
          className={`epi-products-page__tab${activeTab === 'products' ? ' epi-products-page__tab--active' : ''}`}
          onClick={() => setActiveTab('products')}
        >
          Produtos EPI
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'requirements'}
          className={`epi-products-page__tab${activeTab === 'requirements' ? ' epi-products-page__tab--active' : ''}`}
          onClick={() => setActiveTab('requirements')}
        >
          Requisitos por Cargo
        </button>
      </div>

      {/* Tab: Produtos EPI */}
      {activeTab === 'products' && (
        <section aria-label="Produtos EPI">
          {/* Toolbar */}
          <div className="epi-products-page__toolbar">
            <div className="epi-products-page__search-wrapper">
              <Search size={16} aria-hidden="true" className="epi-products-page__search-icon" />
              <input
                type="search"
                className="epi-products-page__search"
                placeholder="Buscar EPI..."
                aria-label="Buscar EPI"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>
            <select
              className="epi-products-page__filter"
              aria-label="Filtrar por tipo de EPI"
              value={epiTypeFilter}
              onChange={(e) => {
                setEpiTypeFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todos os tipos</option>
              {EPI_TYPES.map((t) => (
                <option key={t} value={t}>
                  {EPI_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Error */}
          {error && (
            <p className="epi-products-page__error" role="alert">
              {error}
            </p>
          )}

          {/* Table */}
          <div className="epi-products-page__table-wrapper">
            <table className="epi-products-page__table">
              <thead>
                <tr>
                  <th scope="col">NOME</th>
                  <th scope="col">TIPO</th>
                  <th scope="col">NÚMERO CA</th>
                  <th scope="col">VALIDADE CA</th>
                  <th scope="col">ESTOQUE</th>
                  <th scope="col">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                )}
                {!loading && epiProducts?.data.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <div className="epi-products-page__empty">
                        <Shield
                          size={48}
                          aria-hidden="true"
                          className="epi-products-page__empty-icon"
                        />
                        <p className="epi-products-page__empty-title">Nenhum EPI cadastrado</p>
                        <p className="epi-products-page__empty-body">
                          Cadastre os EPIs para começar o controle de conformidade NR-31.
                        </p>
                        <button
                          type="button"
                          className="epi-products-page__btn-primary"
                          onClick={() => setShowCreateModal(true)}
                        >
                          <Plus size={20} aria-hidden="true" />
                          Novo EPI
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
                {!loading &&
                  epiProducts?.data.map((product) => (
                    <tr key={product.id} className="epi-products-page__row">
                      <td>{product.productName}</td>
                      <td>{EPI_TYPE_LABELS[product.epiType] ?? product.epiType}</td>
                      <td>
                        <span className="epi-products-page__mono">{product.caNumber}</span>
                      </td>
                      <td>
                        {product.caExpiry ? (
                          <>
                            <ComplianceStatusBadge status={getCaExpiryStatus(product.caExpiry)} />
                            <span className="epi-products-page__expiry-date">
                              {formatDate(product.caExpiry)}
                            </span>
                          </>
                        ) : (
                          <span className="epi-products-page__no-expiry">Sem validade</span>
                        )}
                      </td>
                      <td>{product.currentStock}</td>
                      <td>
                        <div className="epi-products-page__actions">
                          <button
                            type="button"
                            className="epi-products-page__btn-icon"
                            aria-label={`Editar ${product.productName}`}
                            onClick={() => setEditingProduct(product)}
                          >
                            <Pencil size={16} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="epi-products-page__btn-secondary"
                            onClick={() => setDeliveryProduct(product)}
                          >
                            <Package size={16} aria-hidden="true" />
                            Entregar
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
            <div className="epi-products-page__pagination" aria-label="Paginação">
              <button
                type="button"
                className="epi-products-page__page-btn"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                &lsaquo;
              </button>
              <span className="epi-products-page__page-info">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="epi-products-page__page-btn"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Próxima página"
              >
                &rsaquo;
              </button>
            </div>
          )}
        </section>
      )}

      {/* Tab: Requisitos por Cargo */}
      {activeTab === 'requirements' && (
        <section aria-label="Requisitos por Cargo">
          <div className="epi-products-page__table-wrapper">
            <table className="epi-products-page__table">
              <thead>
                <tr>
                  <th scope="col">CARGO</th>
                  <th scope="col">EPIS OBRIGATÓRIOS</th>
                  <th scope="col">AÇÕES</th>
                </tr>
              </thead>
              <tbody>
                {posReqLoading && (
                  <>
                    <tr className="epi-products-page__skeleton-row">
                      {[1, 2, 3].map((i) => (
                        <td key={i}>
                          <div className="epi-products-page__skeleton" />
                        </td>
                      ))}
                    </tr>
                    <tr className="epi-products-page__skeleton-row">
                      {[1, 2, 3].map((i) => (
                        <td key={i}>
                          <div className="epi-products-page__skeleton" />
                        </td>
                      ))}
                    </tr>
                  </>
                )}
                {!posReqLoading && positionRequirements.length === 0 && (
                  <tr>
                    <td colSpan={3}>
                      <div className="epi-products-page__empty">
                        <p className="epi-products-page__empty-title">
                          Nenhum cargo com requisitos configurados.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
                {!posReqLoading &&
                  positionRequirements.map((pos) => (
                    <tr key={pos.positionId} className="epi-products-page__row">
                      <td>{pos.positionName}</td>
                      <td>
                        {pos.epiCount === 0 ? (
                          <em className="epi-products-page__no-epi">Nenhum EPI definido</em>
                        ) : (
                          <span className="epi-products-page__count-chip">{pos.epiCount}</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="epi-products-page__btn-secondary"
                          onClick={() => setPositionForRequirements(pos)}
                        >
                          Configurar
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Modals */}
      {(showCreateModal || editingProduct) && (
        <EpiProductModal
          isOpen={showCreateModal || editingProduct !== null}
          product={editingProduct}
          onClose={() => {
            setShowCreateModal(false);
            setEditingProduct(null);
          }}
          onSuccess={(msg) => {
            setShowCreateModal(false);
            setEditingProduct(null);
            showToast(msg);
            loadProducts();
          }}
        />
      )}

      {positionForRequirements && (
        <PositionEpiRequirementsModal
          isOpen={true}
          position={positionForRequirements}
          onClose={() => setPositionForRequirements(null)}
          onSuccess={() => {
            void fetchPositionRequirements().then(setPositionRequirements);
          }}
        />
      )}

      {deliveryProduct && (
        <EpiDeliveryModal
          isOpen={true}
          prefilledEpiProduct={deliveryProduct}
          onClose={() => setDeliveryProduct(null)}
          onSuccess={(msg) => {
            setDeliveryProduct(null);
            showToast(msg);
            loadProducts();
          }}
        />
      )}
    </main>
  );
}
