import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Filter,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  MapPin,
  Bug,
  Shield,
  Beaker,
} from 'lucide-react';
import { useMonitoringRecommendations } from '@/hooks/useMonitoringRecommendations';
import { usePests } from '@/hooks/usePests';
import { api } from '@/services/api';
import type { RecommendationItem, RecommendationAffectedPoint } from '@/types/monitoring-record';
import './MonitoringRecommendationsPage.css';

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'increasing':
      return (
        <TrendingUp size={16} aria-hidden="true" className="mrc__trend-icon mrc__trend-icon--up" />
      );
    case 'decreasing':
      return (
        <TrendingDown
          size={16}
          aria-hidden="true"
          className="mrc__trend-icon mrc__trend-icon--down"
        />
      );
    case 'stable':
      return (
        <Minus size={16} aria-hidden="true" className="mrc__trend-icon mrc__trend-icon--stable" />
      );
    default:
      return (
        <HelpCircle
          size={16}
          aria-hidden="true"
          className="mrc__trend-icon mrc__trend-icon--unknown"
        />
      );
  }
}

function MonitoringRecommendationsPage() {
  const { farmId = '', fieldPlotId = '' } = useParams<{
    farmId: string;
    fieldPlotId: string;
  }>();

  const [filterPestId, setFilterPestId] = useState('');
  const [filterUrgency, setFilterUrgency] = useState<'' | 'ALERTA' | 'CRITICO'>('');
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [plotName, setPlotName] = useState('');

  const { recommendations, summary, isLoading, error } = useMonitoringRecommendations({
    farmId,
    fieldPlotId,
    pestId: filterPestId || undefined,
    urgency: filterUrgency || undefined,
  });

  const { pests } = usePests({ limit: 100 });

  useEffect(() => {
    async function fetchPlotData() {
      try {
        const result = await api.get<{
          plots: Array<{ id: string; name: string }>;
        }>(`/org/farms/${farmId}/plots`);
        const plot = result.plots.find((p) => p.id === fieldPlotId);
        if (plot) setPlotName(plot.name);
      } catch {
        // ignore
      }
    }
    if (farmId && fieldPlotId) void fetchPlotData();
  }, [farmId, fieldPlotId]);

  const handleClearFilters = () => {
    setFilterPestId('');
    setFilterUrgency('');
  };

  const hasActiveFilters = !!filterPestId || !!filterUrgency;

  const toggleExpand = (pestId: string) => {
    setExpandedCard((prev) => (prev === pestId ? null : pestId));
  };

  return (
    <section className="mrc">
      {/* Breadcrumb */}
      <nav className="mrc__breadcrumb" aria-label="Navegação">
        <Link to={`/farms/${farmId}/plots/${fieldPlotId}/monitoring-points`} className="mrc__back">
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar aos pontos
        </Link>
      </nav>

      {/* Header */}
      <div className="mrc__header">
        <div className="mrc__header-text">
          <h1 className="mrc__title">Recomendações de Controle</h1>
          <p className="mrc__subtitle">
            {plotName
              ? `Recomendações automáticas de ação — ${plotName}`
              : 'Sugestões baseadas em dados dos monitoramentos'}
          </p>
        </div>
        <div className="mrc__header-actions">
          <button
            type="button"
            className={`mrc__btn mrc__btn--secondary ${hasActiveFilters ? 'mrc__btn--active' : ''}`}
            onClick={() => setShowFilters((v) => !v)}
            aria-expanded={showFilters}
            aria-controls="mrc-filters"
          >
            <Filter size={20} aria-hidden="true" />
            Filtros
            {hasActiveFilters && <span className="mrc__filter-badge" aria-label="Filtros ativos" />}
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="mrc__filters" id="mrc-filters">
          <div className="mrc__filter-field">
            <label htmlFor="mrc-filter-pest" className="mrc__filter-label">
              Praga
            </label>
            <select
              id="mrc-filter-pest"
              className="mrc__filter-select"
              value={filterPestId}
              onChange={(e) => setFilterPestId(e.target.value)}
            >
              <option value="">Todas</option>
              {pests.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.commonName}
                </option>
              ))}
            </select>
          </div>
          <div className="mrc__filter-field">
            <label htmlFor="mrc-filter-urgency" className="mrc__filter-label">
              Urgência
            </label>
            <select
              id="mrc-filter-urgency"
              className="mrc__filter-select"
              value={filterUrgency}
              onChange={(e) => setFilterUrgency(e.target.value as '' | 'ALERTA' | 'CRITICO')}
            >
              <option value="">Todas</option>
              <option value="CRITICO">Crítico</option>
              <option value="ALERTA">Alerta</option>
            </select>
          </div>
          {hasActiveFilters && (
            <button type="button" className="mrc__btn mrc__btn--ghost" onClick={handleClearFilters}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mrc__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <>
          <div className="mrc__skeleton-summary" aria-label="Carregando resumo">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mrc__skeleton-card" />
            ))}
          </div>
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="mrc__skeleton-rec" aria-label="Carregando recomendação" />
          ))}
        </>
      )}

      {/* Empty state */}
      {!isLoading && !error && recommendations.length === 0 && (
        <div className="mrc__empty">
          <Lightbulb size={48} aria-hidden="true" className="mrc__empty-icon" />
          <h2 className="mrc__empty-title">Nenhuma recomendação no momento</h2>
          <p className="mrc__empty-desc">
            {summary && summary.totalRecommendations === 0
              ? 'Nenhuma praga atingiu o nível de controle (NC) nos últimos 30 dias. Continue monitorando.'
              : 'Nenhuma praga com limiar de controle configurado ou sem registros recentes. Configure o NC na biblioteca de pragas.'}
          </p>
          <div className="mrc__empty-actions">
            <Link
              to={`/farms/${farmId}/plots/${fieldPlotId}/monitoring-records`}
              className="mrc__btn mrc__btn--secondary"
            >
              Ver registros
            </Link>
            <Link to="/pests" className="mrc__btn mrc__btn--primary">
              Configurar pragas
            </Link>
          </div>
        </div>
      )}

      {/* Data loaded */}
      {!isLoading && !error && recommendations.length > 0 && (
        <>
          {/* Summary cards */}
          {summary && (
            <div className="mrc__summary-grid">
              <div className="mrc__summary-card">
                <p className="mrc__summary-card-label">Total de alertas</p>
                <p className="mrc__summary-card-value">{summary.totalRecommendations}</p>
              </div>
              <div className="mrc__summary-card mrc__summary-card--critical">
                <p className="mrc__summary-card-label">
                  <ShieldAlert size={16} aria-hidden="true" />
                  Críticos
                </p>
                <p className="mrc__summary-card-value">{summary.criticalCount}</p>
              </div>
              <div className="mrc__summary-card mrc__summary-card--alert">
                <p className="mrc__summary-card-label">
                  <AlertTriangle size={16} aria-hidden="true" />
                  Alertas
                </p>
                <p className="mrc__summary-card-value">{summary.alertCount}</p>
              </div>
              <div className="mrc__summary-card">
                <p className="mrc__summary-card-label">
                  <MapPin size={16} aria-hidden="true" />
                  Pontos afetados
                </p>
                <p className="mrc__summary-card-value">{summary.totalAffectedPoints}</p>
              </div>
            </div>
          )}

          {/* Disclaimer */}
          <div className="mrc__disclaimer" role="note">
            <Lightbulb size={16} aria-hidden="true" />
            <span>
              As recomendações são sugestões baseadas em dados dos monitoramentos. A decisão final é
              do agrônomo responsável.
            </span>
          </div>

          {/* Recommendation cards */}
          <div className="mrc__recommendations">
            {recommendations.map((rec) => (
              <RecommendationCard
                key={rec.pestId}
                rec={rec}
                isExpanded={expandedCard === rec.pestId}
                onToggle={() => toggleExpand(rec.pestId)}
                farmId={farmId}
                fieldPlotId={fieldPlotId}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function RecommendationCard({
  rec,
  isExpanded,
  onToggle,
  farmId,
  fieldPlotId,
}: {
  rec: RecommendationItem;
  isExpanded: boolean;
  onToggle: () => void;
  farmId: string;
  fieldPlotId: string;
}) {
  const urgencyClass = rec.urgency === 'CRITICO' ? 'mrc__rec--critical' : 'mrc__rec--alert';

  return (
    <article className={`mrc__rec ${urgencyClass}`}>
      {/* Card header */}
      <div className="mrc__rec-header">
        <div className="mrc__rec-header-left">
          <Bug size={20} aria-hidden="true" className="mrc__rec-icon" />
          <div>
            <h3 className="mrc__rec-name">{rec.pestName}</h3>
            <p className="mrc__rec-meta">
              {rec.pestCategoryLabel}
              {rec.severityLabel && ` · Severidade ${rec.severityLabel}`}
            </p>
          </div>
        </div>
        <div className="mrc__rec-header-right">
          <span className={`mrc__urgency-badge mrc__urgency-badge--${rec.urgency.toLowerCase()}`}>
            {rec.urgency === 'CRITICO' ? (
              <ShieldAlert size={14} aria-hidden="true" />
            ) : (
              <AlertTriangle size={14} aria-hidden="true" />
            )}
            {rec.urgencyLabel}
          </span>
        </div>
      </div>

      {/* Key info row */}
      <div className="mrc__rec-info">
        <div className="mrc__rec-info-item">
          <span className="mrc__rec-info-label">Nível atual (máx.)</span>
          <span className={`mrc__badge mrc__badge--${rec.maxLevel.toLowerCase()}`}>
            {rec.maxLevelLabel}
          </span>
        </div>
        <div className="mrc__rec-info-item">
          <span className="mrc__rec-info-label">Limiar de controle (NC)</span>
          <span className="mrc__rec-info-value">{rec.controlThresholdLabel}</span>
        </div>
        <div className="mrc__rec-info-item">
          <span className="mrc__rec-info-label">Pontos afetados</span>
          <span className="mrc__rec-info-value">{rec.affectedPointCount}</span>
        </div>
        <div className="mrc__rec-info-item">
          <span className="mrc__rec-info-label">Tendência</span>
          <span className="mrc__rec-info-value mrc__rec-trend">
            <TrendIcon trend={rec.trend} />
            {rec.trendLabel}
          </span>
        </div>
        {rec.avgDamagePercentage !== null && (
          <div className="mrc__rec-info-item">
            <span className="mrc__rec-info-label">Dano médio</span>
            <span className="mrc__rec-info-value">{rec.avgDamagePercentage}%</span>
          </div>
        )}
        {rec.hasNaturalEnemies && (
          <div className="mrc__rec-info-item">
            <span className="mrc__rec-info-label">Inimigos naturais</span>
            <span className="mrc__rec-info-value mrc__rec-info-value--positive">
              <Shield size={14} aria-hidden="true" />
              Presentes
            </span>
          </div>
        )}
      </div>

      {/* NDE/NC descriptions */}
      {(rec.ndeDescription || rec.ncDescription) && (
        <div className="mrc__rec-thresholds">
          {rec.ndeDescription && (
            <div className="mrc__rec-threshold">
              <span className="mrc__rec-threshold-label">Nível de Dano Econômico (NDE)</span>
              <span className="mrc__rec-threshold-value">{rec.ndeDescription}</span>
            </div>
          )}
          {rec.ncDescription && (
            <div className="mrc__rec-threshold">
              <span className="mrc__rec-threshold-label">Nível de Controle (NC)</span>
              <span className="mrc__rec-threshold-value">{rec.ncDescription}</span>
            </div>
          )}
        </div>
      )}

      {/* Recommended products */}
      {rec.recommendedProducts && (
        <div className="mrc__rec-products">
          <h4 className="mrc__rec-products-title">
            <Beaker size={16} aria-hidden="true" />
            Produtos recomendados
          </h4>
          <p className="mrc__rec-products-text">{rec.recommendedProducts}</p>
        </div>
      )}

      {/* Expand/collapse for affected points */}
      <button
        type="button"
        className="mrc__btn mrc__btn--ghost mrc__rec-expand"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`mrc-points-${rec.pestId}`}
      >
        <MapPin size={16} aria-hidden="true" />
        {isExpanded
          ? 'Ocultar pontos afetados'
          : `Ver ${rec.affectedPointCount} ponto${rec.affectedPointCount > 1 ? 's' : ''} afetado${rec.affectedPointCount > 1 ? 's' : ''}`}
      </button>

      {/* Affected points list */}
      {isExpanded && (
        <div className="mrc__rec-points" id={`mrc-points-${rec.pestId}`}>
          {/* Desktop table */}
          <div className="mrc__points-table-wrapper">
            <table className="mrc__points-table">
              <caption className="sr-only">Pontos afetados por {rec.pestName}</caption>
              <thead>
                <tr>
                  <th scope="col">Ponto</th>
                  <th scope="col">Nível atual</th>
                  <th scope="col">Dano (%)</th>
                  <th scope="col">Última observação</th>
                </tr>
              </thead>
              <tbody>
                {rec.affectedPoints.map((pt: RecommendationAffectedPoint) => (
                  <tr key={pt.monitoringPointId}>
                    <td className="mrc__point-code">{pt.code}</td>
                    <td>
                      <span className={`mrc__badge mrc__badge--${pt.currentLevel.toLowerCase()}`}>
                        {pt.currentLevelLabel}
                      </span>
                    </td>
                    <td>{pt.damagePercentage !== null ? `${pt.damagePercentage}%` : '—'}</td>
                    <td>{new Date(pt.lastObservedAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="mrc__points-cards">
            {rec.affectedPoints.map((pt: RecommendationAffectedPoint) => (
              <div key={pt.monitoringPointId} className="mrc__point-card">
                <div className="mrc__point-card-header">
                  <span className="mrc__point-code">{pt.code}</span>
                  <span className={`mrc__badge mrc__badge--${pt.currentLevel.toLowerCase()}`}>
                    {pt.currentLevelLabel}
                  </span>
                </div>
                <div className="mrc__point-card-row">
                  <span className="mrc__point-card-label">Dano</span>
                  <span>{pt.damagePercentage !== null ? `${pt.damagePercentage}%` : '—'}</span>
                </div>
                <div className="mrc__point-card-row">
                  <span className="mrc__point-card-label">Última obs.</span>
                  <span>{new Date(pt.lastObservedAt).toLocaleDateString('pt-BR')}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Link to heatmap */}
          <Link
            to={`/farms/${farmId}/plots/${fieldPlotId}/monitoring-heatmap?pestId=${rec.pestId}`}
            className="mrc__btn mrc__btn--secondary mrc__rec-heatmap-link"
          >
            Ver no mapa de calor
          </Link>
        </div>
      )}
    </article>
  );
}

export default MonitoringRecommendationsPage;
