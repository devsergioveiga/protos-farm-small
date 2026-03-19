import { useRef, useEffect, useCallback } from 'react';
import { X, Upload, ArrowLeft, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { useAssetBulkImport } from '@/hooks/useAssetBulkImport';
import './AssetImportModal.css';

// ─── Required system fields for mapping ──────────────────────────────────

const REQUIRED_FIELDS: { field: string; label: string }[] = [
  { field: 'name', label: 'Nome *' },
  { field: 'assetType', label: 'Tipo *' },
  { field: 'classification', label: 'Classificacao CPC *' },
  { field: 'farmId', label: 'Fazenda *' },
];

const OPTIONAL_FIELDS: { field: string; label: string }[] = [
  { field: 'acquisitionDate', label: 'Data de aquisicao' },
  { field: 'acquisitionValue', label: 'Valor de aquisicao (R$)' },
  { field: 'serialNumber', label: 'Numero de serie' },
  { field: 'manufacturer', label: 'Fabricante' },
  { field: 'model', label: 'Modelo' },
  { field: 'yearOfManufacture', label: 'Ano' },
  { field: 'costCenterId', label: 'Centro de custo' },
  { field: 'description', label: 'Descricao' },
  { field: 'notes', label: 'Observacoes' },
];

const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

const STEP_TITLES: Record<string, string> = {
  idle: 'Importar ativos',
  uploading: 'Processando arquivo...',
  mapping: 'Mapeamento de colunas',
  previewing: 'Preview dos ativos',
  confirming: 'Importando...',
  done: 'Resultado da importacao',
};

// ─── Props ────────────────────────────────────────────────────────────────

interface AssetImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function AssetImportModal({ isOpen, onClose, onSuccess }: AssetImportModalProps) {
  const { state, uploadFile, setMapping, preview, confirm, downloadTemplate, goToMapping, reset } =
    useAssetBulkImport();

  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  // Reset on close
  const prevIsOpen = useRef(isOpen);
  if (prevIsOpen.current !== isOpen) {
    prevIsOpen.current = isOpen;
    if (!isOpen) {
      reset();
    }
  }

  // Keyboard handling
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (state.step === 'done') {
          onSuccess();
        }
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, state.step, onClose, onSuccess]);

  // Focus trap
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus();
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (state.step === 'done') {
      onSuccess();
    }
    onClose();
  }, [state.step, onSuccess, onClose]);

  // File handling
  function handleFileSelect(file: File) {
    void uploadFile(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    dropZoneRef.current?.classList.add('asset-import-modal__dropzone--over');
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('asset-import-modal__dropzone--over');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    dropZoneRef.current?.classList.remove('asset-import-modal__dropzone--over');
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  // Column mapping handler
  function handleMappingChange(field: string, headerValue: string) {
    const newMapping = { ...state.columnMapping };
    // Remove any existing mapping to this field
    for (const [h, f] of Object.entries(newMapping)) {
      if (f === field) delete newMapping[h];
    }
    // Set new mapping
    if (headerValue) {
      newMapping[headerValue] = field;
    }
    setMapping(newMapping);
  }

  function getMappedHeader(field: string): string {
    for (const [header, f] of Object.entries(state.columnMapping)) {
      if (f === field) return header;
    }
    return '';
  }

  if (!isOpen) return null;

  const title = STEP_TITLES[state.step] ?? 'Importar ativos';

  return (
    <div
      className="asset-import-modal__backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="asset-import-title"
    >
      <div className="asset-import-modal" ref={dialogRef} tabIndex={-1}>
        {/* Header */}
        <header className="asset-import-modal__header">
          <h2 id="asset-import-title" className="asset-import-modal__title">
            {title}
          </h2>
          <button
            type="button"
            className="asset-import-modal__close"
            onClick={handleClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {/* Body */}
        <div className="asset-import-modal__body">
          {/* Error banner */}
          {state.error && (
            <div className="asset-import-modal__error" role="alert">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>{state.error}</span>
            </div>
          )}

          {/* Step: idle */}
          {state.step === 'idle' && (
            <div className="asset-import-modal__step">
              <div
                className="asset-import-modal__dropzone"
                ref={dropZoneRef}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Adicionar fotos"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <Upload
                  size={48}
                  aria-hidden="true"
                  className="asset-import-modal__dropzone-icon"
                />
                <p className="asset-import-modal__dropzone-text">
                  Arraste um arquivo CSV ou Excel, ou clique para selecionar.
                </p>
                <p className="asset-import-modal__dropzone-hint">Formatos aceitos: .csv, .xlsx</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="sr-only"
                  onChange={handleInputChange}
                  aria-label="Selecionar arquivo de importacao"
                />
              </div>
              <div className="asset-import-modal__template-row">
                <FileText size={16} aria-hidden="true" />
                <button
                  type="button"
                  className="asset-import-modal__link-btn"
                  onClick={() => void downloadTemplate()}
                >
                  Baixar modelo de planilha
                </button>
              </div>
            </div>
          )}

          {/* Step: uploading */}
          {state.step === 'uploading' && (
            <div className="asset-import-modal__step asset-import-modal__step--loading">
              <div
                className="asset-import-modal__skeleton"
                aria-label="Processando arquivo"
                role="status"
              />
              <div className="asset-import-modal__skeleton asset-import-modal__skeleton--short" />
              <div className="asset-import-modal__skeleton asset-import-modal__skeleton--short" />
              <p className="asset-import-modal__loading-text">Processando arquivo...</p>
            </div>
          )}

          {/* Step: mapping */}
          {state.step === 'mapping' && (
            <div className="asset-import-modal__step">
              <p className="asset-import-modal__mapping-desc">
                Associe cada campo do sistema a uma coluna do arquivo. Campos com * sao
                obrigatorios.
              </p>
              <div className="asset-import-modal__mapping-grid">
                {ALL_FIELDS.map(({ field, label }) => (
                  <div key={field} className="asset-import-modal__mapping-row">
                    <label
                      htmlFor={`mapping-${field}`}
                      className="asset-import-modal__mapping-label"
                    >
                      {label}
                    </label>
                    <select
                      id={`mapping-${field}`}
                      className="asset-import-modal__select"
                      value={getMappedHeader(field)}
                      onChange={(e) => handleMappingChange(field, e.target.value)}
                    >
                      <option value="">-- nao importar --</option>
                      {state.columnHeaders.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step: previewing */}
          {state.step === 'previewing' && (
            <div className="asset-import-modal__step">
              <div className="asset-import-modal__preview-summary">
                <span className="asset-import-modal__preview-valid">
                  <CheckCircle size={16} aria-hidden="true" />
                  {state.totalValid} valido(s)
                </span>
                {state.totalInvalid > 0 && (
                  <span className="asset-import-modal__preview-invalid">
                    <AlertTriangle size={16} aria-hidden="true" />
                    {state.totalInvalid} com erro
                  </span>
                )}
              </div>

              {state.totalInvalid > 0 && (
                <div className="asset-import-modal__preview-errors">
                  <h3 className="asset-import-modal__preview-errors-title">Linhas com erro:</h3>
                  <table className="asset-import-modal__preview-table">
                    <caption className="sr-only">Linhas com erro de validacao</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="asset-import-modal__th">
                          Linha
                        </th>
                        <th scope="col" className="asset-import-modal__th">
                          Nome
                        </th>
                        <th scope="col" className="asset-import-modal__th">
                          Erros
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.invalidRows.map((row) => (
                        <tr key={row.rowNumber} className="asset-import-modal__tr--invalid">
                          <td className="asset-import-modal__td">{row.rowNumber}</td>
                          <td className="asset-import-modal__td">
                            {(row.data['name'] as string) ?? '—'}
                          </td>
                          <td className="asset-import-modal__td asset-import-modal__td--errors">
                            {row.errors.join('; ')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {state.totalValid > 0 && (
                <div className="asset-import-modal__preview-valid-list">
                  <h3 className="asset-import-modal__preview-errors-title">
                    Ativos prontos para importar ({state.totalValid}):
                  </h3>
                  <table className="asset-import-modal__preview-table">
                    <caption className="sr-only">Ativos validos para importacao</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="asset-import-modal__th">
                          Linha
                        </th>
                        <th scope="col" className="asset-import-modal__th">
                          Nome
                        </th>
                        <th scope="col" className="asset-import-modal__th">
                          Tipo
                        </th>
                        <th scope="col" className="asset-import-modal__th">
                          Fazenda
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.validRows.map((row) => (
                        <tr key={row.rowNumber}>
                          <td className="asset-import-modal__td">{row.rowNumber}</td>
                          <td className="asset-import-modal__td">
                            {(row.data['name'] as string) ?? '—'}
                          </td>
                          <td className="asset-import-modal__td">
                            {(row.data['assetType'] as string) ?? '—'}
                          </td>
                          <td className="asset-import-modal__td">
                            {(row.data['farmId'] as string) ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Step: confirming */}
          {state.step === 'confirming' && (
            <div className="asset-import-modal__step asset-import-modal__step--loading">
              <div
                className="asset-import-modal__skeleton"
                aria-label="Importando ativos"
                role="status"
              />
              <div className="asset-import-modal__skeleton asset-import-modal__skeleton--short" />
              <p className="asset-import-modal__loading-text">Importando ativos...</p>
            </div>
          )}

          {/* Step: done */}
          {state.step === 'done' && state.result && (
            <div className="asset-import-modal__step">
              {state.result.failed === 0 ? (
                <div className="asset-import-modal__result asset-import-modal__result--success">
                  <CheckCircle
                    size={48}
                    aria-hidden="true"
                    className="asset-import-modal__result-icon"
                  />
                  <p className="asset-import-modal__result-text">
                    {state.result.imported} ativo(s) importado(s) com sucesso.
                  </p>
                </div>
              ) : (
                <div className="asset-import-modal__result asset-import-modal__result--partial">
                  <AlertTriangle
                    size={48}
                    aria-hidden="true"
                    className="asset-import-modal__result-icon"
                  />
                  <p className="asset-import-modal__result-text">
                    {state.result.imported} importado(s), {state.result.failed} com erro. Revise o
                    relatorio antes de tentar novamente.
                  </p>
                </div>
              )}

              {state.result.errors.length > 0 && (
                <div className="asset-import-modal__result-errors">
                  <h3 className="asset-import-modal__preview-errors-title">Erros na importacao:</h3>
                  <table className="asset-import-modal__preview-table">
                    <caption className="sr-only">Erros ocorridos durante a importacao</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="asset-import-modal__th">
                          Linha
                        </th>
                        <th scope="col" className="asset-import-modal__th">
                          Erro
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {state.result.errors.map((e) => (
                        <tr key={e.row}>
                          <td className="asset-import-modal__td">{e.row}</td>
                          <td className="asset-import-modal__td">{e.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="asset-import-modal__footer">
          {state.step === 'idle' && (
            <button
              type="button"
              className="asset-import-modal__btn asset-import-modal__btn--secondary"
              onClick={handleClose}
            >
              Cancelar
            </button>
          )}

          {state.step === 'uploading' && (
            <button
              type="button"
              className="asset-import-modal__btn asset-import-modal__btn--secondary"
              onClick={handleClose}
            >
              Cancelar
            </button>
          )}

          {state.step === 'mapping' && (
            <>
              <button
                type="button"
                className="asset-import-modal__btn asset-import-modal__btn--secondary"
                onClick={handleClose}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="asset-import-modal__btn asset-import-modal__btn--primary"
                onClick={() => void preview()}
                disabled={state.loading}
              >
                Visualizar preview
              </button>
            </>
          )}

          {state.step === 'previewing' && (
            <>
              <button
                type="button"
                className="asset-import-modal__btn asset-import-modal__btn--secondary"
                onClick={goToMapping}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar
              </button>
              <button
                type="button"
                className="asset-import-modal__btn asset-import-modal__btn--secondary"
                onClick={handleClose}
              >
                Cancelar
              </button>
              {state.totalValid > 0 && (
                <button
                  type="button"
                  className="asset-import-modal__btn asset-import-modal__btn--primary"
                  onClick={() => void confirm()}
                  disabled={state.loading}
                >
                  Importar {state.totalValid} ativo(s)
                </button>
              )}
            </>
          )}

          {state.step === 'done' && (
            <button
              type="button"
              className="asset-import-modal__btn asset-import-modal__btn--primary"
              onClick={() => {
                onSuccess();
              }}
            >
              Fechar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
