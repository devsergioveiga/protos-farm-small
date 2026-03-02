import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { useBulkImport } from '@/hooks/useBulkImport';
import BulkUploadZone from './BulkUploadZone';
import ColumnMappingForm from './ColumnMappingForm';
import BulkPreviewTable from './BulkPreviewTable';
import BulkImportReport from './BulkImportReport';
import './BulkImportModal.css';

const BulkPreviewMap = lazy(() => import('./BulkPreviewMap'));

interface BulkImportModalProps {
  isOpen: boolean;
  farmId: string;
  farmBoundary?: GeoJSON.Polygon | null;
  onClose: () => void;
  onImportComplete: () => void;
}

const STEP_TITLES: Record<string, string> = {
  idle: 'Importar talhões',
  uploading: 'Processando arquivo...',
  mapping: 'Mapeamento de colunas',
  previewing: 'Preview dos talhões',
  confirming: 'Importando...',
  done: 'Resultado da importação',
};

function BulkImportModal({
  isOpen,
  farmId,
  farmBoundary,
  onClose,
  onImportComplete,
}: BulkImportModalProps) {
  const {
    step,
    preview,
    result,
    error,
    columnMapping,
    setColumnMapping,
    selectedIndices,
    toggleIndex,
    selectAllValid,
    deselectAll,
    uploadFile,
    goToPreview,
    goToMapping,
    confirmImport,
    reset,
  } = useBulkImport();

  const [file, setFile] = useState<File | null>(null);
  const [defaultName, setDefaultName] = useState('Talhão {n}');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      reset();
      setFile(null);
      setDefaultName('Talhão {n}');
    }
  }, [isOpen, reset]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        handleClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, step]);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      setFile(selectedFile);
      void uploadFile(selectedFile, farmId);
    },
    [farmId, uploadFile],
  );

  const handleConfirm = useCallback(() => {
    if (!file) return;
    void confirmImport(file, farmId, undefined, defaultName);
  }, [file, farmId, defaultName, confirmImport]);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onImportComplete();
    }
    onClose();
  }, [step, onClose, onImportComplete]);

  if (!isOpen) return null;

  const showBackButton = step === 'previewing';
  const showNextButton = step === 'mapping';
  const showConfirmButton = step === 'previewing' && selectedIndices.size > 0;

  return (
    <div
      className="bulk-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Importar talhões em lote"
    >
      <div className="bulk-modal" ref={dialogRef}>
        <header className="bulk-modal__header">
          <h2 className="bulk-modal__title">{STEP_TITLES[step]}</h2>
          <button
            type="button"
            className="bulk-modal__close"
            onClick={handleClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {error && (
          <div className="bulk-modal__error" role="alert">
            {error}
          </div>
        )}

        <div className="bulk-modal__body">
          {step === 'idle' && (
            <BulkUploadZone onFileSelect={handleFileSelect} isUploading={false} />
          )}

          {step === 'uploading' && (
            <BulkUploadZone onFileSelect={handleFileSelect} isUploading={true} />
          )}

          {step === 'mapping' && preview && (
            <div className="bulk-modal__mapping-step">
              <ColumnMappingForm
                propertyKeys={preview.propertyKeys}
                columnMapping={columnMapping}
                onChange={setColumnMapping}
              />
              <div className="bulk-modal__default-name">
                <label htmlFor="default-name" className="bulk-modal__label">
                  Nome padrão (quando não mapeado)
                </label>
                <input
                  id="default-name"
                  type="text"
                  value={defaultName}
                  onChange={(e) => setDefaultName(e.target.value)}
                  className="bulk-modal__input"
                  placeholder="Talhão {n}"
                />
                <p className="bulk-modal__hint">Use {'{n}'} para numeração automática</p>
              </div>
            </div>
          )}

          {step === 'previewing' && preview && (
            <div className="bulk-modal__preview-step">
              <div className="bulk-modal__preview-table">
                <BulkPreviewTable
                  features={preview.features}
                  selectedIndices={selectedIndices}
                  onToggle={toggleIndex}
                  onSelectAllValid={selectAllValid}
                  onDeselectAll={deselectAll}
                  columnMapping={columnMapping}
                />
              </div>
              <Suspense
                fallback={<div className="bulk-modal__map-loading">Carregando mapa...</div>}
              >
                <BulkPreviewMap
                  features={preview.features}
                  farmBoundary={farmBoundary}
                  selectedIndices={selectedIndices}
                />
              </Suspense>
            </div>
          )}

          {step === 'confirming' && (
            <div className="bulk-modal__confirming">
              <div className="bulk-modal__confirming-spinner" />
              <p>Importando {selectedIndices.size} talhões...</p>
            </div>
          )}

          {step === 'done' && result && <BulkImportReport result={result} onClose={handleClose} />}
        </div>

        {(showBackButton || showNextButton || showConfirmButton) && (
          <footer className="bulk-modal__footer">
            {showBackButton && (
              <button
                type="button"
                className="bulk-modal__btn bulk-modal__btn--secondary"
                onClick={goToMapping}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                Voltar
              </button>
            )}
            {showNextButton && (
              <button
                type="button"
                className="bulk-modal__btn bulk-modal__btn--primary"
                onClick={goToPreview}
              >
                Visualizar preview
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            {showConfirmButton && (
              <button
                type="button"
                className="bulk-modal__btn bulk-modal__btn--primary"
                onClick={handleConfirm}
              >
                Importar {selectedIndices.size} talhões
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

export default BulkImportModal;
