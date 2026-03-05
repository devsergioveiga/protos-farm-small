import { useState, useEffect, useRef, useCallback } from 'react';
import { X, ArrowLeft, ArrowRight } from 'lucide-react';
import { useBulkImportAnimals } from '@/hooks/useBulkImportAnimals';
import AnimalBulkUploadZone from './AnimalBulkUploadZone';
import AnimalColumnMappingForm from './AnimalColumnMappingForm';
import AnimalBulkPreviewTable from './AnimalBulkPreviewTable';
import AnimalBulkImportReport from './AnimalBulkImportReport';
import './AnimalBulkImportModal.css';

interface AnimalBulkImportModalProps {
  isOpen: boolean;
  farmId: string;
  onClose: () => void;
  onImportComplete: () => void;
}

const STEP_TITLES: Record<string, string> = {
  idle: 'Importar animais',
  uploading: 'Processando arquivo...',
  mapping: 'Mapeamento de colunas',
  previewing: 'Preview dos animais',
  confirming: 'Importando...',
  done: 'Resultado da importação',
};

function AnimalBulkImportModal({
  isOpen,
  farmId,
  onClose,
  onImportComplete,
}: AnimalBulkImportModalProps) {
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
  } = useBulkImportAnimals();

  const [file, setFile] = useState<File | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (prevIsOpen !== isOpen) {
    setPrevIsOpen(isOpen);
    if (!isOpen) {
      reset();
      setFile(null);
    }
  }

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onImportComplete();
    }
    onClose();
  }, [step, onClose, onImportComplete]);

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
      setFile(selectedFile);
      void uploadFile(selectedFile, farmId);
    },
    [farmId, uploadFile],
  );

  const handleConfirm = useCallback(() => {
    if (!file) return;
    void confirmImport(file, farmId);
  }, [file, farmId, confirmImport]);

  if (!isOpen) return null;

  const showBackButton = step === 'previewing';
  const showNextButton = step === 'mapping';
  const showConfirmButton = step === 'previewing' && selectedIndices.size > 0;

  return (
    <div
      className="bulk-modal__overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Importar animais em lote"
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
            <AnimalBulkUploadZone onFileSelect={handleFileSelect} isUploading={false} />
          )}

          {step === 'uploading' && (
            <AnimalBulkUploadZone onFileSelect={handleFileSelect} isUploading={true} />
          )}

          {step === 'mapping' && preview && (
            <AnimalColumnMappingForm
              columnHeaders={preview.columnHeaders}
              columnMapping={columnMapping}
              onChange={setColumnMapping}
            />
          )}

          {step === 'previewing' && preview && (
            <AnimalBulkPreviewTable
              rows={preview.rows}
              selectedIndices={selectedIndices}
              onToggle={toggleIndex}
              onSelectAllValid={selectAllValid}
              onDeselectAll={deselectAll}
            />
          )}

          {step === 'confirming' && (
            <div className="bulk-modal__confirming">
              <div className="bulk-modal__confirming-spinner" />
              <p>Importando {selectedIndices.size} animais...</p>
            </div>
          )}

          {step === 'done' && result && (
            <AnimalBulkImportReport result={result} onClose={handleClose} />
          )}
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
                Importar {selectedIndices.size} animais
              </button>
            )}
          </footer>
        )}
      </div>
    </div>
  );
}

export default AnimalBulkImportModal;
