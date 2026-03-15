import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  HeartHandshake,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Download,
  Upload,
  ArrowLeft,
  Calendar,
  Target,
  Users,
  BarChart3,
  X,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useMatingPlans } from '@/hooks/useMatingPlans';
import type {
  MatingPlanItem,
  MatingPlanDetail,
  MatingPairItem,
  AdherenceReport,
  UpdateMatingPairInput,
} from '@/types/mating-plan';
import {
  PLAN_STATUS_CONFIG,
  PAIR_STATUS_CONFIG,
  MATING_PLAN_STATUSES,
  MATING_PAIR_STATUSES,
} from '@/types/mating-plan';
import MatingPlanModal from '@/components/mating-plans/MatingPlanModal';
import AddPairModal from '@/components/mating-plans/AddPairModal';
import { api } from '@/services/api';
import './MatingPlansPage.css';

type Tab = 'plans' | 'detail';

export default function MatingPlansPage() {
  const { selectedFarm } = useFarmContext();

  const [activeTab, setActiveTab] = useState<Tab>('plans');
  const [searchInput, setSearchInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MatingPlanItem | null>(null);
  const [showAddPairModal, setShowAddPairModal] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [planDetail, setPlanDetail] = useState<MatingPlanDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adherence, setAdherence] = useState<AdherenceReport | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pair status update modal
  const [updatingPair, setUpdatingPair] = useState<MatingPairItem | null>(null);
  const [pairStatus, setPairStatus] = useState('');
  const [pairExecutedBullId, setPairExecutedBullId] = useState('');
  const [pairExecutionDate, setPairExecutionDate] = useState('');
  const [pairSubstitutionReason, setPairSubstitutionReason] = useState('');
  const [pairNotes, setPairNotes] = useState('');
  const [pairUpdateLoading, setPairUpdateLoading] = useState(false);

  const { plans, meta, isLoading, error, refetch } = useMatingPlans({
    farmId: selectedFarm?.id ?? null,
    page,
    status: statusFilter || undefined,
  });

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // Fetch plan detail
  const fetchDetail = useCallback(
    async (planId: string) => {
      if (!selectedFarm) return;
      setDetailLoading(true);
      try {
        const [detail, adh] = await Promise.all([
          api.get<MatingPlanDetail>(`/org/farms/${selectedFarm.id}/mating-plans/${planId}`),
          api.get<AdherenceReport>(
            `/org/farms/${selectedFarm.id}/mating-plans/${planId}/adherence`,
          ),
        ]);
        setPlanDetail(detail);
        setAdherence(adh);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao carregar detalhes do plano');
      } finally {
        setDetailLoading(false);
      }
    },
    [selectedFarm],
  );

  // Open detail tab
  const handleOpenDetail = useCallback(
    (plan: MatingPlanItem) => {
      setSelectedPlanId(plan.id);
      setActiveTab('detail');
      void fetchDetail(plan.id);
    },
    [fetchDetail],
  );

  // Back to plans list
  const handleBackToPlans = useCallback(() => {
    setActiveTab('plans');
    setSelectedPlanId(null);
    setPlanDetail(null);
    setAdherence(null);
  }, []);

  // Plan CRUD success
  const handlePlanSuccess = useCallback(() => {
    setShowPlanModal(false);
    setEditingPlan(null);
    setSuccessMsg('Plano salvo com sucesso');
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch]);

  // Add pair success
  const handleAddPairSuccess = useCallback(() => {
    setShowAddPairModal(false);
    setSuccessMsg('Pares adicionados com sucesso');
    if (selectedPlanId) void fetchDetail(selectedPlanId);
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [selectedPlanId, fetchDetail, refetch]);

  // Delete plan
  const handleDeletePlan = useCallback(
    async (plan: MatingPlanItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm(`Excluir o plano "${plan.name}"? Todos os pares serão removidos.`))
        return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/mating-plans/${plan.id}`);
        setSuccessMsg('Plano excluído com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir plano');
      }
    },
    [refetch, selectedFarm],
  );

  // Edit plan
  const handleEditPlan = useCallback((plan: MatingPlanItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingPlan(plan);
    setShowPlanModal(true);
  }, []);

  // Remove pair
  const handleRemovePair = useCallback(
    async (pair: MatingPairItem) => {
      if (!window.confirm('Remover este par do plano?')) return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/mating-plans/pairs/${pair.id}`);
        setSuccessMsg('Par removido com sucesso');
        if (selectedPlanId) void fetchDetail(selectedPlanId);
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao remover par');
      }
    },
    [selectedFarm, selectedPlanId, fetchDetail, refetch],
  );

  // Open pair status update
  const handleOpenPairUpdate = useCallback((pair: MatingPairItem) => {
    setUpdatingPair(pair);
    setPairStatus(pair.status);
    setPairExecutedBullId(pair.executedBullId ?? '');
    setPairExecutionDate(pair.executionDate ?? new Date().toISOString().slice(0, 10));
    setPairSubstitutionReason(pair.substitutionReason ?? '');
    setPairNotes(pair.notes ?? '');
  }, []);

  // Submit pair status update
  const handlePairStatusSubmit = useCallback(async () => {
    if (!updatingPair || !selectedFarm) return;
    setPairUpdateLoading(true);
    try {
      const payload: UpdateMatingPairInput = {
        status: pairStatus,
        executedBullId: pairExecutedBullId || null,
        executionDate: pairExecutionDate || null,
        substitutionReason: pairSubstitutionReason || null,
        notes: pairNotes || null,
      };
      await api.patch(
        `/org/farms/${selectedFarm.id}/mating-plans/pairs/${updatingPair.id}`,
        payload,
      );
      setUpdatingPair(null);
      setSuccessMsg('Status do par atualizado');
      if (selectedPlanId) void fetchDetail(selectedPlanId);
      void refetch();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao atualizar par');
    } finally {
      setPairUpdateLoading(false);
    }
  }, [
    updatingPair,
    selectedFarm,
    pairStatus,
    pairExecutedBullId,
    pairExecutionDate,
    pairSubstitutionReason,
    pairNotes,
    selectedPlanId,
    fetchDetail,
    refetch,
  ]);

  // Import CSV
  const handleImportCSV = useCallback(async () => {
    if (!selectedFarm || !selectedPlanId) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.onchange = async (ev) => {
      const file = (ev.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const formData = new FormData();
        formData.append('file', file);
        await api.postFormData(
          `/org/farms/${selectedFarm.id}/mating-plans/${selectedPlanId}/import`,
          formData,
        );
        setSuccessMsg('Pares importados com sucesso');
        void fetchDetail(selectedPlanId);
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao importar CSV');
      }
    };
    input.click();
  }, [selectedFarm, selectedPlanId, fetchDetail, refetch]);

  // Export CSV
  const handleExportCSV = useCallback(async () => {
    if (!selectedFarm || !selectedPlanId) return;
    try {
      const blob = await api.getBlob(
        `/org/farms/${selectedFarm.id}/mating-plans/${selectedPlanId}/export`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `plano-acasalamento-${selectedPlanId}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setDeleteError('Erro ao exportar CSV');
    }
  }, [selectedFarm, selectedPlanId]);

  // ─── No farm selected ──────────────────────────────────────────
  if (!selectedFarm) {
    return (
      <section className="mating-plans-page">
        <div className="mating-plans-page__empty">
          <HeartHandshake size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver os planos de acasalamento.</p>
        </div>
      </section>
    );
  }

  // Filter locally by search
  const filteredPlans = searchInput
    ? plans.filter(
        (p) =>
          p.name.toLowerCase().includes(searchInput.toLowerCase()) ||
          (p.season ?? '').toLowerCase().includes(searchInput.toLowerCase()) ||
          (p.objective ?? '').toLowerCase().includes(searchInput.toLowerCase()),
      )
    : plans;

  return (
    <section className="mating-plans-page">
      <header className="mating-plans-page__header">
        <div>
          <h1>Planos de acasalamento</h1>
          <p>Gestão reprodutiva do rebanho de {selectedFarm.name}</p>
        </div>
        {activeTab === 'plans' && (
          <div className="mating-plans-page__actions">
            <button
              type="button"
              className="mating-plans-page__btn-primary"
              onClick={() => {
                setEditingPlan(null);
                setShowPlanModal(true);
              }}
            >
              <Plus size={20} aria-hidden="true" />
              Novo plano
            </button>
          </div>
        )}
      </header>

      {successMsg && (
        <div className="mating-plans-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {(error || deleteError) && (
        <div className="mating-plans-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
          {deleteError && (
            <button
              type="button"
              className="mating-plans-page__error-dismiss"
              onClick={() => setDeleteError(null)}
              aria-label="Fechar mensagem de erro"
            >
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      {/* ─── Tab: Plans ──────────────────────────────────────────── */}
      {activeTab === 'plans' && (
        <>
          <div className="mating-plans-page__toolbar">
            <div className="mating-plans-page__search">
              <Search size={16} aria-hidden="true" className="mating-plans-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por nome, estação ou objetivo..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar planos"
              />
            </div>
            <select
              className="mating-plans-page__status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              {MATING_PLAN_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {isLoading && <div className="mating-plans-page__loading">Carregando planos...</div>}

          {!isLoading && filteredPlans.length === 0 && (
            <div className="mating-plans-page__empty">
              <HeartHandshake size={48} aria-hidden="true" />
              <h2>Nenhum plano de acasalamento</h2>
              <p>Crie o primeiro plano usando o botão acima.</p>
            </div>
          )}

          {!isLoading && filteredPlans.length > 0 && (
            <div className="mating-plans-page__grid">
              {filteredPlans.map((plan) => {
                const cfg = PLAN_STATUS_CONFIG[plan.status] ?? {
                  label: plan.statusLabel,
                  className: '',
                };
                return (
                  <div
                    key={plan.id}
                    className="mating-plans-page__card"
                    onClick={() => handleOpenDetail(plan)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenDetail(plan);
                      }
                    }}
                  >
                    <div className="mating-plans-page__card-header">
                      <div>
                        <h3 className="mating-plans-page__card-title">{plan.name}</h3>
                        {plan.season && (
                          <p className="mating-plans-page__card-subtitle">{plan.season}</p>
                        )}
                      </div>
                      <div className="mating-plans-page__card-actions">
                        <button
                          type="button"
                          className="mating-plans-page__card-btn"
                          onClick={(e) => handleEditPlan(plan, e)}
                          aria-label={`Editar plano ${plan.name}`}
                        >
                          <Pencil size={16} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="mating-plans-page__card-btn mating-plans-page__card-btn--delete"
                          onClick={(e) => void handleDeletePlan(plan, e)}
                          aria-label={`Excluir plano ${plan.name}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="mating-plans-page__card-tags">
                      <span className={`mating-plans-page__tag ${cfg.className}`}>{cfg.label}</span>
                    </div>

                    {plan.objective && (
                      <p className="mating-plans-page__card-objective">
                        <Target size={14} aria-hidden="true" />
                        {plan.objective}
                      </p>
                    )}

                    <div className="mating-plans-page__card-stats">
                      <span className="mating-plans-page__stat">
                        <Users size={14} aria-hidden="true" />
                        {plan.pairCount} pares
                      </span>
                      <span className="mating-plans-page__stat">
                        <CheckCircle size={14} aria-hidden="true" />
                        {plan.executedCount} executados
                      </span>
                      <span className="mating-plans-page__stat mating-plans-page__stat--highlight">
                        {plan.confirmedCount} prenhas
                      </span>
                    </div>

                    {(plan.startDate || plan.endDate) && (
                      <div className="mating-plans-page__card-dates">
                        <Calendar size={14} aria-hidden="true" />
                        {plan.startDate
                          ? new Date(plan.startDate).toLocaleDateString('pt-BR')
                          : '—'}
                        {' a '}
                        {plan.endDate ? new Date(plan.endDate).toLocaleDateString('pt-BR') : '—'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <nav className="mating-plans-page__pagination" aria-label="Paginacao">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                aria-label="Pagina anterior"
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
                aria-label="Proxima pagina"
              >
                Proxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      {/* ─── Tab: Detail ─────────────────────────────────────────── */}
      {activeTab === 'detail' && (
        <div className="mating-plans-page__detail">
          <button type="button" className="mating-plans-page__back-btn" onClick={handleBackToPlans}>
            <ArrowLeft size={16} aria-hidden="true" />
            Voltar para planos
          </button>

          {detailLoading && (
            <div className="mating-plans-page__loading">Carregando detalhes...</div>
          )}

          {!detailLoading && planDetail && (
            <>
              {/* Plan info */}
              <div className="mating-plans-page__detail-info">
                <div className="mating-plans-page__detail-info-main">
                  <h2>{planDetail.name}</h2>
                  <span
                    className={`mating-plans-page__tag ${(PLAN_STATUS_CONFIG[planDetail.status] ?? { className: '' }).className}`}
                  >
                    {planDetail.statusLabel}
                  </span>
                </div>
                {planDetail.season && <p>Estacao: {planDetail.season}</p>}
                {planDetail.objective && <p>Objetivo: {planDetail.objective}</p>}
                {planDetail.notes && (
                  <p className="mating-plans-page__detail-notes">{planDetail.notes}</p>
                )}
              </div>

              {/* Actions */}
              <div className="mating-plans-page__detail-actions">
                <button
                  type="button"
                  className="mating-plans-page__btn-primary"
                  onClick={() => setShowAddPairModal(true)}
                >
                  <Plus size={20} aria-hidden="true" />
                  Adicionar par
                </button>
                <button
                  type="button"
                  className="mating-plans-page__btn-secondary"
                  onClick={handleImportCSV}
                >
                  <Upload size={20} aria-hidden="true" />
                  Importar CSV
                </button>
                <button
                  type="button"
                  className="mating-plans-page__btn-secondary"
                  onClick={handleExportCSV}
                >
                  <Download size={20} aria-hidden="true" />
                  Exportar CSV
                </button>
              </div>

              {/* Pairs table */}
              {planDetail.pairs.length === 0 && (
                <div className="mating-plans-page__empty">
                  <Users size={48} aria-hidden="true" />
                  <h2>Nenhum par adicionado</h2>
                  <p>Adicione pares de acasalamento ao plano.</p>
                </div>
              )}

              {planDetail.pairs.length > 0 && (
                <>
                  {/* Desktop table */}
                  <div className="mating-plans-page__table-wrap">
                    <table className="mating-plans-page__table">
                      <caption className="sr-only">Pares de acasalamento</caption>
                      <thead>
                        <tr>
                          <th scope="col">Fêmea</th>
                          <th scope="col">Touro 1</th>
                          <th scope="col">Touro 2</th>
                          <th scope="col">Touro 3</th>
                          <th scope="col">Status</th>
                          <th scope="col">Touro executado</th>
                          <th scope="col">Data execução</th>
                          <th scope="col">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {planDetail.pairs.map((pair) => {
                          const pairCfg = PAIR_STATUS_CONFIG[pair.status] ?? {
                            label: pair.statusLabel,
                            className: '',
                          };
                          return (
                            <tr key={pair.id}>
                              <td>
                                <span className="mating-plans-page__cell-animal">
                                  {pair.animalEarTag}
                                </span>
                                {pair.animalName && (
                                  <span className="mating-plans-page__cell-name">
                                    {pair.animalName}
                                  </span>
                                )}
                              </td>
                              <td className="mating-plans-page__cell-bull">
                                {pair.primaryBullName ?? '—'}
                              </td>
                              <td className="mating-plans-page__cell-bull">
                                {pair.secondaryBullName ?? '—'}
                              </td>
                              <td className="mating-plans-page__cell-bull">
                                {pair.tertiaryBullName ?? '—'}
                              </td>
                              <td>
                                <span
                                  className={`mating-plans-page__pair-tag ${pairCfg.className}`}
                                >
                                  {pairCfg.label}
                                </span>
                              </td>
                              <td className="mating-plans-page__cell-bull">
                                {pair.executedBullName ?? '—'}
                              </td>
                              <td>
                                {pair.executionDate
                                  ? new Date(pair.executionDate).toLocaleDateString('pt-BR')
                                  : '—'}
                              </td>
                              <td>
                                <div className="mating-plans-page__pair-actions">
                                  <button
                                    type="button"
                                    className="mating-plans-page__card-btn"
                                    onClick={() => handleOpenPairUpdate(pair)}
                                    aria-label={`Atualizar status do par ${pair.animalEarTag}`}
                                  >
                                    <Pencil size={16} aria-hidden="true" />
                                  </button>
                                  <button
                                    type="button"
                                    className="mating-plans-page__card-btn mating-plans-page__card-btn--delete"
                                    onClick={() => void handleRemovePair(pair)}
                                    aria-label={`Remover par ${pair.animalEarTag}`}
                                  >
                                    <Trash2 size={16} aria-hidden="true" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile cards */}
                  <div className="mating-plans-page__pair-cards">
                    {planDetail.pairs.map((pair) => {
                      const pairCfg = PAIR_STATUS_CONFIG[pair.status] ?? {
                        label: pair.statusLabel,
                        className: '',
                      };
                      return (
                        <div key={pair.id} className="mating-plans-page__pair-card">
                          <div className="mating-plans-page__pair-card-header">
                            <div>
                              <span className="mating-plans-page__cell-animal">
                                {pair.animalEarTag}
                              </span>
                              {pair.animalName && (
                                <span className="mating-plans-page__cell-name">
                                  {' '}
                                  {pair.animalName}
                                </span>
                              )}
                            </div>
                            <span className={`mating-plans-page__pair-tag ${pairCfg.className}`}>
                              {pairCfg.label}
                            </span>
                          </div>
                          <div className="mating-plans-page__pair-card-body">
                            <div className="mating-plans-page__pair-card-row">
                              <span className="mating-plans-page__pair-card-label">Touro 1:</span>
                              <span className="mating-plans-page__cell-bull">
                                {pair.primaryBullName ?? '—'}
                              </span>
                            </div>
                            {pair.secondaryBullName && (
                              <div className="mating-plans-page__pair-card-row">
                                <span className="mating-plans-page__pair-card-label">Touro 2:</span>
                                <span className="mating-plans-page__cell-bull">
                                  {pair.secondaryBullName}
                                </span>
                              </div>
                            )}
                            {pair.tertiaryBullName && (
                              <div className="mating-plans-page__pair-card-row">
                                <span className="mating-plans-page__pair-card-label">Touro 3:</span>
                                <span className="mating-plans-page__cell-bull">
                                  {pair.tertiaryBullName}
                                </span>
                              </div>
                            )}
                            {pair.executedBullName && (
                              <div className="mating-plans-page__pair-card-row">
                                <span className="mating-plans-page__pair-card-label">
                                  Executado:
                                </span>
                                <span className="mating-plans-page__cell-bull">
                                  {pair.executedBullName}
                                </span>
                              </div>
                            )}
                            {pair.executionDate && (
                              <div className="mating-plans-page__pair-card-row">
                                <span className="mating-plans-page__pair-card-label">Data:</span>
                                <span>
                                  {new Date(pair.executionDate).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                            )}
                            {pair.substitutionReason && (
                              <div className="mating-plans-page__pair-card-row">
                                <span className="mating-plans-page__pair-card-label">
                                  Motivo substituição:
                                </span>
                                <span>{pair.substitutionReason}</span>
                              </div>
                            )}
                          </div>
                          <div className="mating-plans-page__pair-card-footer">
                            <button
                              type="button"
                              className="mating-plans-page__btn-secondary mating-plans-page__btn-sm"
                              onClick={() => handleOpenPairUpdate(pair)}
                            >
                              <Pencil size={16} aria-hidden="true" />
                              Atualizar
                            </button>
                            <button
                              type="button"
                              className="mating-plans-page__btn-danger mating-plans-page__btn-sm"
                              onClick={() => void handleRemovePair(pair)}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                              Remover
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}

              {/* Adherence report */}
              {adherence && adherence.totalExecuted > 0 && (
                <div className="mating-plans-page__adherence">
                  <h3>
                    <BarChart3 size={20} aria-hidden="true" />
                    Relatório de aderência
                  </h3>

                  <div className="mating-plans-page__adherence-stats">
                    <div className="mating-plans-page__adherence-stat">
                      <span className="mating-plans-page__adherence-value">
                        {adherence.totalExecuted}
                      </span>
                      <span className="mating-plans-page__adherence-label">Executados</span>
                    </div>
                    <div className="mating-plans-page__adherence-stat">
                      <span className="mating-plans-page__adherence-value">
                        {adherence.followedPlan}
                      </span>
                      <span className="mating-plans-page__adherence-label">Seguiram plano</span>
                    </div>
                    <div className="mating-plans-page__adherence-stat">
                      <span className="mating-plans-page__adherence-value">
                        {adherence.substituted}
                      </span>
                      <span className="mating-plans-page__adherence-label">Substituídos</span>
                    </div>
                  </div>

                  <div className="mating-plans-page__adherence-bar">
                    <div className="mating-plans-page__adherence-bar-label">
                      Aderência: {adherence.adherencePercent.toFixed(1)}%
                    </div>
                    <div
                      className="mating-plans-page__adherence-bar-track"
                      role="progressbar"
                      aria-valuenow={adherence.adherencePercent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`Aderência ao plano: ${adherence.adherencePercent.toFixed(1)}%`}
                    >
                      <div
                        className="mating-plans-page__adherence-bar-fill"
                        style={{ width: `${Math.min(100, adherence.adherencePercent)}%` }}
                      />
                    </div>
                  </div>

                  {adherence.substitutionReasons.length > 0 && (
                    <div className="mating-plans-page__adherence-reasons">
                      <h4>Motivos de substituição</h4>
                      <ul>
                        {adherence.substitutionReasons.map((r) => (
                          <li key={r.reason}>
                            <span>{r.reason}</span>
                            <span className="mating-plans-page__adherence-reason-count">
                              {r.count}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ─── Modals ──────────────────────────────────────────────── */}
      <MatingPlanModal
        isOpen={showPlanModal}
        onClose={() => {
          setShowPlanModal(false);
          setEditingPlan(null);
        }}
        farmId={selectedFarm.id}
        plan={editingPlan}
        onSuccess={handlePlanSuccess}
      />

      {selectedPlanId && (
        <AddPairModal
          isOpen={showAddPairModal}
          onClose={() => setShowAddPairModal(false)}
          farmId={selectedFarm.id}
          planId={selectedPlanId}
          existingPairAnimalIds={planDetail?.pairs.map((p) => p.animalId) ?? []}
          onSuccess={handleAddPairSuccess}
        />
      )}

      {/* Pair status update modal */}
      {updatingPair && (
        <div className="mating-plan-modal__overlay" onClick={() => setUpdatingPair(null)}>
          <div
            className="mating-plan-modal__dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Atualizar status do par"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="mating-plan-modal__header">
              <h2>Atualizar par — {updatingPair.animalEarTag}</h2>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setUpdatingPair(null)}
                className="mating-plan-modal__close"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="mating-plan-modal__form">
              <div className="mating-plan-modal__field">
                <label htmlFor="pair-status">Status *</label>
                <select
                  id="pair-status"
                  value={pairStatus}
                  onChange={(e) => setPairStatus(e.target.value)}
                  required
                  aria-required="true"
                >
                  {MATING_PAIR_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {pairStatus === 'EXECUTED' && (
                <>
                  <div className="mating-plan-modal__field">
                    <label htmlFor="pair-exec-bull">Touro executado</label>
                    <input
                      id="pair-exec-bull"
                      type="text"
                      value={pairExecutedBullId}
                      onChange={(e) => setPairExecutedBullId(e.target.value)}
                      placeholder="ID do touro utilizado"
                    />
                  </div>
                  <div className="mating-plan-modal__field">
                    <label htmlFor="pair-exec-date">Data de execução</label>
                    <input
                      id="pair-exec-date"
                      type="date"
                      value={pairExecutionDate}
                      onChange={(e) => setPairExecutionDate(e.target.value)}
                    />
                  </div>
                  <div className="mating-plan-modal__field">
                    <label htmlFor="pair-subst-reason">Motivo da substituição</label>
                    <input
                      id="pair-subst-reason"
                      type="text"
                      value={pairSubstitutionReason}
                      onChange={(e) => setPairSubstitutionReason(e.target.value)}
                      placeholder="Se o touro foi diferente do planejado"
                    />
                  </div>
                </>
              )}

              <div className="mating-plan-modal__field">
                <label htmlFor="pair-notes">Observações</label>
                <textarea
                  id="pair-notes"
                  value={pairNotes}
                  onChange={(e) => setPairNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <footer className="mating-plan-modal__footer">
              <button
                type="button"
                className="mating-plan-modal__btn-cancel"
                onClick={() => setUpdatingPair(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="mating-plan-modal__btn-save"
                disabled={pairUpdateLoading}
                onClick={handlePairStatusSubmit}
              >
                {pairUpdateLoading ? 'Salvando...' : 'Salvar'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </section>
  );
}
