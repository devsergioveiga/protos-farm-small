import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Plus,
  Search,
  AlertCircle,
  Pencil,
  Trash2,
  Salad,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  FlaskConical,
  Upload,
  Download,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  Check,
  FileText,
  TrendingUp,
} from 'lucide-react';
import {
  useFeedIngredients,
  useFeedAnalyses,
  useAnalysisComparison,
  useQualityTrend,
} from '@/hooks/useFeedIngredients';
import type { FeedIngredientItem, AnalysisItem, ImportResult } from '@/types/feed-ingredient';
import { FEED_TYPES } from '@/types/feed-ingredient';
import FeedIngredientModal from '@/components/feed-ingredients/FeedIngredientModal';
import AnalysisModal from '@/components/feed-ingredients/AnalysisModal';
import { api } from '@/services/api';
import './FeedIngredientsPage.css';

type TabKey = 'ingredients' | 'analyses' | 'import';

const TYPE_BADGE_CLASS: Record<string, string> = {
  ROUGHAGE: 'feed-ingredients-page__badge--roughage',
  CONCENTRATE: 'feed-ingredients-page__badge--concentrate',
  MINERAL: 'feed-ingredients-page__badge--mineral',
  ADDITIVE: 'feed-ingredients-page__badge--additive',
  BYPRODUCT: 'feed-ingredients-page__badge--byproduct',
};

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `R$ ${value.toFixed(2)}`;
}

