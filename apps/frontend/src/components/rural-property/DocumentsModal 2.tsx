import { useState, useEffect, useCallback } from 'react';
import { FileText, X, AlertCircle, Download } from 'lucide-react';
import { listPropertyDocuments } from '@/hooks/useRuralProperties';
import { DOCUMENT_TYPES } from '@/types/rural-property';
import type { PropertyDocumentItem } from '@/types/rural-property';
import { api } from '@/services/api';
import './DocumentsModal.css';

interface DocumentsModalProps {
  isOpen: boolean;
  farmId: string;
  propertyId: string;
  propertyName: string;
  onClose: () => void;
}

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsModal({
  isOpen,
  farmId,
  propertyId,
  propertyName,
  onClose,
}: DocumentsModalProps) {
  const [documents, setDocuments] = useState<PropertyDocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const docs = await listPropertyDocuments(farmId, propertyId);
      setDocuments(docs);
    } catch {
      setError('Não foi possível carregar os documentos.');
    } finally {
      setIsLoading(false);
    }
  }, [farmId, propertyId]);

  useEffect(() => {
    if (!isOpen) return;
    void fetchDocuments();
  }, [isOpen, fetchDocuments]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleDownload = async (doc: PropertyDocumentItem) => {
    try {
      const blob = await api.getBlob(
        `/org/farms/${farmId}/properties/${propertyId}/documents/${doc.id}`,
      );
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = doc.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // download error handled silently
    }
  };

  if (!isOpen) return null;

  const getTypeLabel = (type: string) =>
    DOCUMENT_TYPES.find((t) => t.value === type)?.label || type;

  return (
    <div
      className="docs-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="docs-modal-title"
    >
      <div className="docs-modal">
        <header className="docs-modal__header">
          <h2 id="docs-modal-title" className="docs-modal__title">
            Documentos
          </h2>
          <button type="button" className="docs-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <p className="docs-modal__subtitle">{propertyName}</p>

        {error && (
          <div className="docs-modal__error" role="alert">
            <AlertCircle size={16} aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {isLoading ? (
          <div className="docs-modal__skeleton" aria-busy="true">
            {[1, 2].map((i) => (
              <div key={i} className="docs-modal__skeleton-item" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="docs-modal__empty">
            <FileText size={40} aria-hidden="true" />
            <p className="docs-modal__empty-text">Nenhum documento vinculado a este imóvel.</p>
          </div>
        ) : (
          <ul className="docs-modal__list">
            {documents.map((doc) => (
              <li key={doc.id} className="docs-modal__item">
                <div className="docs-modal__item-icon">
                  <FileText size={18} aria-hidden="true" />
                </div>
                <div className="docs-modal__item-info">
                  <span className="docs-modal__item-name">{doc.filename}</span>
                  <div className="docs-modal__item-details">
                    <span className="docs-modal__item-badge">{getTypeLabel(doc.type)}</span>
                    {doc.sizeBytes != null && <span>{formatFileSize(doc.sizeBytes)}</span>}
                  </div>
                </div>
                <button
                  type="button"
                  className="docs-modal__download-btn"
                  onClick={() => void handleDownload(doc)}
                  aria-label={`Baixar ${doc.filename}`}
                >
                  <Download size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
