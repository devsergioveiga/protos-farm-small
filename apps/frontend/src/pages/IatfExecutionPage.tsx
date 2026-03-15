import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Zap,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Calendar,
  Users,
  Syringe,
  ArrowLeft,
  Play,
  XCircle,
  Trash2,
  Clock,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useReproductiveLots } from '@/hooks/useReproductiveLots';
import type {
  ReproductiveLotItem,
  LotDetailItem,
  UpcomingStepItem,
  LotStepItem,
  LotAnimalItem,
  InseminationItem,
} from '@/types/iatf-execution';
import { LOT_STATUS_CONFIG, STEP_STATUS_CONFIG } from '@/types/iatf-execution';
import CreateLotModal from '@/components/iatf-execution/CreateLotModal';
import InseminationModal from '@/components/iatf-execution/InseminationModal';
import { api } from '@/services/api';
import './IatfExecutionPage.css';

export default function IatfExecutionPage() {
  const { selectedFarm } = useFarmContext();

  const [statusFilter, setStatusFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Detail view state
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [lotDetail, setLotDetail] = useState<LotDetailItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Upcoming steps
  const [upcomingSteps, setUpcomingSteps] = useState<UpcomingStepItem[]>([]);

  // Insemination modal state
  const [showInseminationModal, setShowInseminationModal] = useState(false);
  const [inseminationAnimalId, setInseminationAnimalId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setPage(1), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { lots, meta, isLoading, error, refetch } = useReproductiveLots({
    farmId: selectedFarm?.id ?? null,
    page,
    status: statusFilter || undefined,
  });

  // Load upcoming steps
  useEffect(() => {
    if (!selectedFarm) return;
    void (async () => {
      try {
        const res = await api.get<{ data: UpcomingStepItem[] }>(
          `/org/farms/${selectedFarm.id}/reproductive-lots/upcoming-steps`,
        );
        setUpcomingSteps(res.data ?? []);
      } catch {
        // non-critical
      }
    })();
  }, [selectedFarm, successMsg]);

  // Load lot detail
  const loadLotDetail = useCallback(
    async (lotId: string) => {
      if (!selectedFarm) return;
      setDetailLoading(true);
      try {
        const detail = await api.get<LotDetailItem>(
          `/org/farms/${selectedFarm.id}/reproductive-lots/${lotId}`,
        );
        setLotDetail(detail);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao carregar detalhes do lote');
      } finally {
        setDetailLoading(false);
      }
    },
    [selectedFarm],
  );

  useEffect(() => {
    if (selectedLotId) {
      void loadLotDetail(selectedLotId);
    }
  }, [selectedLotId, loadLotDetail]);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, []);

  const handleCreateSuccess = useCallback(() => {
    setShowCreateModal(false);
    showSuccess('Lote reprodutivo criado com sucesso');
    void refetch();
  }, [refetch, showSuccess]);

  const handleExecuteStep = useCallback(
    async (stepId: string) => {
      if (!selectedFarm || !selectedLotId) return;
      setActionError(null);
      try {
        await api.post(
          `/org/farms/${selectedFarm.id}/reproductive-lots/${selectedLotId}/steps/${stepId}/execute`,
        );
        showSuccess('Etapa executada com sucesso');
        void loadLotDetail(selectedLotId);
        void refetch();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao executar etapa');
      }
    },
    [selectedFarm, selectedLotId, loadLotDetail, refetch, showSuccess],
  );

  const handleCompleteLot = useCallback(
    async (lotId: string) => {
      if (!selectedFarm) return;
      if (!window.confirm('Deseja concluir este lote reprodutivo?')) return;
      setActionError(null);
      try {
        await api.post(`/org/farms/${selectedFarm.id}/reproductive-lots/${lotId}/complete`);
        showSuccess('Lote concluído com sucesso');
        if (selectedLotId === lotId) {
          void loadLotDetail(lotId);
        }
        void refetch();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao concluir lote');
      }
    },
    [selectedFarm, selectedLotId, loadLotDetail, refetch, showSuccess],
  );

  const handleCancelLot = useCallback(
    async (lotId: string) => {
      if (!selectedFarm) return;
      if (
        !window.confirm('Deseja cancelar este lote reprodutivo? Esta ação não pode ser desfeita.')
      )
        return;
      setActionError(null);
      try {
        await api.post(`/org/farms/${selectedFarm.id}/reproductive-lots/${lotId}/cancel`);
        showSuccess('Lote cancelado');
        if (selectedLotId === lotId) {
          void loadLotDetail(lotId);
        }
        void refetch();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao cancelar lote');
      }
    },
    [selectedFarm, selectedLotId, loadLotDetail, refetch, showSuccess],
  );

  const handleRemoveAnimal = useCallback(
    async (animalId: string) => {
      if (!selectedFarm || !selectedLotId) return;
      if (!window.confirm('Remover este animal do lote?')) return;
      setActionError(null);
      try {
        await api.delete(
          `/org/farms/${selectedFarm.id}/reproductive-lots/${selectedLotId}/animals/${animalId}`,
        );
        showSuccess('Animal removido do lote');
        void loadLotDetail(selectedLotId);
        void refetch();
      } catch (err) {
        setActionError(err instanceof Error ? err.message : 'Erro ao remover animal');
      }
    },
    [selectedFarm, selectedLotId, loadLotDetail, refetch, showSuccess],
  );

  const handleInseminationFromStep = useCallback((step: LotStepItem) => {
    if (step.isAiDay) {
      setInseminationAnimalId(null);
      setShowInseminationModal(true);
    }
  }, []);

  const handleInseminationSuccess = useCallback(() => {
    showSuccess('Inseminação registrada com sucesso');
    setShowInseminationModal(false);
    if (selectedLotId) {
      void loadLotDetail(selectedLotId);
    }
    void refetch();
  }, [selectedLotId, loadLotDetail, refetch, showSuccess]);

  if (!selectedFarm) {
    return (
      <section className="iatf-execution-page">
        <div className="iatf-execution-page__empty">
          <Zap size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver os lotes de IATF.</p>
        </div>
      </section>
    );
  }

  // Filter lots locally by search
  const filteredLots = searchInput
    ? lots.filter(
        (l) =>
          l.name.toLowerCase().includes(searchInput.toLowerCase()) ||
          l.protocolName.toLowerCase().includes(searchInput.toLowerCase()),
      )
    : lots;

  // ──── DETAIL VIEW ─────────────────────────────────────────────────
  if (selectedLotId) {
    return (
      <section className="iatf-execution-page">
        <header className="iatf-execution-page__detail-header">
          <button
            type="button"
            className="iatf-execution-page__back-btn"
            onClick={() => {
              setSelectedLotId(null);
              setLotDetail(null);
            }}
          >
            <ArrowLeft size={20} aria-hidden="true" />
            Voltar aos lotes
          </button>
        </header>

        {successMsg && (
          <div className="iatf-execution-page__success" role="status">
            <CheckCircle size={16} aria-hidden="true" />
            {successMsg}
          </div>
        )}

        {actionError && (
          <div className="iatf-execution-page__error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            {actionError}
          </div>
        )}

        {detailLoading && (
          <div className="iatf-execution-page__loading">Carregando detalhes do lote...</div>
        )}

        {lotDetail && !detailLoading && (
          <>
            {/* Lot header info */}
            <div className="iatf-execution-page__lot-info">
              <div className="iatf-execution-page__lot-info-main">
                <h1>{lotDetail.name}</h1>
                <div className="iatf-execution-page__lot-meta">
                  <span
                    className={`iatf-execution-page__status-badge ${LOT_STATUS_CONFIG[lotDetail.status]?.className ?? ''}`}
                  >
                    {lotDetail.statusLabel}
                  </span>
                  <span className="iatf-execution-page__lot-meta-item">
                    <Calendar size={14} aria-hidden="true" />
                    D0: {new Date(lotDetail.d0Date).toLocaleDateString('pt-BR')}
                  </span>
                  <span className="iatf-execution-page__lot-meta-item">
                    {lotDetail.protocolName}
                  </span>
                  <span className="iatf-execution-page__lot-meta-item">
                    <Users size={14} aria-hidden="true" />
                    {lotDetail.animalCount} animais
                  </span>
                  {lotDetail.totalCostCents > 0 && (
                    <span className="iatf-execution-page__lot-meta-item iatf-execution-page__lot-meta-item--mono">
                      R$ {(lotDetail.totalCostCents / 100).toFixed(2).replace('.', ',')}
                    </span>
                  )}
                </div>
              </div>
              {lotDetail.status === 'ACTIVE' && (
                <div className="iatf-execution-page__lot-actions">
                  <button
                    type="button"
                    className="iatf-execution-page__btn-secondary"
                    onClick={() => void handleCompleteLot(lotDetail.id)}
                  >
                    <CheckCircle2 size={16} aria-hidden="true" />
                    Concluir
                  </button>
                  <button
                    type="button"
                    className="iatf-execution-page__btn-danger"
                    onClick={() => void handleCancelLot(lotDetail.id)}
                  >
                    <XCircle size={16} aria-hidden="true" />
                    Cancelar
                  </button>
                </div>
              )}
            </div>

            {/* Progress bar */}
            <div className="iatf-execution-page__progress-section">
              <div className="iatf-execution-page__progress-label">
                Progresso: {lotDetail.stepsDone}/{lotDetail.stepsTotal} etapas
              </div>
              <div
                className="iatf-execution-page__progress-bar"
                role="progressbar"
                aria-valuenow={lotDetail.stepsDone}
                aria-valuemin={0}
                aria-valuemax={lotDetail.stepsTotal}
                aria-label={`${lotDetail.stepsDone} de ${lotDetail.stepsTotal} etapas concluídas`}
              >
                <div
                  className="iatf-execution-page__progress-fill"
                  style={{
                    width: `${lotDetail.stepsTotal > 0 ? (lotDetail.stepsDone / lotDetail.stepsTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>

            {/* Tabs content: Cronograma, Animais, Inseminações */}
            <DetailTabs
              lotDetail={lotDetail}
              onExecuteStep={handleExecuteStep}
              onRemoveAnimal={handleRemoveAnimal}
              onInseminateFromStep={handleInseminationFromStep}
              onOpenInsemination={(animalId) => {
                setInseminationAnimalId(animalId);
                setShowInseminationModal(true);
              }}
            />
          </>
        )}

        <InseminationModal
          isOpen={showInseminationModal}
          onClose={() => setShowInseminationModal(false)}
          farmId={selectedFarm.id}
          lotId={selectedLotId}
          lotAnimals={lotDetail?.animals}
          preSelectedAnimalId={inseminationAnimalId}
          onSuccess={handleInseminationSuccess}
        />
      </section>
    );
  }

  // ──── LIST VIEW ───────────────────────────────────────────────────
  return (
    <section className="iatf-execution-page">
      <header className="iatf-execution-page__header">
        <div>
          <h1>Execução IATF</h1>
          <p>Lotes reprodutivos e inseminações de {selectedFarm.name}</p>
        </div>
        <div className="iatf-execution-page__actions">
          <button
            type="button"
            className="iatf-execution-page__btn-primary"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Novo lote
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="iatf-execution-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {(error || actionError) && (
        <div className="iatf-execution-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || actionError}
        </div>
      )}

      {/* Upcoming steps alert */}
      {upcomingSteps.length > 0 && (
        <div className="iatf-execution-page__upcoming">
          <h3>
            <Clock size={16} aria-hidden="true" />
            Próximas etapas
          </h3>
          <div className="iatf-execution-page__upcoming-list">
            {upcomingSteps.slice(0, 5).map((step) => (
              <div
                key={step.stepId}
                className={`iatf-execution-page__upcoming-item ${step.isAiDay ? 'iatf-execution-page__upcoming-item--ai' : ''}`}
              >
                <span className="iatf-execution-page__upcoming-lot">{step.lotName}</span>
                <span className="iatf-execution-page__upcoming-desc">
                  D{step.dayNumber}: {step.description}
                </span>
                <span className="iatf-execution-page__upcoming-date">
                  <Calendar size={14} aria-hidden="true" />
                  {new Date(step.scheduledDate).toLocaleDateString('pt-BR')}
                </span>
                {step.isAiDay && (
                  <span className="iatf-execution-page__ai-badge">
                    <Syringe size={12} aria-hidden="true" />
                    IA
                  </span>
                )}
                <button
                  type="button"
                  className="iatf-execution-page__upcoming-action"
                  onClick={() => {
                    setSelectedLotId(step.lotId);
                  }}
                >
                  Ver lote
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="iatf-execution-page__toolbar">
        <div className="iatf-execution-page__search">
          <Search size={16} aria-hidden="true" className="iatf-execution-page__search-icon" />
          <input
            type="text"
            placeholder="Buscar por nome do lote ou protocolo..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Buscar lotes"
          />
        </div>
        <select
          className="iatf-execution-page__status-filter"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          aria-label="Filtrar por status"
        >
          <option value="">Todos os status</option>
          <option value="ACTIVE">Ativo</option>
          <option value="COMPLETED">Concluído</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      {isLoading && <div className="iatf-execution-page__loading">Carregando lotes...</div>}

      {!isLoading && filteredLots.length === 0 && (
        <div className="iatf-execution-page__empty">
          <Zap size={48} aria-hidden="true" />
          <h2>Nenhum lote reprodutivo encontrado</h2>
          <p>Crie um novo lote usando o botão acima para iniciar um protocolo IATF.</p>
        </div>
      )}

      {!isLoading && filteredLots.length > 0 && (
        <div className="iatf-execution-page__grid">
          {filteredLots.map((lot) => (
            <LotCard
              key={lot.id}
              lot={lot}
              onClick={() => setSelectedLotId(lot.id)}
              onComplete={() => void handleCompleteLot(lot.id)}
              onCancel={() => void handleCancelLot(lot.id)}
            />
          ))}
        </div>
      )}

      {meta.totalPages > 1 && (
        <nav className="iatf-execution-page__pagination" aria-label="Paginação">
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

      <CreateLotModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        farmId={selectedFarm.id}
        onSuccess={handleCreateSuccess}
      />
    </section>
  );
}

// ─── LotCard sub-component ──────────────────────────────────────────
interface LotCardProps {
  lot: ReproductiveLotItem;
  onClick: () => void;
  onComplete: () => void;
  onCancel: () => void;
}

function LotCard({ lot, onClick, onComplete, onCancel }: LotCardProps) {
  const progress = lot.stepsTotal > 0 ? (lot.stepsDone / lot.stepsTotal) * 100 : 0;
  const statusCfg = LOT_STATUS_CONFIG[lot.status] ?? { label: lot.status, className: '' };

  return (
    <div
      className="iatf-execution-page__card"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div className="iatf-execution-page__card-header">
        <div>
          <h3 className="iatf-execution-page__card-title">{lot.name}</h3>
          <p className="iatf-execution-page__card-subtitle">{lot.protocolName}</p>
        </div>
        <span className={`iatf-execution-page__status-badge ${statusCfg.className}`}>
          {lot.statusLabel}
        </span>
      </div>

      {/* Progress bar */}
      <div className="iatf-execution-page__card-progress">
        <div className="iatf-execution-page__card-progress-info">
          <span>
            {lot.stepsDone}/{lot.stepsTotal} etapas
          </span>
        </div>
        <div
          className="iatf-execution-page__progress-bar iatf-execution-page__progress-bar--small"
          role="progressbar"
          aria-valuenow={lot.stepsDone}
          aria-valuemin={0}
          aria-valuemax={lot.stepsTotal}
          aria-label={`${lot.stepsDone} de ${lot.stepsTotal} etapas concluídas`}
        >
          <div className="iatf-execution-page__progress-fill" style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="iatf-execution-page__card-details">
        <span className="iatf-execution-page__detail">
          <Calendar size={14} aria-hidden="true" />
          D0: {new Date(lot.d0Date).toLocaleDateString('pt-BR')}
        </span>
        <span className="iatf-execution-page__detail">
          <Users size={14} aria-hidden="true" />
          {lot.animalCount} animais
        </span>
        {lot.totalCostCents > 0 && (
          <span className="iatf-execution-page__detail iatf-execution-page__detail--mono">
            R$ {(lot.totalCostCents / 100).toFixed(2).replace('.', ',')}
          </span>
        )}
      </div>

      {lot.status === 'ACTIVE' && (
        <div className="iatf-execution-page__card-actions-row">
          <button
            type="button"
            className="iatf-execution-page__card-action iatf-execution-page__card-action--complete"
            onClick={(e) => {
              e.stopPropagation();
              onComplete();
            }}
            aria-label={`Concluir lote ${lot.name}`}
          >
            <CheckCircle2 size={14} aria-hidden="true" />
            Concluir
          </button>
          <button
            type="button"
            className="iatf-execution-page__card-action iatf-execution-page__card-action--cancel"
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            aria-label={`Cancelar lote ${lot.name}`}
          >
            <XCircle size={14} aria-hidden="true" />
            Cancelar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── DetailTabs sub-component ───────────────────────────────────────
interface DetailTabsProps {
  lotDetail: LotDetailItem;
  onExecuteStep: (stepId: string) => Promise<void>;
  onRemoveAnimal: (animalId: string) => Promise<void>;
  onInseminateFromStep: (step: LotStepItem) => void;
  onOpenInsemination: (animalId: string) => void;
}

function DetailTabs({
  lotDetail,
  onExecuteStep,
  onRemoveAnimal,
  onInseminateFromStep,
  onOpenInsemination,
}: DetailTabsProps) {
  const [activeTab, setActiveTab] = useState<'schedule' | 'animals' | 'inseminations'>('schedule');

  return (
    <div className="iatf-execution-page__tabs">
      <div className="iatf-execution-page__tab-list" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'schedule'}
          className={`iatf-execution-page__tab ${activeTab === 'schedule' ? 'iatf-execution-page__tab--active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={16} aria-hidden="true" />
          Cronograma
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'animals'}
          className={`iatf-execution-page__tab ${activeTab === 'animals' ? 'iatf-execution-page__tab--active' : ''}`}
          onClick={() => setActiveTab('animals')}
        >
          <Users size={16} aria-hidden="true" />
          Animais ({lotDetail.animals.filter((a) => !a.removedAt).length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'inseminations'}
          className={`iatf-execution-page__tab ${activeTab === 'inseminations' ? 'iatf-execution-page__tab--active' : ''}`}
          onClick={() => setActiveTab('inseminations')}
        >
          <Syringe size={16} aria-hidden="true" />
          Inseminações ({lotDetail.inseminations.length})
        </button>
      </div>

      <div className="iatf-execution-page__tab-panel" role="tabpanel">
        {activeTab === 'schedule' && (
          <ScheduleTimeline
            steps={lotDetail.steps}
            lotStatus={lotDetail.status}
            onExecute={onExecuteStep}
            onInseminate={onInseminateFromStep}
          />
        )}
        {activeTab === 'animals' && (
          <AnimalsSection
            animals={lotDetail.animals}
            lotStatus={lotDetail.status}
            onRemove={onRemoveAnimal}
            onInseminate={onOpenInsemination}
          />
        )}
        {activeTab === 'inseminations' && (
          <InseminationsTable inseminations={lotDetail.inseminations} />
        )}
      </div>
    </div>
  );
}

// ─── ScheduleTimeline ───────────────────────────────────────────────
interface ScheduleTimelineProps {
  steps: LotStepItem[];
  lotStatus: string;
  onExecute: (stepId: string) => Promise<void>;
  onInseminate: (step: LotStepItem) => void;
}

function ScheduleTimeline({ steps, lotStatus, onExecute, onInseminate }: ScheduleTimelineProps) {
  const sorted = [...steps].sort(
    (a, b) => a.dayNumber - b.dayNumber || a.scheduledDate.localeCompare(b.scheduledDate),
  );

  if (sorted.length === 0) {
    return (
      <div className="iatf-execution-page__empty-section">
        <Calendar size={32} aria-hidden="true" />
        <p>Nenhuma etapa no cronograma</p>
      </div>
    );
  }

  return (
    <div className="iatf-execution-page__timeline">
      {sorted.map((step) => {
        const statusCfg = STEP_STATUS_CONFIG[step.status] ?? {
          label: step.status,
          className: '',
        };
        return (
          <div
            key={step.id}
            className={`iatf-execution-page__timeline-item ${step.isAiDay ? 'iatf-execution-page__timeline-item--ai' : ''} ${statusCfg.className}`}
          >
            <div className="iatf-execution-page__timeline-marker">
              <div className="iatf-execution-page__timeline-dot" />
              <div className="iatf-execution-page__timeline-line" />
            </div>

            <div className="iatf-execution-page__timeline-content">
              <div className="iatf-execution-page__timeline-header">
                <span className="iatf-execution-page__timeline-day">D{step.dayNumber}</span>
                <span className="iatf-execution-page__timeline-date">
                  {new Date(step.scheduledDate).toLocaleDateString('pt-BR')}
                </span>
                <span className={`iatf-execution-page__step-badge ${statusCfg.className}`}>
                  {statusCfg.label}
                </span>
                {step.isAiDay && (
                  <span className="iatf-execution-page__ai-badge">
                    <Syringe size={12} aria-hidden="true" />
                    IA
                  </span>
                )}
              </div>
              <p className="iatf-execution-page__timeline-desc">{step.description}</p>
              {step.executedAt && (
                <p className="iatf-execution-page__timeline-executed">
                  Executado em {new Date(step.executedAt).toLocaleDateString('pt-BR')}
                  {step.responsibleName ? ` por ${step.responsibleName}` : ''}
                </p>
              )}
              {step.status === 'PENDING' && lotStatus === 'ACTIVE' && (
                <div className="iatf-execution-page__timeline-actions">
                  <button
                    type="button"
                    className="iatf-execution-page__btn-execute"
                    onClick={() => void onExecute(step.id)}
                  >
                    <Play size={14} aria-hidden="true" />
                    Executar
                  </button>
                  {step.isAiDay && (
                    <button
                      type="button"
                      className="iatf-execution-page__btn-inseminate"
                      onClick={() => onInseminate(step)}
                    >
                      <Syringe size={14} aria-hidden="true" />
                      Registrar inseminação
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── AnimalsSection ─────────────────────────────────────────────────
interface AnimalsSectionProps {
  animals: LotAnimalItem[];
  lotStatus: string;
  onRemove: (animalId: string) => Promise<void>;
  onInseminate: (animalId: string) => void;
}

function AnimalsSection({ animals, lotStatus, onRemove, onInseminate }: AnimalsSectionProps) {
  const active = animals.filter((a) => !a.removedAt);
  const removed = animals.filter((a) => a.removedAt);

  if (animals.length === 0) {
    return (
      <div className="iatf-execution-page__empty-section">
        <Users size={32} aria-hidden="true" />
        <p>Nenhum animal neste lote</p>
      </div>
    );
  }

  return (
    <div className="iatf-execution-page__animals">
      <ul className="iatf-execution-page__animal-list">
        {active.map((animal) => (
          <li key={animal.id} className="iatf-execution-page__animal-row">
            <div className="iatf-execution-page__animal-info">
              <span className="iatf-execution-page__animal-tag">{animal.earTag}</span>
              {animal.animalName && (
                <span className="iatf-execution-page__animal-name">{animal.animalName}</span>
              )}
            </div>
            {lotStatus === 'ACTIVE' && (
              <div className="iatf-execution-page__animal-actions">
                <button
                  type="button"
                  className="iatf-execution-page__btn-inseminate-sm"
                  onClick={() => onInseminate(animal.animalId)}
                  aria-label={`Inseminar ${animal.earTag}`}
                >
                  <Syringe size={14} aria-hidden="true" />
                  Inseminar
                </button>
                <button
                  type="button"
                  className="iatf-execution-page__btn-remove"
                  onClick={() => void onRemove(animal.animalId)}
                  aria-label={`Remover ${animal.earTag} do lote`}
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {removed.length > 0 && (
        <>
          <h4 className="iatf-execution-page__removed-heading">Removidos ({removed.length})</h4>
          <ul className="iatf-execution-page__animal-list iatf-execution-page__animal-list--removed">
            {removed.map((animal) => (
              <li
                key={animal.id}
                className="iatf-execution-page__animal-row iatf-execution-page__animal-row--removed"
              >
                <div className="iatf-execution-page__animal-info">
                  <span className="iatf-execution-page__animal-tag">{animal.earTag}</span>
                  {animal.animalName && (
                    <span className="iatf-execution-page__animal-name">{animal.animalName}</span>
                  )}
                </div>
                <span className="iatf-execution-page__removal-reason">
                  {animal.removalReason ?? 'Sem motivo'}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

// ─── InseminationsTable ─────────────────────────────────────────────
interface InseminationsTableProps {
  inseminations: InseminationItem[];
}

function InseminationsTable({ inseminations }: InseminationsTableProps) {
  if (inseminations.length === 0) {
    return (
      <div className="iatf-execution-page__empty-section">
        <Syringe size={32} aria-hidden="true" />
        <p>Nenhuma inseminação registrada</p>
      </div>
    );
  }

  return (
    <div className="iatf-execution-page__inseminations">
      {/* Desktop table */}
      <table className="iatf-execution-page__table">
        <thead>
          <tr>
            <th scope="col">Animal</th>
            <th scope="col">Tipo</th>
            <th scope="col">Touro</th>
            <th scope="col">Partida</th>
            <th scope="col">Doses</th>
            <th scope="col">Inseminador</th>
            <th scope="col">Data</th>
            <th scope="col">Muco</th>
            <th scope="col">Touro planejado</th>
          </tr>
        </thead>
        <tbody>
          {inseminations.map((ins) => (
            <tr key={ins.id}>
              <td>
                <span className="iatf-execution-page__animal-tag">{ins.animalEarTag}</span>
                {ins.animalName && (
                  <span className="iatf-execution-page__insem-animal-name">{ins.animalName}</span>
                )}
              </td>
              <td>{ins.inseminationTypeLabel}</td>
              <td>{ins.bullName ?? '—'}</td>
              <td>
                <span className="iatf-execution-page__mono-text">
                  {ins.semenBatchNumber ?? '—'}
                </span>
              </td>
              <td>{ins.dosesUsed}</td>
              <td>{ins.inseminatorName}</td>
              <td>
                {new Date(ins.inseminationDate).toLocaleDateString('pt-BR')}
                {ins.inseminationTime && (
                  <span className="iatf-execution-page__insem-time"> {ins.inseminationTime}</span>
                )}
              </td>
              <td>{ins.cervicalMucusLabel ?? '—'}</td>
              <td>
                {ins.wasPlannedBull === true && (
                  <span className="iatf-execution-page__planned-match">
                    <CheckCircle size={14} aria-hidden="true" />
                    Sim
                  </span>
                )}
                {ins.wasPlannedBull === false && (
                  <span className="iatf-execution-page__planned-sub">
                    <AlertTriangle size={14} aria-hidden="true" />
                    Substituído
                  </span>
                )}
                {ins.wasPlannedBull === null && '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="iatf-execution-page__insem-cards">
        {inseminations.map((ins) => (
          <div key={ins.id} className="iatf-execution-page__insem-card">
            <div className="iatf-execution-page__insem-card-header">
              <span className="iatf-execution-page__animal-tag">{ins.animalEarTag}</span>
              {ins.animalName && <span> — {ins.animalName}</span>}
              <span className="iatf-execution-page__insem-type-badge">
                {ins.inseminationTypeLabel}
              </span>
            </div>
            <div className="iatf-execution-page__insem-card-row">
              <span>Touro: {ins.bullName ?? '—'}</span>
              <span>Partida: {ins.semenBatchNumber ?? '—'}</span>
            </div>
            <div className="iatf-execution-page__insem-card-row">
              <span>Doses: {ins.dosesUsed}</span>
              <span>Inseminador: {ins.inseminatorName}</span>
            </div>
            <div className="iatf-execution-page__insem-card-row">
              <span>
                Data: {new Date(ins.inseminationDate).toLocaleDateString('pt-BR')}
                {ins.inseminationTime ? ` ${ins.inseminationTime}` : ''}
              </span>
              <span>Muco: {ins.cervicalMucusLabel ?? '—'}</span>
            </div>
            {ins.wasPlannedBull !== null && (
              <div className="iatf-execution-page__insem-card-planned">
                {ins.wasPlannedBull ? (
                  <span className="iatf-execution-page__planned-match">
                    <CheckCircle size={14} aria-hidden="true" />
                    Touro conforme planejado
                  </span>
                ) : (
                  <span className="iatf-execution-page__planned-sub">
                    <AlertTriangle size={14} aria-hidden="true" />
                    Touro substituído
                    {ins.substitutionReason ? `: ${ins.substitutionReason}` : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
