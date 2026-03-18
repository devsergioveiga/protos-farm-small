import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  Heart,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Download,
  TestTubeDiagonal,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useBulls } from '@/hooks/useBulls';
import type { BullItem } from '@/types/bull';
import { BULL_STATUSES } from '@/types/bull';
import BullModal from '@/components/bulls/BullModal';
import BullDetailModal from '@/components/bulls/BullDetailModal';
import { api } from '@/services/api';
import './BullsPage.css';

type Tab = 'bulls' | 'catalog';

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bulls-page__badge--active',
  RESTING: 'bulls-page__badge--resting',
  DISCARDED: 'bulls-page__badge--discarded',
};

export default function BullsPage() {
  const { selectedFarm } = useFarmContext();

  // ─── State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<Tab>('bulls');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [selectedBull, setSelectedBull] = useState<BullItem | null>(null);
  const [detailBullId, setDetailBullId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Catalog state
  const [catalogBulls, setCatalogBulls] = useState<BullItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  // ─── Debounced search ───────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── Data ───────────────────────────────────────────────
  const { bulls, meta, isLoading, error, refetch } = useBulls({
    farmId: selectedFarm?.id ?? null,
    page,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  // ─── Catalog fetch ────────────────────────────────────
  const fetchCatalog = useCallback(async () => {
    if (!selectedFarm) return;
    setCatalogLoading(true);
    setCatalogError(null);
    try {
      const result = await api.get<{ data: BullItem[] }>(
        `/org/farms/${selectedFarm.id}/bulls/catalog`,
      );
      setCatalogBulls(result.data);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Erro ao carregar catálogo');
    } finally {
      setCatalogLoading(false);
    }
  }, [selectedFarm]);

  useEffect(() => {
    if (activeTab === 'catalog') {
      void fetchCatalog();
    }
  }, [activeTab, fetchCatalog]);

  // ─── Callbacks ──────────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedBull(null);
    setSuccessMsg(selectedBull ? 'Touro atualizado com sucesso' : 'Touro cadastrado com sucesso');
    void refetch();
    if (activeTab === 'catalog') void fetchCatalog();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, selectedBull, activeTab, fetchCatalog]);

  const handleEdit = useCallback((b: BullItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBull(b);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (b: BullItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm('Excluir este touro? Esta ação não pode ser desfeita.')) return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/bulls/${b.id}`);
        setSuccessMsg('Touro excluído com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir touro.');
      }
    },
    [refetch, selectedFarm],
  );

  const handleExportCatalog = useCallback(async () => {
    if (!selectedFarm) return;
    try {
      const blob = await api.getBlob(`/org/farms/${selectedFarm.id}/bulls/export`);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `catalogo-touros-${selectedFarm.name}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setCatalogError(err instanceof Error ? err.message : 'Erro ao exportar catálogo.');
    }
  }, [selectedFarm]);

  const handleDetailSuccess = useCallback(() => {
    void refetch();
    if (activeTab === 'catalog') void fetchCatalog();
  }, [refetch, activeTab, fetchCatalog]);

  // ─── No farm selected ──────────────────────────────────
  if (!selectedFarm) {
    return (
      <section className="bulls-page">
        <div className="bulls-page__empty">
          <Heart size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para gerenciar touros e sêmen.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bulls-page">
      {/* Header */}
      <header className="bulls-page__header">
        <div>
          <h1>Touros e sêmen</h1>
          <p>Gestão de touros e estoque de sêmen de {selectedFarm.name}</p>
        </div>
        {activeTab === 'bulls' && (
          <div className="bulls-page__actions">
            <button
              type="button"
              className="bulls-page__btn-primary"
              onClick={() => {
                setSelectedBull(null);
                setShowModal(true);
              }}
            >
              <Plus size={20} aria-hidden="true" />
              Novo touro
            </button>
          </div>
        )}
        {activeTab === 'catalog' && (
          <div className="bulls-page__actions">
            <button
              type="button"
              className="bulls-page__btn-secondary"
              onClick={() => void handleExportCatalog()}
            >
              <Download size={20} aria-hidden="true" />
              Exportar CSV
            </button>
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="bulls-page__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'bulls'}
          className={`bulls-page__tab ${activeTab === 'bulls' ? 'bulls-page__tab--active' : ''}`}
          onClick={() => setActiveTab('bulls')}
        >
          <Heart size={16} aria-hidden="true" />
          Touros
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'catalog'}
          className={`bulls-page__tab ${activeTab === 'catalog' ? 'bulls-page__tab--active' : ''}`}
          onClick={() => setActiveTab('catalog')}
        >
          <TestTubeDiagonal size={16} aria-hidden="true" />
          Catálogo genético
        </button>
      </div>

      {/* Success */}
      {successMsg && (
        <div className="bulls-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Errors */}
      {(error || deleteError || catalogError) && (
        <div className="bulls-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError || catalogError}
        </div>
      )}

      {/* ═══ Touros tab ═══ */}
      {activeTab === 'bulls' && (
        <>
          {/* Toolbar */}
          <div className="bulls-page__toolbar">
            <div className="bulls-page__search">
              <Search size={16} aria-hidden="true" className="bulls-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por nome, raça ou registro..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar touros"
              />
            </div>
            <div className="bulls-page__filter">
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrar por status"
              >
                <option value="">Todos os status</option>
                {BULL_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Loading */}
          {isLoading && <div className="bulls-page__loading">Carregando touros...</div>}

          {/* Empty */}
          {!isLoading && bulls.length === 0 && (
            <div className="bulls-page__empty">
              <Heart size={48} aria-hidden="true" />
              <h2>Nenhum touro cadastrado</h2>
              <p>Cadastre touros para gerenciar sêmen e mérito genético.</p>
            </div>
          )}

          {/* Card grid */}
          {!isLoading && bulls.length > 0 && (
            <div className="bulls-page__grid">
              {bulls.map((b) => (
                <div
                  key={b.id}
                  className="bulls-page__card"
                  onClick={() => setDetailBullId(b.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setDetailBullId(b.id);
                    }
                  }}
                >
                  <div className="bulls-page__card-header">
                    <div>
                      <h3 className="bulls-page__card-title">{b.name}</h3>
                      <p className="bulls-page__card-subtitle">{b.breedName}</p>
                    </div>
                    <div className="bulls-page__card-actions">
                      <button
                        type="button"
                        className="bulls-page__card-btn"
                        onClick={(e) => handleEdit(b, e)}
                        aria-label={`Editar ${b.name}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="bulls-page__card-btn bulls-page__card-btn--delete"
                        onClick={(e) => void handleDelete(b, e)}
                        aria-label={`Excluir ${b.name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="bulls-page__card-tags">
                    <span className={`bulls-page__badge ${STATUS_BADGE[b.status] || ''}`}>
                      {b.statusLabel}
                    </span>
                    {b.isOwnAnimal && (
                      <span className="bulls-page__badge bulls-page__badge--own">Próprio</span>
                    )}
                  </div>

                  <div className="bulls-page__card-details">
                    {b.ptaMilkKg != null && (
                      <span className="bulls-page__detail">
                        <span className="bulls-page__detail-label">PTA LEITE</span>
                        <span className="bulls-page__detail-value">{b.ptaMilkKg} kg</span>
                      </span>
                    )}
                    <span className="bulls-page__detail">
                      <TestTubeDiagonal size={14} aria-hidden="true" />
                      <span className="bulls-page__detail-value">{b.semenStock} doses</span>
                    </span>
                  </div>

                  {b.registryNumber && (
                    <div className="bulls-page__card-registry">
                      {b.registryNumber}
                      {b.registryAssociation ? ` — ${b.registryAssociation}` : ''}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="bulls-page__pagination" aria-label="Paginação">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span>
                {page} de {meta.totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= meta.totalPages}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      {/* ═══ Catálogo genético tab ═══ */}
      {activeTab === 'catalog' && (
        <>
          {catalogLoading && (
            <div className="bulls-page__loading">Carregando catálogo genético...</div>
          )}

          {!catalogLoading && catalogBulls.length === 0 && (
            <div className="bulls-page__empty">
              <TestTubeDiagonal size={48} aria-hidden="true" />
              <h2>Catálogo vazio</h2>
              <p>Cadastre touros com dados de mérito genético para montar o catálogo.</p>
            </div>
          )}

          {!catalogLoading && catalogBulls.length > 0 && (
            <div className="bulls-page__catalog-table-wrap">
              <table className="bulls-page__catalog-table">
                <caption className="sr-only">
                  Catálogo genético de touros ordenado por PTA Leite
                </caption>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Nome</th>
                    <th scope="col">Raça</th>
                    <th scope="col">Status</th>
                    <th scope="col">PTA Leite (kg)</th>
                    <th scope="col">PTA Gord. (kg)</th>
                    <th scope="col">PTA Gord. (%)</th>
                    <th scope="col">PTA Prot. (kg)</th>
                    <th scope="col">PTA Prot. (%)</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Vida Prod.</th>
                    <th scope="col">Parto</th>
                    <th scope="col">CCS</th>
                    <th scope="col">Doses</th>
                  </tr>
                </thead>
                <tbody>
                  {catalogBulls.map((b, idx) => (
                    <tr
                      key={b.id}
                      className="bulls-page__catalog-row"
                      onClick={() => setDetailBullId(b.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setDetailBullId(b.id);
                        }
                      }}
                    >
                      <td className="bulls-page__catalog-rank">{idx + 1}</td>
                      <td className="bulls-page__catalog-name">{b.name}</td>
                      <td>{b.breedName}</td>
                      <td>
                        <span className={`bulls-page__badge ${STATUS_BADGE[b.status] || ''}`}>
                          {b.statusLabel}
                        </span>
                      </td>
                      <td className="bulls-page__catalog-mono">
                        {b.ptaMilkKg != null ? b.ptaMilkKg : '—'}
                      </td>
                      <td className="bulls-page__catalog-mono">
                        {b.ptaFatKg != null ? b.ptaFatKg : '—'}
                      </td>
                      <td className="bulls-page__catalog-mono">
                        {b.ptaFatPct != null ? `${b.ptaFatPct}%` : '—'}
                      </td>
                      <td className="bulls-page__catalog-mono">
                        {b.ptaProteinKg != null ? b.ptaProteinKg : '—'}
                      </td>
                      <td className="bulls-page__catalog-mono">
                        {b.ptaProteinPct != null ? `${b.ptaProteinPct}%` : '—'}
                      </td>
                      <td className="bulls-page__catalog-mono">
                        {b.typeScore != null ? b.typeScore : '—'}
                      </td>
                      <td className="bulls-page__catalog-mono">
                        {b.productiveLife != null ? b.productiveLife : '—'}
                      </td>
                      <td className="bulls-page__catalog-mono">
                        {b.calvingEase != null ? b.calvingEase : '—'}
                      </td>
                      <td className="bulls-page__catalog-mono">{b.scc != null ? b.scc : '—'}</td>
                      <td className="bulls-page__catalog-mono">{b.semenStock}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <BullModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedBull(null);
        }}
        bull={selectedBull}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
      />

      <BullDetailModal
        isOpen={!!detailBullId}
        onClose={() => setDetailBullId(null)}
        bullId={detailBullId}
        farmId={selectedFarm.id}
        onSuccess={handleDetailSuccess}
      />
    </section>
  );
}
