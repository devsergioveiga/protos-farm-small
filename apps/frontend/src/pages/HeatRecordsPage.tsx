import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Trash2,
  Flame,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Calendar,
  Clock,
  AlertTriangle,
  BarChart3,
  Download,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useHeatRecords, useDailyHeats, useHeatIndicators } from '@/hooks/useHeatRecords';
import type { HeatRecordItem, DailyHeatGroup, UpdateHeatRecordInput } from '@/types/heat-record';
import { HEAT_STATUSES, INTENSITY_CONFIG, STATUS_CONFIG } from '@/types/heat-record';
import HeatModal from '@/components/heat-records/HeatModal';
import { api } from '@/services/api';
import './HeatRecordsPage.css';

type TabKey = 'daily' | 'history' | 'indicators';

export default function HeatRecordsPage() {
  const { selectedFarm } = useFarmContext();

  const [activeTab, setActiveTab] = useState<TabKey>('daily');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reason input for NOT_INSEMINATED
  const [reasonHeatId, setReasonHeatId] = useState<string | null>(null);
  const [reasonText, setReasonText] = useState('');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const farmId = selectedFarm?.id ?? null;

  const {
    heats,
    meta,
    isLoading: heatsLoading,
    error: heatsError,
    refetch: refetchHeats,
  } = useHeatRecords({
    farmId,
    page,
    search: search || undefined,
    status: statusFilter || undefined,
  });

  const {
    groups: dailyGroups,
    isLoading: dailyLoading,
    error: dailyError,
    refetch: refetchDaily,
  } = useDailyHeats(farmId);

  const {
    indicators,
    isLoading: indicatorsLoading,
    error: indicatorsError,
    refetch: refetchIndicators,
  } = useHeatIndicators(farmId);

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchHeats(), refetchDaily(), refetchIndicators()]);
  }, [refetchHeats, refetchDaily, refetchIndicators]);

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSuccessMsg('Cio registrado com sucesso');
    void refetchAll();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetchAll]);

  const handleDelete = useCallback(
    async (heat: HeatRecordItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm('Excluir este registro de cio? Esta ação não pode ser desfeita.')) return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/heat-records/${heat.id}`);
        setSuccessMsg('Registro de cio excluído com sucesso');
        void refetchAll();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir registro.');
      }
    },
    [refetchAll, selectedFarm],
  );

  const handleUpdateStatus = useCallback(
    async (heatId: string, payload: UpdateHeatRecordInput) => {
      try {
        await api.patch(`/org/farms/${selectedFarm!.id}/heat-records/${heatId}`, payload);
        setSuccessMsg(
          payload.status === 'AI_DONE'
            ? 'IA marcada como realizada'
            : 'Status atualizado com sucesso',
        );
        setReasonHeatId(null);
        setReasonText('');
        void refetchAll();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao atualizar status.');
      }
    },
    [refetchAll, selectedFarm],
  );

  const handleExportCsv = useCallback(async () => {
    if (!selectedFarm) return;
    try {
      const blob = await api.getBlob(`/org/farms/${selectedFarm.id}/heat-records/export`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cios-${selectedFarm.name}-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao exportar CSV.');
    }
  }, [selectedFarm]);

  if (!selectedFarm) {
    return (
      <section className="heat-records-page">
        <div className="heat-records-page__empty">
          <Flame size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver os registros de cio.</p>
        </div>
      </section>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'daily', label: 'Cios do dia' },
    { key: 'history', label: 'Histórico' },
    { key: 'indicators', label: 'Indicadores' },
  ];

  return (
    <section className="heat-records-page">
      <header className="heat-records-page__header">
        <div>
          <h1>Detecção de cio</h1>
          <p>Registros de cio do rebanho de {selectedFarm.name}</p>
        </div>
        <div className="heat-records-page__actions">
          <button
            type="button"
            className="heat-records-page__btn-secondary"
            onClick={() => void handleExportCsv()}
          >
            <Download size={20} aria-hidden="true" />
            Exportar CSV
          </button>
          <button
            type="button"
            className="heat-records-page__btn-primary"
            onClick={() => setShowModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Novo cio
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="heat-records-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}
      {(heatsError || dailyError || indicatorsError || deleteError) && (
        <div className="heat-records-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {heatsError || dailyError || indicatorsError || deleteError}
        </div>
      )}

      {/* Tabs */}
      <nav className="heat-records-page__tabs" aria-label="Abas de detecção de cio">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`heat-records-page__tab ${activeTab === tab.key ? 'heat-records-page__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.key)}
            aria-selected={activeTab === tab.key}
            role="tab"
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* ─── TAB: Cios do dia ─── */}
      {activeTab === 'daily' && (
        <DailyTab
          groups={dailyGroups}
          isLoading={dailyLoading}
          onMarkAiDone={(heatId) => void handleUpdateStatus(heatId, { status: 'AI_DONE' })}
          onMarkNotInseminated={(heatId) => {
            setReasonHeatId(heatId);
            setReasonText('');
          }}
          reasonHeatId={reasonHeatId}
          reasonText={reasonText}
          onReasonTextChange={setReasonText}
          onConfirmNotInseminated={(heatId) =>
            void handleUpdateStatus(heatId, {
              status: 'NOT_INSEMINATED',
              notInseminatedReason: reasonText || null,
            })
          }
          onCancelReason={() => {
            setReasonHeatId(null);
            setReasonText('');
          }}
        />
      )}

      {/* ─── TAB: Histórico ─── */}
      {activeTab === 'history' && (
        <HistoryTab
          heats={heats}
          meta={meta}
          isLoading={heatsLoading}
          searchInput={searchInput}
          onSearchChange={setSearchInput}
          statusFilter={statusFilter}
          onStatusFilterChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
          page={page}
          onPageChange={setPage}
          onDelete={handleDelete}
        />
      )}

      {/* ─── TAB: Indicadores ─── */}
      {activeTab === 'indicators' && (
        <IndicatorsTab indicators={indicators} isLoading={indicatorsLoading} />
      )}

      <HeatModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
      />
    </section>
  );
}

