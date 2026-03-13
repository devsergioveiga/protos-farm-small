import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import type { UnitItem } from '@/hooks/useMeasurementUnits';
import './MeasurementUnitModal.css';

const CATEGORIES = [
  { value: 'WEIGHT', label: 'Peso' },
  { value: 'VOLUME', label: 'Volume' },
  { value: 'COUNT', label: 'Contagem' },
  { value: 'AREA', label: 'Área' },
];

interface Props {
  isOpen: boolean;
  unit: UnitItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function MeasurementUnitModal({ isOpen, unit, onClose, onSuccess }: Props) {
  const isEditing = !!unit;
  const [name, setName] = useState('');
  const [abbreviation, setAbbreviation] = useState('');
  const [category, setCategory] = useState('WEIGHT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (unit) {
        setName(unit.name);
        setAbbreviation(unit.abbreviation);
        setCategory(unit.category);
      } else {
        setName('');
        setAbbreviation('');
        setCategory('WEIGHT');
      }
      setSubmitError(null);
    }
  }, [isOpen, unit]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const canSubmit = name.trim() && abbreviation.trim() && !isSubmitting;
  const isSystemUnit = unit?.isSystem ?? false;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      if (isEditing) {
        const payload: Record<string, unknown> = {};
        if (!isSystemUnit) {
          payload.name = name.trim();
          payload.abbreviation = abbreviation.trim();
          payload.category = category;
        }
        await api.patch(`/org/measurement-units/${unit.id}`, payload);
      } else {
        await api.post('/org/measurement-units', {
          name: name.trim(),
          abbreviation: abbreviation.trim(),
          category,
        });
      }
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar unidade.';
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="unit-modal__overlay" onClick={onClose}>
      <div
        className="unit-modal"
        role="dialog"
        aria-modal="true"
        aria-label={isEditing ? 'Editar unidade' : 'Nova unidade'}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="unit-modal__header">
          <h2>{isEditing ? 'Editar unidade' : 'Nova unidade de medida'}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div className="unit-modal__body">
            {submitError && (
              <div className="unit-modal__error" role="alert">
                {submitError}
              </div>
            )}

            <div className="unit-modal__field">
              <label htmlFor="unit-name">
                Nome <span aria-hidden="true">*</span>
              </label>
              <input
                id="unit-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSystemUnit}
                aria-required="true"
              />
            </div>

            <div className="unit-modal__row">
              <div className="unit-modal__field">
                <label htmlFor="unit-abbreviation">
                  Abreviação <span aria-hidden="true">*</span>
                </label>
                <input
                  id="unit-abbreviation"
                  type="text"
                  value={abbreviation}
                  onChange={(e) => setAbbreviation(e.target.value)}
                  disabled={isSystemUnit}
                  aria-required="true"
                />
              </div>

              <div className="unit-modal__field">
                <label htmlFor="unit-category">Categoria</label>
                <select
                  id="unit-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  disabled={isSystemUnit}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {isSystemUnit && (
              <p className="unit-modal__hint">
                Unidades do sistema não podem ter nome, abreviação ou categoria alterados.
              </p>
            )}
          </div>

          <footer className="unit-modal__footer">
            <button
              type="button"
              className="unit-modal__btn--ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button type="submit" className="unit-modal__btn--primary" disabled={!canSubmit}>
              {isSubmitting ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar unidade'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
