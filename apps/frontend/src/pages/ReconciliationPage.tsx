import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Upload, ChevronLeft } from 'lucide-react';
import { useImportHistory } from '@/hooks/useReconciliation';
import ImportHistoryTable from '@/components/reconciliation/ImportHistoryTable';
import ImportPreviewModal from '@/components/reconciliation/ImportPreviewModal';
import ReconciliationLineList from '@/components/reconciliation/ReconciliationLineList';
import './ReconciliationPage.css';

// ─── Main Page ────────────────────────────────────────────────────

export default function ReconciliationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const selectedImportId = searchParams.get('importId');

  const { imports, loading, error, refetch } = useImportHistory();

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 5000);
  }, []);

  const handleRowClick = useCallback(
    (importId: string) => {
      setSearchParams({ importId });
    },
    [setSearchParams],
  );

  const handleBack = useCallback(() => {
    setSearchParams({});
  }, [setSearchParams]);

  const handleImportSuccess = useCallback(
    (importedLines: number, duplicatesSkipped: number) => {
      setIsImportModalOpen(false);
      void refetch();
      showToast(
        `${importedLines} linha${importedLines !== 1 ? 's' : ''} importada${importedLines !== 1 ? 's' : ''} com sucesso. ${duplicatesSkipped} duplicata${duplicatesSkipped !== 1 ? 's' : ''} ignorada${duplicatesSkipped !== 1 ? 's' : ''}.`,
      );
    },
    [refetch, showToast],
  );

  // Find selected import info for session header
  const selectedImport = selectedImportId
    ? imports.find((imp) => imp.id === selectedImportId)
    : null;

  // Sync importId from URL when imports load (for deep linking)
  useEffect(() => {
    if (selectedImportId && imports.length > 0 && !selectedImport) {
      // Import not in current page, keep URL as-is (backend will serve the lines)
    }
  }, [selectedImportId, imports, selectedImport]);

  return (
    <main className="reconciliation-page" id="main-content">
      {toast && (
        <div className="reconciliation-page__toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}

      {/* Header */}
      <header className="reconciliation-page__header">
        <div>
          <nav className="reconciliation-page__breadcrumb" aria-label="Navegação estrutural">
            <a href="/financial-dashboard">Financeiro</a>
            <span aria-hidden="true"> &rsaquo; </span>
            <span aria-current="page">Conciliação Bancária</span>
          </nav>
          <h1 className="reconciliation-page__title">Conciliação Bancária</h1>
          <p className="reconciliation-page__subtitle">
            Importe extratos e concilie com os lançamentos do sistema
          </p>
        </div>
        {!selectedImportId && (
          <button
            type="button"
            className="reconciliation-page__btn-primary"
            onClick={() => setIsImportModalOpen(true)}
          >
            <Upload size={20} aria-hidden="true" />
            Nova Importação
          </button>
        )}
      </header>

      {/* Error */}
      {error && !selectedImportId && (
        <div className="reconciliation-page__error" role="alert">
          {error}
        </div>
      )}

      {/* ── History view ── */}
      {!selectedImportId && (
        <ImportHistoryTable
          imports={imports}
          loading={loading}
          onRowClick={handleRowClick}
          onNewImport={() => setIsImportModalOpen(true)}
        />
      )}

      {/* ── Reconciliation session view ── */}
      {selectedImportId && (
        <>
          <div className="reconciliation-page__session-header">
            <button
              type="button"
              className="reconciliation-page__back-btn"
              onClick={handleBack}
              aria-label="Voltar ao histórico de importações"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              Voltar
            </button>
            <div>
              <h2 className="reconciliation-page__session-title">
                {selectedImport?.fileName ?? 'Conciliação'}
              </h2>
              {selectedImport && (
                <p className="reconciliation-page__session-meta">
                  {selectedImport.importedLines} linha
                  {selectedImport.importedLines !== 1 ? 's' : ''} importada
                  {selectedImport.importedLines !== 1 ? 's' : ''} — {selectedImport.pendingLines}{' '}
                  pendente
                  {selectedImport.pendingLines !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <ReconciliationLineList
            importId={selectedImportId}
            bankAccountId={selectedImport?.bankAccountId ?? ''}
            onBack={handleBack}
            onActionSuccess={showToast}
          />
        </>
      )}

      {/* Import modal */}
      {isImportModalOpen && (
        <ImportPreviewModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </main>
  );
}
