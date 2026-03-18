import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { DiseaseItem, CreateDiseaseInput } from '@/types/disease';
import { DISEASE_CATEGORIES, DISEASE_SEVERITIES, AFFECTED_SYSTEMS } from '@/types/disease';
import './DiseaseModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  disease?: DiseaseItem | null;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateDiseaseInput = {
  name: '',
  scientificName: '',
  code: '',
  category: '',
  severity: '',
  affectedSystem: '',
  symptoms: '',
  quarantineDays: null,
  isNotifiable: false,
  photoUrl: '',
  notes: '',
};

export default function DiseaseModal({ isOpen, onClose, disease, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateDiseaseInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (disease) {
      setFormData({
        name: disease.name,
        scientificName: disease.scientificName ?? '',
        code: disease.code ?? '',
        category: disease.category,
        severity: disease.severity ?? '',
        affectedSystem: disease.affectedSystem ?? '',
        symptoms: disease.symptoms ?? '',
        quarantineDays: disease.quarantineDays,
        isNotifiable: disease.isNotifiable,
        photoUrl: disease.photoUrl ?? '',
        notes: disease.notes ?? '',
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
  }, [disease, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const payload: CreateDiseaseInput = {
      ...formData,
      scientificName: formData.scientificName || null,
      code: formData.code || null,
      severity: formData.severity || null,
      affectedSystem: formData.affectedSystem || null,
      symptoms: formData.symptoms || null,
      quarantineDays: formData.quarantineDays ?? null,
      photoUrl: formData.photoUrl || null,
      notes: formData.notes || null,
    };

    try {
      if (disease) {
        await api.patch(`/org/diseases/${disease.id}`, payload);
      } else {
        await api.post('/org/diseases', payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar doença.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="disease-modal__overlay" onClick={onClose}>
      <div
        className="disease-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="disease-modal-title"
      >
        <header className="disease-modal__header">
          <h2 id="disease-modal-title">{disease ? 'Editar doença' : 'Nova doença'}</h2>
          <button
            type="button"
            className="disease-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="disease-modal__form">
          {error && (
            <div className="disease-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="disease-modal__row">
            <div className="disease-modal__field">
              <label htmlFor="disease-name">Nome *</label>
              <input
                id="disease-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                aria-required="true"
              />
            </div>

            <div className="disease-modal__field">
              <label htmlFor="disease-scientific-name">Nome científico</label>
              <input
                id="disease-scientific-name"
                type="text"
                value={formData.scientificName ?? ''}
                onChange={(e) => setFormData({ ...formData, scientificName: e.target.value })}
              />
            </div>
          </div>

          <div className="disease-modal__row">
            <div className="disease-modal__field">
              <label htmlFor="disease-category">Categoria *</label>
              <select
                id="disease-category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                required
                aria-required="true"
              >
                <option value="">Selecione...</option>
                {DISEASE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="disease-modal__field">
              <label htmlFor="disease-code">Código (referência interna)</label>
              <input
                id="disease-code"
                type="text"
                value={formData.code ?? ''}
                onChange={(e) => setFormData({ ...formData, code: e.target.value })}
              />
            </div>
          </div>

          <div className="disease-modal__row">
            <div className="disease-modal__field">
              <label htmlFor="disease-severity">Gravidade padrão</label>
              <select
                id="disease-severity"
                value={formData.severity ?? ''}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
              >
                <option value="">Selecione...</option>
                {DISEASE_SEVERITIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="disease-modal__field">
              <label htmlFor="disease-affected-system">Sistema afetado</label>
              <select
                id="disease-affected-system"
                value={formData.affectedSystem ?? ''}
                onChange={(e) => setFormData({ ...formData, affectedSystem: e.target.value })}
              >
                <option value="">Selecione...</option>
                {AFFECTED_SYSTEMS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="disease-modal__field">
            <label htmlFor="disease-symptoms">Sinais clínicos principais</label>
            <textarea
              id="disease-symptoms"
              value={formData.symptoms ?? ''}
              onChange={(e) => setFormData({ ...formData, symptoms: e.target.value })}
              rows={3}
            />
          </div>

          <div className="disease-modal__row">
            <div className="disease-modal__field">
              <label htmlFor="disease-quarantine-days">Dias de quarentena</label>
              <input
                id="disease-quarantine-days"
                type="number"
                min="0"
                value={formData.quarantineDays ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    quarantineDays: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>

            <div className="disease-modal__field disease-modal__checkbox">
              <input
                id="disease-notifiable"
                type="checkbox"
                checked={formData.isNotifiable ?? false}
                onChange={(e) => setFormData({ ...formData, isNotifiable: e.target.checked })}
              />
              <label htmlFor="disease-notifiable">Notificação obrigatória</label>
            </div>
          </div>

          <div className="disease-modal__field">
            <label htmlFor="disease-notes">Observações</label>
            <textarea
              id="disease-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <footer className="disease-modal__footer">
            <button
              type="button"
              className="disease-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="disease-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : disease ? 'Salvar alterações' : 'Cadastrar doença'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
