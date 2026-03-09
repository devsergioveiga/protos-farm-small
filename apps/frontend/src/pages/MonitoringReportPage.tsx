import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  AlertCircle,
  FileSpreadsheet,
  FileText,
  Calendar,
  Bug,
  MapPin,
  ClipboardList,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
  Shield,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useMonitoringReport } from '@/hooks/useMonitoringReport';
import { api } from '@/services/api';
import type { ReportPestDetail, ReportControlDecision } from '@/types/monitoring-report';
import './MonitoringReportPage.css';

function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'increasing':
      return (
        <TrendingUp size={16} aria-hidden="true" className="mrp__trend-icon mrp__trend-icon--up" />
      );
    case 'decreasing':
      return (
        <TrendingDown
          size={16}
          aria-hidden="true"
          className="mrp__trend-icon mrp__trend-icon--down"
        />
      );
    case 'stable':
      return (
        <Minus size={16} aria-hidden="true" className="mrp__trend-icon mrp__trend-icon--stable" />
      );
    default:
      return (
        <HelpCircle
          size={16}
          aria-hidden="true"
          className="mrp__trend-icon mrp__trend-icon--unknown"
        />
      );
  }
}

function MonitoringReportPage() {
  const { farmId = '' } = useParams<{ farmId: string }>();

  const [farmName, setFarmName] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expandedPest, setExpandedPest] = useState<string | null>(null);

  const { report, isLoading, error, generateReport, downloadExcel } = useMonitoringReport({
    farmId,
  });

  useEffect(() => {
    async function fetchFarmName() {
      try {
        const result = await api.get<{ id: string; name: string }>(`/org/farms/${farmId}`);
        setFarmName(result.name);
      } catch {
        // ignore
      }
    }
    if (farmId) void fetchFarmName();
  }, [farmId]);

  const handleGenerate = () => {
    void generateReport(startDate, endDate);
  };

  const handleDownloadExcel = () => {
    downloadExcel(startDate, endDate);
  };

  const togglePest = (pestId: string) => {
    setExpandedPest((prev) => (prev === pestId ? null : pestId));
  };

  return (
    <section className="mrp">
      {/* Breadcrumb */}
      <nav className="mrp__breadcrumb" aria-label="Navegação">
        <Link to={`/farms/${farmId}`} className="mrp__back">
          <ArrowLeft size={16} aria-hidden="true" />
          Voltar à fazenda
        </Link>
      </nav>

      {/* Header */}
      <div className="mrp__header">
        <div className="mrp__header-text">
          <h1 className="mrp__title">Relatório MIP para Certificadoras</h1>
          <p className="mrp__subtitle">
            {farmName
              ? `Relatório de monitoramento integrado de pragas — ${farmName}`
              : 'Gere relatórios para auditorias e certificações'}
          </p>
        </div>
      </div>

      {/* Filter form */}
      <div className="mrp__filters">
        <div className="mrp__filter-field">
          <label htmlFor="mrp-start-date" className="mrp__filter-label">
            <Calendar size={16} aria-hidden="true" />
            Data inicial *
          </label>
          <input
            id="mrp-start-date"
            type="date"
            className="mrp__filter-input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-required="true"
          />
        </div>
        <div className="mrp__filter-field">
          <label htmlFor="mrp-end-date" className="mrp__filter-label">
            <Calendar size={16} aria-hidden="true" />
            Data final *
          </label>
          <input
            id="mrp-end-date"
            type="date"
            className="mrp__filter-input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-required="true"
          />
        </div>
        <div className="mrp__filter-actions">
          <button
            type="button"
            className="mrp__btn mrp__btn--primary"
            onClick={handleGenerate}
            disabled={isLoading || !startDate || !endDate}
          >
            <FileText size={20} aria-hidden="true" />
            {isLoading ? 'Gerando...' : 'Gerar Relatório'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mrp__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <div className="mrp__loading" aria-label="Gerando relatório">
          <div className="mrp__skeleton-summary">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="mrp__skeleton-card" />
            ))}
          </div>
          <div className="mrp__skeleton-table" />
          <div className="mrp__skeleton-table" />
        </div>
      )}

      {/* Report data */}
      {!isLoading && report && (
        <div className="mrp__report">
          {/* Export button */}
          <div className="mrp__export-bar">
            <span className="mrp__generated-at">
              Gerado em {new Date(report.summary.generatedAt).toLocaleString('pt-BR')}
            </span>
            <button
              type="button"
              className="mrp__btn mrp__btn--secondary"
              onClick={handleDownloadExcel}
            >
              <FileSpreadsheet size={20} aria-hidden="true" />
              Baixar Excel
            </button>
          </div>

          {/* Summary cards */}
          <div className="mrp__summary-grid">
            <div className="mrp__summary-card">
              <p className="mrp__summary-card-label">
                <ClipboardList size={16} aria-hidden="true" />
                Registros
              </p>
              <p className="mrp__summary-card-value">{report.summary.totalMonitoringRecords}</p>
            </div>
            <div className="mrp__summary-card">
              <p className="mrp__summary-card-label">
                <Bug size={16} aria-hidden="true" />
                Pragas
              </p>
              <p className="mrp__summary-card-value">{report.summary.totalPestsMonitored}</p>
            </div>
            <div className="mrp__summary-card">
              <p className="mrp__summary-card-label">
                <MapPin size={16} aria-hidden="true" />
                Pontos
              </p>
              <p className="mrp__summary-card-value">{report.summary.totalMonitoringPoints}</p>
            </div>
            <div className="mrp__summary-card">
              <p className="mrp__summary-card-label">
                <FileText size={16} aria-hidden="true" />
                Talhões
              </p>
              <p className="mrp__summary-card-value">{report.summary.plotsIncluded.length}</p>
            </div>
          </div>

          {/* Plots included */}
          {report.summary.plotsIncluded.length > 0 && (
            <div className="mrp__section">
              <h2 className="mrp__section-title">Talhões Monitorados</h2>
              <div className="mrp__plots-table-wrapper">
                <table className="mrp__table">
                  <caption className="sr-only">Talhões incluídos no relatório</caption>
                  <thead>
                    <tr>
                      <th scope="col">Talhão</th>
                      <th scope="col">Pontos</th>
                      <th scope="col">Registros</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.summary.plotsIncluded.map((plot) => (
                      <tr key={plot.id}>
                        <td>{plot.name}</td>
                        <td>{plot.monitoringPointCount}</td>
                        <td>{plot.recordCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="mrp__plots-cards">
                {report.summary.plotsIncluded.map((plot) => (
                  <div key={plot.id} className="mrp__plot-card">
                    <p className="mrp__plot-card-name">{plot.name}</p>
                    <div className="mrp__plot-card-row">
                      <span className="mrp__plot-card-label">Pontos</span>
                      <span>{plot.monitoringPointCount}</span>
                    </div>
                    <div className="mrp__plot-card-row">
                      <span className="mrp__plot-card-label">Registros</span>
                      <span>{plot.recordCount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pest Summary */}
          {report.pestSummary.length > 0 && (
            <div className="mrp__section">
              <h2 className="mrp__section-title">Pragas Monitoradas</h2>
              <div className="mrp__pest-table-wrapper">
                <table className="mrp__table">
                  <caption className="sr-only">Resumo de pragas monitoradas</caption>
                  <thead>
                    <tr>
                      <th scope="col">Praga</th>
                      <th scope="col">Categoria</th>
                      <th scope="col">Nível Máx.</th>
                      <th scope="col">Primeira Det.</th>
                      <th scope="col">Última Det.</th>
                      <th scope="col">Registros</th>
                      <th scope="col">Pontos</th>
                      <th scope="col">Inim. Naturais</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.pestSummary.map((pest) => (
                      <tr key={pest.pestId}>
                        <td>
                          <div className="mrp__pest-name">
                            {pest.commonName}
                            {pest.scientificName && (
                              <span className="mrp__pest-scientific">{pest.scientificName}</span>
                            )}
                          </div>
                        </td>
                        <td>{pest.categoryLabel}</td>
                        <td>
                          <span
                            className={`mrp__badge mrp__badge--${pest.peakLevel.toLowerCase()}`}
                          >
                            {pest.peakLevelLabel}
                          </span>
                        </td>
                        <td className="mrp__mono">
                          {new Date(pest.firstDetected).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="mrp__mono">
                          {new Date(pest.lastDetected).toLocaleDateString('pt-BR')}
                        </td>
                        <td>{pest.recordCount}</td>
                        <td>{pest.affectedPointCount}</td>
                        <td>
                          {pest.hasNaturalEnemies ? (
                            <span className="mrp__natural-enemies">
                              <Shield size={14} aria-hidden="true" />
                              Sim
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Mobile cards */}
              <div className="mrp__pest-cards">
                {report.pestSummary.map((pest) => (
                  <div key={pest.pestId} className="mrp__pest-card">
                    <div className="mrp__pest-card-header">
                      <div className="mrp__pest-name">
                        {pest.commonName}
                        {pest.scientificName && (
                          <span className="mrp__pest-scientific">{pest.scientificName}</span>
                        )}
                      </div>
                      <span className={`mrp__badge mrp__badge--${pest.peakLevel.toLowerCase()}`}>
                        {pest.peakLevelLabel}
                      </span>
                    </div>
                    <div className="mrp__pest-card-row">
                      <span className="mrp__pest-card-label">Categoria</span>
                      <span>{pest.categoryLabel}</span>
                    </div>
                    <div className="mrp__pest-card-row">
                      <span className="mrp__pest-card-label">Período</span>
                      <span className="mrp__mono">
                        {new Date(pest.firstDetected).toLocaleDateString('pt-BR')} —{' '}
                        {new Date(pest.lastDetected).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div className="mrp__pest-card-row">
                      <span className="mrp__pest-card-label">Registros / Pontos</span>
                      <span>
                        {pest.recordCount} / {pest.affectedPointCount}
                      </span>
                    </div>
                    {pest.hasNaturalEnemies && (
                      <div className="mrp__pest-card-row">
                        <span className="mrp__natural-enemies">
                          <Shield size={14} aria-hidden="true" />
                          Inimigos naturais presentes
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed Analysis */}
          {report.detailedAnalysis.length > 0 && (
            <div className="mrp__section">
              <h2 className="mrp__section-title">Análise Detalhada por Praga</h2>
              <div className="mrp__details">
                {report.detailedAnalysis.map((detail) => (
                  <PestDetailCard
                    key={detail.pestId}
                    detail={detail}
                    isExpanded={expandedPest === detail.pestId}
                    onToggle={() => togglePest(detail.pestId)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {report.pestSummary.length === 0 && (
            <div className="mrp__empty">
              <Bug size={48} aria-hidden="true" className="mrp__empty-icon" />
              <h2 className="mrp__empty-title">Nenhum registro no período</h2>
              <p className="mrp__empty-desc">
                Não foram encontrados registros de monitoramento no período selecionado. Ajuste as
                datas ou verifique se há monitoramentos cadastrados.
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PestDetailCard({
  detail,
  isExpanded,
  onToggle,
}: {
  detail: ReportPestDetail;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const hasDecisions = detail.controlDecisions.length > 0;

  return (
    <article className={`mrp__detail ${hasDecisions ? 'mrp__detail--has-decisions' : ''}`}>
      <button
        type="button"
        className="mrp__detail-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`mrp-detail-${detail.pestId}`}
      >
        <div className="mrp__detail-header-left">
          <Bug size={20} aria-hidden="true" />
          <div>
            <h3 className="mrp__detail-name">{detail.pestName}</h3>
            {detail.scientificName && (
              <p className="mrp__detail-scientific">{detail.scientificName}</p>
            )}
          </div>
        </div>
        <div className="mrp__detail-header-right">
          <span className="mrp__detail-trend">
            <TrendIcon trend={detail.trend} />
            {detail.trendLabel}
          </span>
          {hasDecisions && (
            <span className="mrp__detail-decisions-badge">
              <AlertTriangle size={14} aria-hidden="true" />
              {detail.controlDecisions.length} decisão(ões)
            </span>
          )}
          {isExpanded ? (
            <ChevronUp size={20} aria-hidden="true" />
          ) : (
            <ChevronDown size={20} aria-hidden="true" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="mrp__detail-body" id={`mrp-detail-${detail.pestId}`}>
          {/* NDE/NC info */}
          {(detail.ndeDescription || detail.ncDescription) && (
            <div className="mrp__detail-thresholds">
              {detail.ndeDescription && (
                <div className="mrp__detail-threshold">
                  <span className="mrp__detail-threshold-label">NDE</span>
                  <span>{detail.ndeDescription}</span>
                </div>
              )}
              {detail.ncDescription && (
                <div className="mrp__detail-threshold">
                  <span className="mrp__detail-threshold-label">NC</span>
                  <span>{detail.ncDescription}</span>
                </div>
              )}
            </div>
          )}

          {/* Recommended products */}
          {detail.recommendedProducts && (
            <div className="mrp__detail-products">
              <span className="mrp__detail-products-label">Produtos recomendados:</span>
              <span>{detail.recommendedProducts}</span>
            </div>
          )}

          {/* Natural enemies */}
          {detail.naturalEnemiesObserved && (
            <div className="mrp__detail-natural-enemies">
              <Shield size={16} aria-hidden="true" />
              Inimigos naturais observados durante o período — considerar controle biológico.
            </div>
          )}

          {/* Timeline */}
          {detail.timeline.length > 0 && (
            <div className="mrp__detail-timeline">
              <h4 className="mrp__detail-section-title">Evolução Semanal</h4>
              <div className="mrp__timeline-bars">
                {detail.timeline.map((entry) => (
                  <div key={entry.date} className="mrp__timeline-bar-group">
                    <div
                      className="mrp__timeline-bar"
                      style={{ height: `${Math.max(4, entry.avgIntensity * 100)}%` }}
                      title={`${entry.date}: intensidade ${entry.avgIntensity}, ${entry.recordCount} registros`}
                      aria-label={`Semana ${entry.date}: intensidade ${entry.avgIntensity}`}
                    />
                    <span className="mrp__timeline-label">{entry.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Control Decisions */}
          {hasDecisions && (
            <div className="mrp__detail-decisions">
              <h4 className="mrp__detail-section-title">Decisões de Controle</h4>
              {detail.controlDecisions.map((dec, i) => (
                <DecisionRow key={i} decision={dec} />
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function DecisionRow({ decision }: { decision: ReportControlDecision }) {
  const isCritical = decision.urgency === 'CRITICO';

  return (
    <div
      className={`mrp__decision ${isCritical ? 'mrp__decision--critical' : 'mrp__decision--alert'}`}
    >
      <div className="mrp__decision-header">
        <span
          className={`mrp__urgency-badge mrp__urgency-badge--${decision.urgency.toLowerCase()}`}
        >
          {isCritical ? (
            <ShieldAlert size={14} aria-hidden="true" />
          ) : (
            <AlertTriangle size={14} aria-hidden="true" />
          )}
          {decision.urgencyLabel}
        </span>
        <span className="mrp__decision-date mrp__mono">
          Semana de {new Date(decision.date).toLocaleDateString('pt-BR')}
        </span>
      </div>
      <p className="mrp__decision-justification">{decision.justification}</p>
    </div>
  );
}

export default MonitoringReportPage;
