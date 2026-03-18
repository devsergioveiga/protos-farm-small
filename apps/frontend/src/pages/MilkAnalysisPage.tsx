import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Plus,
  AlertCircle,
  Pencil,
  Trash2,
  TestTube,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Calendar,
  Download,
  Upload,
  AlertTriangle,
  Settings,
  TrendingUp,
  Save,
} from 'lucide-react';
import { useFarmContext } from '@/stores/FarmContext';
import {
  useMilkAnalyses,
  useHighScc,
  useQualityTrend,
  useQualityConfig,
} from '@/hooks/useMilkAnalyses';
import type { MilkAnalysisItem, BonusPenaltyEntry } from '@/types/milk-analysis';
import { ANALYSIS_TYPES, CMT_RESULTS } from '@/types/milk-analysis';
import MilkAnalysisModal from '@/components/milk-analysis/MilkAnalysisModal';
import { api } from '@/services/api';
import './MilkAnalysisPage.css';

type TabKey = 'analyses' | 'highScc' | 'quality' | 'config';

/* ─── Helpers ──────────────────────────────────────────────────────── */

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

function cmtShort(value: string | null): string {
  if (!value) return '--';
  const map: Record<string, string> = {
    NEGATIVE: '-',
    TRACE: 'T',
    PLUS_1: '+',
    PLUS_2: '++',
    PLUS_3: '+++',
  };
  return map[value] ?? value;
}

function cmtClass(value: string | null): string {
  if (!value) return 'milk-analysis__cmt-cell--empty';
  return `milk-analysis__cmt-cell--${value}`;
}

function alertBadgeClass(alert: string | null): string {
  if (!alert) return '';
  return `milk-analysis__alert-badge milk-analysis__alert-badge--${alert}`;
}

function ratioClass(ratio: number | null): string {
  if (ratio === null) return '';
  if (ratio < 1.0 || ratio > 1.5) return 'milk-analysis__ratio milk-analysis__ratio--alert';
  return 'milk-analysis__ratio milk-analysis__ratio--normal';
}

/* ─── Component ────────────────────────────────────────────────────── */