function formatPercent(value: number | null): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(1)}%`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR');
}

export default function FeedIngredientsPage() {
  // ─── State ──────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabKey>('ingredients');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);

  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<FeedIngredientItem | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Analyses tab state
  const [viewingIngredient, setViewingIngredient] = useState<FeedIngredientItem | null>(null);
  const [analysisPage, setAnalysisPage] = useState(1);
  const [selectedAnalysis, setSelectedAnalysis] = useState<AnalysisItem | null>(null);
  const [uploadingReport, setUploadingReport] = useState(false);

  // Import tab state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Debounced search ───────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ─── Data ───────────────────────────────────────────────
  const { ingredients, meta, isLoading, error, refetch } = useFeedIngredients({
    page,
    type: typeFilter || undefined,
    search: search || undefined,
  });

  const {
    analyses,
    meta: analysesMeta,
    isLoading: analysesLoading,
    error: analysesError,
    refetch: refetchAnalyses,
  } = useFeedAnalyses({
    feedId: viewingIngredient?.id ?? null,
    page: analysisPage,
  });

  const { comparison, isLoading: comparisonLoading } = useAnalysisComparison(
    viewingIngredient?.id ?? null,
    selectedAnalysis?.id ?? null,
  );

  const { trend, isLoading: trendLoading } = useQualityTrend(viewingIngredient?.id ?? null);

  // ─── Callbacks ──────────────────────────────────────────
  const handleIngredientSuccess = useCallback(() => {
    setShowIngredientModal(false);
    setSuccessMsg(
      selectedIngredient
        ? 'Ingrediente atualizado com sucesso'
        : 'Ingrediente cadastrado com sucesso',
    );
    setSelectedIngredient(null);
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetch, selectedIngredient]);

  const handleAnalysisSuccess = useCallback(() => {
    setShowAnalysisModal(false);
    setSuccessMsg('Análise registrada com sucesso');
    void refetchAnalyses();
    void refetch();
    setTimeout(() => setSuccessMsg(null), 5000);
  }, [refetchAnalyses, refetch]);

  const handleEdit = useCallback((item: FeedIngredientItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIngredient(item);
    setShowIngredientModal(true);
  }, []);

  const handleDelete = useCallback(
    async (item: FeedIngredientItem, e: React.MouseEvent) => {
      e.stopPropagation();
      setDeleteError(null);
      if (!window.confirm(`Excluir "${item.name}"? Esta ação não pode ser desfeita.`)) return;
      try {
        await api.delete(`/org/feed-ingredients/${item.id}`);
        setSuccessMsg('Ingrediente excluído com sucesso');
        void refetch();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao excluir ingrediente.');
      }
    },
    [refetch],
  );

  const handleViewAnalyses = useCallback((item: FeedIngredientItem) => {
    setViewingIngredient(item);
    setSelectedAnalysis(null);
    setAnalysisPage(1);
    setActiveTab('analyses');
  }, []);

  const handleBackToList = useCallback(() => {
    setViewingIngredient(null);
    setSelectedAnalysis(null);
    setActiveTab('ingredients');
  }, []);

  const handleUploadReport = useCallback(
    async (analysisId: string, file: File) => {
      if (!viewingIngredient) return;
      setUploadingReport(true);
      try {
        const formData = new FormData();
        formData.append('report', file);
        await api.postFormData(
          `/org/feed-ingredients/${viewingIngredient.id}/analyses/${analysisId}/report`,
          formData,
        );
        setSuccessMsg('Laudo enviado com sucesso');
        void refetchAnalyses();
        setTimeout(() => setSuccessMsg(null), 5000);
      } catch (err: unknown) {
        setDeleteError(err instanceof Error ? err.message : 'Erro ao enviar laudo.');
      } finally {
        setUploadingReport(false);
      }
    },
    [viewingIngredient, refetchAnalyses],
  );

  const handleExport = useCallback(async () => {
    try {
      const blob = await api.getBlob('/org/feed-ingredients/export');
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'ingredientes.csv';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Erro ao exportar.');
    }
  }, []);

  // ─── Import handlers ───────────────────────────────────
  const handleImportDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith('.csv') || file.name.endsWith('.xlsx'))) {
      setImportFile(file);
      setImportResult(null);
      setImportError(null);
    }
  }, []);

  const handleImportSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
      setImportError(null);
    }
  }, []);

  const handleImportSubmit = useCallback(async () => {
    if (!importFile) return;
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', importFile);
      const result = await api.postFormData<ImportResult>('/org/feed-ingredients/import', formData);
      setImportResult(result);
      setImportFile(null);
      void refetch();
    } catch (err: unknown) {
      setImportError(err instanceof Error ? err.message : 'Erro ao importar arquivo.');
    } finally {
      setImporting(false);
    }
  }, [importFile, refetch]);

  // ─── Quality trend max value for bars ──────────────────
  const trendMaxCp = trend.length > 0 ? Math.max(...trend.map((t) => t.cpPercent ?? 0), 1) : 1;

  return (
    <section className="feed-ingredients-page">
      {/* Header */}
      <header className="feed-ingredients-page__header">
        <div>
          <h1>Ingredientes e Análise Bromatológica</h1>
          <p>Cadastro de alimentos, ingredientes e seus laudos de análise</p>
        </div>
        <div className="feed-ingredients-page__actions">
          <button
            type="button"
            className="feed-ingredients-page__btn-secondary"
            onClick={handleExport}
          >
            <Download size={20} aria-hidden="true" />
            Exportar CSV
          </button>
          {activeTab === 'ingredients' && (
            <button
              type="button"
              className="feed-ingredients-page__btn-primary"
              onClick={() => {
                setSelectedIngredient(null);
                setShowIngredientModal(true);
              }}
            >
              <Plus size={20} aria-hidden="true" />
              Novo ingrediente
            </button>
          )}
        </div>
      </header>

      {/* Success / Error banners */}
      {successMsg && (
        <div className="feed-ingredients-page__success" role="status">
          <CheckCircle size={16} aria-hidden="true" />
          {successMsg}
        </div>
      )}

      {(error || deleteError || analysesError) && (
        <div className="feed-ingredients-page__error" role="alert">
          <AlertCircle size={16} aria-hidden="true" />
          {error || deleteError || analysesError}
        </div>
      )}

      {/* Tabs */}
      <nav className="feed-ingredients-page__tabs" aria-label="Abas de navegação">
        <button
          type="button"
          className={`feed-ingredients-page__tab ${activeTab === 'ingredients' ? 'feed-ingredients-page__tab--active' : ''}`}
          onClick={() => {
            setActiveTab('ingredients');
            setViewingIngredient(null);
            setSelectedAnalysis(null);
          }}
          aria-current={activeTab === 'ingredients' ? 'page' : undefined}
        >
          <Salad size={16} aria-hidden="true" />
          Ingredientes
        </button>
        <button
          type="button"
          className={`feed-ingredients-page__tab ${activeTab === 'analyses' ? 'feed-ingredients-page__tab--active' : ''}`}
          onClick={() => setActiveTab('analyses')}
          aria-current={activeTab === 'analyses' ? 'page' : undefined}
          disabled={!viewingIngredient}
        >
          <FlaskConical size={16} aria-hidden="true" />
          Análises
          {viewingIngredient && (
            <span className="feed-ingredients-page__tab-badge">{viewingIngredient.name}</span>
          )}
        </button>
        <button
          type="button"
          className={`feed-ingredients-page__tab ${activeTab === 'import' ? 'feed-ingredients-page__tab--active' : ''}`}
          onClick={() => setActiveTab('import')}
          aria-current={activeTab === 'import' ? 'page' : undefined}
        >
          <Upload size={16} aria-hidden="true" />
          Importar
        </button>
      </nav>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Ingredientes                                         */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'ingredients' && (
        <>
          {/* Toolbar */}
          <div className="feed-ingredients-page__toolbar">
            <div className="feed-ingredients-page__search">
              <Search size={16} aria-hidden="true" className="feed-ingredients-page__search-icon" />
              <input
                type="text"
                placeholder="Buscar por nome..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                aria-label="Buscar ingredientes"
              />
            </div>
            <div className="feed-ingredients-page__filter">
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                aria-label="Filtrar por tipo"
              >
                <option value="">Todos os tipos</option>
                {FEED_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Loading */}
          {isLoading && (
            <div className="feed-ingredients-page__loading">Carregando ingredientes...</div>
          )}

          {/* Empty */}
          {!isLoading && ingredients.length === 0 && (
            <div className="feed-ingredients-page__empty">
              <Salad size={48} aria-hidden="true" />
              <h2>Nenhum ingrediente cadastrado</h2>
              <p>Cadastre ingredientes para gerenciar a nutrição do rebanho ou importe via CSV.</p>
              <button
                type="button"
                className="feed-ingredients-page__btn-primary"
                onClick={() => {
                  setSelectedIngredient(null);
                  setShowIngredientModal(true);
                }}
              >
                <Plus size={20} aria-hidden="true" />
                Cadastrar primeiro ingrediente
              </button>
            </div>
          )}

          {/* Grid */}
          {!isLoading && ingredients.length > 0 && (
            <div className="feed-ingredients-page__grid">
              {ingredients.map((item) => (
                <div
                  key={item.id}
                  className="feed-ingredients-page__card"
                  onClick={() => handleViewAnalyses(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleViewAnalyses(item);
                    }
                  }}
                >
                  <div className="feed-ingredients-page__card-header">
                    <div>
                      <h3 className="feed-ingredients-page__card-title">{item.name}</h3>
                      <span
                        className={`feed-ingredients-page__badge ${TYPE_BADGE_CLASS[item.type] ?? ''}`}
                      >
                        {item.typeLabel}
                      </span>
                    </div>
                    <div className="feed-ingredients-page__card-actions">
                      <button
                        type="button"
                        className="feed-ingredients-page__card-btn"
                        onClick={(e) => handleEdit(item, e)}
                        aria-label={`Editar ${item.name}`}
                      >
                        <Pencil size={16} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        className="feed-ingredients-page__card-btn feed-ingredients-page__card-btn--delete"
                        onClick={(e) => void handleDelete(item, e)}
                        aria-label={`Excluir ${item.name}`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Cost */}
                  {item.costPerKg !== null && (
                    <p className="feed-ingredients-page__card-cost">
                      {formatCurrency(item.costPerKg)}
                      <span>/kg</span>
                    </p>
                  )}

                  {/* Reference params */}
                  <div className="feed-ingredients-page__card-params">
                    {item.refDmPercent !== null && (
                      <span className="feed-ingredients-page__param">
                        <span className="feed-ingredients-page__param-label">MS</span>
                        <span className="feed-ingredients-page__param-value">
                          {formatPercent(item.refDmPercent)}
                        </span>
                      </span>
                    )}
                    {item.refCpPercent !== null && (
                      <span className="feed-ingredients-page__param">
                        <span className="feed-ingredients-page__param-label">PB</span>
                        <span className="feed-ingredients-page__param-value">
                          {formatPercent(item.refCpPercent)}
                        </span>
                      </span>
                    )}
                    {item.refNdfPercent !== null && (
                      <span className="feed-ingredients-page__param">
                        <span className="feed-ingredients-page__param-label">FDN</span>
                        <span className="feed-ingredients-page__param-value">
                          {formatPercent(item.refNdfPercent)}
                        </span>
                      </span>
                    )}
                    {item.refTdnPercent !== null && (
                      <span className="feed-ingredients-page__param">
                        <span className="feed-ingredients-page__param-label">TDN</span>
                        <span className="feed-ingredients-page__param-value">
                          {formatPercent(item.refTdnPercent)}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Analysis count */}
                  <div className="feed-ingredients-page__card-footer">
                    <span className="feed-ingredients-page__analysis-count">
                      <FlaskConical size={14} aria-hidden="true" />
                      {item.analysisCount} {item.analysisCount === 1 ? 'análise' : 'análises'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {meta && meta.totalPages > 1 && (
            <nav className="feed-ingredients-page__pagination" aria-label="Paginação">
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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Análises                                             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'analyses' && (
        <>
          {!viewingIngredient ? (
            <div className="feed-ingredients-page__empty">
              <FlaskConical size={48} aria-hidden="true" />
              <h2>Selecione um ingrediente</h2>
              <p>Clique em um ingrediente na aba Ingredientes para visualizar suas análises.</p>
            </div>
          ) : (
            <>
              {/* Sub-header */}
              <div className="feed-ingredients-page__analyses-header">
                <button
                  type="button"
                  className="feed-ingredients-page__back-btn"
                  onClick={handleBackToList}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  Voltar
                </button>
                <div className="feed-ingredients-page__analyses-title">
                  <h2>{viewingIngredient.name}</h2>
                  <span
                    className={`feed-ingredients-page__badge ${TYPE_BADGE_CLASS[viewingIngredient.type] ?? ''}`}
                  >
                    {viewingIngredient.typeLabel}
                  </span>
                </div>
                <button
                  type="button"
                  className="feed-ingredients-page__btn-primary"
                  onClick={() => setShowAnalysisModal(true)}
                >
                  <Plus size={20} aria-hidden="true" />
                  Nova análise
                </button>
              </div>

              {/* Analyses loading */}
              {analysesLoading && (
                <div className="feed-ingredients-page__loading">Carregando análises...</div>
              )}

              {/* Analyses empty */}
              {!analysesLoading && analyses.length === 0 && (
                <div className="feed-ingredients-page__empty">
                  <FlaskConical size={48} aria-hidden="true" />
                  <h2>Nenhuma análise registrada</h2>
                  <p>Registre a primeira análise bromatológica deste ingrediente.</p>
                </div>
              )}

              {/* Analysis cards */}
              {!analysesLoading && analyses.length > 0 && (
                <div className="feed-ingredients-page__analyses-grid">
                  {analyses.map((a) => {
                    const isSelected = selectedAnalysis?.id === a.id;
                    return (
                      <div
                        key={a.id}
                        className={`feed-ingredients-page__analysis-card ${isSelected ? 'feed-ingredients-page__analysis-card--selected' : ''}`}
                        onClick={() => setSelectedAnalysis(isSelected ? null : a)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setSelectedAnalysis(isSelected ? null : a);
                          }
                        }}
                      >
                        <div className="feed-ingredients-page__analysis-card-top">
                          <div>
                            <span className="feed-ingredients-page__analysis-date">
                              {formatDate(a.collectionDate)}
                            </span>
                            {a.laboratory && (
                              <span className="feed-ingredients-page__analysis-lab">
                                {a.laboratory}
                              </span>
                            )}
                          </div>
                          {a.batchNumber && (
                            <span className="feed-ingredients-page__analysis-batch">
                              Lote {a.batchNumber}
                            </span>
                          )}
                        </div>

                        <div className="feed-ingredients-page__analysis-values">
                          {a.dmPercent !== null && (
                            <span className="feed-ingredients-page__val">
                              <span className="feed-ingredients-page__val-label">MS</span>
                              <span className="feed-ingredients-page__val-num">
                                {formatPercent(a.dmPercent)}
                              </span>
                            </span>
                          )}
                          {a.cpPercent !== null && (
                            <span className="feed-ingredients-page__val">
                              <span className="feed-ingredients-page__val-label">PB</span>
                              <span className="feed-ingredients-page__val-num">
                                {formatPercent(a.cpPercent)}
                              </span>
                            </span>
                          )}
                          {a.ndfPercent !== null && (
                            <span className="feed-ingredients-page__val">
                              <span className="feed-ingredients-page__val-label">FDN</span>
                              <span className="feed-ingredients-page__val-num">
                                {formatPercent(a.ndfPercent)}
                              </span>
                            </span>
                          )}
                          {a.tdnPercent !== null && (
                            <span className="feed-ingredients-page__val">
                              <span className="feed-ingredients-page__val-label">TDN</span>
                              <span className="feed-ingredients-page__val-num">
                                {formatPercent(a.tdnPercent)}
                              </span>
                            </span>
                          )}
                          {a.nelMcalKg !== null && (
                            <span className="feed-ingredients-page__val">
                              <span className="feed-ingredients-page__val-label">NEL</span>
                              <span className="feed-ingredients-page__val-num">
                                {a.nelMcalKg.toFixed(2)}
                              </span>
                            </span>
                          )}
                        </div>

                        {/* Report upload/indicator */}
                        <div className="feed-ingredients-page__analysis-card-footer">
                          {a.reportFileName ? (
                            <span className="feed-ingredients-page__report-tag">
                              <FileText size={14} aria-hidden="true" />
                              Laudo anexado
                            </span>
                          ) : (
                            <label className="feed-ingredients-page__upload-btn">
                              <Upload size={14} aria-hidden="true" />
                              Enviar laudo
                              <input
                                type="file"
                                accept=".pdf"
                                className="feed-ingredients-page__upload-input"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) void handleUploadReport(a.id, file);
                                }}
                                disabled={uploadingReport}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Analyses pagination */}
              {analysesMeta && analysesMeta.totalPages > 1 && (
                <nav
                  className="feed-ingredients-page__pagination"
                  aria-label="Paginação de análises"
                >
                  <button
                    type="button"
                    onClick={() => setAnalysisPage((p) => Math.max(1, p - 1))}
                    disabled={analysisPage <= 1}
                    aria-label="Página anterior"
                  >
                    <ChevronLeft size={16} aria-hidden="true" />
                    Anterior
                  </button>
                  <span>
                    {analysisPage} de {analysesMeta.totalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setAnalysisPage((p) => p + 1)}
                    disabled={analysisPage >= analysesMeta.totalPages}
                    aria-label="Próxima página"
                  >
                    Próxima
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                </nav>
              )}

              {/* ─── Comparison table ────────────────────────────── */}
              {selectedAnalysis && (
                <section
                  className="feed-ingredients-page__comparison"
                  aria-label="Comparação com referência"
                >
                  <h3 className="feed-ingredients-page__section-title">
                    Comparação com valores de referência
                  </h3>
                  {comparisonLoading ? (
                    <div className="feed-ingredients-page__loading">Carregando comparação...</div>
                  ) : comparison.length === 0 ? (
                    <p className="feed-ingredients-page__comparison-empty">
                      Nenhum valor de referência cadastrado para comparação.
                    </p>
                  ) : (
                    <div className="feed-ingredients-page__comparison-table-wrapper">
                      <table className="feed-ingredients-page__comparison-table">
                        <thead>
                          <tr>
                            <th scope="col">Parâmetro</th>
                            <th scope="col">Referência</th>
                            <th scope="col">Analisado</th>
                            <th scope="col">Desvio</th>
                            <th scope="col">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparison.map((row) => (
                            <tr key={row.param}>
                              <td>
                                {row.label} ({row.unit})
                              </td>
                              <td className="feed-ingredients-page__td-mono">
                                {row.reference !== null ? row.reference.toFixed(2) : '—'}
                              </td>
                              <td className="feed-ingredients-page__td-mono">
                                {row.actual !== null ? row.actual.toFixed(2) : '—'}
                              </td>
                              <td className="feed-ingredients-page__td-mono">
                                {row.deviation !== null
                                  ? `${row.deviation > 0 ? '+' : ''}${row.deviation.toFixed(2)}`
                                  : '—'}
                              </td>
                              <td>
                                <span
                                  className={`feed-ingredients-page__status feed-ingredients-page__status--${row.status.toLowerCase()}`}
                                >
                                  {row.status === 'LOW' && (
                                    <ArrowDown size={14} aria-hidden="true" />
                                  )}
                                  {row.status === 'NORMAL' && (
                                    <Check size={14} aria-hidden="true" />
                                  )}
                                  {row.status === 'HIGH' && (
                                    <ArrowUp size={14} aria-hidden="true" />
                                  )}
                                  {row.status === 'LOW' && 'Baixo'}
                                  {row.status === 'NORMAL' && 'Normal'}
                                  {row.status === 'HIGH' && 'Alto'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}

              {/* ─── Quality trend ───────────────────────────────── */}
              {trend.length > 0 && (
                <section
                  className="feed-ingredients-page__trend"
                  aria-label="Evolução da qualidade"
                >
                  <h3 className="feed-ingredients-page__section-title">
                    <TrendingUp size={16} aria-hidden="true" />
                    Evolução da qualidade (PB %)
                  </h3>
                  {trendLoading ? (
                    <div className="feed-ingredients-page__loading">Carregando tendência...</div>
                  ) : (
                    <div className="feed-ingredients-page__trend-bars">
                      {trend.map((point, i) => (
                        <div key={i} className="feed-ingredients-page__trend-bar-group">
                          <div className="feed-ingredients-page__trend-bar-wrapper">
                            <div
                              className="feed-ingredients-page__trend-bar"
                              style={{ height: `${((point.cpPercent ?? 0) / trendMaxCp) * 100}%` }}
                              title={`PB: ${formatPercent(point.cpPercent)}`}
                            />
                          </div>
                          <span className="feed-ingredients-page__trend-bar-value">
                            {point.cpPercent !== null ? point.cpPercent.toFixed(1) : '—'}
                          </span>
                          <span className="feed-ingredients-page__trend-bar-date">
                            {formatDate(point.date)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* TAB: Importar                                             */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {activeTab === 'import' && (
        <div className="feed-ingredients-page__import">
          <div
            className={`feed-ingredients-page__dropzone ${dragOver ? 'feed-ingredients-page__dropzone--active' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleImportDrop}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                fileInputRef.current?.click();
              }
            }}
            aria-label="Área de upload de arquivo CSV"
          >
            <Upload size={40} aria-hidden="true" />
            <h3>Arraste um arquivo CSV aqui</h3>
            <p>ou clique para selecionar</p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              className="feed-ingredients-page__upload-input"
              onChange={handleImportSelect}
            />
          </div>

          {importFile && (
            <div className="feed-ingredients-page__import-file">
              <FileText size={16} aria-hidden="true" />
              <span>{importFile.name}</span>
              <button
                type="button"
                className="feed-ingredients-page__btn-primary"
                onClick={handleImportSubmit}
                disabled={importing}
              >
                {importing ? 'Importando...' : 'Importar'}
              </button>
            </div>
          )}

          {importError && (
            <div className="feed-ingredients-page__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {importError}
            </div>
          )}

          {importResult && (
            <div className="feed-ingredients-page__import-result" role="status">
              <CheckCircle size={16} aria-hidden="true" />
              <span>{importResult.imported} ingredientes importados com sucesso.</span>
              {importResult.errors.length > 0 && (
                <div className="feed-ingredients-page__import-errors">
                  <p>{importResult.errors.length} erros encontrados:</p>
                  <ul>
                    {importResult.errors.slice(0, 10).map((err, i) => (
                      <li key={i}>
                        Linha {err.row}: {err.message}
                      </li>
                    ))}
                    {importResult.errors.length > 10 && (
                      <li>...e mais {importResult.errors.length - 10} erros</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── Modals ──────────────────────────────────────────── */}
      <FeedIngredientModal
        isOpen={showIngredientModal}
        onClose={() => {
          setShowIngredientModal(false);
          setSelectedIngredient(null);
        }}
        ingredient={selectedIngredient}
        onSuccess={handleIngredientSuccess}
      />

      {viewingIngredient && (
        <AnalysisModal
          isOpen={showAnalysisModal}
          onClose={() => setShowAnalysisModal(false)}
          feedId={viewingIngredient.id}
          feedName={viewingIngredient.name}
          onSuccess={handleAnalysisSuccess}
        />
      )}
    </section>
  );
}
