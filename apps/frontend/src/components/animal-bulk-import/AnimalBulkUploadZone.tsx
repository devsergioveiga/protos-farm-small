import { useState, useRef, useCallback } from 'react';
import { Upload } from 'lucide-react';
import './AnimalBulkImportModal.css';

interface AnimalBulkUploadZoneProps {
  onFileSelect: (file: File) => void;
  isUploading: boolean;
}

const ACCEPTED_EXTENSIONS = '.csv,.xlsx,.xls';

function AnimalBulkUploadZone({ onFileSelect, isUploading }: AnimalBulkUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileSelect(file);
    },
    [onFileSelect],
  );

  return (
    <div
      className={`bulk-upload-zone ${isDragging ? 'bulk-upload-zone--dragging' : ''} ${isUploading ? 'bulk-upload-zone--uploading' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="region"
      aria-label="Área de upload de arquivo"
    >
      {isUploading ? (
        <div className="bulk-upload-zone__loading">
          <div className="bulk-upload-zone__spinner" />
          <p className="bulk-upload-zone__text">Processando arquivo...</p>
        </div>
      ) : (
        <>
          <Upload size={48} aria-hidden="true" className="bulk-upload-zone__icon" />
          <p className="bulk-upload-zone__text">
            Arraste um arquivo aqui ou{' '}
            <button
              type="button"
              className="bulk-upload-zone__browse"
              onClick={() => inputRef.current?.click()}
            >
              selecione do computador
            </button>
          </p>
          <p className="bulk-upload-zone__hint">Formatos aceitos: CSV, Excel (.xlsx, .xls)</p>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleChange}
            className="bulk-upload-zone__input"
            aria-label="Selecionar arquivo de animais"
          />
        </>
      )}
    </div>
  );
}

export default AnimalBulkUploadZone;
