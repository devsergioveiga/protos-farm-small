import { useState, useEffect, useRef } from 'react';
import { X, Save, Trash2, Check } from 'lucide-react';
import { useJournalEntryActions } from '@/hooks/useJournalEntries';
import ConfirmModal from '@/components/ui/ConfirmModal';
import type { JournalEntryTemplate, CreateJournalEntryLineInput } from '@/types/journal-entries';
import './JournalEntryTemplateModal.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface JournalEntryTemplateModalProps {
  isOpen: boolean;
  orgId: string;
  currentLines: CreateJournalEntryLineInput[];
  currentDescription: string;
  onClose: () => void;
  onLoad: (lines: CreateJournalEntryLineInput[], description: string) => void;
  onSave: (name: string) => Promise<void>;
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function JournalEntryTemplateModal({
  isOpen,
  currentLines,
  currentDescription,
  onClose,
  onLoad,
  onSave,
}: JournalEntryTemplateModalProps) {
  const { listTemplates, deleteTemplate } = useJournalEntryActions();
  const [templates, setTemplates] = useState<JournalEntryTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<JournalEntryTemplate | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const headingId = 'template-modal-heading';

  useEffect(() => {
    if (!isOpen) return;
    setTemplateName('');
    setSaveError(null);
    setSavedMessage(false);
    setIsLoading(true);
    setTimeout(() => headingRef.current?.focus(), 50);

    listTemplates()
      .then((result) => setTemplates(result))
      .catch(() => setTemplates([]))
      .finally(() => setIsLoading(false));
  }, [isOpen, listTemplates]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  const handleSave = async () => {
    if (!templateName.trim()) {
      setSaveError('O nome do modelo é obrigatório');
      return;
    }
    if (currentLines.length === 0) {
      setSaveError('Adicione pelo menos uma linha antes de salvar como modelo');
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(templateName.trim());
      setSavedMessage(true);
      setTemplateName('');
      // Reload templates
      const updated = await listTemplates();
      setTemplates(updated);
      setTimeout(() => setSavedMessage(false), 3000);
    } catch {
      setSaveError('Não foi possível salvar o modelo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingTemplate) return;
    try {
      await deleteTemplate(deletingTemplate.id);
      setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
    } catch {
      // silent
    } finally {
      setDeletingTemplate(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="template-modal__overlay"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <div className="template-modal">
          {/* Header */}
          <div className="template-modal__header">
            <h2 id={headingId} className="template-modal__heading" ref={headingRef} tabIndex={-1}>
              Modelos de Lançamento
            </h2>
            <button
              type="button"
              className="template-modal__close"
              aria-label="Fechar"
              onClick={onClose}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {/* Body */}
          <div className="template-modal__body">
            {/* Save current as template */}
            <section className="template-modal__save-section" aria-labelledby="template-save-heading">
              <h3 id="template-save-heading" className="template-modal__section-heading">
                Salvar como modelo
              </h3>
              <p className="template-modal__save-desc">
                Salva as {currentLines.length} linhas do lançamento atual como modelo reutilizável.
              </p>
              <div className="template-modal__save-row">
                <div className="template-modal__field">
                  <label htmlFor="template-name" className="template-modal__label">
                    Nome do modelo <span aria-hidden="true">*</span>
                  </label>
                  <input
                    id="template-name"
                    type="text"
                    className={`template-modal__input ${saveError ? 'template-modal__input--error' : ''}`}
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="Nome do modelo (ex: Depreciação mensal)"
                    onKeyDown={(e) => { if (e.key === 'Enter') { void handleSave(); } }}
                    aria-describedby={saveError ? 'template-name-error' : undefined}
                  />
                  {saveError && (
                    <span id="template-name-error" className="template-modal__error" role="alert">
                      {saveError}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="template-modal__btn template-modal__btn--secondary"
                  onClick={() => { void handleSave(); }}
                  disabled={isSaving}
                >
                  {savedMessage ? (
                    <><Check size={16} aria-hidden="true" /> Salvo!</>
                  ) : (
                    <><Save size={16} aria-hidden="true" /> {isSaving ? 'Salvando...' : 'Salvar'}</>
                  )}
                </button>
              </div>
              <div className="template-modal__current-desc">
                Histórico atual: <em>{currentDescription || '(sem histórico)'}</em>
              </div>
            </section>

            <hr className="template-modal__divider" />

            {/* Template list */}
            <section aria-labelledby="template-list-heading">
              <h3 id="template-list-heading" className="template-modal__section-heading">
                Modelos salvos
              </h3>

              {isLoading && (
                <div className="template-modal__loading" aria-label="Carregando modelos..." aria-busy="true">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="template-modal__skeleton" />
                  ))}
                </div>
              )}

              {!isLoading && templates.length === 0 && (
                <p className="template-modal__empty">
                  Nenhum modelo salvo ainda. Crie o primeiro acima.
                </p>
              )}

              {!isLoading && templates.length > 0 && (
                <ul className="template-modal__list" role="list">
                  {templates.map((template) => (
                    <li key={template.id} className="template-modal__item">
                      <div className="template-modal__item-info">
                        <span className="template-modal__item-name">{template.name}</span>
                        {template.description && (
                          <span className="template-modal__item-desc">{template.description}</span>
                        )}
                        <span className="template-modal__item-meta">
                          {template.lines.length} linha{template.lines.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div className="template-modal__item-actions">
                        <button
                          type="button"
                          className="template-modal__btn template-modal__btn--primary"
                          onClick={() => onLoad(template.lines, template.description)}
                        >
                          Usar
                        </button>
                        <button
                          type="button"
                          className="template-modal__btn template-modal__btn--icon-danger"
                          aria-label={`Excluir modelo ${template.name}`}
                          onClick={() => setDeletingTemplate(template)}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      <ConfirmModal
        isOpen={!!deletingTemplate}
        title="Excluir modelo"
        message={`Excluir o modelo "${deletingTemplate?.name}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
        onConfirm={() => { void handleDeleteConfirm(); }}
        onCancel={() => setDeletingTemplate(null)}
      />
    </>
  );
}
