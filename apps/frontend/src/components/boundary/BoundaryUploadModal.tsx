import { useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { X, CheckCircle, AlertTriangle, FileUp } from 'lucide-react';
import { useBoundaryUpload } from '@/hooks/useBoundaryUpload';
import BulkUploadZone from '@/components/bulk-import/BulkUploadZone';
import './BoundaryUploadModal.css';

const PreviewMap = lazy(() => import('./BoundaryPreviewMap'));

interface BoundaryUploadModalProps {
  isOpen: boolean;
  farmId: string;
  farmTotalAreaHa: number;
  existingBoundary?: GeoJSON.Polygon | null;
  onClose: () => void;
  onUploadComplete: () => void;
  /** If provided, uploads to registration boundary endpoint instead of farm boundary */
  registrationId?: string;
  /** Area to compare boundary against (defaults to farmTotalAreaHa) */
  referenceAreaHa?: number;
  /** Label for the entity ("da fazenda" or "da matrícula 1234") */
  entityLabel?: string;
}

const STEP_TITLES: Record<string, string> = {
  idle: 'Upload de perímetro',
  parsing: 'Lendo arquivo...',
  previewing: 'Preview do perímetro',
  uploading: 'Enviando perímetro...',
  done: 'Perímetro enviado',
};

function formatArea(ha: number): string {
  return ha.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function BoundaryUploadModal({
  isOpen,
  farmId,
  farmTotalAreaHa,
  existingBoundary,
  onClose,
  onUploadComplete,
  registrationId,
  referenceAreaHa,
  entityLabel,
}: BoundaryUploadModalProps) {
  const { step, file, clientPreview, canPreview, result, error, selectFile, upload, reset } =
    useBoundaryUpload();

  const effectiveAreaHa = referenceAreaHa ?? farmTotalAreaHa;
  const effectiveLabel = entityLabel ?? 'da fazenda';
  const uploadUrl = registrationId
    ? `/org/farms/${farmId}/registrations/${registrationId}/boundary`
    : `/org/farms/${farmId}/boundary`;

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onUploadComplete();
    }
    reset();
    onClose();
  }, [step, onClose, onUploadComplete, reset]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      selectFile(selectedFile, effectiveAreaHa);
    },
    [selectFile, effectiveAreaHa],
  );

  const handleUpload = useCallback(() => {
    void upload(uploadUrl);
  }, [upload, uploadUrl]);

  const divergenceBadge = useMemo(() => {
    const pct = clientPreview?.divergencePercentage;
    if (pct == null) return null;

    let className = 'boundary-modal__divergence-badge--ok';
    const label = `${formatArea(pct)}% de divergência`;

    if (pct > 20) {
      className = 'boundary-modal__divergence-badge--danger';
    } else if (pct > 10) {
      className = 'boundary-modal__divergence-badge--warning';
    }

    return (
      <span className={`boundary-modal__divergence-badge ${className}`}>
        <AlertTriangle size={14} aria-hidden="true" />
        {label}
      </span>
    );
  }, [clientPreview?.divergencePercentage]);

  const resultDivergenceBadge = useMemo(() => {
    if (!result?.areaDivergence) return null;

    const { percentage, warning } = result.areaDivergence;
    const className = warning
      ? percentage > 20
        ? 'boundary-modal__divergence-badge--danger'
        : 'boundary-modal__divergence-badge--warning'
      : 'boundary-modal__divergence-badge--ok';

    return (
      <span className={`boundary-modal__divergence-badge ${className}`}>
        <AlertTriangle size={14} aria-hidden="true" />
        {formatArea(percentage)}% de divergência
      </span>
    );
  }, [result]);

  if (!isOpen) return null;

  return (
    <div
      className="boundary-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Upload de perímetro ${effectiveLabel}`}
    >
      <div className="boundary-modal">
        <header className="boundary-modal__header">
          <h2 className="boundary-modal__title">{STEP_TITLES[step]}</h2>
          <button
            type="button"
            className="boundary-modal__close"
            onClick={handleClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {error && (
          <div className="boundary-modal__error" role="alert">
            {error}
          </div>
        )}

        <div className="boundary-modal__body">
          {/* ── idle / parsing ── */}
          {(step === 'idle' || step === 'parsing') && (
            <BulkUploadZone onFileSelect={handleFileSelect} isUploading={step === 'parsing'} />
          )}

          {/* ── previewing ── */}
          {step === 'previewing' && (
            <div className="boundary-modal__preview">
              <div className="boundary-modal__info">
                <div className="boundary-modal__info-row">
                  <span className="boundary-modal__info-label">ARQUIVO</span>
                  <span className="boundary-modal__info-value">{file?.name ?? '—'}</span>
                </div>

                {clientPreview && (
                  <div className="boundary-modal__info-row">
                    <span className="boundary-modal__info-label">ÁREA CALCULADA</span>
                    <span className="boundary-modal__info-value">
                      {formatArea(clientPreview.areaHa)} ha
                    </span>
                  </div>
                )}

                <div className="boundary-modal__info-row">
                  <span className="boundary-modal__info-label">ÁREA CADASTRADA</span>
                  <span className="boundary-modal__info-value">
                    {formatArea(effectiveAreaHa)} ha
                  </span>
                </div>

                {divergenceBadge}

                {existingBoundary && (
                  <p className="boundary-modal__replace-note">
                    O perímetro atual será substituído pelo novo arquivo.
                  </p>
                )}

                {!canPreview && (
                  <p className="boundary-modal__no-preview">
                    <FileUp size={20} aria-hidden="true" style={{ marginBottom: 4 }} />
                    <br />
                    Preview não disponível para este formato. O arquivo será processado no servidor.
                  </p>
                )}
              </div>

              {canPreview && clientPreview && (
                <div className="boundary-modal__map">
                  <Suspense
                    fallback={
                      <div
                        style={{
                          height: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-neutral-500)',
                        }}
                      >
                        Carregando mapa...
                      </div>
                    }
                  >
                    <PreviewMap
                      polygon={clientPreview.polygon}
                      existingBoundary={existingBoundary ?? null}
                    />
                  </Suspense>
                </div>
              )}
            </div>
          )}

          {/* ── uploading ── */}
          {step === 'uploading' && (
            <div className="boundary-modal__uploading">
              <div className="boundary-modal__spinner" />
              <p>Enviando perímetro...</p>
            </div>
          )}

          {/* ── done ── */}
          {step === 'done' && result && (
            <div className="boundary-modal__result">
              <CheckCircle size={48} aria-hidden="true" className="boundary-modal__result-icon" />
              <h3 className="boundary-modal__result-title">Perímetro salvo com sucesso</h3>
              <span className="boundary-modal__result-area">
                {formatArea(result.boundaryAreaHa)} ha
              </span>
              {resultDivergenceBadge}
              {result.warnings.length > 0 && (
                <ul className="boundary-modal__warnings">
                  {result.warnings.map((w, i) => (
                    <li key={i} className="boundary-modal__warning-item">
                      <AlertTriangle size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
                      {w}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        {(step === 'previewing' || step === 'done') && (
          <footer className="boundary-modal__footer">
            {step === 'previewing' && (
              <>
                <button
                  type="button"
                  className="boundary-modal__btn boundary-modal__btn--secondary"
                  onClick={() => {
                    reset();
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="boundary-modal__btn boundary-modal__btn--primary"
                  onClick={handleUpload}
                >
                  Enviar perímetro
                </button>
              </>
            )}
            {step === 'done' && (
              <button
                type="button"
                className="boundary-modal__btn boundary-modal__btn--primary"
                onClick={handleClose}
              >
                Fechar
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

export default BoundaryUploadModal;
