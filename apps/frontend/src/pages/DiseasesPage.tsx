import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  HeartPulse,
  Database,
  ShieldAlert,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
} from 'lucide-react';
import { useDiseases } from '@/hooks/useDiseases';
import type { DiseaseItem } from '@/types/disease';
import { DISEASE_CATEGORIES } from '@/types/disease';
import DiseaseModal from '@/components/diseases/DiseaseModal';
import { api } from '@/services/api';
import './DiseasesPage.css';

export default function DiseasesPage() {
  // ─── State ──────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState<DiseaseItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  // ─── Debounced search ───────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── Data ───────────────────────────────────────────────
  const { diseases, meta, isLoading, error, refetch } = useDiseases({
    page,
    category: categoryFilter || undefined,
    search: search || undefined,
  });

  // ─── Callbacks ──────────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedDisease(null);
    setSuccessMsg(
      selectedDisease ? 'Doença atualizada com sucesso' : 'Doença cadastrada com sucesso',
    );
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, selectedDisease]);

  const handleEdit = useCallback((d: DiseaseItem) => {
    setSelectedDisease(d);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (d: DiseaseItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm(`Excluir "${d.name}"? Esta ação não pode ser desfeita.`)) return;
      try {
        await api.delete(`/org/diseases/${d.id}`);
        setSuccessMsg('Doença excluída com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir doença.');
      }
    },
    [refetch],
  );

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    setDeleteError(null);
    try {
      const result = await api.post<{ created: number; total: number }>('/org/diseases/seed', {});
      setSuccessMsg(`${result.created} doenças pré-carregadas com sucesso`);
      void refetch();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao carregar doenças padrão.');
    } finally {
      setSeeding(false);
    }
  }, [refetch]);

  return (
    <section className="diseases-page">
      {/* Header */}
      <header className="diseases-page__header">
        <div>
          <h1>Catálogo de Doenças</h1>
          <p>Gerencie o catálogo de doenças que acometem o rebanho</p>
        </div>
        <div className="diseases-page__actions">
          <button
            type="button"
            className="diseases-page__btn-seed"
            onClick={handleSeed}
            disabled={seeding}
          >
            <Database size={20} aria-hidden="true" />
            {seeding ? 'Carregando...' : 'Pré-carregar'}
          </button>
          <button
            type="button"
            className="diseases-page__btn-primary"
            onClick={() => {
              setSelectedDisease(null);
              setShowModal(true);
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Nova doença
          </button>
        </div>
      </header>

      {/* Success */}
      {successMsg && (
        <div className="diseases-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Errors */}
      {(error || deleteError) && (
        <div className="diseases-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {/* Toolbar */}
      <div className="diseases-page__toolbar">
        <div className="diseases-page__search">
          <Search size={16} aria-hidden="true" className="diseases-page__search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome ou nome científico..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar doenças"
          />
        </div>
        <div className="diseases-page__filter">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por categoria"
          >
            <option value="">Todas as categorias</option>
            {DISEASE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && <div className="diseases-page__loading">Carregando doenças...</div>}

      {/* Empty */}
      {!isLoading && diseases.length === 0 && (
        <div className="diseases-page__empty">
          <HeartPulse size={48} aria-hidden="true" />
          <h2>Nenhuma doença cadastrada</h2>
          <p>
            Cadastre doenças manualmente ou use o botão &quot;Pré-carregar&quot; para importar as
            doenças mais comuns na pecuária.
          </p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && diseases.length > 0 && (
        <div className="diseases-page__grid">
          {diseases.map((d) => (
            <div
              key={d.id}
              className="diseases-page__card"
              onClick={() => handleEdit(d)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEdit(d);
                }
              }}
            >
              <div className="diseases-page__card-header">
                <div>
                  <h3 className="diseases-page__card-title">{d.name}</h3>
                  {d.scientificName && (
                    <p className="diseases-page__card-scientific">{d.scientificName}</p>
                  )}
                </div>
                <div className="diseases-page__card-actions">
                  <button
                    type="button"
                    className="diseases-page__card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(d);
                    }}
                    aria-label={`Editar ${d.name}`}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="diseases-page__card-btn diseases-page__card-btn--delete"
                    onClick={(e) => void handleDelete(d, e)}
                    aria-label={`Excluir ${d.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="diseases-page__card-tags">
                <span className="diseases-page__tag diseases-page__tag--category">
                  {d.categoryLabel}
                </span>
                {d.severity && (
                  <span className={`diseases-page__tag diseases-page__tag--severity-${d.severity}`}>
                    {d.severityLabel}
                  </span>
                )}
                {d.affectedSystemLabel && (
                  <span className="diseases-page__tag diseases-page__tag--system">
                    {d.affectedSystemLabel}
                  </span>
                )}
                {d.isNotifiable && (
                  <span className="diseases-page__tag diseases-page__tag--notifiable">
                    <ShieldAlert size={12} aria-hidden="true" />
                    Notificação obrigatória
                  </span>
                )}
              </div>

              {d.symptoms && <p className="diseases-page__card-symptoms">{d.symptoms}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="diseases-page__pagination" aria-label="Paginação">
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

      {/* Modal */}
      <DiseaseModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedDisease(null);
        }}
        disease={selectedDisease}
        onSuccess={handleSuccess}
      />
    </section>
  );
}
