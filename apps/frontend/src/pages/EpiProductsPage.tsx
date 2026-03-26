import { useEffect, useState, useRef, useCallback } from 'react';
import { HardHat, Shield, Pencil, Trash2, AlertCircle } from 'lucide-react';
import { useEpiProducts } from '@/hooks/useEpiProducts';
import { ComplianceStatusBadge } from '@/components/shared/ComplianceStatusBadge';
import { EPI_TYPE_LABELS } from '@/types/epi';
import ConfirmModal from '@/components/ui/ConfirmModal';
import './EpiProductsPage.css';

type TabKey = 'produtos' | 'requisitos';

function getExpiryStatus(caExpiry: string | null): 'OK' | 'YELLOW' | 'RED' | 'EXPIRED' {
  if (!caExpiry) return 'OK';
  const now = new Date();
  const expiry = new Date(caExpiry);
  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'EXPIRED';
  if (diffDays <= 15) return 'RED';
  if (diffDays <= 30) return 'YELLOW';
  return 'OK';
}

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function EpiProductsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('produtos');
  const [search, setSearch] = useState('');
  const [epiTypeFilter, setEpiTypeFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    epiProducts,
    loading,
    error,
    fetchEpiProducts,
    deleteEpiProduct,
  } = useEpiProducts();

  const load = useCallback(
    (s: string, epiType: string) => {
      void fetchEpiProducts({ search: s || undefined, epiType: epiType || undefined });
    },
    [fetchEpiProducts],
  );

  useEffect(() => {
    load(search, epiTypeFilter);
  }, [load, search, epiTypeFilter]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 300);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const ok = await deleteEpiProduct(deleteId);
    setDeleting(false);
    if (ok) {
      setDeleteId(null);
      load(search, epiTypeFilter);
    }
  };

  const items = epiProducts?.data ?? [];
  const isEmpty = !loading && items.length === 0;

  return (
    <main className="epi-products-page">
      <header className="epi-products-page__header">
        <h1 className="epi-products-page__title">
          <HardHat size={24} aria-hidden="true" />
          EPIs
        </h1>
        <button type="button" className="epi-products-page__cta">
          Novo EPI
        </button>
      </header>

      {/* Tab strip */}
      <div className="epi-products-page__tabs" role="tablist" aria-label="Seções de EPIs">
        <button
          role="tab"
          aria-selected={activeTab === 'produtos'}
          className={`epi-products-page__tab ${activeTab === 'produtos' ? 'epi-products-page__tab--active' : ''}`}
          onClick={() => setActiveTab('produtos')}
          type="button"
        >
          Produtos EPI
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'requisitos'}
          className={`epi-products-page__tab ${activeTab === 'requisitos' ? 'epi-products-page__tab--active' : ''}`}
          onClick={() => setActiveTab('requisitos')}
          type="button"
        >
          Requisitos por Cargo
        </button>
      </div>

      {activeTab === 'produtos' && (
        <section aria-label="Produtos EPI">
          {/* Toolbar */}
          <div className="epi-products-page__toolbar">
            <div className="epi-products-page__search-wrap">
              <label htmlFor="epi-search" className="sr-only">
                Buscar EPI
              </label>
              <input
                id="epi-search"
                type="search"
                className="epi-products-page__search"
                placeholder="Buscar EPI..."
                onChange={handleSearchChange}
                aria-label="Buscar EPI"
              />
            </div>
            <div>
              <label htmlFor="epi-type-filter" className="sr-only">
                Tipo de EPI
              </label>
              <select
                id="epi-type-filter"
                className="epi-products-page__select"
                value={epiTypeFilter}
                onChange={(e) => setEpiTypeFilter(e.target.value)}
              >
                <option value="">Todos os tipos</option>
                {Object.entries(EPI_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="epi-products-page__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Loading skeleton */}
          {loading && (
            <div className="epi-products-page__skeleton" aria-busy="true" aria-label="Carregando">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="epi-products-page__skeleton-row" />
              ))}
            </div>
          )}

          {/* Empty state */}
          {isEmpty && (
            <div className="epi-products-page__empty">
              <Shield size={48} aria-hidden="true" className="epi-products-page__empty-icon" />
              <p className="epi-products-page__empty-title">Nenhum EPI cadastrado</p>
              <p className="epi-products-page__empty-body">
                Cadastre os EPIs para começar o controle de conformidade NR-31.
              </p>
              <button type="button" className="epi-products-page__cta">
                Novo EPI
              </button>
            </div>
          )}

          {/* Table */}
          {!loading && !isEmpty && (
            <div className="epi-products-page__table-wrap">
              <table className="epi-products-page__table">
                <thead>
                  <tr>
                    <th scope="col">NOME</th>
                    <th scope="col">TIPO</th>
                    <th scope="col">Nº CA</th>
                    <th scope="col">VALIDADE CA</th>
                    <th scope="col">ESTOQUE</th>
                    <th scope="col">AÇÕES</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.productName}</td>
                      <td>{EPI_TYPE_LABELS[item.epiType] ?? item.epiType}</td>
                      <td className="epi-products-page__mono">{item.caNumber}</td>
                      <td>
                        {item.caExpiry ? (
                          <ComplianceStatusBadge status={getExpiryStatus(item.caExpiry)} />
                        ) : (
                          <span className="epi-products-page__no-expiry">
                            {formatDate(item.caExpiry)}
                          </span>
                        )}
                      </td>
                      <td>{item.currentStock}</td>
                      <td className="epi-products-page__actions">
                        <button
                          type="button"
                          aria-label={`Editar ${item.productName}`}
                          className="epi-products-page__action-btn"
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Excluir ${item.productName}`}
                          className="epi-products-page__action-btn epi-products-page__action-btn--danger"
                          onClick={() => setDeleteId(item.id)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === 'requisitos' && (
        <section aria-label="Requisitos por Cargo">
          <p className="epi-products-page__requisitos-placeholder">
            Configure os EPIs obrigatórios por cargo.
          </p>
        </section>
      )}

      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir EPI"
        message="Esta ação irá remover o EPI. Confirmar exclusão?"
        variant="danger"
        confirmLabel="Excluir"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
      />
    </main>
  );
}
