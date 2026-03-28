import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useSpedEcd } from '@/hooks/useSpedEcd';
import { useFiscalYears } from '@/hooks/useFiscalPeriods';
import { useAuth } from '@/stores/AuthContext';
import { api } from '@/services/api';
import ValidationPanel from '@/components/sped-ecd/ValidationPanel';
import NotesTextarea from '@/components/sped-ecd/NotesTextarea';
import './SpedEcdPage.css';

interface CostCenter {
  id: string;
  name: string;
}

type ActiveTab = 'sped' | 'report';

export default function SpedEcdPage() {
  const { user } = useAuth();
  const orgId = user?.organizationId ?? undefined;
  const { data: fiscalYears } = useFiscalYears();

  const [selectedFyId, setSelectedFyId] = useState('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('sped');
  const [costCenterId, setCostCenterId] = useState('');
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);

  const {
    validationResult,
    validationLoading,
    validate,
    spedDownloading,
    downloadSped,
    pdfDownloading,
    downloadPdf,
    notesText,
    setNotesText,
    notesSaved,
    notesLoading,
    loadNotes,
    saveNotes,
    toast,
  } = useSpedEcd(orgId);

  // Load notes on mount
  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  // Fetch cost centers
  useEffect(() => {
    if (!orgId) return;
    void api
      .get<CostCenter[]>(`/org/${orgId}/cost-centers`)
      .then((data) => setCostCenters(data))
      .catch(() => {
        // Non-blocking: cost center filter is optional
      });
  }, [orgId]);

  // Auto-validate on fiscal year change
  const handleFyChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const fyId = e.target.value;
      setSelectedFyId(fyId);
      if (fyId) {
        void validate(fyId);
      }
    },
    [validate],
  );

  const handleDownloadSped = useCallback(() => {
    void downloadSped(selectedFyId);
  }, [downloadSped, selectedFyId]);

  const handleDownloadPdf = useCallback(() => {
    void downloadPdf(selectedFyId, costCenterId || undefined);
  }, [downloadPdf, selectedFyId, costCenterId]);

  return (
    <main id="main-content" className="sped-ecd-page">
      {/* Breadcrumb */}
      <nav aria-label="Caminho da pagina" className="sped-ecd-page__breadcrumb">
        <ol className="sped-ecd-page__breadcrumb-list">
          <li className="sped-ecd-page__breadcrumb-item">
            <Link to="/">Inicio</Link>
          </li>
          <li className="sped-ecd-page__breadcrumb-sep" aria-hidden="true">/</li>
          <li className="sped-ecd-page__breadcrumb-item">
            <Link to="/chart-of-accounts">Contabilidade</Link>
          </li>
          <li className="sped-ecd-page__breadcrumb-sep" aria-hidden="true">/</li>
          <li className="sped-ecd-page__breadcrumb-item sped-ecd-page__breadcrumb-item--current">
            SPED / Relatorios
          </li>
        </ol>
      </nav>

      {/* Page header */}
      <header className="sped-ecd-page__header">
        <FileText size={24} aria-hidden="true" className="sped-ecd-page__header-icon" />
        <h1 className="sped-ecd-page__title">SPED ECD e Relatorios</h1>
      </header>

      {/* Fiscal year selector (shared between tabs) */}
      <section className="sped-ecd-page__filter-bar" aria-label="Periodo">
        <div className="sped-ecd-page__filter-group">
          <label htmlFor="sped-fy-select" className="sped-ecd-page__filter-label">
            Exercicio Fiscal
          </label>
          <select
            id="sped-fy-select"
            className="sped-ecd-page__select"
            value={selectedFyId}
            onChange={handleFyChange}
          >
            <option value="">Selecione o exercicio</option>
            {fiscalYears.map((fy) => (
              <option key={fy.id} value={fy.id}>
                {fy.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* Tab rail */}
      <nav role="tablist" className="sped-ecd-page__tabs" aria-label="Secoes da pagina">
        <button
          id="tab-sped"
          type="button"
          role="tab"
          aria-selected={activeTab === 'sped'}
          aria-controls="panel-sped"
          onClick={() => setActiveTab('sped')}
          className={`sped-ecd-page__tab ${activeTab === 'sped' ? 'sped-ecd-page__tab--active' : ''}`}
        >
          SPED ECD
        </button>
        <button
          id="tab-report"
          type="button"
          role="tab"
          aria-selected={activeTab === 'report'}
          aria-controls="panel-report"
          onClick={() => setActiveTab('report')}
          className={`sped-ecd-page__tab ${activeTab === 'report' ? 'sped-ecd-page__tab--active' : ''}`}
        >
          Relatorio Integrado
        </button>
      </nav>

      {/* Tab panel: SPED ECD */}
      <section
        id="panel-sped"
        role="tabpanel"
        aria-labelledby="tab-sped"
        hidden={activeTab !== 'sped'}
        className="sped-ecd-page__panel"
      >
        {!selectedFyId ? (
          <div className="sped-ecd-page__empty">
            <FileText size={48} aria-hidden="true" className="sped-ecd-page__empty-icon" />
            <h2 className="sped-ecd-page__empty-title">Selecione o exercicio fiscal</h2>
            <p className="sped-ecd-page__empty-desc">
              Escolha um exercicio fiscal para executar a pre-validacao e gerar o arquivo SPED ECD.
            </p>
          </div>
        ) : (
          <>
            <ValidationPanel result={validationResult} loading={validationLoading} />
            <div className="sped-ecd-page__action-bar">
              <button
                type="button"
                className="sped-ecd-page__btn sped-ecd-page__btn--primary"
                disabled={!selectedFyId || !!(validationResult?.hasErrors) || spedDownloading}
                aria-disabled={!selectedFyId || !!(validationResult?.hasErrors)}
                title={
                  validationResult?.hasErrors
                    ? 'Corrija os erros acima para gerar o arquivo'
                    : undefined
                }
                onClick={handleDownloadSped}
              >
                {spedDownloading ? 'Gerando arquivo...' : 'Gerar SPED ECD'}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Tab panel: Relatorio Integrado */}
      <section
        id="panel-report"
        role="tabpanel"
        aria-labelledby="tab-report"
        hidden={activeTab !== 'report'}
        className="sped-ecd-page__panel"
      >
        {!selectedFyId ? (
          <div className="sped-ecd-page__empty">
            <FileText size={48} aria-hidden="true" className="sped-ecd-page__empty-icon" />
            <h2 className="sped-ecd-page__empty-title">Selecione o exercicio fiscal</h2>
            <p className="sped-ecd-page__empty-desc">
              Escolha um exercicio fiscal para gerar o Relatorio Integrado.
            </p>
          </div>
        ) : (
          <>
            {/* Farm selector (optional) */}
            <div className="sped-ecd-page__filter-group sped-ecd-page__filter-group--inline">
              <label htmlFor="farm-select" className="sped-ecd-page__filter-label">
                Fazenda (opcional)
              </label>
              <select
                id="farm-select"
                className="sped-ecd-page__select"
                value={costCenterId}
                onChange={(e) => setCostCenterId(e.target.value)}
              >
                <option value="">Consolidado (todas as fazendas)</option>
                {costCenters.map((cc) => (
                  <option key={cc.id} value={cc.id}>
                    {cc.name}
                  </option>
                ))}
              </select>
            </div>

            <NotesTextarea
              value={notesText}
              onChange={setNotesText}
              onSave={saveNotes}
              saved={notesSaved}
              loading={notesLoading}
            />

            <div className="sped-ecd-page__action-bar">
              <button
                type="button"
                className="sped-ecd-page__btn sped-ecd-page__btn--primary"
                disabled={!selectedFyId || pdfDownloading}
                onClick={handleDownloadPdf}
              >
                {pdfDownloading ? 'Gerando PDF...' : 'Gerar Relatorio PDF'}
              </button>
            </div>
          </>
        )}
      </section>

      {/* Toast */}
      {toast && (
        <div
          className={`sped-ecd-page__toast sped-ecd-page__toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.message}
        </div>
      )}
    </main>
  );
}
