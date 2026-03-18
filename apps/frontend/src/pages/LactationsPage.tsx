import { useState, useCallback, useMemo } from 'react';
import {
  Plus,
  Droplets,
  AlertCircle,
  CheckCircle,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Calendar,
  TrendingUp,
  Calculator,
  Star,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import {
  useActiveLactations,
  useDryingAlerts,
  useLactations,
  useLactationCurve,
} from '@/hooks/useLactations';
import type { LactationItem, DryingAlertItem } from '@/types/lactation';
import { ORIGIN_CONFIG, STATUS_CONFIG, DRYING_REASON_CONFIG } from '@/types/lactation';
import LactationModal from '@/components/lactations/LactationModal';
import InductionModal from '@/components/lactations/InductionModal';
import DryOffModal from '@/components/lactations/DryOffModal';
import { api } from '@/services/api';
import './LactationsPage.css';

type TabId = 'active' | 'curve' | 'alerts' | 'history';

export default function LactationsPage() {
  const { selectedFarm } = useFarmContext();

  const [activeTab, setActiveTab] = useState<TabId>('active');
  const [showLactationModal, setShowLactationModal] = useState(false);
  const [showInductionModal, setShowInductionModal] = useState(false);
  const [dryOffLactation, setDryOffLactation] = useState<LactationItem | null>(null);
  const [curveLactation, setCurveLactation] = useState<LactationItem | null>(null);
  const [historyStatusFilter, setHistoryStatusFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const farmId = selectedFarm?.id ?? null;

  const {
    lactations: activeLactations,
    isLoading: activeLoading,
    error: activeError,
    refetch: refetchActive,
  } = useActiveLactations(farmId);

  const {
    alerts,
    isLoading: alertsLoading,
    error: alertsError,
    refetch: refetchAlerts,
  } = useDryingAlerts(farmId);

  const {
    lactations: historyLactations,
    total: historyTotal,
    isLoading: historyLoading,
    error: historyError,
    refetch: refetchHistory,
  } = useLactations({
    farmId,
    page: historyPage,
    limit: 50,
    status: historyStatusFilter || undefined,
  });

  const {
    points: curvePoints,
    isLoading: curveLoading,
    error: curveError,
  } = useLactationCurve(farmId, curveLactation?.id ?? null);

  const historyTotalPages = Math.ceil(historyTotal / 50) || 1;

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchActive(), refetchAlerts(), refetchHistory()]);
  }, [refetchActive, refetchAlerts, refetchHistory]);

  const showSuccess = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, []);

  const handleLactationSuccess = useCallback(() => {
    setShowLactationModal(false);
    showSuccess('Lactação registrada com sucesso');
    void refetchAll();
  }, [refetchAll, showSuccess]);

  const handleInductionSuccess = useCallback(() => {
    setShowInductionModal(false);
    showSuccess('Indução de lactação registrada com sucesso');
    void refetchAll();
  }, [refetchAll, showSuccess]);

  const handleDryOffSuccess = useCallback(() => {
    setDryOffLactation(null);
    showSuccess('Secagem registrada com sucesso');
    void refetchAll();
  }, [refetchAll, showSuccess]);

  const handleDelete = useCallback(
    async (lact: LactationItem) => {
      setActionError(null);
      if (!window.confirm('Excluir esta lactação? Esta ação não pode ser desfeita.')) return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/lactations/${lact.id}`);
        showSuccess('Lactação excluída com sucesso');
        void refetchAll();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : 'Erro ao excluir lactação.');
      }
    },
    [refetchAll, selectedFarm, showSuccess],
  );

  const handleCalculate = useCallback(
    async (lact: LactationItem) => {
      setActionError(null);
      try {
        await api.post(`/org/farms/${selectedFarm!.id}/lactations/${lact.id}/calculate`);
        showSuccess('Indicadores recalculados com sucesso');
        void refetchAll();
      } catch (err: unknown) {
        setActionError(err instanceof Error ? err.message : 'Erro ao recalcular indicadores.');
      }
    },
    [refetchAll, selectedFarm, showSuccess],
  );

  const handleViewCurve = useCallback((lact: LactationItem) => {
    setCurveLactation(lact);
    setActiveTab('curve');
  }, []);

  const handleDryFromAlert = useCallback(
    (alert: DryingAlertItem) => {
      const lact = activeLactations.find((l) => l.id === alert.lactationId);
      if (lact) {
        setDryOffLactation(lact);
      }
    },
    [activeLactations],
  );

  // Curve calculations
  const maxLiters = useMemo(() => {
    if (curvePoints.length === 0) return 1;
    return Math.max(...curvePoints.map((p) => p.liters));
  }, [curvePoints]);

  const peakPoint = useMemo(() => {
    if (curvePoints.length === 0) return null;
    return curvePoints.reduce((best, p) => (p.liters > best.liters ? p : best), curvePoints[0]);
  }, [curvePoints]);

  const accumulated = useMemo(() => {
    return curvePoints.reduce((sum, p) => sum + p.liters, 0);
  }, [curvePoints]);

  if (!selectedFarm) {
    return (
      <section className="lact-page">
        <div className="lact-page__empty">
          <Droplets size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para gerenciar as lactações.</p>
        </div>
      </section>
    );
  }

  const currentError = activeError || alertsError || historyError || actionError;

  return (
    <section className="lact-page">
      <header className="lact-page__header">
        <div>
          <h1>Lactação e secagem</h1>
          <p>Controle de lactação, secagem e indução de {selectedFarm.name}</p>
        </div>
        <div className="lact-page__actions">
          <button
            type="button"
            className="lact-page__btn-secondary"
            onClick={() => setShowInductionModal(true)}
          >
            <TrendingUp size={20} aria-hidden="true" />
            Induzir lactação
          </button>
          <button
            type="button"
            className="lact-page__btn-primary"
            onClick={() => setShowLactationModal(true)}
          >
            <Plus size={20} aria-hidden="true" />
            Nova lactação
          </button>
        </div>
      </header>

      {successMsg && (
        <div className="lact-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {currentError && (
        <div className="lact-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {currentError}
        </div>
      )}

      {/* Tabs */}
      <nav className="lact-page__tabs" aria-label="Abas de lactação">
        <button
          type="button"
          className={`lact-page__tab ${activeTab === 'active' ? 'lact-page__tab--active' : ''}`}
          onClick={() => setActiveTab('active')}
          aria-selected={activeTab === 'active'}
          role="tab"
        >
          <Droplets size={16} aria-hidden="true" />
          Lactações ativas
          {activeLactations.length > 0 && (
            <span className="lact-page__tab-badge lact-page__tab-badge--count">
              {activeLactations.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`lact-page__tab ${activeTab === 'alerts' ? 'lact-page__tab--active' : ''}`}
          onClick={() => setActiveTab('alerts')}
          aria-selected={activeTab === 'alerts'}
          role="tab"
        >
          <AlertTriangle size={16} aria-hidden="true" />
          Alertas secagem
          {alerts.length > 0 && (
            <span className="lact-page__tab-badge lact-page__tab-badge--alert">
              {alerts.length}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`lact-page__tab ${activeTab === 'history' ? 'lact-page__tab--active' : ''}`}
          onClick={() => setActiveTab('history')}
          aria-selected={activeTab === 'history'}
          role="tab"
        >
          <Clock size={16} aria-hidden="true" />
          Histórico
        </button>
        {curveLactation && (
          <button
            type="button"
            className={`lact-page__tab ${activeTab === 'curve' ? 'lact-page__tab--active' : ''}`}
            onClick={() => setActiveTab('curve')}
            aria-selected={activeTab === 'curve'}
            role="tab"
          >
            <TrendingUp size={16} aria-hidden="true" />
            Curva
          </button>
        )}
      </nav>

      {/* ── Active Lactations Tab ──────────────────────────────────── */}
      {activeTab === 'active' && (
        <>
          {activeLoading && (
            <div className="lact-page__loading">Carregando lactações ativas...</div>
          )}

          {!activeLoading && activeLactations.length === 0 && (
            <div className="lact-page__empty">
              <Droplets size={48} aria-hidden="true" />
              <h2>Nenhuma lactação ativa</h2>
              <p>Registre uma nova lactação ou induza lactação usando os botões acima.</p>
            </div>
          )}

          {!activeLoading && activeLactations.length > 0 && (
            <div className="lact-page__grid">
              {activeLactations.map((lact) => {
                const originCfg =
                  ORIGIN_CONFIG[lact.origin as keyof typeof ORIGIN_CONFIG] ?? ORIGIN_CONFIG.BIRTH;

                return (
                  <div key={lact.id} className="lact-page__card">
                    <div className="lact-page__card-header">
                      <div>
                        <h3 className="lact-page__card-title">
                          {lact.animalEarTag} — {lact.animalName || 'Sem nome'}
                        </h3>
                        <p className="lact-page__card-subtitle">Lactação #{lact.lactationNumber}</p>
                      </div>
                      <div className="lact-page__card-actions">
                        <button
                          type="button"
                          className="lact-page__card-btn lact-page__card-btn--delete"
                          onClick={() => void handleDelete(lact)}
                          aria-label={`Excluir lactação de ${lact.animalEarTag}`}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="lact-page__del">
                      <span className="lact-page__del-value">{lact.del}</span>
                      <span className="lact-page__del-label">DEL</span>
                    </div>

                    <div className="lact-page__card-tags">
                      <span className={`lact-page__tag ${originCfg.className}`}>
                        {lact.originLabel}
                      </span>
                      <span className="lact-page__tag lact-page__tag--lactation-num">
                        #{lact.lactationNumber}
                      </span>
                    </div>

                    <div className="lact-page__card-stats">
                      {lact.peakLiters != null && (
                        <div className="lact-page__stat">
                          <span className="lact-page__stat-label">PICO</span>
                          <span className="lact-page__stat-value lact-page__stat-value--peak">
                            <Star size={12} aria-hidden="true" />
                            {lact.peakLiters.toFixed(1)} L (DEL {lact.peakDel})
                          </span>
                        </div>
                      )}
                      {lact.accumulated305 != null && (
                        <div className="lact-page__stat">
                          <span className="lact-page__stat-label">305D</span>
                          <span className="lact-page__stat-value">
                            {lact.accumulated305.toFixed(0)} L
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="lact-page__card-details">
                      <span className="lact-page__detail">
                        <Calendar size={14} aria-hidden="true" />
                        {new Date(lact.startDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <div className="lact-page__card-footer">
                      <button
                        type="button"
                        className="lact-page__card-action"
                        onClick={() => handleViewCurve(lact)}
                      >
                        <TrendingUp size={14} aria-hidden="true" />
                        Curva
                      </button>
                      <button
                        type="button"
                        className="lact-page__card-action"
                        onClick={() => void handleCalculate(lact)}
                      >
                        <Calculator size={14} aria-hidden="true" />
                        Recalcular
                      </button>
                      <button
                        type="button"
                        className="lact-page__card-action lact-page__card-action--dryoff"
                        onClick={() => setDryOffLactation(lact)}
                      >
                        <AlertTriangle size={14} aria-hidden="true" />
                        Secar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── Curve Tab ──────────────────────────────────────────────── */}
      {activeTab === 'curve' && curveLactation && (
        <div className="lact-page__curve">
          <div className="lact-page__curve-header">
            <button
              type="button"
              className="lact-page__curve-back"
              onClick={() => {
                setActiveTab('active');
                setCurveLactation(null);
              }}
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Voltar
            </button>
            <h2 className="lact-page__curve-title">
              Curva de lactação — {curveLactation.animalEarTag} (#{curveLactation.lactationNumber})
            </h2>
          </div>

          <div className="lact-page__curve-info">
            <div className="lact-page__curve-stat">
              <span className="lact-page__curve-stat-label">DEL ATUAL</span>
              <span className="lact-page__curve-stat-value">{curveLactation.del}</span>
            </div>
            {peakPoint && (
              <div className="lact-page__curve-stat">
                <span className="lact-page__curve-stat-label">PICO</span>
                <span className="lact-page__curve-stat-value">
                  {peakPoint.liters.toFixed(1)} L (DEL {peakPoint.del})
                </span>
              </div>
            )}
            <div className="lact-page__curve-stat">
              <span className="lact-page__curve-stat-label">ACUMULADO</span>
              <span className="lact-page__curve-stat-value">{accumulated.toFixed(0)} L</span>
            </div>
            {curveLactation.accumulated305 != null && (
              <div className="lact-page__curve-stat">
                <span className="lact-page__curve-stat-label">305 DIAS</span>
                <span className="lact-page__curve-stat-value">
                  {curveLactation.accumulated305.toFixed(0)} L
                </span>
              </div>
            )}
          </div>

          {curveLoading && (
            <div className="lact-page__loading">Carregando curva de lactação...</div>
          )}

          {curveError && (
            <div className="lact-page__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {curveError}
            </div>
          )}

          {!curveLoading && curvePoints.length === 0 && !curveError && (
            <div className="lact-page__curve-empty">
              Nenhum dado de produção disponível para esta lactação.
            </div>
          )}

          {!curveLoading && curvePoints.length > 0 && (
            <div className="lact-page__curve-chart" role="img" aria-label="Curva de lactação">
              {curvePoints.map((point) => {
                const isPeak = peakPoint && point.del === peakPoint.del;
                const widthPct = maxLiters > 0 ? (point.liters / maxLiters) * 100 : 0;
                return (
                  <div key={point.del} className="lact-page__curve-row">
                    <span className="lact-page__curve-del">{point.del}</span>
                    <div className="lact-page__curve-bar-bg">
                      <div
                        className={`lact-page__curve-bar ${isPeak ? 'lact-page__curve-bar--peak' : ''}`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span
                      className={`lact-page__curve-liters ${isPeak ? 'lact-page__curve-liters--peak' : ''}`}
                    >
                      {point.liters.toFixed(1)} L
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Alerts Tab ─────────────────────────────────────────────── */}
      {activeTab === 'alerts' && (
        <>
          {alertsLoading && (
            <div className="lact-page__loading">Carregando alertas de secagem...</div>
          )}

          {!alertsLoading && alerts.length === 0 && (
            <div className="lact-page__empty">
              <AlertTriangle size={48} aria-hidden="true" />
              <h2>Nenhum alerta de secagem</h2>
              <p>Todas as lactações ativas estão dentro dos parâmetros esperados.</p>
            </div>
          )}

          {!alertsLoading && alerts.length > 0 && (
            <>
              {/* Desktop table */}
              <table className="lact-page__alerts-table">
                <caption>Vacas que precisam de atenção para secagem</caption>
                <thead>
                  <tr>
                    <th scope="col">Animal</th>
                    <th scope="col">DEL</th>
                    <th scope="col">Produção atual</th>
                    <th scope="col">Motivo</th>
                    <th scope="col">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((alert) => {
                    const reasonCfg = DRYING_REASON_CONFIG[alert.reason] ?? {
                      label: alert.reason,
                      className: '',
                    };
                    return (
                      <tr key={alert.lactationId}>
                        <td>
                          <strong>{alert.earTag}</strong>
                          {alert.animalName && <span> — {alert.animalName}</span>}
                        </td>
                        <td>
                          <span className="lact-page__alert-del">{alert.del}</span>
                        </td>
                        <td>
                          {alert.currentProduction != null ? (
                            <span className="lact-page__alert-production">
                              {alert.currentProduction.toFixed(1)} L
                            </span>
                          ) : (
                            <span style={{ color: 'var(--color-neutral-400)' }}>—</span>
                          )}
                        </td>
                        <td>
                          <span className={`lact-page__alert-reason ${reasonCfg.className}`}>
                            <AlertTriangle size={12} aria-hidden="true" />
                            {reasonCfg.label}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="lact-page__alert-action"
                            onClick={() => handleDryFromAlert(alert)}
                          >
                            Secar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile cards */}
              <div className="lact-page__alerts-cards">
                {alerts.map((alert) => {
                  const reasonCfg = DRYING_REASON_CONFIG[alert.reason] ?? {
                    label: alert.reason,
                    className: '',
                  };
                  return (
                    <div key={alert.lactationId} className="lact-page__alert-card">
                      <div className="lact-page__alert-card-header">
                        <span className="lact-page__alert-card-tag">
                          {alert.earTag} — {alert.animalName || 'Sem nome'}
                        </span>
                        <span className={`lact-page__alert-reason ${reasonCfg.className}`}>
                          <AlertTriangle size={12} aria-hidden="true" />
                          {reasonCfg.label}
                        </span>
                      </div>
                      <div className="lact-page__alert-card-details">
                        <span>
                          <strong>DEL:</strong> {alert.del}
                        </span>
                        {alert.currentProduction != null && (
                          <span>
                            <strong>Produção:</strong> {alert.currentProduction.toFixed(1)} L
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="lact-page__alert-action"
                        onClick={() => handleDryFromAlert(alert)}
                      >
                        Secar
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ── History Tab ────────────────────────────────────────────── */}
      {activeTab === 'history' && (
        <>
          <div className="lact-page__history-toolbar">
            <select
              className="lact-page__history-filter"
              value={historyStatusFilter}
              onChange={(e) => {
                setHistoryStatusFilter(e.target.value);
                setHistoryPage(1);
              }}
              aria-label="Filtrar por status"
            >
              <option value="">Todos os status</option>
              <option value="IN_PROGRESS">Em andamento</option>
              <option value="DRIED">Seca</option>
            </select>
          </div>

          {historyLoading && <div className="lact-page__loading">Carregando histórico...</div>}

          {!historyLoading && historyLactations.length === 0 && (
            <div className="lact-page__empty">
              <Clock size={48} aria-hidden="true" />
              <h2>Nenhuma lactação encontrada</h2>
              <p>Não há lactações registradas com os filtros selecionados.</p>
            </div>
          )}

          {!historyLoading && historyLactations.length > 0 && (
            <div className="lact-page__grid">
              {historyLactations.map((lact) => {
                const originCfg =
                  ORIGIN_CONFIG[lact.origin as keyof typeof ORIGIN_CONFIG] ?? ORIGIN_CONFIG.BIRTH;
                const statusCfg =
                  STATUS_CONFIG[lact.status as keyof typeof STATUS_CONFIG] ??
                  STATUS_CONFIG.IN_PROGRESS;

                return (
                  <div key={lact.id} className="lact-page__card">
                    <div className="lact-page__card-header">
                      <div>
                        <h3 className="lact-page__card-title">
                          {lact.animalEarTag} — {lact.animalName || 'Sem nome'}
                        </h3>
                        <p className="lact-page__card-subtitle">Lactação #{lact.lactationNumber}</p>
                      </div>
                    </div>

                    <div className="lact-page__card-tags">
                      <span className={`lact-page__tag ${statusCfg.className}`}>
                        {lact.statusLabel}
                      </span>
                      <span className={`lact-page__tag ${originCfg.className}`}>
                        {lact.originLabel}
                      </span>
                    </div>

                    <div className="lact-page__card-stats">
                      {lact.durationDays != null && (
                        <div className="lact-page__stat">
                          <span className="lact-page__stat-label">DURAÇÃO</span>
                          <span className="lact-page__stat-value lact-page__history-duration">
                            {lact.durationDays} dias
                          </span>
                        </div>
                      )}
                      {lact.accumulated305 != null && (
                        <div className="lact-page__stat">
                          <span className="lact-page__stat-label">305D</span>
                          <span className="lact-page__stat-value">
                            {lact.accumulated305.toFixed(0)} L
                          </span>
                        </div>
                      )}
                      {lact.peakLiters != null && (
                        <div className="lact-page__stat">
                          <span className="lact-page__stat-label">PICO</span>
                          <span className="lact-page__stat-value lact-page__stat-value--peak">
                            <Star size={12} aria-hidden="true" />
                            {lact.peakLiters.toFixed(1)} L
                          </span>
                        </div>
                      )}
                      {lact.totalAccumulated != null && (
                        <div className="lact-page__stat">
                          <span className="lact-page__stat-label">TOTAL</span>
                          <span className="lact-page__stat-value">
                            {lact.totalAccumulated.toFixed(0)} L
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="lact-page__card-details">
                      <span className="lact-page__detail">
                        <Calendar size={14} aria-hidden="true" />
                        {new Date(lact.startDate).toLocaleDateString('pt-BR')}
                        {lact.endDate && (
                          <> — {new Date(lact.endDate).toLocaleDateString('pt-BR')}</>
                        )}
                      </span>
                      {lact.dryingReasonLabel && (
                        <span className="lact-page__detail">Secagem: {lact.dryingReasonLabel}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {historyTotalPages > 1 && (
            <nav className="lact-page__pagination" aria-label="Paginação do histórico">
              <button
                type="button"
                onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                disabled={historyPage <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} aria-hidden="true" />
                Anterior
              </button>
              <span>
                {historyPage} de {historyTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setHistoryPage((p) => p + 1)}
                disabled={historyPage >= historyTotalPages}
                aria-label="Próxima página"
              >
                Próxima
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </nav>
          )}
        </>
      )}

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <LactationModal
        isOpen={showLactationModal}
        onClose={() => setShowLactationModal(false)}
        farmId={selectedFarm.id}
        onSuccess={handleLactationSuccess}
      />

      <InductionModal
        isOpen={showInductionModal}
        onClose={() => setShowInductionModal(false)}
        farmId={selectedFarm.id}
        onSuccess={handleInductionSuccess}
      />

      <DryOffModal
        isOpen={!!dryOffLactation}
        onClose={() => setDryOffLactation(null)}
        lactation={dryOffLactation}
        farmId={selectedFarm.id}
        onSuccess={handleDryOffSuccess}
      />
    </section>
  );
}
