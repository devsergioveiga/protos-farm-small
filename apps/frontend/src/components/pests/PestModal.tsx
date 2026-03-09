import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import { PEST_CATEGORIES, PEST_SEVERITIES, CROP_OPTIONS_PEST } from '@/types/pest';
import type { PestItem, CreatePestInput } from '@/types/pest';
import './PestModal.css';

interface PestModalProps {
  isOpen: boolean;
  pest: PestItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

function PestModal({ isOpen, pest, onClose, onSuccess }: PestModalProps) {
  const isEditing = !!pest;

  const [commonName, setCommonName] = useState('');
  const [scientificName, setScientificName] = useState('');
  const [category, setCategory] = useState('');
  const [affectedCrops, setAffectedCrops] = useState<string[]>([]);
  const [severity, setSeverity] = useState('');
  const [ndeDescription, setNdeDescription] = useState('');
  const [ncDescription, setNcDescription] = useState('');
  const [lifecycle, setLifecycle] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setCommonName('');
      setScientificName('');
      setCategory('');
      setAffectedCrops([]);
      setSeverity('');
      setNdeDescription('');
      setNcDescription('');
      setLifecycle('');
      setSymptoms('');
      setNotes('');
      setSubmitError(null);
      setIsSubmitting(false);
    } else if (pest) {
      setCommonName(pest.commonName);
      setScientificName(pest.scientificName ?? '');
      setCategory(pest.category);
      setAffectedCrops(pest.affectedCrops);
      setSeverity(pest.severity ?? '');
      setNdeDescription(pest.ndeDescription ?? '');
      setNcDescription(pest.ncDescription ?? '');
      setLifecycle(pest.lifecycle ?? '');
      setSymptoms(pest.symptoms ?? '');
      setNotes(pest.notes ?? '');
    }
  }, [isOpen, pest]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleCropToggle = useCallback((crop: string) => {
    setAffectedCrops((prev) =>
      prev.includes(crop) ? prev.filter((c) => c !== crop) : [...prev, crop],
    );
  }, []);

  const canSubmit = commonName.trim() !== '' && category !== '';

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const payload: CreatePestInput = {
        commonName: commonName.trim(),
        scientificName: scientificName.trim() || null,
        category,
        affectedCrops,
        severity: severity || null,
        ndeDescription: ndeDescription.trim() || null,
        ncDescription: ncDescription.trim() || null,
        lifecycle: lifecycle.trim() || null,
        symptoms: symptoms.trim() || null,
        notes: notes.trim() || null,
      };

      if (isEditing) {
        await api.patch(`/org/pests/${pest!.id}`, payload);
      } else {
        await api.post('/org/pests', payload);
      }
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao salvar praga/doença';
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    canSubmit,
    commonName,
    scientificName,
    category,
    affectedCrops,
    severity,
    ndeDescription,
    ncDescription,
    lifecycle,
    symptoms,
    notes,
    isEditing,
    pest,
    onSuccess,
  ]);

  if (!isOpen) return null;

  return (
    <div className="pest-overlay" onClick={onClose}>
      <div
        className="pest-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar praga/doença' : 'Nova praga/doença'}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="pest-modal__header">
          <h2 className="pest-modal__title">
            {isEditing ? 'Editar praga/doença' : 'Nova praga/doença'}
          </h2>
          <button type="button" className="pest-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="pest-modal__body">
          <div className="pest-modal__fields">
            {/* Identificação */}
            <h3 className="pest-modal__section-title">Identificação</h3>

            <div className="pest-modal__row">
              <div className="pest-modal__field">
                <label htmlFor="pest-common-name" className="pest-modal__label">
                  Nome popular *
                </label>
                <input
                  id="pest-common-name"
                  type="text"
                  className="pest-modal__input"
                  value={commonName}
                  onChange={(e) => setCommonName(e.target.value)}
                  placeholder="Ex: Lagarta-do-cartucho"
                  aria-required="true"
                />
              </div>
              <div className="pest-modal__field">
                <label htmlFor="pest-scientific-name" className="pest-modal__label">
                  Nome científico
                </label>
                <input
                  id="pest-scientific-name"
                  type="text"
                  className="pest-modal__input pest-modal__input--italic"
                  value={scientificName}
                  onChange={(e) => setScientificName(e.target.value)}
                  placeholder="Ex: Spodoptera frugiperda"
                />
              </div>
            </div>

            <div className="pest-modal__row">
              <div className="pest-modal__field">
                <label htmlFor="pest-category" className="pest-modal__label">
                  Categoria *
                </label>
                <select
                  id="pest-category"
                  className="pest-modal__select"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione</option>
                  {PEST_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="pest-modal__field">
                <label htmlFor="pest-severity" className="pest-modal__label">
                  Severidade
                </label>
                <select
                  id="pest-severity"
                  className="pest-modal__select"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                >
                  <option value="">Não definida</option>
                  {PEST_SEVERITIES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Culturas afetadas */}
            <h3 className="pest-modal__section-title">Culturas afetadas</h3>
            <div className="pest-modal__crops-grid">
              {CROP_OPTIONS_PEST.map((crop) => (
                <label key={crop} className="pest-modal__crop-item">
                  <input
                    type="checkbox"
                    checked={affectedCrops.includes(crop)}
                    onChange={() => handleCropToggle(crop)}
                    className="pest-modal__checkbox"
                  />
                  <span className="pest-modal__crop-label">{crop}</span>
                </label>
              ))}
            </div>

            {/* Níveis de controle */}
            <h3 className="pest-modal__section-title">Níveis de controle (MIP)</h3>

            <div className="pest-modal__row">
              <div className="pest-modal__field">
                <label htmlFor="pest-nde" className="pest-modal__label">
                  Nível de dano econômico (NDE)
                </label>
                <input
                  id="pest-nde"
                  type="text"
                  className="pest-modal__input"
                  value={ndeDescription}
                  onChange={(e) => setNdeDescription(e.target.value)}
                  placeholder="Ex: 20% folhas raspadas"
                />
              </div>
              <div className="pest-modal__field">
                <label htmlFor="pest-nc" className="pest-modal__label">
                  Nível de controle (NC)
                </label>
                <input
                  id="pest-nc"
                  type="text"
                  className="pest-modal__input"
                  value={ncDescription}
                  onChange={(e) => setNcDescription(e.target.value)}
                  placeholder="Ex: 2 lagartas por planta"
                />
              </div>
            </div>

            {/* Biologia */}
            <h3 className="pest-modal__section-title">Biologia e sintomas</h3>

            <div className="pest-modal__field">
              <label htmlFor="pest-lifecycle" className="pest-modal__label">
                Ciclo de vida
              </label>
              <input
                id="pest-lifecycle"
                type="text"
                className="pest-modal__input"
                value={lifecycle}
                onChange={(e) => setLifecycle(e.target.value)}
                placeholder="Ex: Ovo → Larva (6 instares) → Pupa → Adulto"
              />
            </div>

            <div className="pest-modal__field">
              <label htmlFor="pest-symptoms" className="pest-modal__label">
                Sintomas na planta
              </label>
              <textarea
                id="pest-symptoms"
                className="pest-modal__textarea"
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="Descreva os sintomas visíveis na planta..."
                rows={3}
              />
            </div>

            <div className="pest-modal__field">
              <label htmlFor="pest-notes" className="pest-modal__label">
                Observações
              </label>
              <textarea
                id="pest-notes"
                className="pest-modal__textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notas adicionais do agrônomo..."
                rows={3}
              />
            </div>
          </div>

          {submitError && (
            <div className="pest-modal__error" role="alert" aria-live="polite">
              {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pest-modal__footer">
          <div className="pest-modal__footer-spacer" />
          <button
            type="button"
            className="pest-modal__btn pest-modal__btn--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="pest-modal__btn pest-modal__btn--primary"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Cadastrar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PestModal;
