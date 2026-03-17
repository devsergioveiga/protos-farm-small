import { useState, useCallback, useRef, useEffect } from 'react';
import { X, Upload, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';
import { useReconciliationActions } from '@/hooks/useReconciliation';
import { useBankAccounts } from '@/hooks/useBankAccounts';
import type { ImportPreviewResponse } from '@/hooks/useReconciliation';
import './ReconciliationModal.css';

// ─── Types ──────────────────────────────────────────────────────────

type Step = 1 | 2;

interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
  type: string;
}

interface ImportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (importedLines: number, duplicatesSkipped: number) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatBRL(val: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Component ────────────────────────────────────────────────────

const ImportPreviewModal = ({ isOpen, onClose, onSuccess }: ImportPreviewModalProps) => {
  const [step, setStep] = useState<Step>(1);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({
    date: '',
    amount: '',
    description: '',
    type: '',
  });
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [manualBankAccountId, setManualBankAccountId] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadPreview, confirmImport } = useReconciliationActions();
  const { accounts: bankAccounts } = useBankAccounts();

  // Escape handler
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  }, []);

  const handleAdvance = useCallback(async () => {
    if (!selectedFile) return;

    // Check file size limit (5000 lines) — we preview first to know the line count
    setIsPreviewing(true);
    setPreviewError(null);

    try {
      const data = await uploadPreview(selectedFile);
      setPreviewData(data);

      // Set suggested column mapping for CSV
      if (data.fileType === 'CSV' && data.suggestedMapping) {
        setColumnMapping({
          date: data.suggestedMapping.date ?? '',
          amount: data.suggestedMapping.amount ?? '',
          description: data.suggestedMapping.description ?? '',
          type: data.suggestedMapping.type ?? '',
        });
      }

      // Check line limit
      if (data.totalLines > 5000) {
        setPreviewError('Arquivo muito grande. O limite é 5.000 linhas por importação.');
        setIsPreviewing(false);
        return;
      }

      // Select all lines by default
      const allIndices = new Set(data.lines.map((l) => l.index));
      setSelectedIndices(allIndices);

      // OFX skips step 1
      if (data.fileType === 'OFX') {
        setStep(2);
      } else {
        setStep(1);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      setPreviewError(`Não foi possível importar o arquivo. ${msg}`);
    } finally {
      setIsPreviewing(false);
    }
  }, [selectedFile, uploadPreview]);

  const handleToStep2 = useCallback(() => {
    setStep(2);
  }, []);

  const isMappingValid =
    previewData?.fileType === 'OFX' ||
    (columnMapping.date !== '' && columnMapping.amount !== '' && columnMapping.description !== '');

  const toggleLine = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const allSelected = previewData
    ? previewData.lines.every((l) => selectedIndices.has(l.index))
    : false;

  const toggleAll = useCallback(() => {
    if (!previewData) return;
    if (allSelected) {
      setSelectedIndices(new Set());
    } else {
      setSelectedIndices(new Set(previewData.lines.map((l) => l.index)));
    }
  }, [previewData, allSelected]);

  const handleSubmit = useCallback(async () => {
    if (!selectedFile || !previewData) return;

    const bankAccountId = previewData.bankAccountId ?? manualBankAccountId;

    if (!bankAccountId) {
      setSubmitError('Selecione a conta bancária antes de importar.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const selectedLineIndices = Array.from(selectedIndices);
      const mappingToSend =
        previewData.fileType === 'CSV'
          ? {
              date: columnMapping.date,
              amount: columnMapping.amount,
              description: columnMapping.description,
              type: columnMapping.type || undefined,
            }
          : undefined;

      const result = await confirmImport(
        selectedFile,
        bankAccountId,
        selectedLineIndices,
        mappingToSend as Record<string, string> | undefined,
      );

      onSuccess(result.importedLines, result.duplicatesSkipped);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao importar';
      setSubmitError(
        `Não foi possível importar o arquivo. Verifique o formato e tente novamente. ${msg}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    selectedFile,
    previewData,
    selectedIndices,
    columnMapping,
    manualBankAccountId,
    confirmImport,
    onSuccess,
  ]);

  if (!isOpen) return null;

  const isInitialStep = !previewData;
  const showStepIndicator = previewData?.fileType === 'CSV';

  return (
    <div
      className="recon-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Importar extrato bancário"
    >
      <div className="recon-modal__panel recon-modal__panel--wide">
        {/* Header */}
        <header className="recon-modal__header">
          <div className="recon-modal__header-icon" aria-hidden="true">
            <Upload size={20} />
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="recon-modal__title">Importar extrato bancário</h2>
            {showStepIndicator && (
              <p className="recon-modal__step-indicator">
                <span
                  className={`recon-modal__step ${step === 1 ? 'recon-modal__step--active' : ''}`}
                >
                  1. Mapeamento
                </span>{' '}
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  style={{ display: 'inline', verticalAlign: 'middle' }}
                />{' '}
                <span
                  className={`recon-modal__step ${step === 2 ? 'recon-modal__step--active' : ''}`}
                >
                  2. Seleção
                </span>
              </p>
            )}
          </div>
          <button
            type="button"
            className="recon-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <div className="recon-modal__body">
          {/* ── File upload (initial or before step 1) ── */}
          {isInitialStep && (
            <>
              {previewError && (
                <div className="recon-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {previewError}
                </div>
              )}

              <div
                className={`recon-modal__dropzone${isDragging ? ' recon-modal__dropzone--dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Área de upload — clique ou arraste o arquivo OFX ou CSV"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
              >
                <Upload size={48} aria-hidden="true" className="recon-modal__dropzone-icon" />
                <p className="recon-modal__dropzone-title">
                  {selectedFile ? selectedFile.name : 'Arraste o arquivo ou clique para selecionar'}
                </p>
                <p className="recon-modal__dropzone-hint">Formatos aceitos: .ofx, .csv</p>
                <label htmlFor="recon-file-input" className="sr-only">
                  Selecionar arquivo de extrato bancário
                </label>
                <input
                  id="recon-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".ofx,.csv"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  aria-label="Selecionar arquivo de extrato bancário"
                />
              </div>

              {selectedFile && (
                <div className="recon-modal__file-info">
                  <CheckCircle2
                    size={16}
                    aria-hidden="true"
                    className="recon-modal__file-info-icon"
                  />
                  <span className="recon-modal__file-info-name">{selectedFile.name}</span>
                  <span className="recon-modal__file-info-size">
                    — {formatFileSize(selectedFile.size)}
                  </span>
                  <span className="recon-modal__file-type-badge">
                    {selectedFile.name.toLowerCase().endsWith('.ofx') ? 'OFX' : 'CSV'}
                  </span>
                </div>
              )}
            </>
          )}

          {/* ── Step 1: CSV column mapping ── */}
          {previewData && previewData.fileType === 'CSV' && step === 1 && (
            <>
              <p className="recon-modal__section-title">
                Mapeamento de colunas detectado automaticamente. Ajuste se necessário.
              </p>
              <div className="recon-modal__mapping-grid">
                {(['date', 'amount', 'description', 'type'] as const).map((field) => {
                  const labels = {
                    date: 'Data *',
                    amount: 'Valor *',
                    description: 'Descrição *',
                    type: 'Tipo (opcional)',
                  };
                  return (
                    <div key={field} className="recon-modal__mapping-row">
                      <label htmlFor={`recon-col-${field}`} className="recon-modal__mapping-label">
                        {labels[field]}
                      </label>
                      <select
                        id={`recon-col-${field}`}
                        className="recon-modal__mapping-select"
                        value={columnMapping[field]}
                        onChange={(e) =>
                          setColumnMapping((prev) => ({ ...prev, [field]: e.target.value }))
                        }
                      >
                        <option value="">— Selecionar coluna —</option>
                        {(previewData.headers ?? []).map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>

              {/* Preview of first 3 rows */}
              {previewData.lines.length > 0 && (
                <div className="recon-modal__preview-hint">
                  <p className="recon-modal__preview-hint-label">
                    Pré-visualização (3 primeiras linhas):
                  </p>
                  <div className="recon-modal__preview-table-wrap">
                    <table className="recon-modal__preview-table">
                      <thead>
                        <tr>
                          <th scope="col">Data</th>
                          <th scope="col">Valor</th>
                          <th scope="col">Descrição</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.lines.slice(0, 3).map((line) => (
                          <tr key={line.index}>
                            <td className="recon-modal__col-mono">{formatDate(line.date)}</td>
                            <td className="recon-modal__col-mono">{formatBRL(line.amount)}</td>
                            <td>{line.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Line selection ── */}
          {previewData && step === 2 && (
            <>
              {/* OFX bank account detection */}
              {previewData.fileType === 'OFX' && (
                <div className="recon-modal__bank-info">
                  {previewData.bankAccountName ? (
                    <div className="recon-modal__bank-detected">
                      <CheckCircle2 size={16} aria-hidden="true" />
                      Conta detectada: <strong>{previewData.bankAccountName}</strong>
                    </div>
                  ) : (
                    <div className="recon-modal__bank-not-found">
                      <AlertCircle size={16} aria-hidden="true" />
                      <span>
                        Conta bancária não identificada no arquivo. Selecione a conta abaixo.
                      </span>
                      <div className="recon-modal__bank-select-wrap">
                        <label htmlFor="recon-bank-account" className="recon-modal__mapping-label">
                          Conta bancária *
                        </label>
                        <select
                          id="recon-bank-account"
                          className="recon-modal__mapping-select"
                          value={manualBankAccountId}
                          onChange={(e) => setManualBankAccountId(e.target.value)}
                        >
                          <option value="">— Selecionar conta —</option>
                          {bankAccounts.map((ba) => (
                            <option key={ba.id} value={ba.id}>
                              {ba.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {submitError && (
                <div className="recon-modal__error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {submitError}
                </div>
              )}

              <div className="recon-modal__selection-wrap">
                <table className="recon-modal__selection-table">
                  <caption className="sr-only">
                    Linhas do extrato para importação — selecione as que deseja importar
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleAll}
                          aria-label="Selecionar todas as linhas"
                          className="recon-modal__checkbox"
                        />
                      </th>
                      <th scope="col">Tipo</th>
                      <th scope="col">Data</th>
                      <th scope="col" className="recon-modal__col-right">
                        Valor
                      </th>
                      <th scope="col">Descrição</th>
                    </tr>
                  </thead>
                  <tbody>
                    {previewData.lines.map((line) => (
                      <tr key={line.index}>
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedIndices.has(line.index)}
                            onChange={() => toggleLine(line.index)}
                            aria-label={`Selecionar linha ${line.description}`}
                            className="recon-modal__checkbox"
                          />
                        </td>
                        <td>
                          <span
                            className={`recon-modal__type-badge recon-modal__type-badge--${line.type.toLowerCase()}`}
                          >
                            {line.type === 'CREDIT' ? 'CRÉDITO' : 'DÉBITO'}
                          </span>
                        </td>
                        <td className="recon-modal__col-mono">{formatDate(line.date)}</td>
                        <td className="recon-modal__col-right recon-modal__col-mono">
                          {formatBRL(line.amount)}
                        </td>
                        <td className="recon-modal__description">{line.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="recon-modal__selection-footer">
                <span className="recon-modal__selection-count">
                  {selectedIndices.size} de {previewData.lines.length} linhas selecionadas
                </span>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <footer className="recon-modal__footer">
          <button type="button" className="recon-modal__btn-cancel" onClick={onClose}>
            Cancelar
          </button>

          {isInitialStep && (
            <button
              type="button"
              className="recon-modal__btn-submit"
              disabled={!selectedFile || isPreviewing}
              onClick={() => void handleAdvance()}
            >
              {isPreviewing ? 'Processando...' : 'Avançar'}
            </button>
          )}

          {previewData?.fileType === 'CSV' && step === 1 && (
            <>
              <button
                type="button"
                className="recon-modal__btn-cancel"
                onClick={() => {
                  setPreviewData(null);
                  setStep(1);
                }}
              >
                Voltar
              </button>
              <button
                type="button"
                className="recon-modal__btn-submit"
                disabled={!isMappingValid}
                onClick={handleToStep2}
              >
                Avançar
              </button>
            </>
          )}

          {previewData && step === 2 && (
            <>
              {previewData.fileType === 'CSV' && (
                <button
                  type="button"
                  className="recon-modal__btn-cancel"
                  onClick={() => setStep(1)}
                >
                  Voltar
                </button>
              )}
              <button
                type="button"
                className="recon-modal__btn-submit"
                disabled={selectedIndices.size === 0 || isSubmitting}
                onClick={() => void handleSubmit()}
              >
                {isSubmitting
                  ? 'Importando...'
                  : `Importar ${selectedIndices.size} linha${selectedIndices.size !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </footer>
      </div>
    </div>
  );
};

export default ImportPreviewModal;
