import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  AlertOctagon,
  Trash2,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Thermometer,
  Lock,
  Syringe,
  Clock,
  BarChart3,
  X,
  Activity,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useMastitis, useMastitisIndicators, useMastitisDetail } from '@/hooks/useMastitis';
import { api } from '@/services/api';
import type { MastitisCaseItem } from '@/types/mastitis';
import {
  STATUS_CONFIG,
  CLASSIFICATION_CONFIG,
  GRADE_CONFIG,
  QUARTER_STATUS_CONFIG,
  QUARTER_SHORT_LABELS,
  QUARTER_STATUSES,
  CLOSURE_OUTCOMES,
  QUARTERS,
} from '@/types/mastitis';
import MastitisModal from '@/components/mastitis/MastitisModal';
import ApplicationModal from '@/components/mastitis/ApplicationModal';
import './MastitisPage.css';

type PageTab = 'cases' | 'detail' | 'indicators';

export default function MastitisPage() {
  const { selectedFarm } = useFarmContext();

  const [activeTab, setActiveTab] = useState<PageTab>('cases');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAppModal, setShowAppModal] = useState(false);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Close case form
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [closeOutcome, setCloseOutcome] = useState('CURED');
  const [closeNotes, setCloseNotes] = useState('');
  const [closeLoading, setCloseLoading] = useState(false);

  // Update quarter form
  const [editQuarterId, setEditQuarterId] = useState<string | null>(null);
  const [editQuarterStatus, setEditQuarterStatus] = useState('');
  const [editQuarterWithdrawal, setEditQuarterWithdrawal] = useState('');
  const [quarterLoading, setQuarterLoading] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const farmId = selectedFarm?.id ?? null;

  const { cases, total, isLoading, error, refetch } = useMastitis({
    farmId,
    page,
    status: statusFilter || undefined,
  });

  const {
    indicators,
    isLoading: indicatorsLoading,
    refetch: refetchIndicators,
  } = useMastitisIndicators(farmId);

  const {
    mastitisCase: detail,
    isLoading: detailLoading,
    error: detailError,
    refetch: refetchDetail,
  } = useMastitisDetail(farmId, selectedCaseId);

  const totalPages = Math.ceil(total / 50) || 1;

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    showSuccess('Caso de mastite registrado com sucesso');
    void refetch();
  }, [refetch, showSuccess]);

  const handleAppSuccess = useCallback(() => {
    setShowAppModal(false);
    showSuccess('Aplicação registrada com sucesso');
    void refetchDetail();
  }, [refetchDetail, showSuccess]);

  const handleViewDetail = useCallback((c: MastitisCaseItem) => {
    setSelectedCaseId(c.id);
    setActiveTab('detail');
    setShowCloseForm(false);
    setEditQuarterId(null);
    setDeleteError(null);
  }, []);

  const handleBackToCases = useCallback(() => {
    setActiveTab('cases');
    setSelectedCaseId(null);
    void refetch();
  }, [refetch]);

  const handleDelete = useCallback(
    async (c: MastitisCaseItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm('Excluir este caso de mastite? Todos os dados serão perdidos.')) return;
      try {
        await api.delete(`/org/farms/${farmId}/mastitis-cases/${c.id}`);
        showSuccess('Caso excluído com sucesso');
        void refetch();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir caso.');
      }
    },
    [refetch, farmId, showSuccess],
  );

  const handleCloseCase = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCaseId || !farmId) return;
      setCloseLoading(true);
      setDeleteError(null);
      try {
        await api.post(`/org/farms/${farmId}/mastitis-cases/${selectedCaseId}/close`, {
          closureOutcome: closeOutcome,
          closingNotes: closeNotes || null,
        });
        showSuccess('Caso encerrado com sucesso');
        setShowCloseForm(false);
        void refetchDetail();
        void refetch();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao encerrar caso');
      } finally {
        setCloseLoading(false);
      }
    },
    [selectedCaseId, farmId, closeOutcome, closeNotes, showSuccess, refetchDetail, refetch],
  );

  const handleUpdateQuarter = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedCaseId || !farmId || !editQuarterId) return;
      setQuarterLoading(true);
      setDeleteError(null);
      try {
        await api.patch(
          `/org/farms/${farmId}/mastitis-cases/${selectedCaseId}/quarters/${editQuarterId}`,
          {
            status: editQuarterStatus,
            withdrawalEndDate: editQuarterWithdrawal || null,
          },
        );
        showSuccess('Quarto atualizado com sucesso');
        setEditQuarterId(null);
        void refetchDetail();
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao atualizar quarto');
      } finally {
        setQuarterLoading(false);
      }
    },
    [
      selectedCaseId,
      farmId,
      editQuarterId,
      editQuarterStatus,
      editQuarterWithdrawal,
      showSuccess,
      refetchDetail,
    ],
  );

  const startEditQuarter = useCallback((quarterId: string, currentStatus: string) => {
    setEditQuarterId(quarterId);
    setEditQuarterStatus(currentStatus);
    setEditQuarterWithdrawal('');
  }, []);

  if (!selectedFarm) {
    return (
      <section className="mast-page">
        <div className="mast-page__empty">
          <AlertOctagon size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver os casos de mastite.</p>
        </div>
      </section>
    );
  }

  // Filter by search locally
  const filtered = searchInput
    ? cases.filter(
        (c) =>
          c.animalEarTag.toLowerCase().includes(searchInput.toLowerCase()) ||
          (c.animalName ?? '').toLowerCase().includes(searchInput.toLowerCase()) ||
          c.classificationLabel.toLowerCase().includes(searchInput.toLowerCase()) ||
          (c.cultureAgent ?? '').toLowerCase().includes(searchInput.toLowerCase()),
      )
    : cases;

  return (
    <section className="mast-page">
      <header className="mast-page__header">
        <div>
          <h1>Mastite</h1>
          <p>Registro clínico de mastite de {selectedFarm.name}</p>
        </div>
        <div className="mast-page__actions">
          <button
            type="button"
            className="mast-page__btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Novo caso
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="mast-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {(error || deleteError) && (
        <div className="mast-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {/* ─── Page tabs ─────────────────────────────────────────────── */}
      <div className="mast-page__tabs" role="tablist">
        <button
          role="tab"
          aria-selected={activeTab === 'cases'}
          className={activeTab === 'cases' ? 'mast-page__tab--active' : ''}
          onClick={() => {
            setActiveTab('cases');
            setSelectedCaseId(null);
          }}
        >
          <AlertOctagon size={16} aria-hidden="true" />
          Casos
        </button>
        {activeTab === 'detail' && detail && (
          <button
            role="tab"
            aria-selected={activeTab === 'detail'}
            className="mast-page__tab--active"
            onClick={() => setActiveTab('detail')}
          >
            <Activity size={16} aria-hidden="true" />
            Detalhes
          </button>
        )}
        <button
          role="tab"
          aria-selected={activeTab === 'indicators'}
          className={activeTab === 'indicators' ? 'mast-page__tab--active' : ''}
          onClick={() => {
            setActiveTab('indicators');
            void refetchIndicators();
          }}
        >
          <BarChart3 size={16} aria-hidden="true" />
          Indicadores
        </button>
      </div>

      {/* ═══════════════ CASES TAB ═══════════════════════════════════ */}
      {activeTab === 'cases' && (
        <>
          <div className="mast-page__toolbar">
            <div className="mast-page__search">
              <Search size={16} aria-hidden="true" className="mast-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por animal, classificação, agente..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar casos de mastite"
              />
            </div>
            <select
              className="mast-page__status-filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              <option value="OPEN">Aberto</option>
              <option value="CLOSED">Encerrado</option>
            </select>
          </div>

          {isLoading && <div className="mast-page__loading">Carregando casos de mastite...</div>}

          {!isLoading && filtered.length === 0 && (
            <div className="mast-page__empty">
              <AlertOctagon size={48} aria-hidden="true" />
              <h2>Nenhum caso de mastite registrado</h2>
              <p>Registre um novo caso usando o botão acima.</p>
            </div>
          )}

          {!isLoading && filtered.length > 0 && (
            <div className="mast-page__grid">
              {filtered.map((c) => {
                const classConfig = CLASSIFICATION_CONFIG[c.classification] || {
                  label: c.classificationLabel,
                  className: '',
                };
                const statConfig = STATUS_CONFIG[c.status] || {
                  label: c.statusLabel,
                  className: '',
                };

                return (
                  <div
                    key={c.id}
                    className="mast-page__card"
                    onClick={() => handleViewDetail(c)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleViewDetail(c);
                      }
                    }}
                  >
                    <div className="mast-page__card-header">
                      <div>
                        <h3 className="mast-page__card-title">
                          {c.animalEarTag} — {c.animalName || 'Sem nome'}
                        </h3>
                        <p className="mast-page__card-subtitle">
                          <Calendar size={14} aria-hidden="true" />
                          {new Date(c.occurrenceDate).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="mast-page__card-actions">
                        <button
                          type="button"
                          className="mast-page__card-btn mast-page__card-btn--delete"
                          onClick={(e) => void handleDelete(c, e)}
                          aria-label={`Excluir caso de ${c.animalEarTag}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="mast-page__card-tags">
                      <span className={`mast-page__tag ${statConfig.className}`}>
                        {statConfig.label}
                      </span>
                      <span className={`mast-page__tag ${classConfig.className}`}>
                        {classConfig.label}
                      </span>
                      {c.temperatureAlert && (
                        <span className="mast-page__tag mast-page__tag--temp-alert">
                          <Thermometer size={12} aria-hidden="true" />
                          {c.rectalTemperature}°C
                        </span>
                      )}
                    </div>

                    {/* Udder diagram */}
                    <div className="mast-page__udder" aria-label="Quartos afetados">
                      <div className="mast-page__udder-grid">
                        {(['FL', 'FR', 'RL', 'RR'] as const).map((qKey) => {
                          const quarter = c.quarters.find((q) => q.quarter === qKey);
                          const isAffected = c.quartersAffected.includes(qKey);
                          const qStatusClass = quarter
                            ? (QUARTER_STATUS_CONFIG[quarter.status]?.className ?? '')
                            : '';
                          const gradeClass = quarter
                            ? (GRADE_CONFIG[quarter.grade]?.className ?? '')
                            : '';
                          return (
                            <div
                              key={qKey}
                              className={`mast-page__udder-q ${isAffected ? qStatusClass : 'q-status--none'}`}
                              title={
                                quarter
                                  ? `${quarter.quarterLabel} - ${quarter.gradeLabel} - ${quarter.statusLabel}`
                                  : QUARTER_SHORT_LABELS[qKey]
                              }
                            >
                              <span className="mast-page__udder-label">
                                {QUARTER_SHORT_LABELS[qKey]}
                              </span>
                              {isAffected && quarter && (
                                <span className={`mast-page__udder-grade ${gradeClass}`}>
                                  {GRADE_CONFIG[quarter.grade]?.label ?? ''}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mast-page__card-details">
                      {c.cultureAgent && (
                        <span className="mast-page__detail">Agente: {c.cultureAgent}</span>
                      )}
                      {c.treatmentProtocolName && (
                        <span className="mast-page__detail">
                          <Syringe size={14} aria-hidden="true" />
                          {c.treatmentProtocolName}
                        </span>
                      )}
                      {c.withdrawalEndDate && (
                        <span className="mast-page__detail mast-page__detail--withdrawal">
                          <Lock size={14} aria-hidden="true" />
                          Carência: {new Date(c.withdrawalEndDate).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                      {c.totalCostCents > 0 && (
                        <span className="mast-page__detail mast-page__detail--mono">
                          R$ {(c.totalCostCents / 100).toFixed(2).replace('.', ',')}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <nav className="mast-page__pagination" aria-label="Paginação">
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
                {page} de {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      {/* ═══════════════ DETAIL TAB ══════════════════════════════════ */}
      {activeTab === 'detail' && (
        <div className="mast-detail">
          <button type="button" className="mast-detail__back" onClick={handleBackToCases}>
            <ChevronLeft size={16} aria-hidden="true" />
            Voltar para casos
          </button>

          {detailLoading && <div className="mast-page__loading">Carregando detalhes...</div>}

          {detailError && (
            <div className="mast-page__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {detailError}
            </div>
          )}

          {detail && (
            <>
              {/* Case header */}
              <div className="mast-detail__header">
                <div>
                  <h2 className="mast-detail__title">
                    {detail.animalEarTag} — {detail.animalName || 'Sem nome'}
                  </h2>
                  <div className="mast-detail__meta">
                    <span
                      className={`mast-page__tag ${STATUS_CONFIG[detail.status]?.className ?? ''}`}
                    >
                      {detail.statusLabel}
                    </span>
                    <span
                      className={`mast-page__tag ${CLASSIFICATION_CONFIG[detail.classification]?.className ?? ''}`}
                    >
                      {detail.classificationLabel}
                    </span>
                    {detail.temperatureAlert && (
                      <span className="mast-page__tag mast-page__tag--temp-alert">
                        <Thermometer size={12} aria-hidden="true" />
                        {detail.rectalTemperature}°C
                      </span>
                    )}
                    {detail.closureOutcomeLabel && (
                      <span className="mast-page__tag mast-page__tag--outcome">
                        {detail.closureOutcomeLabel}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mast-detail__header-info">
                  <span>
                    <Calendar size={14} aria-hidden="true" />
                    {new Date(detail.occurrenceDate).toLocaleDateString('pt-BR')}
                    {detail.occurrenceTime && ` ${detail.occurrenceTime}`}
                  </span>
                  <span>Identificado por: {detail.identifiedBy}</span>
                  {detail.withdrawalEndDate && (
                    <span className="mast-detail__withdrawal">
                      <Lock size={14} aria-hidden="true" />
                      Carência até {new Date(detail.withdrawalEndDate).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                  {detail.totalCostCents > 0 && (
                    <span className="mast-detail__cost">
                      R$ {(detail.totalCostCents / 100).toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </div>
              </div>

              {detail.notes && <p className="mast-detail__notes">{detail.notes}</p>}

              {/* Culture results */}
              {detail.cultureSampleCollected && (
                <div className="mast-detail__culture">
                  <h3>Cultura microbiológica</h3>
                  {detail.cultureAgent ? (
                    <p>
                      <strong>Agente identificado:</strong> {detail.cultureAgent}
                    </p>
                  ) : (
                    <p className="mast-detail__culture-pending">Resultado pendente</p>
                  )}
                </div>
              )}

              {/* Quarter status cards (udder diagram) */}
              <div className="mast-detail__quarters-section">
                <h3>Quartos mamários</h3>
                <div className="mast-detail__udder-visual">
                  {(['FL', 'FR', 'RL', 'RR'] as const).map((qKey) => {
                    const quarter = detail.quarters.find((q) => q.quarter === qKey);
                    const isAffected = detail.quartersAffected.includes(qKey);
                    const qStatusConf = quarter
                      ? (QUARTER_STATUS_CONFIG[quarter.status] ?? {
                          label: quarter.statusLabel,
                          className: '',
                        })
                      : null;
                    const gradeConf = quarter ? (GRADE_CONFIG[quarter.grade] ?? null) : null;

                    return (
                      <div
                        key={qKey}
                        className={`mast-detail__quarter-card ${isAffected ? (qStatusConf?.className ?? '') : 'q-status--none'}`}
                      >
                        <div className="mast-detail__quarter-header">
                          <span className="mast-detail__quarter-name">
                            {QUARTERS.find((q) => q.value === qKey)?.label ?? qKey}
                          </span>
                          {isAffected && qStatusConf && (
                            <span className="mast-detail__quarter-status">{qStatusConf.label}</span>
                          )}
                        </div>

                        {isAffected && quarter && (
                          <>
                            <div className="mast-detail__quarter-info">
                              {gradeConf && (
                                <span
                                  className={`mast-detail__quarter-grade ${gradeConf.className}`}
                                >
                                  {gradeConf.label}
                                </span>
                              )}
                              {quarter.milkAppearance && (
                                <span>Leite: {quarter.milkAppearance}</span>
                              )}
                              {quarter.cmtResult && <span>CMT: {quarter.cmtResult}</span>}
                              {quarter.withdrawalEndDate && (
                                <span className="mast-detail__quarter-withdrawal">
                                  <Lock size={12} aria-hidden="true" />
                                  Carência:{' '}
                                  {new Date(quarter.withdrawalEndDate).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>

                            {detail.status === 'OPEN' && (
                              <>
                                {editQuarterId === quarter.id ? (
                                  <form
                                    className="mast-detail__quarter-form"
                                    onSubmit={handleUpdateQuarter}
                                  >
                                    <div className="modal__field">
                                      <label htmlFor={`qedit-status-${quarter.id}`}>
                                        Novo status
                                      </label>
                                      <select
                                        id={`qedit-status-${quarter.id}`}
                                        value={editQuarterStatus}
                                        onChange={(e) => setEditQuarterStatus(e.target.value)}
                                        required
                                      >
                                        {QUARTER_STATUSES.map((qs) => (
                                          <option key={qs.value} value={qs.value}>
                                            {qs.label}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    {editQuarterStatus === 'IN_WITHDRAWAL' && (
                                      <div className="modal__field">
                                        <label htmlFor={`qedit-withdrawal-${quarter.id}`}>
                                          Carência até
                                        </label>
                                        <input
                                          id={`qedit-withdrawal-${quarter.id}`}
                                          type="date"
                                          value={editQuarterWithdrawal}
                                          onChange={(e) => setEditQuarterWithdrawal(e.target.value)}
                                        />
                                      </div>
                                    )}
                                    <div className="mast-detail__quarter-form-actions">
                                      <button
                                        type="submit"
                                        className="mast-detail__btn-save"
                                        disabled={quarterLoading}
                                      >
                                        {quarterLoading ? 'Salvando...' : 'Salvar'}
                                      </button>
                                      <button
                                        type="button"
                                        className="mast-detail__btn-cancel-edit"
                                        onClick={() => setEditQuarterId(null)}
                                      >
                                        <X size={14} aria-hidden="true" />
                                        Cancelar
                                      </button>
                                    </div>
                                  </form>
                                ) : (
                                  <button
                                    type="button"
                                    className="mast-detail__btn-update-quarter"
                                    onClick={() => startEditQuarter(quarter.id, quarter.status)}
                                  >
                                    Atualizar quarto
                                  </button>
                                )}
                              </>
                            )}
                          </>
                        )}

                        {!isAffected && (
                          <span className="mast-detail__quarter-ok">Sem alteração</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Applications timeline */}
              <div className="mast-detail__apps-section">
                <div className="mast-detail__apps-header">
                  <h3>Aplicações ({detail.applications.length})</h3>
                  {detail.status === 'OPEN' && (
                    <button
                      type="button"
                      className="mast-detail__btn-add-app"
                      onClick={() => setShowAppModal(true)}
                    >
                      <Plus size={16} aria-hidden="true" />
                      Registrar aplicação
                    </button>
                  )}
                </div>

                {detail.applications.length === 0 && (
                  <p className="mast-detail__empty-text">Nenhuma aplicação registrada.</p>
                )}

                <div className="mast-detail__apps-timeline">
                  {detail.applications.map((app) => (
                    <div key={app.id} className="mast-detail__app-item">
                      <div className="mast-detail__app-dot" />
                      <div className="mast-detail__app-content">
                        <div className="mast-detail__app-top">
                          <strong>{app.productName}</strong>
                          <span className="mast-detail__app-date">
                            <Clock size={14} aria-hidden="true" />
                            {new Date(app.applicationDate).toLocaleDateString('pt-BR')}
                            {app.applicationTime && ` ${app.applicationTime}`}
                          </span>
                        </div>
                        <div className="mast-detail__app-info">
                          <span>Dose: {app.dose}</span>
                          <span>Via: {app.administrationRoute}</span>
                          {app.quarterTreated && (
                            <span>
                              Quarto:{' '}
                              {QUARTER_SHORT_LABELS[app.quarterTreated] ?? app.quarterTreated}
                            </span>
                          )}
                          <span>Responsável: {app.responsibleName}</span>
                          {app.costCents > 0 && (
                            <span className="mast-detail__app-cost">
                              R$ {(app.costCents / 100).toFixed(2).replace('.', ',')}
                            </span>
                          )}
                        </div>
                        {app.notes && <p className="mast-detail__app-notes">{app.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Close case */}
              {detail.status === 'OPEN' && (
                <div className="mast-detail__close-section">
                  {!showCloseForm ? (
                    <button
                      type="button"
                      className="mast-detail__btn-close-case"
                      onClick={() => setShowCloseForm(true)}
                    >
                      Encerrar caso
                    </button>
                  ) : (
                    <form className="mast-detail__close-form" onSubmit={handleCloseCase}>
                      <h3>Encerrar caso de mastite</h3>
                      <div className="modal__field">
                        <label htmlFor="mast-close-outcome">Resultado *</label>
                        <select
                          id="mast-close-outcome"
                          value={closeOutcome}
                          onChange={(e) => setCloseOutcome(e.target.value)}
                          required
                          aria-required="true"
                        >
                          {CLOSURE_OUTCOMES.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="modal__field">
                        <label htmlFor="mast-close-notes">Observações finais</label>
                        <textarea
                          id="mast-close-notes"
                          value={closeNotes}
                          onChange={(e) => setCloseNotes(e.target.value)}
                          rows={3}
                        />
                      </div>
                      <div className="mast-detail__close-actions">
                        <button
                          type="submit"
                          className="mast-detail__btn-confirm-close"
                          disabled={closeLoading}
                        >
                          {closeLoading ? 'Encerrando...' : 'Confirmar encerramento'}
                        </button>
                        <button
                          type="button"
                          className="mast-detail__btn-cancel-close"
                          onClick={() => setShowCloseForm(false)}
                        >
                          Cancelar
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════ INDICATORS TAB ══════════════════════════════ */}
      {activeTab === 'indicators' && (
        <div className="mast-indicators">
          {indicatorsLoading && <div className="mast-page__loading">Carregando indicadores...</div>}

          {indicators && (
            <>
              <div className="mast-indicators__cards">
                <div className="mast-indicators__card">
                  <span className="mast-indicators__card-value">{indicators.totalCases}</span>
                  <span className="mast-indicators__card-label">Total de casos</span>
                </div>
                <div className="mast-indicators__card">
                  <span className="mast-indicators__card-value mast-indicators__card-value--alert">
                    {indicators.openCases}
                  </span>
                  <span className="mast-indicators__card-label">Casos abertos</span>
                </div>
                <div className="mast-indicators__card">
                  <span className="mast-indicators__card-value">
                    {(indicators.clinicalRate * 100).toFixed(1)}%
                  </span>
                  <span className="mast-indicators__card-label">Taxa clínica</span>
                </div>
                <div className="mast-indicators__card">
                  <span className="mast-indicators__card-value mast-indicators__card-value--success">
                    {(indicators.cureRate * 100).toFixed(1)}%
                  </span>
                  <span className="mast-indicators__card-label">Taxa de cura</span>
                </div>
                <div className="mast-indicators__card">
                  <span className="mast-indicators__card-value mast-indicators__card-value--mono">
                    R$ {(indicators.avgCostCents / 100).toFixed(2).replace('.', ',')}
                  </span>
                  <span className="mast-indicators__card-label">Custo médio/caso</span>
                </div>
                <div className="mast-indicators__card">
                  <span className="mast-indicators__card-value mast-indicators__card-value--alert">
                    {indicators.recurrentCows}
                  </span>
                  <span className="mast-indicators__card-label">Vacas recorrentes</span>
                </div>
              </div>

              {/* Top agents */}
              {indicators.topAgents.length > 0 && (
                <div className="mast-indicators__agents">
                  <h3>Agentes mais frequentes</h3>
                  <table className="mast-indicators__table">
                    <thead>
                      <tr>
                        <th scope="col">Agente</th>
                        <th scope="col">Casos</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicators.topAgents.map((a) => (
                        <tr key={a.agent}>
                          <td>{a.agent}</td>
                          <td className="mast-indicators__table-count">{a.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {indicators.topAgents.length === 0 && (
                <div className="mast-detail__empty-text">Nenhum agente identificado ainda.</div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Modals ────────────────────────────────────────────────── */}
      <MastitisModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        farmId={selectedFarm.id}
        onSuccess={handleCreateSuccess}
      />

      {detail && (
        <ApplicationModal
          isOpen={showAppModal}
          onClose={() => setShowAppModal(false)}
          farmId={selectedFarm.id}
          caseId={detail.id}
          quartersAffected={detail.quartersAffected}
          onSuccess={handleAppSuccess}
        />
      )}
    </section>
  );
}
