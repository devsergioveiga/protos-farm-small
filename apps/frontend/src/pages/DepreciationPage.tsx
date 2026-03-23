import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import { useDepreciationReport } from '@/hooks/useDepreciationReport';
import { useDepreciationRun } from '@/hooks/useDepreciationRun';
import DepreciationReportTable from '@/components/depreciation/DepreciationReportTable';
import DepreciationRunBadge from '@/components/depreciation/DepreciationRunBadge';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { DepreciationTrack } from '@/types/depreciation';
import { MONTH_LABELS, TRACK_LABELS } from '@/types/depreciation';
import './DepreciationPage.css';

// ─── DepreciationPage ─────────────────────────────────────────────────────────

export default function DepreciationPage() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [periodYear, setPeriodYear] = useState(currentYear);
  const [periodMonth, setPeriodMonth] = useState(currentMonth);
  const [track, setTrack] = useState<DepreciationTrack>('FISCAL');
  const [currentPage, setCurrentPage] = useState(1);

  const [showRunConfirm, setShowRunConfirm] = useState(false);
  const [showReverseConfirm, setShowReverseConfirm] = useState(false);
  const [entryToReverse, setEntryToReverse] = useState<{ id: string; assetName: string } | null>(
    null,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [isReversing, setIsReversing] = useState(false);

  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning';
  } | null>(null);
  const [toastPersistent, setToastPersistent] = useState(false);

  const {
    data: reportData,
    loading: reportLoading,
    fetchReport,
    reverseEntry,
    exportReport,
  } = useDepreciationReport();

  const { lastRun, triggerRun, getLastRun } = useDepreciationRun();

  // Load report and last run
  const loadAll = useCallback(() => {
    void fetchReport(periodYear, periodMonth, track, undefined, currentPage);
    void getLastRun(periodYear, periodMonth, track);
  }, [fetchReport, getLastRun, periodYear, periodMonth, track, currentPage]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast && !toastPersistent) {
      const t = setTimeout(() => setToast(null), 5000);
      return () => clearTimeout(t);
    }
  }, [toast, toastPersistent]);

  // Close export menu on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    }
    if (showExportMenu) {
      document.addEventListener('mousedown', handler);
      return () => document.removeEventListener('mousedown', handler);
    }
  }, [showExportMenu]);

  // Year options
  const years = [currentYear, currentYear - 1, currentYear - 2];

  function showToastMsg(
    message: string,
    type: 'success' | 'error' | 'warning',
    persistent = false,
  ) {
    setToast({ message, type });
    setToastPersistent(persistent);
  }

  // Run handler
  async function handleRunConfirm() {
    setIsRunning(true);
    try {
      const run = await triggerRun({ periodYear, periodMonth, track });
      const monthLabel = MONTH_LABELS[periodMonth];
      showToastMsg(
        `Depreciacao de ${monthLabel}/${periodYear} executada. ${run.processedCount} ativo(s) processado(s).`,
        'success',
      );
      if (run.skippedCount > 0) {
        showToastMsg(
          `Depreciacao executada com ${run.skippedCount} ativo(s) ignorado(s).`,
          'warning',
        );
      }
      loadAll();
    } catch {
      showToastMsg(
        'Nao foi possivel executar a depreciacao. Verifique sua conexao e tente novamente.',
        'error',
        true,
      );
    } finally {
      setIsRunning(false);
      setShowRunConfirm(false);
    }
  }

  // Reverse handler
  function handleReverseRequest(entryId: string) {
    const entry = reportData?.entries.find((e) => e.id === entryId);
    setEntryToReverse({ id: entryId, assetName: entry?.asset.name ?? 'ativo' });
    setShowReverseConfirm(true);
  }

  async function handleReverseConfirm() {
    if (!entryToReverse) return;
    setIsReversing(true);
    try {
      await reverseEntry(entryToReverse.id);
      showToastMsg('Lancamento de depreciacao estornado com sucesso.', 'success');
      loadAll();
    } catch {
      showToastMsg('Nao foi possivel estornar o lancamento. Tente novamente.', 'error', true);
    } finally {
      setIsReversing(false);
      setShowReverseConfirm(false);
      setEntryToReverse(null);
    }
  }

  // Export handlers
  async function handleExport(format: 'csv' | 'xlsx') {
    setShowExportMenu(false);
    try {
      await exportReport(periodYear, periodMonth, track, format);
    } catch {
      showToastMsg('Nao foi possivel exportar o relatorio. Tente novamente.', 'error');
    }
  }

  const monthLabel = MONTH_LABELS[periodMonth];
  const trackLabel = TRACK_LABELS[track];

  return (
    <main className="depreciation-page" id="main-content">
      {/* Breadcrumb */}
      <nav className="depreciation-page__breadcrumb" aria-label="Caminho de navegacao">
        <span className="depreciation-page__breadcrumb-item">Patrimonio</span>
        <span className="depreciation-page__breadcrumb-sep" aria-hidden="true">
          &gt;
        </span>
        <span
          className="depreciation-page__breadcrumb-item depreciation-page__breadcrumb-item--current"
          aria-current="page"
        >
          Depreciacao
        </span>
      </nav>

      {/* Header */}
      <header className="depreciation-page__header">
        <h1 className="depreciation-page__title">Depreciacao</h1>
        <div className="depreciation-page__header-actions">
          {/* Run badge */}
          <div className="depreciation-page__badge-slot">
            <DepreciationRunBadge run={lastRun ?? null} />
          </div>

          {/* Period selectors */}
          <div className="depreciation-page__selectors">
            <div className="depreciation-page__selector-group">
              <label htmlFor="depr-year" className="depreciation-page__selector-label">
                Ano
              </label>
              <select
                id="depr-year"
                className="depreciation-page__select"
                value={periodYear}
                onChange={(e) => {
                  setPeriodYear(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="depreciation-page__selector-group">
              <label htmlFor="depr-month" className="depreciation-page__selector-label">
                Mes
              </label>
              <select
                id="depr-month"
                className="depreciation-page__select"
                value={periodMonth}
                onChange={(e) => {
                  setPeriodMonth(parseInt(e.target.value, 10));
                  setCurrentPage(1);
                }}
              >
                {Object.entries(MONTH_LABELS).map(([num, name]) => (
                  <option key={num} value={num}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div className="depreciation-page__selector-group">
              <label htmlFor="depr-track" className="depreciation-page__selector-label">
                Track
              </label>
              <select
                id="depr-track"
                className="depreciation-page__select"
                value={track}
                onChange={(e) => {
                  setTrack(e.target.value as DepreciationTrack);
                  setCurrentPage(1);
                }}
              >
                <option value="FISCAL">Fiscal (RFB)</option>
                <option value="MANAGERIAL">Gerencial</option>
              </select>
            </div>
          </div>

          {/* Export dropdown */}
          <div className="depreciation-page__export-wrapper" ref={exportMenuRef}>
            <button
              type="button"
              className="depreciation-page__btn depreciation-page__btn--secondary"
              aria-haspopup="true"
              aria-expanded={showExportMenu}
              onClick={() => setShowExportMenu((v) => !v)}
            >
              Exportar
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            {showExportMenu && (
              <ul
                className="depreciation-page__export-menu"
                role="menu"
                aria-label="Opcoes de exportacao"
              >
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="depreciation-page__export-item"
                    onClick={() => void handleExport('csv')}
                  >
                    Exportar CSV
                  </button>
                </li>
                <li role="none">
                  <button
                    type="button"
                    role="menuitem"
                    className="depreciation-page__export-item"
                    onClick={() => void handleExport('xlsx')}
                  >
                    Exportar XLSX
                  </button>
                </li>
              </ul>
            )}
          </div>

          {/* Run button */}
          <button
            type="button"
            className="depreciation-page__btn depreciation-page__btn--primary"
            onClick={() => setShowRunConfirm(true)}
            disabled={isRunning}
          >
            {isRunning ? 'Executando...' : 'Executar Depreciacao'}
          </button>
        </div>
      </header>

      {/* Skipped warning banner */}
      {lastRun && lastRun.skippedCount > 0 && (
        <div className="depreciation-page__skipped-banner" role="alert">
          {lastRun.skippedCount} ativo(s) ignorado(s) nesta execucao. Verifique as configuracoes
          pendentes.
        </div>
      )}

      {/* Report table */}
      <DepreciationReportTable
        entries={reportData?.entries ?? []}
        total={reportData?.total ?? 0}
        page={currentPage}
        limit={20}
        onPageChange={(p) => {
          setCurrentPage(p);
        }}
        onReverse={handleReverseRequest}
        loading={reportLoading}
        onRunClick={() => setShowRunConfirm(true)}
      />

      {/* Run confirmation */}
      <ConfirmModal
        isOpen={showRunConfirm}
        title="Executar depreciacao"
        message={`Executar depreciacao de ${monthLabel}/${periodYear} — track ${trackLabel}? Esta acao processa todos os ativos depreciaveis da organizacao.`}
        confirmLabel="Executar depreciacao"
        cancelLabel="Cancelar"
        variant="warning"
        isLoading={isRunning}
        onConfirm={() => void handleRunConfirm()}
        onCancel={() => setShowRunConfirm(false)}
      />

      {/* Reverse confirmation */}
      <ConfirmModal
        isOpen={showReverseConfirm}
        title="Estornar lancamento"
        message={`Estornar o lancamento de depreciacao de ${entryToReverse?.assetName ?? 'ativo'} em ${monthLabel}/${periodYear}? Esta acao cria um lancamento de estorno e nao pode ser desfeita.`}
        confirmLabel="Estornar lancamento"
        cancelLabel="Cancelar"
        variant="danger"
        isLoading={isReversing}
        onConfirm={() => void handleReverseConfirm()}
        onCancel={() => {
          setShowReverseConfirm(false);
          setEntryToReverse(null);
        }}
      />

      {/* Toast */}
      {toast && (
        <div
          className={`depreciation-page__toast depreciation-page__toast--${toast.type}`}
          role={toast.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
        >
          {toast.message}
          {toastPersistent && (
            <button
              type="button"
              className="depreciation-page__toast-close"
              onClick={() => setToast(null)}
              aria-label="Fechar notificacao"
            >
              &times;
            </button>
          )}
        </div>
      )}
    </main>
  );
}
