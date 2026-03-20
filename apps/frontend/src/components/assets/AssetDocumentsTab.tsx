import { useState, useEffect } from 'react';
import { AlertTriangle, Clock, Trash2, Plus } from 'lucide-react';
import { useAssetDocuments } from '@/hooks/useAssetDocuments';
import type { AssetDocumentType } from '@/types/asset';

// ─── Helpers ──────────────────────────────────────────────────────────

const DOCUMENT_TYPE_LABELS: Record<AssetDocumentType, string> = {
  CRLV: 'CRLV',
  SEGURO: 'Seguro',
  REVISAO: 'Revisao',
  CCIR: 'CCIR',
  ITR: 'ITR',
  LAUDO: 'Laudo',
  GARANTIA: 'Garantia',
  OUTRO: 'Outro',
};

function getExpiryStatus(expiresAt: string | null): {
  label: string;
  className: string;
  icon: React.ElementType | null;
} {
  if (!expiresAt)
    return { label: 'Sem vencimento', className: 'docs-tab__badge--neutral', icon: null };

  const now = new Date();
  const expiry = new Date(expiresAt);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { label: 'Vencido', className: 'docs-tab__badge--expired', icon: AlertTriangle };
  }
  if (diffDays <= 7) {
    return {
      label: `Vence em ${diffDays} dia${diffDays === 1 ? '' : 's'}`,
      className: 'docs-tab__badge--urgent',
      icon: AlertTriangle,
    };
  }
  if (diffDays <= 30) {
    return {
      label: `Vence em ${diffDays} dias`,
      className: 'docs-tab__badge--warning',
      icon: Clock,
    };
  }
  return { label: 'Em dia', className: 'docs-tab__badge--ok', icon: null };
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('pt-BR');
  } catch {
    return '—';
  }
}

// ─── AssetDocumentsTab ────────────────────────────────────────────────

interface AssetDocumentsTabProps {
  assetId: string;
}

export default function AssetDocumentsTab({ assetId }: AssetDocumentsTabProps) {
  const { documents, loading, error, fetchDocuments, createDocument, deleteDocument } =
    useAssetDocuments(assetId);

  // Load documents on mount
  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  // Add document form state
  const [docType, setDocType] = useState<AssetDocumentType>('CRLV');
  const [docName, setDocName] = useState('');
  const [docExpiry, setDocExpiry] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!docName.trim()) {
      setAddError('Informe o nome do documento.');
      return;
    }
    setIsAdding(true);
    setAddError(null);
    try {
      await createDocument({
        assetId,
        documentType: docType,
        documentName: docName.trim(),
        expiresAt: docExpiry || undefined,
      });
      setDocName('');
      setDocExpiry('');
    } catch {
      setAddError('Nao foi possivel adicionar o documento. Tente novamente.');
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteDocument(id);
    } catch {
      // Silently fail for now — will surface in future
    }
  }

  return (
    <div className="docs-tab">
      {/* Add document form */}
      <section className="docs-tab__add-section">
        <h3 className="docs-tab__section-title">Adicionar documento</h3>
        <form onSubmit={(e) => void handleAdd(e)} className="docs-tab__form">
          <div className="docs-tab__form-row">
            <div className="docs-tab__form-field">
              <label htmlFor="doc-type" className="docs-tab__label">
                Tipo *
              </label>
              <select
                id="doc-type"
                className="docs-tab__select"
                value={docType}
                onChange={(e) => setDocType(e.target.value as AssetDocumentType)}
                aria-required="true"
              >
                {(Object.entries(DOCUMENT_TYPE_LABELS) as [AssetDocumentType, string][]).map(
                  ([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="docs-tab__form-field docs-tab__form-field--name">
              <label htmlFor="doc-name" className="docs-tab__label">
                Nome *
              </label>
              <input
                id="doc-name"
                type="text"
                className="docs-tab__input"
                placeholder="Ex: CRLV 2025, Apolice Allianz..."
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                aria-required="true"
              />
            </div>

            <div className="docs-tab__form-field">
              <label htmlFor="doc-expiry" className="docs-tab__label">
                Vencimento
              </label>
              <input
                id="doc-expiry"
                type="date"
                className="docs-tab__input"
                value={docExpiry}
                onChange={(e) => setDocExpiry(e.target.value)}
              />
            </div>

            <div className="docs-tab__form-field docs-tab__form-field--btn">
              <button
                type="submit"
                className="docs-tab__btn docs-tab__btn--secondary"
                disabled={isAdding}
                aria-busy={isAdding}
              >
                <Plus size={16} aria-hidden="true" />
                {isAdding ? 'Adicionando...' : 'Adicionar'}
              </button>
            </div>
          </div>

          {addError && (
            <p className="docs-tab__add-error" role="alert">
              {addError}
            </p>
          )}
        </form>
      </section>

      {/* Documents list */}
      <section className="docs-tab__list-section">
        {loading && (
          <div className="docs-tab__loading" role="status" aria-label="Carregando documentos">
            <div className="docs-tab__skeleton" />
            <div className="docs-tab__skeleton" />
          </div>
        )}

        {error && !loading && (
          <p className="docs-tab__error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && documents.length === 0 && (
          <div className="docs-tab__empty">
            <p className="docs-tab__empty-text">
              Nenhum documento cadastrado. Adicione documentos como CRLV, seguro ou laudos.
            </p>
          </div>
        )}

        {!loading && documents.length > 0 && (
          <ul className="docs-tab__list" aria-label="Lista de documentos">
            {documents.map((doc) => {
              const expiry = getExpiryStatus(doc.expiresAt);
              const ExpiryIcon = expiry.icon;
              return (
                <li key={doc.id} className="docs-tab__item">
                  <div className="docs-tab__item-type">
                    <span className="docs-tab__type-badge">
                      {DOCUMENT_TYPE_LABELS[doc.documentType]}
                    </span>
                  </div>
                  <div className="docs-tab__item-info">
                    <span className="docs-tab__item-name">{doc.documentName}</span>
                    {doc.expiresAt && (
                      <span className="docs-tab__item-expiry">{formatDate(doc.expiresAt)}</span>
                    )}
                  </div>
                  <div className="docs-tab__item-status">
                    <span className={`docs-tab__badge ${expiry.className}`}>
                      {ExpiryIcon && <ExpiryIcon size={12} aria-hidden="true" />}
                      {expiry.label}
                    </span>
                  </div>
                  <div className="docs-tab__item-actions">
                    <button
                      type="button"
                      className="docs-tab__delete-btn"
                      onClick={() => void handleDelete(doc.id)}
                      aria-label="Excluir documento"
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
