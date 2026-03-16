import { useState, useEffect, useCallback, useRef } from 'react';
import { X, AlertCircle, Upload, CheckCircle2, XCircle, Minus } from 'lucide-react';
import { api } from '@/services/api';
import './PayableModal.css';

// ─── Types ──────────────────────────────────────────────────────────

type RetornoStatus = 'LIQUIDADO' | 'DEVOLVIDO' | 'REJEITADO';

interface RetornoRecord {
  nossoNumero: string;
  status: RetornoStatus;
  paidAmount: number;
  paidDate: string;
  matched: boolean;
  payableId?: string;
  supplierName?: string;
}

interface CnabRetornoModalProps {
  onClose: () => void;
  onSuccess: () => void;
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

// ─── Component ────────────────────────────────────────────────────

type Step = 'upload' | 'preview' | 'done';

const CnabRetornoModal = ({ onClose, onSuccess }: CnabRetornoModalProps) => {
  const [step, setStep] = useState<Step>('upload');
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [records, setRecords] = useState<RetornoRecord[]>([]);
  const [selectedNossoNumeros, setSelectedNossoNumeros] = useState<Set<string>>(new Set());
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [doneResult, setDoneResult] = useState<{ success: number; errors: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

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

  const handlePreview = useCallback(async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      // Use direct fetch for multipart upload since api.post expects JSON
      const authToken =
        localStorage.getItem('authToken') ?? sessionStorage.getItem('authToken') ?? '';
      const response = await fetch('/api/org/payables/cnab/retorno/preview', {
        method: 'POST',
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const err = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(err.message ?? 'Falha ao processar arquivo');
      }

      const result = (await response.json()) as { records: RetornoRecord[] };
      setRecords(result.records ?? []);

      // Pre-select all matched records with LIQUIDADO status
      const matchedIds = new Set(
        (result.records ?? [])
          .filter((r: RetornoRecord) => r.matched && r.status === 'LIQUIDADO')
          .map((r: RetornoRecord) => r.nossoNumero),
      );
      setSelectedNossoNumeros(matchedIds);
      setStep('preview');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo';
      setUploadError(`Não foi possível ler o arquivo. ${msg}`);
    } finally {
      setIsUploading(false);
    }
  }, [selectedFile]);

  const toggleRecord = useCallback((nossoNumero: string) => {
    setSelectedNossoNumeros((prev) => {
      const next = new Set(prev);
      if (next.has(nossoNumero)) next.delete(nossoNumero);
      else next.add(nossoNumero);
      return next;
    });
  }, []);

  const matchedRecords = records.filter((r) => r.matched);
  const allMatchedSelected =
    matchedRecords.length > 0 &&
    matchedRecords.every((r) => selectedNossoNumeros.has(r.nossoNumero));

  const toggleAllMatched = useCallback(() => {
    if (allMatchedSelected) {
      setSelectedNossoNumeros(new Set());
    } else {
      setSelectedNossoNumeros(new Set(matchedRecords.map((r) => r.nossoNumero)));
    }
  }, [allMatchedSelected, matchedRecords]);

  const handleConfirm = useCallback(async () => {
    setIsConfirming(true);
    setConfirmError(null);

    try {
      const selectedRecords = records.filter((r) => selectedNossoNumeros.has(r.nossoNumero));
      const result = await api.post<{ success: number; errors: number }>(
        '/org/payables/cnab/retorno/confirm',
        { records: selectedRecords },
      );
      setDoneResult({ success: result?.success ?? 0, errors: result?.errors ?? 0 });
      setStep('done');
      // Notify parent of success
      if ((result?.success ?? 0) > 0) {
        setTimeout(onSuccess, 1500);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao confirmar';
      setConfirmError(`Não foi possível confirmar as baixas. ${msg}`);
    } finally {
      setIsConfirming(false);
    }
  }, [records, selectedNossoNumeros, onSuccess]);

  const statusLabel: Record<RetornoStatus, string> = {
    LIQUIDADO: 'Liquidado',
    DEVOLVIDO: 'Devolvido',
    REJEITADO: 'Rejeitado',
  };

  return (
    <div
      className="pm-modal__backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Importar retorno CNAB"
    >
      <div className="pm-modal__panel" style={{ maxWidth: 680 }}>
        <header className="pm-modal__header">
          <div className="pm-modal__header-icon" aria-hidden="true">
            <Upload size={20} />
          </div>
          <h2 className="pm-modal__title">
            {step === 'upload' && 'Importar retorno CNAB'}
            {step === 'preview' && `Retorno CNAB — ${records.length} registros`}
            {step === 'done' && 'Retorno processado'}
          </h2>
          <button type="button" className="pm-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="pm-modal__body">
          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <>
              {uploadError && (
                <div className="pm-modal__submit-error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {uploadError}
                </div>
              )}

              <div
                style={{
                  border: `2px dashed ${isDragging ? 'var(--color-primary-400, #66bb6a)' : 'var(--color-neutral-300, #d0d0d0)'}`,
                  borderRadius: 12,
                  padding: 40,
                  textAlign: 'center',
                  cursor: 'pointer',
                  background: isDragging
                    ? 'var(--color-primary-50, #e8f5e9)'
                    : 'var(--color-neutral-50, #fafaf8)',
                  transition: 'border-color 150ms ease-out, background 150ms ease-out',
                }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                aria-label="Área de upload — clique ou arraste o arquivo .ret ou .txt"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
                }}
              >
                <Upload
                  size={48}
                  aria-hidden="true"
                  style={{
                    color: isDragging
                      ? 'var(--color-primary-600, #2e7d32)'
                      : 'var(--color-neutral-300, #d0d0d0)',
                    margin: '0 auto 16px',
                  }}
                />
                <p
                  style={{
                    fontFamily: "'DM Sans', system-ui, sans-serif",
                    fontWeight: 700,
                    fontSize: '1rem',
                    color: 'var(--color-neutral-700, #3e3833)',
                    margin: '0 0 8px',
                  }}
                >
                  {selectedFile ? selectedFile.name : 'Arraste o arquivo ou clique para selecionar'}
                </p>
                <p
                  style={{
                    fontFamily: "'Source Sans 3', system-ui, sans-serif",
                    fontSize: '0.875rem',
                    color: 'var(--color-neutral-500, #9e9e9e)',
                    margin: 0,
                  }}
                >
                  Formatos aceitos: .ret, .txt (CNAB 240 e CNAB 400)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".ret,.txt,.RET,.TXT"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  aria-label="Selecionar arquivo de retorno CNAB"
                />
              </div>

              {selectedFile && (
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'var(--color-primary-50, #e8f5e9)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <CheckCircle2
                    size={16}
                    aria-hidden="true"
                    style={{ color: 'var(--color-primary-600, #2e7d32)', flexShrink: 0 }}
                  />
                  <span
                    style={{
                      fontFamily: "'Source Sans 3', system-ui, sans-serif",
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'var(--color-primary-700, #1b5e20)',
                    }}
                  >
                    {selectedFile.name} — {(selectedFile.size / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}
            </>
          )}

          {/* ── Step 2: Preview ── */}
          {step === 'preview' && (
            <>
              {confirmError && (
                <div className="pm-modal__submit-error" role="alert">
                  <AlertCircle size={16} aria-hidden="true" />
                  {confirmError}
                </div>
              )}

              <p
                style={{
                  fontFamily: "'Source Sans 3', system-ui, sans-serif",
                  fontSize: '0.9375rem',
                  color: 'var(--color-neutral-600, #757575)',
                  margin: 0,
                }}
              >
                Selecione os registros que deseja processar. Apenas registros com{' '}
                <strong>Encontrado</strong> podem ser baixados.
              </p>

              <div className="pm-modal__installments-wrap">
                <table className="pm-modal__installments-table">
                  <caption className="sr-only">Registros do retorno CNAB</caption>
                  <thead>
                    <tr>
                      <th scope="col">
                        <input
                          type="checkbox"
                          checked={allMatchedSelected}
                          onChange={toggleAllMatched}
                          aria-label="Selecionar todos os registros encontrados"
                          style={{
                            width: 16,
                            height: 16,
                            cursor: 'pointer',
                            accentColor: 'var(--color-primary-600, #2e7d32)',
                          }}
                        />
                      </th>
                      <th scope="col">Nosso número</th>
                      <th scope="col">Fornecedor</th>
                      <th scope="col">Status</th>
                      <th scope="col" className="cp-page__col-right">
                        Valor pago
                      </th>
                      <th scope="col">Data</th>
                      <th scope="col">Vínculo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => (
                      <tr key={r.nossoNumero}>
                        <td>
                          {r.matched && r.status === 'LIQUIDADO' && (
                            <input
                              type="checkbox"
                              checked={selectedNossoNumeros.has(r.nossoNumero)}
                              onChange={() => toggleRecord(r.nossoNumero)}
                              aria-label={`Selecionar ${r.nossoNumero}`}
                              style={{
                                width: 16,
                                height: 16,
                                cursor: 'pointer',
                                accentColor: 'var(--color-primary-600, #2e7d32)',
                              }}
                            />
                          )}
                        </td>
                        <td
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.8125rem',
                          }}
                        >
                          {r.nossoNumero}
                        </td>
                        <td style={{ fontSize: '0.875rem' }}>{r.supplierName ?? '—'}</td>
                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              padding: '2px 8px',
                              borderRadius: 100,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              background:
                                r.status === 'LIQUIDADO'
                                  ? 'var(--color-primary-50, #e8f5e9)'
                                  : r.status === 'DEVOLVIDO'
                                    ? '#fff3e0'
                                    : 'var(--color-error-50, #ffebee)',
                              color:
                                r.status === 'LIQUIDADO'
                                  ? 'var(--color-primary-700, #1b5e20)'
                                  : r.status === 'DEVOLVIDO'
                                    ? '#e65100'
                                    : 'var(--color-error-700, #c62828)',
                            }}
                          >
                            {r.status === 'LIQUIDADO' && (
                              <CheckCircle2 size={10} aria-hidden="true" />
                            )}
                            {r.status === 'REJEITADO' && <XCircle size={10} aria-hidden="true" />}
                            {r.status === 'DEVOLVIDO' && <Minus size={10} aria-hidden="true" />}
                            {statusLabel[r.status]}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.8125rem',
                          }}
                        >
                          {formatBRL(r.paidAmount)}
                        </td>
                        <td
                          style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: '0.8125rem',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatDate(r.paidDate)}
                        </td>
                        <td>
                          {r.matched ? (
                            <span
                              style={{
                                color: 'var(--color-primary-600, #2e7d32)',
                                fontWeight: 600,
                                fontSize: '0.8125rem',
                              }}
                            >
                              Encontrado
                            </span>
                          ) : (
                            <span
                              style={{
                                color: 'var(--color-neutral-400, #bdbdbd)',
                                fontSize: '0.8125rem',
                              }}
                            >
                              Não encontrado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ── Step 3: Done ── */}
          {step === 'done' && doneResult && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 16,
                padding: '32px 0',
                textAlign: 'center',
              }}
            >
              <CheckCircle2
                size={64}
                aria-hidden="true"
                style={{ color: 'var(--color-primary-600, #2e7d32)' }}
              />
              <h3
                style={{
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: 'var(--color-neutral-800, #2a2520)',
                  margin: 0,
                }}
              >
                Retorno processado com sucesso
              </h3>
              <p
                style={{
                  fontFamily: "'Source Sans 3', system-ui, sans-serif",
                  fontSize: '0.9375rem',
                  color: 'var(--color-neutral-600, #757575)',
                  margin: 0,
                }}
              >
                {doneResult.success}{' '}
                {doneResult.success === 1 ? 'baixa registrada' : 'baixas registradas'}
                {doneResult.errors > 0 && ` — ${doneResult.errors} com erro`}
              </p>
            </div>
          )}
        </div>

        <footer className="pm-modal__footer">
          {step === 'upload' && (
            <>
              <button type="button" className="pm-modal__btn-cancel" onClick={onClose}>
                Cancelar
              </button>
              <button
                type="button"
                className="pm-modal__btn-submit"
                disabled={!selectedFile || isUploading}
                onClick={() => void handlePreview()}
              >
                {isUploading ? 'Processando...' : 'Analisar arquivo'}
              </button>
            </>
          )}
          {step === 'preview' && (
            <>
              <button
                type="button"
                className="pm-modal__btn-cancel"
                onClick={() => setStep('upload')}
              >
                Voltar
              </button>
              <button
                type="button"
                className="pm-modal__btn-submit"
                disabled={selectedNossoNumeros.size === 0 || isConfirming}
                onClick={() => void handleConfirm()}
              >
                {isConfirming
                  ? 'Confirmando...'
                  : `Confirmar ${selectedNossoNumeros.size} baixa${selectedNossoNumeros.size !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
          {step === 'done' && (
            <button type="button" className="pm-modal__btn-submit" onClick={onClose}>
              Fechar
            </button>
          )}
        </footer>
      </div>
    </div>
  );
};

export default CnabRetornoModal;
