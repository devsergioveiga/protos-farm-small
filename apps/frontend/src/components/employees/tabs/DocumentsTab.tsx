import { useRef } from 'react';
import { FileText, Download, Trash2, Upload, FilePlus } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { useState } from 'react';
import type { EmployeeDocument, DocumentType } from '@/types/employee';

const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  RG: 'RG',
  CPF: 'CPF',
  CTPS: 'Carteira de Trabalho',
  ASO: 'ASO / Atestado',
  CONTRATO: 'Contrato',
  OUTRO: 'Outro',
};

interface DocumentsTabProps {
  employeeId: string;
  orgId: string;
  documents: EmployeeDocument[];
  onUpload?: (file: File, documentType: DocumentType) => Promise<void>;
  onDelete?: (docId: string) => Promise<void>;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR');
}

export default function DocumentsTab({
  employeeId,
  orgId,
  documents,
  onUpload,
  onDelete,
}: DocumentsTabProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocType, setPendingDocType] = useState<DocumentType>('OUTRO');
  const [isUploading, setIsUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onUpload) return;
    setIsUploading(true);
    try {
      await onUpload(file, pendingDocType);
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !onDelete) return;
    setIsDeleting(true);
    try {
      await onDelete(deleteTarget.id);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const downloadUrl = (doc: EmployeeDocument) =>
    `/api/uploads/employees/${orgId}/${employeeId}/${doc.fileName}`;

  return (
    <div className="employee-detail__tab-content">
      {/* Upload section */}
      <div className="employee-detail__docs-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label
            htmlFor="doc-type-select"
            className="employee-detail__field-label"
            style={{ margin: 0 }}
          >
            Tipo:
          </label>
          <select
            id="doc-type-select"
            value={pendingDocType}
            onChange={(e) => setPendingDocType(e.target.value as DocumentType)}
            className="employee-detail__select"
            aria-label="Tipo de documento a fazer upload"
          >
            {(Object.entries(DOCUMENT_TYPE_LABELS) as [DocumentType, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </select>
        </div>

        <label
          className="employee-detail__btn-secondary"
          style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          aria-label="Fazer upload de documento"
        >
          <Upload size={16} aria-hidden="true" />
          {isUploading ? 'Enviando...' : 'Fazer upload'}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={(e) => void handleFileChange(e)}
            style={{ display: 'none' }}
            aria-label="Selecionar arquivo para upload"
            disabled={isUploading}
          />
        </label>
      </div>

      {documents.length === 0 ? (
        <div className="employee-detail__empty-state">
          <FilePlus size={48} aria-hidden="true" color="var(--color-neutral-400)" />
          <p className="employee-detail__empty-title">Nenhum documento anexado.</p>
          <p className="employee-detail__empty-desc">
            Faça upload do RG, CTPS ou ASO para manter o histórico completo.
          </p>
        </div>
      ) : (
        <ul className="employee-detail__docs-list" aria-label="Documentos do colaborador">
          {documents.map((doc) => (
            <li key={doc.id} className="employee-detail__doc-item">
              <FileText size={20} aria-hidden="true" color="var(--color-neutral-500)" />
              <div className="employee-detail__doc-info">
                <div className="employee-detail__doc-name">{doc.fileName}</div>
                <div className="employee-detail__doc-meta">
                  {DOCUMENT_TYPE_LABELS[doc.documentType] ?? doc.documentType} •{' '}
                  {formatDate(doc.uploadedAt)}
                </div>
              </div>
              <div className="employee-detail__doc-actions">
                <a
                  href={downloadUrl(doc)}
                  download={doc.fileName}
                  className="employee-detail__btn-icon"
                  aria-label={`Baixar ${doc.fileName}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download size={16} aria-hidden="true" />
                </a>
                {onDelete && (
                  <button
                    type="button"
                    className="employee-detail__btn-icon employee-detail__btn-icon--danger"
                    onClick={() => setDeleteTarget(doc)}
                    aria-label={`Excluir ${doc.fileName}`}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Confirm delete modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={true}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void handleDelete()}
          title="Excluir documento"
          message={`O arquivo "${deleteTarget.fileName}" será excluído permanentemente. Tem certeza?`}
          variant="warning"
          confirmLabel="Excluir"
          isLoading={isDeleting}
        />
      )}
    </div>
  );
}
