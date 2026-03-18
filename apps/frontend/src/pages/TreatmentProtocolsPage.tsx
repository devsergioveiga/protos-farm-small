import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  Copy,
  ClipboardList,
  Database,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Syringe,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { useTreatmentProtocols } from '@/hooks/useTreatmentProtocols';
import type { ProtocolItem } from '@/types/treatment-protocol';
import { PROTOCOL_STATUSES } from '@/types/treatment-protocol';
import TreatmentProtocolModal from '@/components/treatment-protocols/TreatmentProtocolModal';
import { api } from '@/services/api';
import './TreatmentProtocolsPage.css';

export default function TreatmentProtocolsPage() {
  // ─── State ──────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [selectedProtocol, setSelectedProtocol] = useState<ProtocolItem | null>(null);
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
  const { protocols, meta, isLoading, error, refetch } = useTreatmentProtocols({
    page,
    status: statusFilter || undefined,
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

  const handleEdit = useCallback((p: ProtocolItem) => {
    setSelectedProtocol(p);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (p: ProtocolItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return;
      try {
        await api.delete(`/org/treatment-protocols/${p.id}`);
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
    async (p: ProtocolItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      try {
        await api.post(`/org/treatment-protocols/${p.id}/duplicate`, {});
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
        '/org/treatment-protocols/seed',
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

  return (
    <section className="tp-page">
      {/* Header */}
      <header className="tp-page__header">
        <div>
          <h1>Protocolos de Tratamento</h1>
          <p>Gerencie protocolos padronizados de tratamento veterinário</p>
        </div>
        <div className="tp-page__actions">
          <button
            type="button"
            className="tp-page__btn-seed"
            onClick={handleSeed}
            disabled={seeding}
          >
            <Database size={20} aria-hidden="true" />
            {seeding ? 'Carregando...' : 'Pré-carregar'}
          </button>
          <button
            type="button"
            className="tp-page__btn-primary"
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
        <div className="tp-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Errors */}
      {(error || deleteError) && (
        <div className="tp-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {/* Toolbar */}
      <div className="tp-page__toolbar">
        <div className="tp-page__search">
          <Search size={16} aria-hidden="true" className="tp-page__search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome, descrição ou autor..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar protocolos"
          />
        </div>
        <div className="tp-page__filter">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            {PROTOCOL_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Loading */}
      {isLoading && <div className="tp-page__loading">Carregando protocolos...</div>}

      {/* Empty */}
      {!isLoading && protocols.length === 0 && (
        <div className="tp-page__empty">
          <ClipboardList size={48} aria-hidden="true" />
          <h2>Nenhum protocolo cadastrado</h2>
          <p>
            Cadastre protocolos manualmente ou use o botão &quot;Pré-carregar&quot; para importar
            protocolos comuns. Certifique-se de cadastrar as doenças primeiro.
          </p>
        </div>
      )}

      {/* Grid */}
      {!isLoading && protocols.length > 0 && (
        <div className="tp-page__grid">
          {protocols.map((p) => (
            <div
              key={p.id}
              className="tp-page__card"
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
              <div className="tp-page__card-header">
                <div>
                  <h3 className="tp-page__card-title">{p.name}</h3>
                  <p className="tp-page__card-author">por {p.authorName}</p>
                </div>
                <div className="tp-page__card-actions">
                  <button
                    type="button"
                    className="tp-page__card-btn"
                    onClick={(e) => void handleDuplicate(p, e)}
                    aria-label={`Duplicar ${p.name}`}
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="tp-page__card-btn"
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
                    className="tp-page__card-btn tp-page__card-btn--delete"
                    onClick={(e) => void handleDelete(p, e)}
                    aria-label={`Excluir ${p.name}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="tp-page__card-tags">
                <span className={`tp-page__tag tp-page__tag--status-${p.status}`}>
                  <ShieldCheck size={12} aria-hidden="true" />
                  {p.statusLabel}
                </span>
                {p.severityLabel && (
                  <span className={`tp-page__tag tp-page__tag--severity-${p.severity}`}>
                    {p.severityLabel}
                  </span>
                )}
                {p.version > 1 && (
                  <span className="tp-page__tag tp-page__tag--version">v{p.version}</span>
                )}
              </div>

              {/* Diseases */}
              {p.diseases.length > 0 && (
                <div className="tp-page__card-diseases">
                  {p.diseases.map((d) => (
                    <span key={d.id} className="tp-page__disease-badge">
                      {d.diseaseName}
                    </span>
                  ))}
                </div>
              )}

              {/* Steps summary */}
              <div className="tp-page__card-meta">
                <span className="tp-page__card-meta-item">
                  <Syringe size={14} aria-hidden="true" />
                  {p.steps.length} medicamento{p.steps.length !== 1 ? 's' : ''}
                </span>
                {(p.withdrawalMeatDays != null || p.withdrawalMilkDays != null) && (
                  <span className="tp-page__card-meta-item">
                    <Clock size={14} aria-hidden="true" />
                    Carência: {p.withdrawalMeatDays ?? 0}d abate
                    {p.withdrawalMilkDays != null ? `, ${p.withdrawalMilkDays}h leite` : ''}
                  </span>
                )}
              </div>

              {p.description && <p className="tp-page__card-description">{p.description}</p>}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <nav className="tp-page__pagination" aria-label="Paginação">
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
      <TreatmentProtocolModal
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