export default function MilkAnalysisPage() {
  const { selectedFarm } = useFarmContext();

  // Tab state
  const [activeTab, setActiveTab] = useState<TabKey>('analyses');

  // Analyses tab state
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<MilkAnalysisItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  // Data hooks
  const { analyses, meta, isLoading, error, refetch } = useMilkAnalyses({
    farmId: selectedFarm?.id ?? null,
    page,
    analysisType: typeFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  });

  const {
    cows: highSccCows,
    isLoading: sccLoading,
    error: sccError,
  } = useHighScc(activeTab === 'highScc' ? (selectedFarm?.id ?? null) : null);

  const {
    trend,
    isLoading: trendLoading,
    error: trendError,
  } = useQualityTrend(activeTab === 'quality' ? (selectedFarm?.id ?? null) : null);

  const {
    config,
    bonus,
    isLoading: configLoading,
    error: configError,
    saveConfig,
    fetchBonus,
  } = useQualityConfig();

  // Config local state
  const [localConfig, setLocalConfig] = useState(config);
  const [configSaving, setConfigSaving] = useState(false);

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  // Fetch bonus when config tab opened
  useEffect(() => {
    if (activeTab === 'config' && selectedFarm) {
      void fetchBonus(selectedFarm.id);
    }
  }, [activeTab, selectedFarm, fetchBonus]);

  // ─── Callbacks ──────────────────────────────────────────

  const showToast = useCallback((msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 5000);
  }, []);

  const handleSuccess = useCallback(() => {
    setShowModal(false);
    setSelectedAnalysis(null);
    showToast(
      selectedAnalysis ? 'Análise atualizada com sucesso' : 'Análise registrada com sucesso',
    );
    void refetch();
  }, [refetch, selectedAnalysis, showToast]);

  const handleEdit = useCallback((a: MilkAnalysisItem) => {
    setSelectedAnalysis(a);
    setShowModal(true);
  }, []);

  const handleDelete = useCallback(
    async (a: MilkAnalysisItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm('Excluir esta análise de leite? Esta ação não pode ser desfeita.'))
        return;
      try {
        await api.delete(`/org/farms/${selectedFarm!.id}/milk-analysis/${a.id}`);
        showToast('Análise excluída com sucesso');
        void refetch();
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir análise.');
      }
    },
    [refetch, selectedFarm, showToast],
  );

  const handleExportCSV = useCallback(async () => {
    if (!selectedFarm) return;
    try {
      const query = new URLSearchParams();
      if (typeFilter) query.set('analysisType', typeFilter);
      if (dateFrom) query.set('dateFrom', dateFrom);
      if (dateTo) query.set('dateTo', dateTo);
      const qs = query.toString();
      const blob = await api.getBlob(
        `/org/farms/${selectedFarm.id}/milk-analysis/export${qs ? `?${qs}` : ''}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analises-leite-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Relatório exportado com sucesso');
    } catch {
      setDeleteError('Erro ao exportar relatório.');
    }
  }, [selectedFarm, typeFilter, dateFrom, dateTo, showToast]);

  const handleImportCSV = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !selectedFarm) return;
      setImporting(true);
      setDeleteError(null);
      try {
        const formData = new FormData();
        formData.append('file', file);
        await api.postFormData(`/org/farms/${selectedFarm.id}/milk-analysis/import`, formData);
        showToast('Análises importadas com sucesso');
        void refetch();
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao importar arquivo.');
      } finally {
        setImporting(false);
        if (importRef.current) importRef.current.value = '';
      }
    },
    [selectedFarm, refetch, showToast],
  );

  const handleSaveConfig = useCallback(async () => {
    if (!localConfig) return;
    setConfigSaving(true);
    try {
      await saveConfig(localConfig);
      showToast('Configuração salva com sucesso');
      if (selectedFarm) void fetchBonus(selectedFarm.id);
    } catch {
      // error is set by hook
    } finally {
      setConfigSaving(false);
    }
  }, [localConfig, saveConfig, showToast, selectedFarm, fetchBonus]);

  // ─── Bonus/penalty table editing ────────────────────────

  const updateBonusEntry = (index: number, field: keyof BonusPenaltyEntry, value: unknown) => {
    if (!localConfig) return;
    const entries = [...localConfig.bonusPenaltyTable];
    entries[index] = { ...entries[index], [field]: value };
    setLocalConfig({ ...localConfig, bonusPenaltyTable: entries });
  };

  const addBonusEntry = () => {
    if (!localConfig) return;
    setLocalConfig({
      ...localConfig,
      bonusPenaltyTable: [
        ...localConfig.bonusPenaltyTable,
        { metric: 'SCC', min: null, max: null, valueCentsPerLiter: 0, label: '' },
      ],
    });
  };

  const removeBonusEntry = (index: number) => {
    if (!localConfig) return;
    const entries = localConfig.bonusPenaltyTable.filter((_, i) => i !== index);
    setLocalConfig({ ...localConfig, bonusPenaltyTable: entries });
  };

  // ─── No farm selected ──────────────────────────────────

  if (!selectedFarm) {
    return (
      <section className="milk-analysis">
        <div className="milk-analysis__empty">
          <TestTube size={48} aria-hidden="true" />
          <h2>Selecione uma fazenda</h2>
          <p>Escolha uma fazenda no seletor acima para ver as análises de leite.</p>
        </div>
      </section>
    );
  }

  // ─── Render ────────────────────────────────────────────

  return (
    <section className="milk-analysis">
      {/* Header */}
      <header className="milk-analysis__header">
        <div>
          <h1>Análise de leite</h1>
          <p>Controle de qualidade do leite de {selectedFarm.name}</p>
        </div>
        {activeTab === 'analyses' && (
          <div className="milk-analysis__actions">
            <button
              type="button"
              className="milk-analysis__btn-secondary"
              onClick={() => void handleExportCSV()}
              aria-label="Exportar análises em CSV"
            >
              <Download size={20} aria-hidden="true" />
              Exportar
            </button>
            <button
              type="button"
              className="milk-analysis__btn-secondary"
              onClick={() => importRef.current?.click()}
              disabled={importing}
              aria-label="Importar análises de CSV"
            >
              <Upload size={20} aria-hidden="true" />
              {importing ? 'Importando...' : 'Importar'}
            </button>
            <input
              ref={importRef}
              type="file"
              accept=".csv"
              onChange={handleImportCSV}
              style={{ display: 'none' }}
              aria-hidden="true"
            />
            <button
              type="button"
              className="milk-analysis__btn-primary"
              onClick={() => {
                setSelectedAnalysis(null);
                setShowModal(true);
              }}
            >
              <Plus size={20} aria-hidden="true" />
              Nova análise
            </button>
          </div>
        )}
      </header>

      {/* Success */}
      {successMsg && (
        <div className="milk-analysis__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {/* Errors */}
      {(error || deleteError || sccError || trendError || configError) && (
        <div className="milk-analysis__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError || sccError || trendError || configError}
        </div>
      )}

      {/* Tabs */}
      <nav className="milk-analysis__tabs" role="tablist" aria-label="Seções">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'analyses'}
          className={`milk-analysis__tab ${activeTab === 'analyses' ? 'milk-analysis__tab--active' : ''}`}
          onClick={() => setActiveTab('analyses')}
        >
          <TestTube size={16} aria-hidden="true" />
          Análises
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'highScc'}
          className={`milk-analysis__tab ${activeTab === 'highScc' ? 'milk-analysis__tab--active' : ''}`}
          onClick={() => setActiveTab('highScc')}
        >
          <AlertTriangle size={16} aria-hidden="true" />
          CCS elevada
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'quality'}
          className={`milk-analysis__tab ${activeTab === 'quality' ? 'milk-analysis__tab--active' : ''}`}
          onClick={() => setActiveTab('quality')}
        >
          <TrendingUp size={16} aria-hidden="true" />
          Qualidade
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'config'}
          className={`milk-analysis__tab ${activeTab === 'config' ? 'milk-analysis__tab--active' : ''}`}
          onClick={() => setActiveTab('config')}
        >
          <Settings size={16} aria-hidden="true" />
          Configuração
        </button>
      </nav>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Análises                                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'analyses' && (
        <>
          {/* Toolbar */}
          <div className="milk-analysis__toolbar">
            <div className="milk-analysis__filter">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrar por tipo de análise"
              >
                <option value="">Todos os tipos</option>
                {ANALYSIS_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="milk-analysis__filter">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
                aria-label="Data inicial"
              />
            </div>
            <div className="milk-analysis__filter">
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
                aria-label="Data final"
              />
            </div>
          </div>

          {/* Loading */}
          {isLoading && <div className="milk-analysis__loading">Carregando análises...</div>}

          {/* Empty */}
          {!isLoading && analyses.length === 0 && (
            <div className="milk-analysis__empty">
              <TestTube size={48} aria-hidden="true" />
              <h2>Nenhuma análise registrada</h2>
              <p>Registre análises de CMT, laboratoriais, tanque ou controle leiteiro oficial.</p>
            </div>
          )}

          {/* Cards */}
          {!isLoading && analyses.length > 0 && (
            <div className="milk-analysis__grid">
              {analyses.map((a) => (
                <div
                  key={a.id}
                  className="milk-analysis__card"
                  onClick={() => handleEdit(a)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleEdit(a);
                    }
                  }}
                >
                  <div className="milk-analysis__card-header">
                    <div>
                      <h3 className="milk-analysis__card-title">
                        {a.animalEarTag
                          ? `${a.animalEarTag} — ${a.animalName || 'Sem nome'}`
                          : a.analysisTypeLabel}
                      </h3>
                      <p className="milk-analysis__card-subtitle">
                        {formatDate(a.analysisDate)}
                        {a.laboratory ? ` — ${a.laboratory}` : ''}
                        {a.dairyCompany ? ` — ${a.dairyCompany}` : ''}
                      </p>
                    </div>
                    <div className="milk-analysis__card-actions">
                      <button
                        type="button"
                        className="milk-analysis__card-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleEdit(a);
                        }}
                        aria-label={`Editar análise de ${a.animalEarTag || a.analysisTypeLabel}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="milk-analysis__card-btn milk-analysis__card-btn--delete"
                        onClick={(e) => void handleDelete(a, e)}
                        aria-label={`Excluir análise de ${a.animalEarTag || a.analysisTypeLabel}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="milk-analysis__card-tags">
                    <span className="milk-analysis__tag milk-analysis__tag--type">
                      {a.analysisTypeLabel}
                    </span>
                    {a.cmtAlert && (
                      <span className="milk-analysis__tag milk-analysis__tag--alert">
                        <AlertTriangle size={12} aria-hidden="true" />
                        CMT positivo
                      </span>
                    )}
                    {a.antibioticResidue === true && (
                      <span className="milk-analysis__tag milk-analysis__tag--antibiotic-pos">
                        <AlertCircle size={12} aria-hidden="true" />
                        Antibiótico detectado
                      </span>
                    )}
                    {a.antibioticResidue === false && (
                      <span className="milk-analysis__tag milk-analysis__tag--antibiotic-neg">
                        <CheckCircle size={12} aria-hidden="true" />
                        Sem antibiótico
                      </span>
                    )}
                  </div>

                  {/* CMT grid */}
                  {(a.cmtFrontLeft || a.cmtFrontRight || a.cmtRearLeft || a.cmtRearRight) && (
                    <div className="milk-analysis__cmt-grid" aria-label="Resultado CMT por quarto">
                      <div
                        className={`milk-analysis__cmt-cell ${cmtClass(a.cmtFrontLeft)}`}
                        title={`AE: ${CMT_RESULTS.find((r) => r.value === a.cmtFrontLeft)?.label ?? '--'}`}
                      >
                        {cmtShort(a.cmtFrontLeft)}
                      </div>
                      <div
                        className={`milk-analysis__cmt-cell ${cmtClass(a.cmtFrontRight)}`}
                        title={`AD: ${CMT_RESULTS.find((r) => r.value === a.cmtFrontRight)?.label ?? '--'}`}
                      >
                        {cmtShort(a.cmtFrontRight)}
                      </div>
                      <div
                        className={`milk-analysis__cmt-cell ${cmtClass(a.cmtRearLeft)}`}
                        title={`PE: ${CMT_RESULTS.find((r) => r.value === a.cmtRearLeft)?.label ?? '--'}`}
                      >
                        {cmtShort(a.cmtRearLeft)}
                      </div>
                      <div
                        className={`milk-analysis__cmt-cell ${cmtClass(a.cmtRearRight)}`}
                        title={`PD: ${CMT_RESULTS.find((r) => r.value === a.cmtRearRight)?.label ?? '--'}`}
                      >
                        {cmtShort(a.cmtRearRight)}
                      </div>
                    </div>
                  )}

                  {/* Values */}
                  <div className="milk-analysis__card-values">
                    {a.scc !== null && (
                      <div className="milk-analysis__value">
                        <span className="milk-analysis__value-label">CCS</span>
                        <span className={alertBadgeClass(a.sccAlert)}>
                          {a.scc.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {a.tbc !== null && (
                      <div className="milk-analysis__value">
                        <span className="milk-analysis__value-label">CBT</span>
                        <span className={alertBadgeClass(a.tbcAlert)}>
                          {a.tbc.toLocaleString('pt-BR')}
                        </span>
                      </div>
                    )}
                    {a.fatPercent !== null && (
                      <div className="milk-analysis__value">
                        <span className="milk-analysis__value-label">GORDURA</span>
                        <span className="milk-analysis__value-number">
                          {a.fatPercent.toFixed(2)}%
                        </span>
                      </div>
                    )}
                    {a.proteinPercent !== null && (
                      <div className="milk-analysis__value">
                        <span className="milk-analysis__value-label">PROTEÍNA</span>
                        <span className="milk-analysis__value-number">
                          {a.proteinPercent.toFixed(2)}%
                        </span>
                      </div>
                    )}
                    {a.fatProteinRatio !== null && (
                      <div className="milk-analysis__value">
                        <span className="milk-analysis__value-label">G:P</span>
                        <span className={ratioClass(a.fatProteinRatio)}>
                          {a.fatProteinRatio.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Production (official recording) */}
                  {(a.productionAmLiters !== null || a.productionPmLiters !== null) && (
                    <div className="milk-analysis__card-details">
                      {a.productionAmLiters !== null && (
                        <span className="milk-analysis__detail milk-analysis__detail--mono">
                          AM: {a.productionAmLiters.toFixed(1)} L
                        </span>
                      )}
                      {a.productionPmLiters !== null && (
                        <span className="milk-analysis__detail milk-analysis__detail--mono">
                          PM: {a.productionPmLiters.toFixed(1)} L
                        </span>
                      )}
                      {a.projected305Liters !== null && (
                        <span className="milk-analysis__detail milk-analysis__detail--mono">
                          Proj. 305d: {a.projected305Liters.toFixed(0)} L
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="milk-analysis__pagination" aria-label="Paginação">
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
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: CCS elevada                                               */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'highScc' && (
        <>
          {sccLoading && (
            <div className="milk-analysis__loading">Carregando vacas com CCS elevada...</div>
          )}

          {!sccLoading && highSccCows.length === 0 && (
            <div className="milk-analysis__empty">
              <CheckCircle size={48} aria-hidden="true" />
              <h2>Nenhuma vaca com CCS elevada</h2>
              <p>
                Todas as vacas estão dentro dos limites configurados de contagem de células
                somáticas.
              </p>
            </div>
          )}

          {!sccLoading && highSccCows.length > 0 && (
            <>
              {/* Desktop table */}
              <div className="milk-analysis__table-wrap">
                <table className="milk-analysis__table">
                  <caption className="sr-only">
                    Vacas com contagem de células somáticas elevada
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Brinco</th>
                      <th scope="col">Nome</th>
                      <th scope="col">Último CCS</th>
                      <th scope="col">Data</th>
                      <th scope="col">Histórico</th>
                      <th scope="col">Nível</th>
                    </tr>
                  </thead>
                  <tbody>
                    {highSccCows.map((cow) => {
                      const maxHist = Math.max(...cow.history, 1);
                      return (
                        <tr key={cow.animalId}>
                          <td>
                            <strong>{cow.animalEarTag}</strong>
                          </td>
                          <td>{cow.animalName || '--'}</td>
                          <td>
                            <span className="milk-analysis__scc-value">
                              {cow.lastScc.toLocaleString('pt-BR')}
                            </span>
                          </td>
                          <td>{formatDate(cow.lastAnalysisDate)}</td>
                          <td>
                            <div
                              className="milk-analysis__sparkline"
                              aria-label={`Histórico CCS: ${cow.history.join(', ')}`}
                            >
                              {cow.history.map((val, i) => (
                                <div
                                  key={i}
                                  className={`milk-analysis__spark-bar ${val > (config?.sccLimitIndividual ?? 400) ? 'milk-analysis__spark-bar--high' : ''}`}
                                  style={{ height: `${Math.max((val / maxHist) * 24, 3)}px` }}
                                />
                              ))}
                            </div>
                          </td>
                          <td>
                            <span
                              className={`milk-analysis__alert-level milk-analysis__alert-level--${cow.alertLevel}`}
                            >
                              <AlertTriangle size={12} aria-hidden="true" />
                              {cow.alertLevel === 'CRITICAL' ? 'Crítico' : 'Atenção'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="milk-analysis__scc-cards">
                {highSccCows.map((cow) => {
                  const maxHist = Math.max(...cow.history, 1);
                  return (
                    <div key={cow.animalId} className="milk-analysis__scc-card">
                      <div className="milk-analysis__scc-card-header">
                        <span className="milk-analysis__scc-card-animal">
                          {cow.animalEarTag} — {cow.animalName || 'Sem nome'}
                        </span>
                        <span
                          className={`milk-analysis__alert-level milk-analysis__alert-level--${cow.alertLevel}`}
                        >
                          <AlertTriangle size={12} aria-hidden="true" />
                          {cow.alertLevel === 'CRITICAL' ? 'Crítico' : 'Atenção'}
                        </span>
                      </div>
                      <div className="milk-analysis__scc-card-details">
                        <span className="milk-analysis__detail">
                          <Calendar size={14} aria-hidden="true" />
                          {formatDate(cow.lastAnalysisDate)}
                        </span>
                        <span className="milk-analysis__detail milk-analysis__detail--mono">
                          CCS: {cow.lastScc.toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <div
                        className="milk-analysis__sparkline"
                        aria-label={`Histórico CCS: ${cow.history.join(', ')}`}
                      >
                        {cow.history.map((val, i) => (
                          <div
                            key={i}
                            className={`milk-analysis__spark-bar ${val > (config?.sccLimitIndividual ?? 400) ? 'milk-analysis__spark-bar--high' : ''}`}
                            style={{ height: `${Math.max((val / maxHist) * 24, 3)}px` }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Qualidade                                                 */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'quality' && (
        <>
          {trendLoading && (
            <div className="milk-analysis__loading">Carregando tendência de qualidade...</div>
          )}

          {!trendLoading && trend.length === 0 && (
            <div className="milk-analysis__empty">
              <TrendingUp size={48} aria-hidden="true" />
              <h2>Sem dados suficientes</h2>
              <p>Registre análises de tanque para visualizar a tendência de qualidade do leite.</p>
            </div>
          )}

          {!trendLoading && trend.length > 0 && (
            <div className="milk-analysis__trend">
              {/* SCC + TBC bars */}
              <div className="milk-analysis__trend-section">
                <h3 className="milk-analysis__trend-title">CCS e CBT — Média mensal</h3>
                <div className="milk-analysis__trend-bars">
                  {trend.map((item) => {
                    const maxScc = Math.max(...trend.map((t) => t.avgScc ?? 0), 1);
                    const maxTbc = Math.max(...trend.map((t) => t.avgTbc ?? 0), 1);
                    const sccH = item.avgScc ? (item.avgScc / maxScc) * 100 : 0;
                    const tbcH = item.avgTbc ? (item.avgTbc / maxTbc) * 100 : 0;
                    return (
                      <div key={item.month} className="milk-analysis__trend-col">
                        {item.avgScc !== null && (
                          <span className="milk-analysis__trend-value">
                            {item.avgScc.toLocaleString('pt-BR')}
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end' }}>
                          <div
                            className="milk-analysis__trend-bar milk-analysis__trend-bar--scc"
                            style={{ height: `${sccH}%` }}
                            title={`CCS: ${item.avgScc?.toLocaleString('pt-BR') ?? '--'}`}
                          />
                          <div
                            className="milk-analysis__trend-bar milk-analysis__trend-bar--tbc"
                            style={{ height: `${tbcH}%` }}
                            title={`CBT: ${item.avgTbc?.toLocaleString('pt-BR') ?? '--'}`}
                          />
                        </div>
                        <span className="milk-analysis__trend-label">{item.month}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="milk-analysis__trend-legend">
                  <div className="milk-analysis__legend-item">
                    <span className="milk-analysis__legend-dot milk-analysis__legend-dot--scc" />
                    CCS (x1000/mL)
                  </div>
                  <div className="milk-analysis__legend-item">
                    <span className="milk-analysis__legend-dot milk-analysis__legend-dot--tbc" />
                    CBT (x1000 UFC/mL)
                  </div>
                </div>
              </div>

              {/* Fat + Protein bars */}
              <div className="milk-analysis__trend-section">
                <h3 className="milk-analysis__trend-title">
                  Gordura e Proteína — Média mensal (%)
                </h3>
                <div className="milk-analysis__trend-bars">
                  {trend.map((item) => {
                    const maxFat = Math.max(...trend.map((t) => t.avgFat ?? 0), 1);
                    const maxProt = Math.max(...trend.map((t) => t.avgProtein ?? 0), 1);
                    const fatH = item.avgFat ? (item.avgFat / maxFat) * 100 : 0;
                    const protH = item.avgProtein ? (item.avgProtein / maxProt) * 100 : 0;
                    return (
                      <div key={item.month} className="milk-analysis__trend-col">
                        {item.avgFat !== null && (
                          <span className="milk-analysis__trend-value">
                            {item.avgFat.toFixed(2)}%
                          </span>
                        )}
                        <div style={{ display: 'flex', gap: '2px', alignItems: 'flex-end' }}>
                          <div
                            className="milk-analysis__trend-bar milk-analysis__trend-bar--fat"
                            style={{ height: `${fatH}%` }}
                            title={`Gordura: ${item.avgFat?.toFixed(2) ?? '--'}%`}
                          />
                          <div
                            className="milk-analysis__trend-bar milk-analysis__trend-bar--protein"
                            style={{ height: `${protH}%` }}
                            title={`Proteína: ${item.avgProtein?.toFixed(2) ?? '--'}%`}
                          />
                        </div>
                        <span className="milk-analysis__trend-label">{item.month}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="milk-analysis__trend-legend">
                  <div className="milk-analysis__legend-item">
                    <span className="milk-analysis__legend-dot milk-analysis__legend-dot--fat" />
                    Gordura (%)
                  </div>
                  <div className="milk-analysis__legend-item">
                    <span className="milk-analysis__legend-dot milk-analysis__legend-dot--protein" />
                    Proteína (%)
                  </div>
                </div>
              </div>

              {/* Traffic light reference */}
              <div
                className="milk-analysis__traffic-ref"
                role="complementary"
                aria-label="Referência de cores"
              >
                <div className="milk-analysis__traffic-item">
                  <span className="milk-analysis__traffic-dot milk-analysis__traffic-dot--green" />
                  Dentro do limite
                </div>
                <div className="milk-analysis__traffic-item">
                  <span className="milk-analysis__traffic-dot milk-analysis__traffic-dot--yellow" />
                  Atenção (próximo do limite)
                </div>
                <div className="milk-analysis__traffic-item">
                  <span className="milk-analysis__traffic-dot milk-analysis__traffic-dot--red" />
                  Acima do limite
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* TAB: Configuração                                              */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'config' && (
        <>
          {configLoading && (
            <div className="milk-analysis__loading">Carregando configuração...</div>
          )}

          {!configLoading && localConfig && (
            <>
              <div className="milk-analysis__config">
                {/* Limits */}
                <div className="milk-analysis__config-section">
                  <h3 className="milk-analysis__config-title">Limites de qualidade (tanque)</h3>
                  <div className="milk-analysis__config-field">
                    <label htmlFor="cfg-scc-limit">CCS limite (x1000/mL) *</label>
                    <input
                      id="cfg-scc-limit"
                      type="number"
                      min="0"
                      value={localConfig.sccLimitTank}
                      onChange={(e) =>
                        setLocalConfig({ ...localConfig, sccLimitTank: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="milk-analysis__config-field">
                    <label htmlFor="cfg-scc-warn">CCS alerta (x1000/mL)</label>
                    <input
                      id="cfg-scc-warn"
                      type="number"
                      min="0"
                      value={localConfig.sccWarningTank}
                      onChange={(e) =>
                        setLocalConfig({ ...localConfig, sccWarningTank: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="milk-analysis__config-field">
                    <label htmlFor="cfg-tbc-limit">CBT limite (x1000 UFC/mL) *</label>
                    <input
                      id="cfg-tbc-limit"
                      type="number"
                      min="0"
                      value={localConfig.tbcLimitTank}
                      onChange={(e) =>
                        setLocalConfig({ ...localConfig, tbcLimitTank: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="milk-analysis__config-field">
                    <label htmlFor="cfg-tbc-warn">CBT alerta (x1000 UFC/mL)</label>
                    <input
                      id="cfg-tbc-warn"
                      type="number"
                      min="0"
                      value={localConfig.tbcWarningTank}
                      onChange={(e) =>
                        setLocalConfig({ ...localConfig, tbcWarningTank: Number(e.target.value) })
                      }
                    />
                  </div>
                  <div className="milk-analysis__config-field">
                    <label htmlFor="cfg-scc-ind">CCS individual limite (x1000/mL)</label>
                    <input
                      id="cfg-scc-ind"
                      type="number"
                      min="0"
                      value={localConfig.sccLimitIndividual}
                      onChange={(e) =>
                        setLocalConfig({
                          ...localConfig,
                          sccLimitIndividual: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                </div>

                {/* Bonus/Penalty Table */}
                <div className="milk-analysis__config-section">
                  <h3 className="milk-analysis__config-title">Tabela de bonificação/penalização</h3>
                  {localConfig.bonusPenaltyTable.length > 0 && (
                    <table className="milk-analysis__bonus-table">
                      <thead>
                        <tr>
                          <th scope="col">Métrica</th>
                          <th scope="col">Mín</th>
                          <th scope="col">Máx</th>
                          <th scope="col">R$/L (cent.)</th>
                          <th scope="col">Descrição</th>
                          <th scope="col" className="sr-only">
                            Ações
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {localConfig.bonusPenaltyTable.map((entry, i) => (
                          <tr key={i}>
                            <td>
                              <select
                                value={entry.metric}
                                onChange={(e) => updateBonusEntry(i, 'metric', e.target.value)}
                                aria-label={`Métrica da linha ${i + 1}`}
                              >
                                <option value="SCC">CCS</option>
                                <option value="TBC">CBT</option>
                                <option value="FAT">Gordura</option>
                                <option value="PROTEIN">Proteína</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                value={entry.min ?? ''}
                                onChange={(e) =>
                                  updateBonusEntry(
                                    i,
                                    'min',
                                    e.target.value === '' ? null : Number(e.target.value),
                                  )
                                }
                                aria-label={`Valor mínimo da linha ${i + 1}`}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={entry.max ?? ''}
                                onChange={(e) =>
                                  updateBonusEntry(
                                    i,
                                    'max',
                                    e.target.value === '' ? null : Number(e.target.value),
                                  )
                                }
                                aria-label={`Valor máximo da linha ${i + 1}`}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                step="0.01"
                                value={entry.valueCentsPerLiter}
                                onChange={(e) =>
                                  updateBonusEntry(i, 'valueCentsPerLiter', Number(e.target.value))
                                }
                                aria-label={`Valor por litro da linha ${i + 1}`}
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={entry.label}
                                onChange={(e) => updateBonusEntry(i, 'label', e.target.value)}
                                style={{ width: '120px' }}
                                aria-label={`Descrição da linha ${i + 1}`}
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="milk-analysis__bonus-remove"
                                onClick={() => removeBonusEntry(i)}
                                aria-label={`Remover linha ${i + 1}`}
                              >
                                <Trash2 size={14} aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <button
                    type="button"
                    className="milk-analysis__bonus-add"
                    onClick={addBonusEntry}
                  >
                    <Plus size={14} aria-hidden="true" />
                    Adicionar faixa
                  </button>
                </div>
              </div>

              {/* Save */}
              <div style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="milk-analysis__btn-primary"
                  onClick={() => void handleSaveConfig()}
                  disabled={configSaving}
                >
                  <Save size={20} aria-hidden="true" />
                  {configSaving ? 'Salvando...' : 'Salvar configuração'}
                </button>
              </div>

              {/* Bonus Result */}
              {bonus && (
                <div className="milk-analysis__bonus-result">
                  <h3 className="milk-analysis__config-title">Última bonificação calculada</h3>
                  <p
                    className={`milk-analysis__bonus-total ${
                      bonus.totalBonusCentsPerLiter > 0
                        ? 'milk-analysis__bonus-total--positive'
                        : bonus.totalBonusCentsPerLiter < 0
                          ? 'milk-analysis__bonus-total--negative'
                          : 'milk-analysis__bonus-total--neutral'
                    }`}
                  >
                    {bonus.totalBonusCentsPerLiter > 0 ? '+' : ''}
                    {bonus.totalBonusCentsPerLiter.toFixed(2)} centavos/litro
                  </p>
                  <p
                    style={{
                      fontSize: '0.8125rem',
                      color: 'var(--color-neutral-500)',
                      margin: '4px 0 0',
                    }}
                  >
                    Calculado em {formatDate(bonus.calculatedAt)}
                  </p>
                  {bonus.details.length > 0 && (
                    <div className="milk-analysis__bonus-details">
                      {bonus.details.map((d, i) => (
                        <div key={i} className="milk-analysis__bonus-detail">
                          <span>
                            {d.label} ({d.metric}: {d.value.toLocaleString('pt-BR')})
                          </span>
                          <span className="milk-analysis__bonus-detail-value">
                            {d.bonusCentsPerLiter > 0 ? '+' : ''}
                            {d.bonusCentsPerLiter.toFixed(2)} c/L
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Modal */}
      <MilkAnalysisModal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedAnalysis(null);
        }}
        analysis={selectedAnalysis}
        farmId={selectedFarm.id}
        onSuccess={handleSuccess}
      />
    </section>
  );
}
