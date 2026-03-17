import { useState, useRef, useCallback } from 'react';
import {
  X,
  Upload,
  Download,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { api } from '@/services/api';
import type { SupplierCategory } from '@/types/supplier';
import { SUPPLIER_CATEGORY_LABELS } from '@/types/supplier';
import './SupplierImportModal.css';

// ─── Types ────────────────────────────────────────────────────────────

interface ImportPreviewRow {
  rowNumber: number;
  name: string;
  document: string;
  categories: SupplierCategory[];
  status: 'valid' | 'invalid' | 'existing';
  errorMessage?: string;
}

interface ImportPreviewResponse {
  valid: ImportPreviewRow[];
  invalid: ImportPreviewRow[];
  existing: ImportPreviewRow[];
}

interface ImportExecuteResponse {
  imported: number;
  skipped: number;
  failed: number;
  errors?: string[];
}

// ─── Props ────────────────────────────────────────────────────────────

interface SupplierImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────

export default function SupplierImportModal({
  isOpen,
  onClose,
  onSuccess,
}: SupplierImportModalProps) {
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<ImportPreviewResponse | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const allRows: ImportPreviewRow[] = previewData
    ? [
        ...previewData.valid.map((r) => ({ ...r, status: 'valid' as const })),
        ...previewData.invalid.map((r) => ({ ...r, status: 'invalid' as const })),
        ...previewData.existing.map((r) => ({ ...r, status: 'existing' as const })),
      ].sort((a, b) => a.rowNumber - b.rowNumber)
    : [];

  const validCount = previewData?.valid.length ?? 0;
  const invalidCount = previewData?.invalid.length ?? 0;
  const existingCount = previewData?.existing.length ?? 0;

  const handleClose = useCallback(() => {
    setStep('upload');
    setParseError(null);
    setImportError(null);
    setPreviewData(null);
    setSelectedFile(null);
    setIsDragging(false);
    onClose();
  }, [onClose]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      handleClose();
    }
  }

  async function processFile(file: File) {
    // Validate size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      setParseError('Arquivo muito grande. O limite e 5 MB.');
      return;
    }
    // Validate format
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'csv' && ext !== 'xlsx') {
      setParseError('Formato nao suportado. Use CSV (.csv) ou Excel (.xlsx).');
      return;
    }

    setSelectedFile(file);
    setParseError(null);
    setIsParsing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const data = await api.postFormData<ImportPreviewResponse>(
        '/org/suppliers/import/preview',
        formData,
      );
      setPreviewData(data);
      setStep('preview');
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      setParseError(
        apiErr.message ||
          'Nao foi possivel processar o arquivo. Verifique o formato e tente novamente.',
      );
    } finally {
      setIsParsing(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    // Reset input so same file can be re-selected
    e.target.value = '';
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      void processFile(file);
    }
  }

  async function handleImport() {
    if (!selectedFile || validCount === 0) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const result = await api.postFormData<ImportExecuteResponse>(
        '/org/suppliers/import/execute',
        formData,
      );
      const message =
        result.skipped > 0
          ? `${result.imported} fornecedores importados. ${result.skipped} ja existiam e foram ignorados.`
          : `${result.imported} fornecedores importados com sucesso.`;
      handleClose();
      onSuccess(message);
    } catch (err) {
      const apiErr = err as Error & { status?: number };
      setImportError(
        apiErr.message ||
          'Nao foi possivel processar o arquivo. Verifique o formato e tente novamente.',
      );
    } finally {
      setIsImporting(false);
    }
  }

  function handleDownloadTemplate() {
    window.open('/api/org/suppliers/import/template', '_blank');
  }

  if (!isOpen) return null;

  return (
    <div
      className="supplier-import-modal__overlay"
      aria-label="Fechar modal"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="supplier-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-modal-title"
        ref={modalRef}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="supplier-import-modal__header">
          <h2 id="import-modal-title" className="supplier-import-modal__title">
            Importar Fornecedores
          </h2>
          <button
            type="button"
            className="supplier-import-modal__close-btn"
            onClick={handleClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="supplier-import-modal__body">
          {step === 'upload' && (
            <>
              {/* Drop zone */}
              <div
                className={`supplier-import-modal__dropzone${isDragging ? ' supplier-import-modal__dropzone--dragging' : ''}`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Zona de upload. Clique ou arraste um arquivo para selecionar"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                {isParsing ? (
                  <Loader2
                    size={48}
                    className="supplier-import-modal__dropzone-spinner"
                    aria-hidden="true"
                  />
                ) : (
                  <Upload
                    size={48}
                    className="supplier-import-modal__dropzone-icon"
                    aria-hidden="true"
                  />
                )}
                <p className="supplier-import-modal__dropzone-text">
                  {isParsing
                    ? 'Processando arquivo...'
                    : 'Arraste o arquivo aqui ou clique para selecionar'}
                </p>
                <p className="supplier-import-modal__dropzone-subtitle">
                  CSV ou Excel (.xlsx) &middot; Maximo 5 MB
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx"
                  className="sr-only"
                  onChange={handleFileChange}
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>

              {/* Template download link */}
              <div className="supplier-import-modal__template-row">
                <button
                  type="button"
                  className="supplier-import-modal__template-link"
                  onClick={handleDownloadTemplate}
                >
                  <Download size={16} aria-hidden="true" />
                  Baixar modelo de importacao
                </button>
              </div>

              {/* Parse error */}
              {parseError && (
                <div className="supplier-import-modal__error" role="alert">
                  <XCircle size={16} aria-hidden="true" />
                  {parseError}
                </div>
              )}
            </>
          )}

          {step === 'preview' && previewData && (
            <>
              {/* Summary bar */}
              <div className="supplier-import-modal__summary">
                <span className="supplier-import-modal__summary-valid">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {validCount} fornecedores prontos para importar
                </span>
                {invalidCount > 0 && (
                  <span className="supplier-import-modal__summary-invalid">
                    <XCircle size={16} aria-hidden="true" />
                    {invalidCount} linhas com erro (serao ignoradas)
                  </span>
                )}
                {existingCount > 0 && (
                  <span className="supplier-import-modal__summary-existing">
                    <MinusCircle size={16} aria-hidden="true" />
                    {existingCount} CNPJ/CPF ja cadastrados (serao ignorados)
                  </span>
                )}
              </div>

              {/* Preview table */}
              <div className="supplier-import-modal__table-wrapper">
                <table className="supplier-import-modal__table">
                  <caption className="sr-only">
                    Previa dos fornecedores a importar: {validCount} validos, {invalidCount} com
                    erro, {existingCount} ja cadastrados
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Nome</th>
                      <th scope="col">CNPJ/CPF</th>
                      <th scope="col">Categorias</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRows.map((row) => (
                      <tr
                        key={row.rowNumber}
                        className={`supplier-import-modal__row supplier-import-modal__row--${row.status}`}
                      >
                        <td className="supplier-import-modal__row-num">{row.rowNumber}</td>
                        <td>{row.name || '—'}</td>
                        <td>
                          <span className="supplier-import-modal__doc">{row.document || '—'}</span>
                        </td>
                        <td>
                          <span className="supplier-import-modal__categories">
                            {row.categories
                              .map((c) => SUPPLIER_CATEGORY_LABELS[c] ?? c)
                              .join(', ') || '—'}
                          </span>
                        </td>
                        <td>
                          {row.status === 'valid' && (
                            <span className="supplier-import-modal__status supplier-import-modal__status--valid">
                              <CheckCircle2 size={14} aria-hidden="true" />
                              Valido
                            </span>
                          )}
                          {row.status === 'invalid' && (
                            <span className="supplier-import-modal__status supplier-import-modal__status--invalid">
                              <XCircle size={14} aria-hidden="true" />
                              <span>
                                Erro
                                {row.errorMessage && (
                                  <span className="supplier-import-modal__row-error">
                                    {' '}
                                    — {row.errorMessage}
                                  </span>
                                )}
                              </span>
                            </span>
                          )}
                          {row.status === 'existing' && (
                            <span className="supplier-import-modal__status supplier-import-modal__status--existing">
                              <MinusCircle size={14} aria-hidden="true" />
                              CNPJ ja cadastrado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import error */}
              {importError && (
                <div className="supplier-import-modal__error" role="alert">
                  <XCircle size={16} aria-hidden="true" />
                  {importError}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="supplier-import-modal__footer">
          {step === 'upload' && (
            <button
              type="button"
              className="supplier-import-modal__cancel-btn"
              onClick={handleClose}
            >
              Cancelar
            </button>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                className="supplier-import-modal__back-btn"
                onClick={() => {
                  setStep('upload');
                  setPreviewData(null);
                  setSelectedFile(null);
                }}
                aria-label="Voltar para upload"
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar
              </button>
              <button
                type="button"
                className="supplier-import-modal__cancel-btn"
                onClick={handleClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="supplier-import-modal__import-btn"
                onClick={() => void handleImport()}
                disabled={validCount === 0 || isImporting}
                aria-disabled={validCount === 0 || isImporting}
              >
                {isImporting ? (
                  <>
                    <Loader2
                      size={16}
                      className="supplier-import-modal__btn-spinner"
                      aria-hidden="true"
                    />
                    Importando...
                  </>
                ) : (
                  <>Importar {validCount} fornecedores</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
