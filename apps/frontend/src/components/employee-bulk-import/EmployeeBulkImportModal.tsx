import { useState, useCallback, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Download,
  FileText,
} from 'lucide-react';
import { api } from '@/services/api';
import { useAuth } from '@/stores/AuthContext';

// ─── Types ──────────────────────────────────────────────────────────

type Step = 1 | 2 | 3 | 4;

interface UploadResult {
  columnHeaders: string[];
  sampleRows: Record<string, string | number | null>[];
  totalRows: number;
}

interface PreviewRow {
  rowNumber: number;
  status: 'valid' | 'error' | 'warning';
  messages: string[];
  data: Record<string, unknown>;
}

interface PreviewResult {
  validRows: PreviewRow[];
  errorRows: PreviewRow[];
  warningRows: PreviewRow[];
  totalRows: number;
}

interface ConfirmResult {
  created: number;
  errors: Array<{ row: number; message: string }>;
}

const EXPECTED_FIELDS = [
  { key: 'name', label: 'Nome *', required: true },
  { key: 'cpf', label: 'CPF *', required: true },
  { key: 'rg', label: 'RG', required: false },
  { key: 'pis_pasep', label: 'PIS/PASEP', required: false },
  { key: 'data_nascimento', label: 'Data de nascimento *', required: true },
  { key: 'data_admissao', label: 'Data de admissão *', required: true },
  { key: 'cargo', label: 'Cargo', required: false },
  { key: 'salario', label: 'Salário', required: false },
  { key: 'telefone', label: 'Telefone', required: false },
  { key: 'email', label: 'E-mail', required: false },
  { key: 'banco', label: 'Banco', required: false },
  { key: 'agencia', label: 'Agência', required: false },
  { key: 'conta', label: 'Conta', required: false },
  { key: 'tipo_conta', label: 'Tipo de conta', required: false },
  { key: 'saldo_ferias', label: 'Saldo de férias (dias)', required: false },
  { key: 'banco_horas', label: 'Banco de horas (h)', required: false },
];

// ─── Props ──────────────────────────────────────────────────────────

interface EmployeeBulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
}

// ─── Step 1: Upload ──────────────────────────────────────────────────

