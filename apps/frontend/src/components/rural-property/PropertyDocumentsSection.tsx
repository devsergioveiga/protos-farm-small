import { useState, useCallback, useEffect, useRef } from 'react';
import { FileText, Upload, Download, Trash2, AlertCircle, Check } from 'lucide-react';
import { api } from '../../services/api';
import { listPropertyDocuments, deletePropertyDocument } from '../../hooks/useRuralProperties';
import type { PropertyDocumentItem } from '../../types/rural-property';
import { DOCUMENT_TYPES } from '../../types/rural-property';

interface PropertyDocumentsSectionProps {
  farmId: string;
  propertyId: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  EXTRACTED: 'Extraído',
  FAILED: 'Falha',
  MANUAL: 'Manual',
};

const STATUS_CLASSES: Record<string, string> = {
  PENDING: 'pending',
  EXTRACTED: 'extracted',
  FAILED: 'failed',
  MANUAL: 'manual',
};

export function PropertyDocumentsSection({ farmId, propertyId }: PropertyDocumentsSectionProps) {
  const [documents, setDocuments] = useState<PropertyDocumentItem[]>([]);
  const [, setIsLoading] = useState(true);
  const [uploadType, setUploadType] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await listPropertyDocuments(farmId, propertyId);
      setDocuments(result);
    } catch {
      // Silently fail — section is supplementary
    } finally {
      setIsLoading(false);
    }
  }, [farmId, propertyId]);

  useEffect(() => {
    void fetchDocs();
  }, [fetchDocs]);

  const handleUploadClick = (type: string) => {
    setUploadType(type);
    setError(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !uploadType) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Formato não suportado. Aceitos: PDF, JPEG, PNG');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo: 10 MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('type', uploadType);

      const token = localStorage.getItem('protos_access_token');
      const response = await fetch(`/api/org/farms/${farmId}/properties/${propertyId}/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error || 'Erro ao enviar documento');
      }

      setSuccessMsg('Documento enviado com sucesso');
      setTimeout(() => setSuccessMsg(null), 3000);
      await fetchDocs();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao enviar documento');
    } finally {
      setIsUploading(false);
      setUploadType('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDownload = async (doc: PropertyDocumentItem) => {
    try {
      const blob = await api.getBlob(
        `/org/farms/${farmId}/properties/${propertyId}/documents/${doc.id}`,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Erro ao baixar documento');
    }
  };

  const handleDelete = async (doc: PropertyDocumentItem) => {
    if (!window.confirm(`Remover "${doc.filename}"?`)) return;
    try {
      await deletePropertyDocument(farmId, propertyId, doc.id);
      await fetchDocs();
    } catch {
      setError('Erro ao remover documento');
    }
  };

  // Group documents by type
  const docsByType = new Map<string, PropertyDocumentItem[]>();
  for (const doc of documents) {
    const list = docsByType.get(doc.type) || [];
    list.push(doc);
    docsByType.set(doc.type, list);
  }

  return (
    <section className="prop-docs" aria-labelledby="prop-docs-title">
      <div className="prop-docs__header">
        <h3 id="prop-docs-title" className="prop-docs__title">
          <FileText size={18} aria-hidden="true" /> Documentos
        </h3>
      </div>

      {error && (
        <div className="prop-docs__error" role="alert">
          <AlertCircle size={14} aria-hidden="true" /> {error}
        </div>
      )}

      {successMsg && (
        <div className="prop-docs__success" role="status">
          <Check size={14} aria-hidden="true" /> {successMsg}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        aria-hidden="true"
      />

      <p className="prop-docs__hint">
        Comece pelo CCIR — ele cria a estrutura do imóvel automaticamente.
      </p>

      <div className="prop-docs__grid">
        {DOCUMENT_TYPES.map((dt) => {
          const docs = docsByType.get(dt.value) || [];
          const isMultiple = false;

          return (
            <div key={dt.value} className="prop-docs__slot">
              <div className="prop-docs__slot-header">
                <span className="prop-docs__slot-label">{dt.label}</span>
                {docs.length > 0 && (
                  <span className={`prop-docs__slot-status prop-docs__slot-status--attached`}>
                    {docs.length} anexo{docs.length !== 1 ? 's' : ''}
                  </span>
                )}
                {docs.length === 0 && (
                  <span className="prop-docs__slot-status prop-docs__slot-status--pending">
                    Pendente
                  </span>
                )}
              </div>

              {docs.map((doc) => (
                <div key={doc.id} className="prop-docs__file">
                  <span className="prop-docs__filename" title={doc.filename}>
                    {doc.filename}
                  </span>
                  <span
                    className={`prop-docs__extraction prop-docs__extraction--${STATUS_CLASSES[doc.extractionStatus] || 'pending'}`}
                  >
                    {STATUS_LABELS[doc.extractionStatus] || doc.extractionStatus}
                  </span>
                  <div className="prop-docs__file-actions">
                    <button
                      className="prop-docs__icon-btn"
                      onClick={() => handleDownload(doc)}
                      aria-label={`Baixar ${doc.filename}`}
                      type="button"
                    >
                      <Download size={14} aria-hidden="true" />
                    </button>
                    <button
                      className="prop-docs__icon-btn prop-docs__icon-btn--danger"
                      onClick={() => handleDelete(doc)}
                      aria-label={`Remover ${doc.filename}`}
                      type="button"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}

              {(isMultiple || docs.length === 0) && (
                <button
                  className="prop-docs__upload-btn"
                  onClick={() => handleUploadClick(dt.value)}
                  disabled={isUploading}
                  type="button"
                >
                  <Upload size={14} aria-hidden="true" />
                  {isUploading && uploadType === dt.value ? 'Enviando...' : 'Enviar'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