/* ─── Daily Tab ───────────────────────────────────────────────────── */

interface DailyTabProps {
  groups: DailyHeatGroup[];
  isLoading: boolean;
  onMarkAiDone: (heatId: string) => void;
  onMarkNotInseminated: (heatId: string) => void;
  reasonHeatId: string | null;
  reasonText: string;
  onReasonTextChange: (v: string) => void;
  onConfirmNotInseminated: (heatId: string) => void;
  onCancelReason: () => void;
}

function DailyTab({
  groups,
  isLoading,
  onMarkAiDone,
  onMarkNotInseminated,
  reasonHeatId,
  reasonText,
  onReasonTextChange,
  onConfirmNotInseminated,
  onCancelReason,
}: DailyTabProps) {
  if (isLoading) {
    return <div className="heat-records-page__loading">Carregando cios do dia...</div>;
  }

  const totalHeats = (groups ?? []).reduce((sum, g) => sum + g.heats.length, 0);

  if (totalHeats === 0) {
    return (
      <div className="heat-records-page__empty">
        <Flame size={48} aria-hidden="true" />
        <h2>Nenhum cio detectado hoje</h2>
        <p>Registre um novo cio usando o botão acima.</p>
      </div>
    );
  }

  const statusOrder = ['AWAITING_AI', 'AI_DONE', 'NOT_INSEMINATED'];
  const sortedGroups = [...groups].sort(
    (a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status),
  );

  return (
    <div className="heat-records-page__daily">
      {sortedGroups.map((group) => {
        const statusKey = group.status as keyof typeof STATUS_CONFIG;
        const config = STATUS_CONFIG[statusKey];
        return (
          <div key={group.status} className="heat-records-page__daily-group">
            <h3 className="heat-records-page__daily-title">
              <span className={`heat-records-page__badge ${config?.className ?? ''}`}>
                {group.statusLabel}
              </span>
              <span className="heat-records-page__daily-count">{group.heats.length}</span>
            </h3>
            <ul className="heat-records-page__daily-list">
              {group.heats.map((heat) => {
                const intKey = heat.intensity as keyof typeof INTENSITY_CONFIG;
                const intConfig = INTENSITY_CONFIG[intKey];
                return (
                  <li key={heat.id} className="heat-records-page__daily-card">
                    <div className="heat-records-page__daily-card-header">
                      <span className="heat-records-page__daily-animal">
                        {heat.animalEarTag}
                        {heat.animalName ? ` — ${heat.animalName}` : ''}
                      </span>
                      {heat.heatTime && (
                        <span className="heat-records-page__daily-time">
                          <Clock size={14} aria-hidden="true" />
                          {heat.heatTime}
                          {heat.heatPeriodLabel ? ` (${heat.heatPeriodLabel})` : ''}
                        </span>
                      )}
                    </div>

                    <div className="heat-records-page__daily-card-body">
                      <span className={`heat-records-page__badge ${intConfig?.className ?? ''}`}>
                        {heat.intensityLabel}
                      </span>
                      <div className="heat-records-page__signs">
                        {heat.signLabels.map((s) => (
                          <span key={s} className="heat-records-page__sign-tag">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>

                    {heat.recommendedAiTime && (
                      <div className="heat-records-page__daily-ai-time">
                        <Clock size={14} aria-hidden="true" />
                        IA recomendada: <strong>{heat.recommendedAiTime}</strong>
                      </div>
                    )}

                    {heat.status === 'AWAITING_AI' && (
                      <div className="heat-records-page__daily-card-actions">
                        {reasonHeatId === heat.id ? (
                          <div className="heat-records-page__reason-form">
                            <label
                              htmlFor={`reason-${heat.id}`}
                              className="heat-records-page__reason-label"
                            >
                              Motivo (opcional)
                            </label>
                            <input
                              id={`reason-${heat.id}`}
                              type="text"
                              value={reasonText}
                              onChange={(e) => onReasonTextChange(e.target.value)}
                              placeholder="Ex: Fêmea com problema no casco"
                              className="heat-records-page__reason-input"
                            />
                            <div className="heat-records-page__reason-btns">
                              <button
                                type="button"
                                className="heat-records-page__btn-sm heat-records-page__btn-sm--cancel"
                                onClick={onCancelReason}
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                className="heat-records-page__btn-sm heat-records-page__btn-sm--confirm"
                                onClick={() => onConfirmNotInseminated(heat.id)}
                              >
                                Confirmar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="heat-records-page__btn-action heat-records-page__btn-action--ai"
                              onClick={() => onMarkAiDone(heat.id)}
                            >
                              <CheckCircle size={16} aria-hidden="true" />
                              Marcar IA realizada
                            </button>
                            <button
                              type="button"
                              className="heat-records-page__btn-action heat-records-page__btn-action--skip"
                              onClick={() => onMarkNotInseminated(heat.id)}
                            >
                              Não inseminada
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/* ─── History Tab ─────────────────────────────────────────────────── */

interface HistoryTabProps {
  heats: HeatRecordItem[];
  meta: { page: number; limit: number; total: number; totalPages: number } | null;
  isLoading: boolean;
  searchInput: string;
  onSearchChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  page: number;
  onPageChange: (p: number) => void;
  onDelete: (heat: HeatRecordItem, e: React.MouseEvent) => void;
}

function HistoryTab({
  heats,
  meta,
  isLoading,
  searchInput,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  page,
  onPageChange,
  onDelete,
}: HistoryTabProps) {
  return (
    <>
      <div className="heat-records-page__toolbar">
        <div className="heat-records-page__search">
          <Search size={16} aria-hidden="true" className="heat-records-page__search-icon" />
          <input
            type="text"
            placeholder="Buscar por brinco ou nome..."
            value={searchInput}
            onChange={(e) => onSearchChange(e.target.value)}
            aria-label="Buscar registros de cio"
          />
        </div>
        <div className="heat-records-page__filter">
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            aria-label="Filtrar por status"
          >
            <option value="">Todos os status</option>
            {HEAT_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && (
        <div className="heat-records-page__loading">Carregando registros de cio...</div>
      )}

      {!isLoading && heats.length === 0 && (
        <div className="heat-records-page__empty">
          <Flame size={48} aria-hidden="true" />
          <h2>Nenhum registro de cio encontrado</h2>
          <p>Registre cios usando o botão acima ou ajuste os filtros de busca.</p>
        </div>
      )}

      {!isLoading && heats.length > 0 && (
        <div className="heat-records-page__grid">
          {heats.map((heat) => {
            const intKey = heat.intensity as keyof typeof INTENSITY_CONFIG;
            const intConfig = INTENSITY_CONFIG[intKey];
            const statusKey = heat.status as keyof typeof STATUS_CONFIG;
            const statusCfg = STATUS_CONFIG[statusKey];
            return (
              <div key={heat.id} className="heat-records-page__card">
                <div className="heat-records-page__card-header">
                  <div>
                    <h3 className="heat-records-page__card-title">
                      {heat.animalEarTag}
                      {heat.animalName ? ` — ${heat.animalName}` : ''}
                    </h3>
                    <p className="heat-records-page__card-subtitle">{heat.detectionMethodLabel}</p>
                  </div>
                  <div className="heat-records-page__card-actions">
                    <button
                      type="button"
                      className="heat-records-page__card-btn heat-records-page__card-btn--delete"
                      onClick={(e) => void onDelete(heat, e)}
                      aria-label={`Excluir cio de ${heat.animalEarTag}`}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                <div className="heat-records-page__card-tags">
                  <span className={`heat-records-page__badge ${statusCfg?.className ?? ''}`}>
                    {heat.statusLabel}
                  </span>
                  <span className={`heat-records-page__badge ${intConfig?.className ?? ''}`}>
                    {heat.intensityLabel}
                  </span>
                </div>

                <div className="heat-records-page__signs">
                  {heat.signLabels.map((s) => (
                    <span key={s} className="heat-records-page__sign-tag">
                      {s}
                    </span>
                  ))}
                </div>

                <div className="heat-records-page__card-details">
                  <span className="heat-records-page__detail">
                    <Calendar size={14} aria-hidden="true" />
                    {new Date(heat.heatDate).toLocaleDateString('pt-BR')}
                  </span>
                  {heat.heatTime && (
                    <span className="heat-records-page__detail">
                      <Clock size={14} aria-hidden="true" />
                      {heat.heatTime}
                    </span>
                  )}
                  <span className="heat-records-page__detail">{heat.recorderName}</span>
                </div>

                {heat.interHeatDays !== null && (
                  <div
                    className={`heat-records-page__interval ${heat.isIntervalIrregular ? 'heat-records-page__interval--irregular' : 'heat-records-page__interval--normal'}`}
                  >
                    {heat.isIntervalIrregular && <AlertTriangle size={14} aria-hidden="true" />}
                    Intervalo: <strong>{heat.interHeatDays} dias</strong>
                    {heat.isIntervalIrregular && ' (irregular)'}
                  </div>
                )}

                {heat.notInseminatedReason && (
                  <div className="heat-records-page__card-reason">
                    Motivo: {heat.notInseminatedReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {meta && meta.totalPages > 1 && (
        <nav className="heat-records-page__pagination" aria-label="Paginação">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
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
            onClick={() => onPageChange(page + 1)}
            disabled={page >= meta.totalPages}
            aria-label="Próxima página"
          >
            Próxima
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}
    </>
  );
}

/* ─── Indicators Tab ──────────────────────────────────────────────── */

interface IndicatorsTabProps {
  indicators: {
    totalHeats: number;
    avgInterHeatDays: number | null;
    inseminatedPercent: number;
    irregularIntervalPercent: number;
  } | null;
  isLoading: boolean;
}

function IndicatorsTab({ indicators, isLoading }: IndicatorsTabProps) {
  if (isLoading) {
    return <div className="heat-records-page__loading">Carregando indicadores...</div>;
  }

  if (!indicators) {
    return (
      <div className="heat-records-page__empty">
        <BarChart3 size={48} aria-hidden="true" />
        <h2>Sem dados para indicadores</h2>
        <p>Registre cios para visualizar os indicadores do rebanho.</p>
      </div>
    );
  }

  return (
    <div className="heat-records-page__indicators">
      <div className="heat-records-page__stat-card">
        <span className="heat-records-page__stat-label">Total de cios</span>
        <span className="heat-records-page__stat-value">{indicators.totalHeats}</span>
      </div>
      <div className="heat-records-page__stat-card">
        <span className="heat-records-page__stat-label">Intervalo médio entre cios</span>
        <span className="heat-records-page__stat-value">
          {indicators.avgInterHeatDays !== null
            ? `${indicators.avgInterHeatDays.toFixed(1)} dias`
            : '—'}
        </span>
      </div>
      <div className="heat-records-page__stat-card">
        <span className="heat-records-page__stat-label">Taxa de inseminação</span>
        <span className="heat-records-page__stat-value">
          {indicators.inseminatedPercent.toFixed(1)}%
        </span>
      </div>
      <div className="heat-records-page__stat-card">
        <span className="heat-records-page__stat-label">Intervalos irregulares</span>
        <span
          className={`heat-records-page__stat-value ${indicators.irregularIntervalPercent > 20 ? 'heat-records-page__stat-value--alert' : ''}`}
        >
          {indicators.irregularIntervalPercent.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}