function StepUpload({
  orgId,
  onUploaded,
  isLoading,
  setIsLoading,
  setError,
}: {
  orgId: string;
  onUploaded: (result: UploadResult, file: File) => void;
  isLoading: boolean;
  setIsLoading: (v: boolean) => void;
  setError: (v: string | null) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      setIsLoading(true);
      try {
        const formData = new FormData();
        formData.append('file', file);
        const result = await api.postFormData<UploadResult>(
          `/org/${orgId}/employees/bulk/upload`,
          formData,
        );
        onUploaded(result, file);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao processar arquivo');
      } finally {
        setIsLoading(false);
      }
    },
    [orgId, onUploaded, setError, setIsLoading],
  );

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) void handleFile(file);
  };

  const handleTemplateDownload = async () => {
    try {
      const response = await fetch(`/api/org/${orgId}/employees/bulk/template`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('protos_access_token') ?? ''}`,
        },
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-colaboradores.xlsx';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // ignore download errors
    }
  };

  return (
    <div className="bulk-modal__step">
      <div
        className={`bulk-modal__dropzone ${dragOver ? 'bulk-modal__dropzone--over' : ''}`}
        onDrop={handleDrop}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        role="region"
        aria-label="Área de upload por arrastar e soltar"
      >
        <Upload size={48} aria-hidden="true" color="var(--color-neutral-400)" />
        <p style={{ margin: '12px 0 4px', fontFamily: "'Source Sans 3', system-ui, sans-serif", fontSize: '1rem', color: 'var(--color-neutral-700)' }}>
          Arraste o arquivo aqui ou
        </p>
        <label
          className="employee-detail__btn-primary"
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8 }}
          aria-label="Selecionar arquivo para importação"
        >
          Selecionar arquivo
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
            disabled={isLoading}
            aria-label="Arquivo CSV ou XLSX"
          />
        </label>
        <p style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--color-neutral-500)' }}>
          Formatos aceitos: .xlsx, .xls, .csv — máx. 500 linhas
        </p>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <button
          type="button"
          onClick={() => void handleTemplateDownload()}
          className="employee-detail__btn-ghost"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={16} aria-hidden="true" />
          Baixar template (.xlsx)
        </button>
      </div>
    </div>
  );
}

// ─── Step 2: Mapping ─────────────────────────────────────────────────

function StepMapping({
  uploadResult,
  mapping,
  setMapping,
}: {
  uploadResult: UploadResult;
  mapping: Record<string, string>;
  setMapping: (m: Record<string, string>) => void;
}) {
  return (
    <div className="bulk-modal__step">
      <p style={{ marginBottom: 16, color: 'var(--color-neutral-600)', fontFamily: "'Source Sans 3', system-ui, sans-serif" }}>
        {uploadResult.totalRows} linhas detectadas. Mapeie as colunas do arquivo para os campos do sistema.
      </p>

      <div className="bulk-modal__mapping-table" role="table" aria-label="Mapeamento de colunas">
        <div className="bulk-modal__mapping-header" role="row">
          <div role="columnheader">Campo do sistema</div>
          <div role="columnheader">Coluna do arquivo</div>
        </div>
        {EXPECTED_FIELDS.map((field) => (
          <div key={field.key} className="bulk-modal__mapping-row" role="row">
            <label
              htmlFor={`map-${field.key}`}
              className="bulk-modal__mapping-label"
              role="cell"
            >
              {field.label}
            </label>
            <div role="cell">
              <select
                id={`map-${field.key}`}
                value={mapping[field.key] ?? ''}
                onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                className="employee-detail__select"
                aria-label={`Mapear campo ${field.label}`}
              >
                <option value="">— Ignorar —</option>
                {uploadResult.columnHeaders.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* Sample data */}
      {uploadResult.sampleRows.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif", fontSize: '0.875rem', color: 'var(--color-neutral-600)', marginBottom: 8 }}>
            Pré-visualização (primeiras linhas):
          </h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="bulk-modal__preview-table">
              <thead>
                <tr>
                  {uploadResult.columnHeaders.map((h) => (
                    <th key={h} scope="col">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uploadResult.sampleRows.map((row, idx) => (
                  <tr key={idx}>
                    {uploadResult.columnHeaders.map((h) => (
                      <td key={h}>{String(row[h] ?? '')}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Step 3: Preview ─────────────────────────────────────────────────

function StepPreview({ previewResult }: { previewResult: PreviewResult | null }) {
  if (!previewResult) {
    return (
      <div className="bulk-modal__step">
        <div className="bulk-modal__skeleton" style={{ height: 200 }} />
      </div>
    );
  }

  const allRows = [
    ...previewResult.errorRows,
    ...previewResult.warningRows,
    ...previewResult.validRows,
  ].sort((a, b) => a.rowNumber - b.rowNumber);

  return (
    <div className="bulk-modal__step">
      {/* Summary */}
      <div className="bulk-modal__preview-summary">
        <div className="bulk-modal__preview-stat bulk-modal__preview-stat--valid">
          <CheckCircle size={16} aria-hidden="true" />
          <span>{previewResult.validRows.length} válidos</span>
        </div>
        <div className="bulk-modal__preview-stat bulk-modal__preview-stat--warning">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{previewResult.warningRows.length} avisos</span>
        </div>
        <div className="bulk-modal__preview-stat bulk-modal__preview-stat--error">
          <AlertCircle size={16} aria-hidden="true" />
          <span>{previewResult.errorRows.length} erros</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginTop: 16 }}>
        <table className="bulk-modal__preview-table">
          <caption className="sr-only">Pré-visualização das linhas do arquivo</caption>
          <thead>
            <tr>
              <th scope="col">Linha</th>
              <th scope="col">Status</th>
              <th scope="col">Nome</th>
              <th scope="col">CPF</th>
              <th scope="col">Mensagens</th>
            </tr>
          </thead>
          <tbody>
            {allRows.map((row) => (
              <tr
                key={row.rowNumber}
                className={
                  row.status === 'error'
                    ? 'bulk-modal__row--error'
                    : row.status === 'warning'
                    ? 'bulk-modal__row--warning'
                    : ''
                }
              >
                <td>{row.rowNumber}</td>
                <td>
                  {row.status === 'error' ? (
                    <AlertCircle size={16} color="var(--color-error-500, #C62828)" aria-label="Erro" />
                  ) : row.status === 'warning' ? (
                    <AlertTriangle size={16} color="var(--color-warning-600, #F57C00)" aria-label="Aviso" />
                  ) : (
                    <CheckCircle size={16} color="var(--color-success-600, #388E3C)" aria-label="Válido" />
                  )}
                </td>
                <td>{String(row.data.name ?? '—')}</td>
                <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem' }}>
                  {String(row.data.cpf ?? '—')}
                </td>
                <td>
                  {row.messages.map((msg, i) => (
                    <div key={i} style={{ fontSize: '0.8125rem' }}>
                      {msg}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Step 4: Report ──────────────────────────────────────────────────

function StepReport({
  confirmResult,
  onClose,
}: {
  confirmResult: ConfirmResult | null;
  onClose: () => void;
}) {
  if (!confirmResult) return null;

  const handleDownloadErrors = () => {
    if (confirmResult.errors.length === 0) return;
    const lines = ['linha,mensagem', ...confirmResult.errors.map((e) => `${e.row},"${e.message}"`)];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'erros-importacao-colaboradores.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bulk-modal__step bulk-modal__step--center">
      <CheckCircle size={64} color="var(--color-success-600, #388E3C)" aria-hidden="true" />
      <h3 style={{ marginTop: 16, fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: '1.25rem', color: 'var(--color-neutral-800)' }}>
        Importação concluída
      </h3>
      <p style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif", color: 'var(--color-neutral-600)', marginTop: 8 }}>
        <strong>{confirmResult.created}</strong>{' '}
        {confirmResult.created === 1 ? 'colaborador criado' : 'colaboradores criados'} com sucesso.
      </p>

      {confirmResult.errors.length > 0 && (
        <div
          style={{ marginTop: 16, padding: '12px 16px', background: 'var(--color-error-50, #FFEBEE)', borderRadius: 8, color: 'var(--color-error-700, #B71C1C)' }}
          role="alert"
        >
          <p style={{ fontFamily: "'Source Sans 3', system-ui, sans-serif", marginBottom: 8 }}>
            {confirmResult.errors.length}{' '}
            {confirmResult.errors.length === 1 ? 'linha com erro' : 'linhas com erro'}.
          </p>
          <button
            type="button"
            className="employee-detail__btn-secondary"
            onClick={handleDownloadErrors}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={16} aria-hidden="true" />
            Baixar relatório de erros (.csv)
          </button>
        </div>
      )}

      <button
        type="button"
        className="employee-detail__btn-primary"
        onClick={onClose}
        style={{ marginTop: 24 }}
      >
        Fechar
      </button>
    </div>
  );
}

// ─── Main Modal ──────────────────────────────────────────────────────

const STEP_LABELS: Record<Step, string> = {
  1: 'Upload',
  2: 'Mapeamento',
  3: 'Preview',
  4: 'Relatório',
};

export default function EmployeeBulkImportModal({
  isOpen,
  onClose,
  onImportComplete,
}: EmployeeBulkImportModalProps) {
  const { user } = useAuth();
  const orgId = user?.organizationId ?? '';

  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [_uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [confirmResult, setConfirmResult] = useState<ConfirmResult | null>(null);

  // Keyboard close
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset on open
  const prevIsOpen = useRef(isOpen);
  if (prevIsOpen.current !== isOpen) {
    prevIsOpen.current = isOpen;
    if (!isOpen) {
      setStep(1);
      setError(null);
      setUploadResult(null);
      setUploadedFile(null);
      setMapping({});
      setPreviewResult(null);
      setConfirmResult(null);
    }
  }

  const handleUploaded = useCallback((result: UploadResult, file: File) => {
    setUploadResult(result);
    setUploadedFile(file);

    // Auto-map columns by name similarity
    const autoMap: Record<string, string> = {};
    for (const field of EXPECTED_FIELDS) {
      const match = result.columnHeaders.find(
        (h) => h.toLowerCase().replace(/\s/g, '_') === field.key,
      );
      if (match) autoMap[field.key] = match;
    }
    setMapping(autoMap);
    setStep(2);
  }, []);

  const handleGoToPreview = useCallback(async () => {
    if (!uploadResult) return;

    setError(null);
    setIsLoading(true);
    try {
      // Convert column mapping: { fieldKey -> columnHeader } to { columnHeader -> fieldKey }
      const columnMapping: Record<string, string> = {};
      for (const [fieldKey, colHeader] of Object.entries(mapping)) {
        if (colHeader) columnMapping[colHeader] = fieldKey;
      }

      // Build rows from upload result sample + ask backend for full preview
      // We'll send all rows via the upload result
      const result = await api.post<PreviewResult>(`/org/${orgId}/employees/bulk/preview`, {
        rows: uploadResult.sampleRows,
        columnMapping,
      });
      setPreviewResult(result);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar preview');
    } finally {
      setIsLoading(false);
    }
  }, [uploadResult, mapping, orgId]);

  const handleConfirm = useCallback(async () => {
    if (!previewResult) return;

    setError(null);
    setIsLoading(true);
    try {
      const rows = [...previewResult.validRows, ...previewResult.warningRows].map((row) => ({
        ...row.data,
        rowNumber: row.rowNumber,
      }));

      const result = await api.post<ConfirmResult>(`/org/${orgId}/employees/bulk/confirm`, {
        rows,
      });
      setConfirmResult(result);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao confirmar importação');
    } finally {
      setIsLoading(false);
    }
  }, [previewResult, orgId]);

  const handleClose = useCallback(() => {
    if (step === 4) onImportComplete();
    onClose();
  }, [step, onClose, onImportComplete]);

  if (!isOpen) return null;

  const canGoNext = step === 2 && !isLoading;
  const canConfirm =
    step === 3 &&
    !isLoading &&
    previewResult !== null &&
    (previewResult.validRows.length + previewResult.warningRows.length) > 0;

  return (
    <div
      className="bulk-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Importar colaboradores em lote"
    >
      <div className="bulk-modal bulk-modal--employee">
        {/* Header */}
        <header className="bulk-modal__header">
          <div>
            <h2 className="bulk-modal__title">Importar colaboradores</h2>
            {/* Step indicator */}
            <nav aria-label="Passos da importação">
              <ol className="bulk-modal__steps">
                {([1, 2, 3, 4] as Step[]).map((s) => (
                  <li
                    key={s}
                    className={`bulk-modal__step-indicator ${
                      s === step
                        ? 'bulk-modal__step-indicator--active'
                        : s < step
                        ? 'bulk-modal__step-indicator--done'
                        : ''
                    }`}
                    aria-current={s === step ? 'step' : undefined}
                  >
                    {s}. {STEP_LABELS[s]}
                  </li>
                ))}
              </ol>
            </nav>
          </div>
          <button
            type="button"
            className="bulk-modal__close"
            onClick={handleClose}
            aria-label="Fechar importação"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Error banner */}
        {error && (
          <div className="bulk-modal__error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            {error}
          </div>
        )}

        {/* Body */}
        <div className="bulk-modal__body">
          {step === 1 && (
            <StepUpload
              orgId={orgId}
              onUploaded={handleUploaded}
              isLoading={isLoading}
              setIsLoading={setIsLoading}
              setError={setError}
            />
          )}
          {step === 2 && uploadResult && (
            <StepMapping
              uploadResult={uploadResult}
              mapping={mapping}
              setMapping={setMapping}
            />
          )}
          {step === 3 && <StepPreview previewResult={previewResult} />}
          {step === 4 && <StepReport confirmResult={confirmResult} onClose={handleClose} />}
        </div>

        {/* Footer */}
        {step !== 4 && (
          <footer className="bulk-modal__footer">
            {step === 3 && (
              <button
                type="button"
                className="bulk-modal__btn-secondary"
                onClick={() => setStep(2)}
              >
                Voltar
              </button>
            )}

            {canGoNext && (
              <button
                type="button"
                className="bulk-modal__btn-primary"
                onClick={() => void handleGoToPreview()}
                disabled={isLoading}
              >
                {isLoading ? 'Processando...' : 'Visualizar preview'}
              </button>
            )}

            {canConfirm && (
              <button
                type="button"
                className="bulk-modal__btn-primary"
                onClick={() => void handleConfirm()}
                disabled={isLoading}
              >
                <FileText size={16} aria-hidden="true" />
                {isLoading ? 'Importando...' : `Importar ${(previewResult?.validRows.length ?? 0) + (previewResult?.warningRows.length ?? 0)} colaboradores`}
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}
