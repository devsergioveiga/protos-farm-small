import { useState, useCallback } from 'react';
import {
  Activity,
  Syringe,
  Stethoscope,
  Clock,
  Calendar,
  FlaskConical,
  Shield,
  Download,
  AlertCircle,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import { useSanitaryDashboard } from '@/hooks/useSanitaryDashboard';
import './SanitaryDashboardPage.css';

const CATEGORY_OPTIONS = [
  { value: '', label: 'Todas as categorias' },
  { value: 'BULL', label: 'Touro' },
  { value: 'COW', label: 'Vaca' },
  { value: 'HEIFER', label: 'Novilha' },
  { value: 'CALF_MALE', label: 'Bezerro' },
  { value: 'CALF_FEMALE', label: 'Bezerra' },
  { value: 'STEER', label: 'Boi' },
  { value: 'YEARLING_MALE', label: 'Garrote' },
  { value: 'YEARLING_FEMALE', label: 'Garota' },
];

function pendingTagClass(type: string): string {
  switch (type) {
    case 'IN_TREATMENT':
      return 'sanitary-dashboard__pending-tag--treatment';
    case 'PENDING_BOOSTER':
    case 'OVERDUE_VACCINE':
      return 'sanitary-dashboard__pending-tag--booster';
    case 'IN_WITHDRAWAL':
      return 'sanitary-dashboard__pending-tag--withdrawal';
    case 'EXAM_PENDING':
      return 'sanitary-dashboard__pending-tag--exam';
    default:
      return '';
  }
}

function formatCurrency(cents: number): string {
  return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

export default function SanitaryDashboardPage() {
  const { selectedFarm } = useFarmContext();
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data, isLoading, error } = useSanitaryDashboard({
    farmId: selectedFarm?.id ?? null,
    category: categoryFilter || undefined,
  });

  const handleExport = useCallback(async () => {
    if (!selectedFarm) return;
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set('category', categoryFilter);
      const qs = params.toString();
      const url = `/org/farms/${selectedFarm.id}/sanitary-dashboard/export${qs ? `?${qs}` : ''}`;

      const response = await fetch(`/api${url}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token') ?? ''}`,
        },
      });
      if (!response.ok) throw new Error('Erro ao exportar');
      const blob = await response.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'relatorio-sanitario.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      // silent
    }
  }, [selectedFarm, categoryFilter]);

  if (!selectedFarm) {
    return (
      <section className="sanitary-dashboard">
        <div className="sanitary-dashboard__empty">
          <Activity size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver o dashboard sanitário.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="sanitary-dashboard">
      {/* Header */}
      <header className="sanitary-dashboard__header">
        <div>
          <h1>Dashboard sanitário</h1>
          <p>Visão consolidada do status sanitário — {selectedFarm.name}</p>
        </div>
        <button
          type="button"
          className="sanitary-dashboard__btn-export"
          onClick={() => void handleExport()}
          aria-label="Exportar relatório sanitário"
        >
          <Download size={20} aria-hidden="true" />
          Exportar CSV
        </button>
      </header>

      {/* Filters (CA5) */}
      <div className="sanitary-dashboard__filters">
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          aria-label="Filtrar por categoria"
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="sanitary-dashboard__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="sanitary-dashboard__loading">Carregando dashboard sanitário...</div>
      )}

      {/* Dashboard content */}
      {!isLoading && data && (
        <>
          {/* KPIs (CA1) */}
          <div className="sanitary-dashboard__kpis">
            <div className="sanitary-dashboard__kpi">
              <div className="sanitary-dashboard__kpi-icon sanitary-dashboard__kpi-icon--green">
                <Syringe size={24} aria-hidden="true" />
              </div>
              <p className="sanitary-dashboard__kpi-value">
                {data.kpis.vaccinationCoveragePercent}%
              </p>
              <p className="sanitary-dashboard__kpi-label">Cobertura vacinal</p>
            </div>

            <div className="sanitary-dashboard__kpi">
              <div className="sanitary-dashboard__kpi-icon sanitary-dashboard__kpi-icon--red">
                <Stethoscope size={24} aria-hidden="true" />
              </div>
              <p
                className={`sanitary-dashboard__kpi-value ${data.kpis.animalsInTreatment > 0 ? 'sanitary-dashboard__kpi-value--error' : ''}`}
              >
                {data.kpis.animalsInTreatment}
              </p>
              <p className="sanitary-dashboard__kpi-label">Em tratamento</p>
            </div>

            <div className="sanitary-dashboard__kpi">
              <div className="sanitary-dashboard__kpi-icon sanitary-dashboard__kpi-icon--orange">
                <Clock size={24} aria-hidden="true" />
              </div>
              <p
                className={`sanitary-dashboard__kpi-value ${data.kpis.animalsInWithdrawal > 0 ? 'sanitary-dashboard__kpi-value--warning' : ''}`}
              >
                {data.kpis.animalsInWithdrawal}
              </p>
              <p className="sanitary-dashboard__kpi-label">Em carência</p>
            </div>

            <div className="sanitary-dashboard__kpi">
              <div className="sanitary-dashboard__kpi-icon sanitary-dashboard__kpi-icon--blue">
                <Calendar size={24} aria-hidden="true" />
              </div>
              <p className="sanitary-dashboard__kpi-value">{data.kpis.upcomingCampaigns}</p>
              <p className="sanitary-dashboard__kpi-label">Campanhas ativas</p>
            </div>

            <div className="sanitary-dashboard__kpi">
              <div className="sanitary-dashboard__kpi-icon sanitary-dashboard__kpi-icon--orange">
                <FlaskConical size={24} aria-hidden="true" />
              </div>
              <p
                className={`sanitary-dashboard__kpi-value ${data.kpis.pendingExamResults > 0 ? 'sanitary-dashboard__kpi-value--warning' : ''}`}
              >
                {data.kpis.pendingExamResults}
              </p>
              <p className="sanitary-dashboard__kpi-label">Exames pendentes</p>
            </div>

            <div className="sanitary-dashboard__kpi">
              <div className="sanitary-dashboard__kpi-icon sanitary-dashboard__kpi-icon--red">
                <Shield size={24} aria-hidden="true" />
              </div>
              <p
                className={`sanitary-dashboard__kpi-value ${data.kpis.expiredRegulatoryExams > 0 ? 'sanitary-dashboard__kpi-value--error' : ''}`}
              >
                {data.kpis.expiredRegulatoryExams}
              </p>
              <p className="sanitary-dashboard__kpi-label">Regulatórios vencidos</p>
            </div>
          </div>

          {/* CA2: Pending animals */}
          {data.pendingAnimals.length > 0 && (
            <div className="sanitary-dashboard__section">
              <h2 className="sanitary-dashboard__section-title">Animais com pendências</h2>
              <div className="sanitary-dashboard__table-wrapper">
                <table className="sanitary-dashboard__table">
                  <thead>
                    <tr>
                      <th scope="col">Brinco</th>
                      <th scope="col">Animal</th>
                      <th scope="col">Lote</th>
                      <th scope="col">Pendência</th>
                      <th scope="col">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pendingAnimals.slice(0, 50).map((p, i) => (
                      <tr key={`${p.animalId}-${p.pendingType}-${i}`}>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
                          {p.earTag}
                        </td>
                        <td>{p.animalName || '—'}</td>
                        <td>{p.lotName || '—'}</td>
                        <td>
                          <span
                            className={`sanitary-dashboard__pending-tag ${pendingTagClass(p.pendingType)}`}
                          >
                            {p.pendingTypeLabel}
                          </span>
                        </td>
                        <td>{p.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.pendingAnimals.length > 50 && (
                <p
                  style={{
                    textAlign: 'center',
                    marginTop: 12,
                    fontSize: '0.8125rem',
                    color: 'var(--color-neutral-500)',
                  }}
                >
                  Mostrando 50 de {data.pendingAnimals.length} pendências. Exporte o CSV para a
                  lista completa.
                </p>
              )}
            </div>
          )}

          {/* CA3: Costs */}
          {(data.costsByCategory.length > 0 || data.costsByLot.length > 0) && (
            <div className="sanitary-dashboard__section">
              <h2 className="sanitary-dashboard__section-title">Custos sanitários acumulados</h2>
              <div className="sanitary-dashboard__costs">
                {data.costsByCategory.length > 0 && (
                  <div className="sanitary-dashboard__cost-list">
                    <p className="sanitary-dashboard__cost-header">Por categoria</p>
                    {data.costsByCategory.map((c) => (
                      <div key={c.groupKey} className="sanitary-dashboard__cost-item">
                        <span className="sanitary-dashboard__cost-label">{c.groupLabel}</span>
                        <span className="sanitary-dashboard__cost-value">
                          {formatCurrency(c.totalCostCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {data.costsByLot.length > 0 && (
                  <div className="sanitary-dashboard__cost-list">
                    <p className="sanitary-dashboard__cost-header">Por lote</p>
                    {data.costsByLot.map((c) => (
                      <div key={c.groupKey} className="sanitary-dashboard__cost-item">
                        <span className="sanitary-dashboard__cost-label">{c.groupLabel}</span>
                        <span className="sanitary-dashboard__cost-value">
                          {formatCurrency(c.totalCostCents)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* CA4: Incidence charts */}
          {(data.diseaseIncidence.length > 0 || data.treatmentIncidence.length > 0) && (
            <div className="sanitary-dashboard__section">
              <h2 className="sanitary-dashboard__section-title">Incidência (últimos 6 meses)</h2>
              <div className="sanitary-dashboard__costs">
                {data.diseaseIncidence.length > 0 && (
                  <div className="sanitary-dashboard__chart">
                    <p className="sanitary-dashboard__chart-title">Doenças diagnosticadas</p>
                    {data.diseaseIncidence.map((d, i) => {
                      const maxCount = Math.max(...data.diseaseIncidence.map((x) => x.count));
                      const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                      return (
                        <div key={i} className="sanitary-dashboard__bar-group">
                          <div className="sanitary-dashboard__bar-label">
                            <span>
                              {d.month} — {d.diseaseName}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              {d.count}
                            </span>
                          </div>
                          <div className="sanitary-dashboard__bar">
                            <div
                              className="sanitary-dashboard__bar-fill sanitary-dashboard__bar-fill--disease"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {data.treatmentIncidence.length > 0 && (
                  <div className="sanitary-dashboard__chart">
                    <p className="sanitary-dashboard__chart-title">Procedimentos realizados</p>
                    {data.treatmentIncidence.map((d, i) => {
                      const maxCount = Math.max(...data.treatmentIncidence.map((x) => x.count));
                      const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
                      return (
                        <div key={i} className="sanitary-dashboard__bar-group">
                          <div className="sanitary-dashboard__bar-label">
                            <span>
                              {d.month} — {d.diseaseName}
                            </span>
                            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                              {d.count}
                            </span>
                          </div>
                          <div className="sanitary-dashboard__bar">
                            <div
                              className="sanitary-dashboard__bar-fill"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* All empty */}
          {data.pendingAnimals.length === 0 &&
            data.costsByCategory.length === 0 &&
            data.diseaseIncidence.length === 0 &&
            data.treatmentIncidence.length === 0 && (
              <div className="sanitary-dashboard__empty">
                <Activity size={48} aria-hidden="true" />
                <h2>Tudo em dia</h2>
                <p>
                  Nenhuma pendência sanitária encontrada. Continue registrando vacinações, exames e
                  tratamentos.
                </p>
              </div>
            )}
        </>
      )}
    </section>
  );
}
