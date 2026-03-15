import { useState, useCallback, useEffect } from 'react';
import {
  Plus,
  AlertCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Calendar,
  Cookie,
  BarChart3,
  ClipboardList,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Milk,
  Eye,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useFeedingRecords, useConsumptionIndicators } from '@/hooks/useFeedingRecords';
import type { FeedingRecordListItem, FeedingRecordResponse } from '@/types/feeding-record';
import { FEEDING_SHIFT_OPTIONS, LEFTOVER_ALERT_CONFIG } from '@/types/feeding-record';
import FeedingModal from '@/components/feeding-records/FeedingModal';
import { api } from '@/services/api';
import './FeedingRecordsPage.css';

type Tab = 'quick' | 'records' | 'indicators';

export default function FeedingRecordsPage() {
  const { selectedFarm } = useFarmContext();

  const [activeTab, setActiveTab] = useState<Tab>('quick');
  const [page, setPage] = useState(1);
  const [filterLotId, setFilterLotId] = useState('');
  const [filterShift, setFilterShift] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [indicatorLotId, setIndicatorLotId] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [leftoverRecord, setLeftoverRecord] = useState<FeedingRecordResponse | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ─── Lots lookup ────────────────────────────────────────────────
  const [lots, setLots] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    if (!selectedFarm) return;
    const fetchLots = async () => {
      try {
        const res = await api.get<{ data: Array<{ id: string; name: string }> }>(
          `/org/farms/${selectedFarm.id}/animal-lots?limit=200`,
        );
        setLots((res.data ?? []).map((l) => ({ id: l.id, name: l.name })));
      } catch {
        /* ignore */
      }
    };
    void fetchLots();
  }, [selectedFarm]);

  // ─── Records ────────────────────────────────────────────────────
  const { records, meta, isLoading, error, refetch } = useFeedingRecords({
    farmId: selectedFarm?.id ?? null,
    page,
    lotId: filterLotId || undefined,
    shift: filterShift || undefined,
    dateFrom: filterDateFrom || undefined,
    dateTo: filterDateTo || undefined,
  });

  // ─── Indicators ─────────────────────────────────────────────────
  const { indicators, isLoading: indicatorsLoading } = useConsumptionIndicators({
    farmId: selectedFarm?.id ?? null,
    lotId: indicatorLotId || undefined,
  });

  // ─── Handlers ───────────────────────────────────────────────────
  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setLeftoverRecord(null);
    setSuccessMsg(
      leftoverRecord ? 'Sobras registradas com sucesso' : 'Trato registrado com sucesso',
    );
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, leftoverRecord]);

  const handleViewDetail = useCallback(
    async (record: FeedingRecordListItem) => {
      if (!selectedFarm) return;
      try {
        const full = await api.get<FeedingRecordResponse>(
          `/org/farms/${selectedFarm.id}/feeding-records/${record.id}`,
        );
        setLeftoverRecord(full);
        setShowModal(true);
      } catch {
        // ignore
      }
    },
    [selectedFarm],
  );

  const handleDelete = useCallback(
    async (record: FeedingRecordListItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (
        !window.confirm(
          'Excluir este registro de trato? O estoque será restaurado se houve dedução.',
        )
      )
        return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/feeding-records/${record.id}`);
        setSuccessMsg('Registro excluído com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir registro.');
      }
    },
    [refetch, selectedFarm],
  );

  const handleExport = useCallback(async () => {
    if (!selectedFarm) return;
    try {
      const blob = await api.getBlob(
        `/org/farms/${selectedFarm.id}/feeding-records/export${filterLotId ? `?lotId=${filterLotId}` : ''}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'registros-trato.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  }, [selectedFarm, filterLotId]);

  // ─── Empty state ────────────────────────────────────────────────
  if (!selectedFarm) {
    return (
      <section className="feeding-page">
        <div className="feeding-page__empty">
          <Cookie size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para gerenciar o trato do rebanho.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="feeding-page">
      <header className="feeding-page__header">
        <div>
          <h1>Trato / Fornecimento</h1>
          <p>Registro de alimentação do rebanho de {selectedFarm.name}</p>
        </div>
      </header>

      {successMsg && (
        <div className="feeding-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}
      {(error || deleteError) && (
        <div className="feeding-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError}
        </div>
      )}

      {/* Tabs */}
      <nav className="feeding-page__tabs" role="tablist" aria-label="Seções de trato">
        <button
          role="tab"
          aria-selected={activeTab === 'quick'}
          className={`feeding-page__tab ${activeTab === 'quick' ? 'feeding-page__tab--active' : ''}`}
          onClick={() => setActiveTab('quick')}
        >
          <Plus size={16} aria-hidden="true" />
          Registro rápido
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'records'}
          className={`feeding-page__tab ${activeTab === 'records' ? 'feeding-page__tab--active' : ''}`}
          onClick={() => setActiveTab('records')}
        >
          <ClipboardList size={16} aria-hidden="true" />
          Registros
        </button>
        <button
          role="tab"
          aria-selected={activeTab === 'indicators'}
          className={`feeding-page__tab ${activeTab === 'indicators' ? 'feeding-page__tab--active' : ''}`}
          onClick={() => setActiveTab('indicators')}
        >
          <BarChart3 size={16} aria-hidden="true" />
          Indicadores
        </button>
      </nav>

      {/* ═══ TAB: REGISTRO RÁPIDO ══════════════════════════════════ */}
      {activeTab === 'quick' && (
        <div className="feeding-page__panel" role="tabpanel">
          <div className="feeding-page__quick-section">
            <div className="feeding-page__quick-card">
              <Cookie size={40} aria-hidden="true" className="feeding-page__quick-icon" />
              <h2>Novo registro de trato</h2>
              <p>
                Selecione o lote, turno e ingredientes fornecidos. Se o lote tem dieta vinculada, os
                ingredientes são preenchidos automaticamente.
              </p>
              <button
                type="button"
                className="feeding-page__btn-primary"
                onClick={() => {
                  setLeftoverRecord(null);
                  setShowModal(true);
                }}
              >
                <Plus size={20} aria-hidden="true" />
                Registrar trato
              </button>
            </div>

            {/* Recent records without leftovers */}
            {records.filter((r) => r.totalLeftoverKg == null).length > 0 && (
              <div className="feeding-page__pending-leftovers">
                <h3>
                  <AlertTriangle size={16} aria-hidden="true" /> Tratos aguardando registro de
                  sobras
                </h3>
                <div className="feeding-page__pending-list">
                  {records
                    .filter((r) => r.totalLeftoverKg == null)
                    .slice(0, 5)
                    .map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className="feeding-page__pending-item"
                        onClick={() => void handleViewDetail(r)}
                      >
                        <span className="feeding-page__pending-lot">{r.lotName}</span>
                        <span className="feeding-page__pending-meta">
                          {new Date(r.feedingDate + 'T12:00:00').toLocaleDateString('pt-BR')} —{' '}
                          {r.shiftLabel} — {r.totalProvidedKg.toFixed(0)}kg
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB: REGISTROS ════════════════════════════════════════ */}
      {activeTab === 'records' && (
        <div className="feeding-page__panel" role="tabpanel">
          {/* Toolbar */}
          <div className="feeding-page__toolbar">
            <select
              value={filterLotId}
              onChange={(e) => {
                setFilterLotId(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por lote"
            >
              <option value="">Todos os lotes</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name}
                </option>
              ))}
            </select>
            <select
              value={filterShift}
              onChange={(e) => {
                setFilterShift(e.target.value);
                setPage(1);
              }}
              aria-label="Filtrar por turno"
            >
              <option value="">Todos os turnos</option>
              {FEEDING_SHIFT_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => {
                setFilterDateFrom(e.target.value);
                setPage(1);
              }}
              aria-label="Data início"
            />
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => {
                setFilterDateTo(e.target.value);
                setPage(1);
              }}
              aria-label="Data fim"
            />
            <button
              type="button"
              className="feeding-page__btn-secondary"
              onClick={handleExport}
              aria-label="Exportar CSV"
            >
              Exportar CSV
            </button>
          </div>

          {isLoading && (
            <div className="feeding-page__loading">Carregando registros de trato...</div>
          )}

          {!isLoading && records.length === 0 && (
            <div className="feeding-page__empty">
              <Cookie size={48} aria-hidden="true" />
              <h2>Nenhum registro de trato</h2>
              <p>Registre o primeiro trato usando a aba &ldquo;Registro rápido&rdquo;.</p>
            </div>
          )}

          {!isLoading && records.length > 0 && (
            <div className="feeding-page__grid">
              {records.map((r) => {
                const alertConfig =
                  r.leftoverAlertType && r.leftoverAlertType !== 'NONE'
                    ? LEFTOVER_ALERT_CONFIG[r.leftoverAlertType]
                    : null;

                return (
                  <div key={r.id} className="feeding-page__card">
                    <div className="feeding-page__card-header">
                      <div>
                        <h3 className="feeding-page__card-title">{r.lotName}</h3>
                        <p className="feeding-page__card-subtitle">
                          {r.dietName ?? 'Sem dieta vinculada'}
                        </p>
                      </div>
                      <div className="feeding-page__card-actions">
                        {r.totalLeftoverKg == null && (
                          <button
                            type="button"
                            className="feeding-page__card-btn feeding-page__card-btn--primary"
                            onClick={() => void handleViewDetail(r)}
                            aria-label={`Registrar sobras de ${r.lotName}`}
                          >
                            <Eye size={16} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="feeding-page__card-btn feeding-page__card-btn--delete"
                          onClick={(e) => void handleDelete(r, e)}
                          aria-label={`Excluir registro de ${r.lotName}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="feeding-page__card-tags">
                      <span className="feeding-page__tag feeding-page__tag--shift">
                        {r.shiftLabel}
                      </span>
                      <span className="feeding-page__tag feeding-page__tag--animals">
                        {r.animalCount} animais
                      </span>
                      {alertConfig && (
                        <span
                          className={`feeding-page__tag feeding-page__tag--alert feeding-page__tag--${alertConfig.className}`}
                        >
                          <AlertTriangle size={12} aria-hidden="true" />
                          {alertConfig.label}
                        </span>
                      )}
                      {r.totalLeftoverKg == null && (
                        <span className="feeding-page__tag feeding-page__tag--pending">
                          Sobras pendentes
                        </span>
                      )}
                    </div>

                    <div className="feeding-page__card-details">
                      <span className="feeding-page__detail">
                        <Calendar size={14} aria-hidden="true" />
                        {new Date(r.feedingDate + 'T12:00:00').toLocaleDateString('pt-BR')}
                      </span>
                      <span className="feeding-page__detail feeding-page__detail--mono">
                        {r.totalProvidedKg.toFixed(1)}kg forn.
                      </span>
                      {r.totalConsumedKg != null && (
                        <span className="feeding-page__detail feeding-page__detail--mono">
                          {r.totalConsumedKg.toFixed(1)}kg cons.
                        </span>
                      )}
                      {r.leftoverPercent != null && (
                        <span className="feeding-page__detail feeding-page__detail--mono">
                          {r.leftoverPercent.toFixed(1)}% sobra
                        </span>
                      )}
                    </div>

                    {r.consumptionPerAnimalKg != null && (
                      <div className="feeding-page__card-per-animal">
                        Consumo/animal: <strong>{r.consumptionPerAnimalKg.toFixed(2)} kg</strong>
                      </div>
                    )}

                    <div className="feeding-page__card-responsible">{r.responsibleName}</div>
                  </div>
                );
              })}
            </div>
          )}

          {meta && meta.totalPages > 1 && (
            <nav className="feeding-page__pagination" aria-label="Paginação">
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
        </div>
      )}

      {/* ═══ TAB: INDICADORES ══════════════════════════════════════ */}
      {activeTab === 'indicators' && (
        <div className="feeding-page__panel" role="tabpanel">
          <div className="feeding-page__indicator-filter">
            <label htmlFor="indicator-lot">Lote</label>
            <select
              id="indicator-lot"
              value={indicatorLotId}
              onChange={(e) => setIndicatorLotId(e.target.value)}
            >
              <option value="">Todos os lotes</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name}
                </option>
              ))}
            </select>
          </div>

          {indicatorsLoading && (
            <div className="feeding-page__loading">Carregando indicadores...</div>
          )}

          {!indicatorsLoading && indicators && (
            <>
              {/* Stats cards */}
              <div className="feeding-page__stats">
                <div className="feeding-page__stat-card">
                  <TrendingUp size={24} aria-hidden="true" className="feeding-page__stat-icon" />
                  <div className="feeding-page__stat-content">
                    <span className="feeding-page__stat-label">MS/Animal/Dia (real)</span>
                    <span className="feeding-page__stat-value">
                      {indicators.averageDmPerAnimalDay != null
                        ? `${indicators.averageDmPerAnimalDay.toFixed(2)} kg`
                        : '—'}
                    </span>
                  </div>
                </div>
                <div className="feeding-page__stat-card">
                  <TrendingUp
                    size={24}
                    aria-hidden="true"
                    className="feeding-page__stat-icon feeding-page__stat-icon--planned"
                  />
                  <div className="feeding-page__stat-content">
                    <span className="feeding-page__stat-label">MS/Animal/Dia (planejado)</span>
                    <span className="feeding-page__stat-value">
                      {indicators.plannedDmPerAnimalDay != null
                        ? `${indicators.plannedDmPerAnimalDay.toFixed(2)} kg`
                        : '—'}
                    </span>
                    {indicators.dmVariancePercent != null && (
                      <span
                        className={`feeding-page__stat-variance ${indicators.dmVariancePercent < 0 ? 'feeding-page__stat-variance--negative' : ''}`}
                      >
                        {indicators.dmVariancePercent > 0 ? '+' : ''}
                        {indicators.dmVariancePercent.toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="feeding-page__stat-card">
                  <DollarSign
                    size={24}
                    aria-hidden="true"
                    className="feeding-page__stat-icon feeding-page__stat-icon--cost"
                  />
                  <div className="feeding-page__stat-content">
                    <span className="feeding-page__stat-label">Custo/Animal/Dia</span>
                    <span className="feeding-page__stat-value">
                      {indicators.costPerAnimalDay != null
                        ? `R$ ${indicators.costPerAnimalDay.toFixed(2)}`
                        : '—'}
                    </span>
                  </div>
                </div>
                <div className="feeding-page__stat-card">
                  <Milk
                    size={24}
                    aria-hidden="true"
                    className="feeding-page__stat-icon feeding-page__stat-icon--milk"
                  />
                  <div className="feeding-page__stat-content">
                    <span className="feeding-page__stat-label">Custo/Litro de Leite</span>
                    <span className="feeding-page__stat-value">
                      {indicators.costPerLiterMilk != null
                        ? `R$ ${indicators.costPerLiterMilk.toFixed(2)}`
                        : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Consumption evolution */}
              {indicators.consumptionEvolution.length > 0 && (
                <div className="feeding-page__evolution">
                  <h3>Evolução do consumo</h3>
                  <div className="feeding-page__evolution-chart">
                    {indicators.consumptionEvolution.map((point) => {
                      const maxKg = Math.max(
                        ...indicators.consumptionEvolution.map((p) => p.totalProvidedKg),
                      );
                      const barHeight = maxKg > 0 ? (point.totalConsumedKg / maxKg) * 100 : 0;
                      const providedHeight = maxKg > 0 ? (point.totalProvidedKg / maxKg) * 100 : 0;

                      return (
                        <div key={point.date} className="feeding-page__bar-group">
                          <div className="feeding-page__bars">
                            <div
                              className="feeding-page__bar feeding-page__bar--provided"
                              style={{ height: `${providedHeight}%` }}
                              title={`Fornecido: ${point.totalProvidedKg.toFixed(0)}kg`}
                            />
                            <div
                              className="feeding-page__bar feeding-page__bar--consumed"
                              style={{ height: `${barHeight}%` }}
                              title={`Consumido: ${point.totalConsumedKg.toFixed(0)}kg`}
                            />
                          </div>
                          <span className="feeding-page__bar-label">
                            {new Date(point.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                            })}
                          </span>
                          <span className="feeding-page__bar-value">
                            {point.consumptionPerAnimalKg.toFixed(1)}kg/cab
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="feeding-page__legend">
                    <span className="feeding-page__legend-item">
                      <span className="feeding-page__legend-dot feeding-page__legend-dot--provided" />
                      Fornecido
                    </span>
                    <span className="feeding-page__legend-item">
                      <span className="feeding-page__legend-dot feeding-page__legend-dot--consumed" />
                      Consumido
                    </span>
                  </div>
                </div>
              )}

              {indicators.consumptionEvolution.length === 0 && (
                <div className="feeding-page__empty feeding-page__empty--small">
                  <BarChart3 size={32} aria-hidden="true" />
                  <p>Sem dados de consumo no período selecionado.</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modal */}
      <FeedingModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setLeftoverRecord(null);
        }}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
        feedingRecord={leftoverRecord}
      />
    </section>
  );
}
