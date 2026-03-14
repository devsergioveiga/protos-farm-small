import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  Copy,
  ShieldPlus,
  Database,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Syringe,
  ShieldCheck,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { useSanitaryProtocols } from '@/hooks/useSanitaryProtocols';
import type { SanitaryProtocol } from '@/types/sanitary-protocol';
import {
  SANITARY_PROTOCOL_STATUSES,
  PROCEDURE_TYPES,
  TARGET_CATEGORIES,
} from '@/types/sanitary-protocol';
import SanitaryProtocolModal from '@/components/sanitary-protocols/SanitaryProtocolModal';
import { api } from '@/services/api';
import './SanitaryProtocolsPage.css';

export default function SanitaryProtocolsPage() {
  // ─── State ──────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [procedureFilter, setProcedureFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<SanitaryProtocol | null>(null);
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
  const { protocols, meta, isLoading, error, refetch } = useSanitaryProtocols({
    page,
    status: statusFilter || undefined,
    procedureType: procedureFilter || undefined,
    targetCategory: categoryFilter || undefined,
    search: search || undefined,
  });

  // ─── Callbacks ──────────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedProtocol(null);
    setSuccessMsg(
      selectedProtocol ? 'Protocolo atualizado com sucesso' : 'Protocolo cadastrado com sucesso',
    );
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, selectedProtocol]);

  const handleEdit = useCallback((p: SanitaryProtocol) => {
    setSelectedProtocol(p);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (p: SanitaryProtocol, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return;
      try {
        await api.delete(`/org/sanitary-protocols/${p.id}`);
        setSuccessMsg('Protocolo excluído com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir protocolo.');
      }
    },
    [refetch],
  );

  const handleDuplicate = useCallback(
    async (p: SanitaryProtocol, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      try {
        await api.post(`/org/sanitary-protocols/${p.id}/duplicate`, {});
        setSuccessMsg('Protocolo duplicado com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao duplicar protocolo.');
      }
    },
    [refetch],
  );

  const handleSeed = useCallback(async () => {
    setSeeding(true);
    setDeleteError(null);
    try {
      const result = await api.post<{ created: number; total: number }>(
        '/org/sanitary-protocols/seed',
        {},
      );
      setSuccessMsg(`${result.created} protocolos pré-carregados com sucesso`);
      void refetch();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao carregar protocolos padrão.');
    } finally {
      setSeeding(false);
    }
  }, [refetch]);

  function formatTrigger(p: SanitaryProtocol): string {
    const triggers = new Set(p.items.map((i) => i.triggerTypeLabel));
    return Array.from(triggers).join(', ');
  }

  return (
    <section className="sp-page">
      {/* Header */}
      <header className="sp-page__header">
        <div>
          <h1>Protocolos Sanitários</h1>
          <p>Gerencie protocolos sanitários do rebanho (vacinação, vermifugação, exames)</p>
        </div>
        <div className="sp-page__actions">
          <button
            type="button"
            className="sp-page__btn-seed"
            onClick={handleSeed}
            disabled={seeding}
          >
            <Database size={20} aria-hidden="true" />
            {seeding ? 'Carregando...' : 'Pré-carregar'}
          </button>
          <button
            type="button"
            className="sp-page__btn-primary"
            onClick={() => {
              setSelectedProtocol(null);
              setShowModal(true);
            }}
          >
            <Plus size={20} aria-hidden="true" />
            Novo protocolo
          </button>
        </div>
      </header>

      {/* Success */}
      {successMsg && (
        <div className="sp-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Errors */}
      {(error || deleteError) && (
        <div className="sp-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {/* Toolbar */}
      <div className="sp-page__toolbar">
        <div className="sp-page__search">
          <Search size={16} aria-hidden="true" className="sp-page__search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome, descrição ou autor..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar protocolos sanitários"
          />
        </div>
        <div className="sp-page__filter">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            {SANITARY_PROTOCOL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sp-page__filter">
          <select
            value={procedureFilter}
            onChange={(e) => {
              setProcedureFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por tipo de procedimento"
          >
            <option value="">Todos os procedimentos</option>
            {PROCEDURE_TYPES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sp-page__filter">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por categoria animal"
          >
            <option value="">Todas as categorias</option>
            {TARGET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && <div className="sp-page__loading">Carregando protocolos...</div>}

      {/* Empty */}
      {!isLoading && protocols.length === 0 && (
        <div className="sp-page__empty">
          <ShieldPlus size={48} aria-hidden="true" />
          <h2>Nenhum protocolo sanitário cadastrado</h2>
          <p>
            Cadastre protocolos manualmente ou use o botão &quot;Pré-carregar&quot; para importar
            protocolos comuns (vacinação, vermifugação, secagem).
          </p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && protocols.length > 0 && (
        <div className="sp-page__grid">
          {protocols.map((p) => (
            <div
              key={p.id}
              className="sp-page__card"
              onClick={() => handleEdit(p)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEdit(p);
                }
              }}
            >
              <div className="sp-page__card-header">
                <div>
                  <h3 className="sp-page__card-title">{p.name}</h3>
                  <p className="sp-page__card-author">por {p.authorName}</p>
                </div>
                <div className="sp-page__card-actions">
                  <button
                    type="button"
                    className="sp-page__card-btn"
                    onClick={(e) => void handleDuplicate(p, e)}
                    aria-label={`Duplicar ${p.name}`}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="sp-page__card-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEdit(p);
                    }}
                    aria-label={`Editar ${p.name}`}
                  >
                    <Pencil size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="sp-page__card-btn sp-page__card-btn--delete"
                    onClick={(e) => void handleDelete(p, e)}
                    aria-label={`Excluir ${p.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="sp-page__card-tags">
                <span className={`sp-page__tag sp-page__tag--status-${p.status}`}>
                  <ShieldCheck size={12} aria-hidden="true" />
                  {p.statusLabel}
                </span>
                {p.isObligatory && (
                  <span className="sp-page__tag sp-page__tag--obligatory">
                    <AlertTriangle size={12} aria-hidden="true" />
                    Obrigatório
                  </span>
                )}
                {p.version > 1 && (
                  <span className="sp-page__tag sp-page__tag--version">v{p.version}</span>
                )}
              </div>

              {/* Target categories */}
              {p.targetCategoryLabels.length > 0 && (
                <div className="sp-page__card-categories">
                  {p.targetCategoryLabels.map((label, idx) => (
                    <span key={idx} className="sp-page__category-badge">
                      {label}
                    </span>
                  ))}
                </div>
              )}

              {/* Items summary */}
              <div className="sp-page__card-meta">
                <span className="sp-page__card-meta-item">
                  <Syringe size={14} aria-hidden="true" />
                  {p.items.length} procedimento{p.items.length !== 1 ? 's' : ''}
                </span>
                <span className="sp-page__card-meta-item">
                  <Calendar size={14} aria-hidden="true" />
                  {formatTrigger(p)}
                </span>
              </div>

              {p.description && <p className="sp-page__card-description">{p.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="sp-page__pagination" aria-label="Paginação">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
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
            onClick={() => setPage((prev) => prev + 1)}
            disabled={page >= meta.totalPages}
            aria-label="Próxima página"
          >
            Próxima
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}

      {/* Modal */}
      <SanitaryProtocolModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedProtocol(null);
        }}
        protocol={selectedProtocol}
        onSuccess={handleSuccess}
      />
    </section>
  );
}
