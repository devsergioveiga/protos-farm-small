import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import { api } from '@/services/api';
import type { UnitItem } from '@/hooks/useMeasurementUnits';
import './MeasurementUnitModal.css';

interface Props {
  isOpen: boolean;
  units: UnitItem[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function ConversionModal({ isOpen, units, onClose, onSuccess }: Props) {
  const [fromUnitId, setFromUnitId] = useState('');
  const [toUnitId, setToUnitId] = useState('');
  const [factor, setFactor] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFromUnitId('');
      setToUnitId('');
      setFactor('');
      setSubmitError(null);
    }
  }, [isOpen]);

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

  const factorNum = Number(factor);
  const canSubmit =
    fromUnitId && toUnitId && fromUnitId !== toUnitId && factorNum > 0 && !isSubmitting;

  const fromUnit = units.find((u) => u.id === fromUnitId);
  const toUnit = units.find((u) => u.id === toUnitId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      await api.post('/org/unit-conversions', { fromUnitId, toUnitId, factor: factorNum });
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar conversão.';
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
        aria-label="Nova conversão"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="unit-modal__header">
          <h2>Nova conversão</h2>
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

            <div className="unit-modal__row">
              <div className="unit-modal__field">
                <label htmlFor="conv-from">
                  De <span aria-hidden="true">*</span>
                </label>
                <select
                  id="conv-from"
                  value={fromUnitId}
                  onChange={(e) => setFromUnitId(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.abbreviation})
                    </option>
                  ))}
                </select>
              </div>

              <div className="unit-modal__field">
                <label htmlFor="conv-to">
                  Para <span aria-hidden="true">*</span>
                </label>
                <select
                  id="conv-to"
                  value={toUnitId}
                  onChange={(e) => setToUnitId(e.target.value)}
                  aria-required="true"
                >
                  <option value="">Selecione...</option>
                  {units
                    .filter((u) => u.id !== fromUnitId)
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.abbreviation})
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="unit-modal__field">
              <label htmlFor="conv-factor">
                Fator <span aria-hidden="true">*</span>
              </label>
              <input
                id="conv-factor"
                type="number"
                step="any"
                min="0"
                value={factor}
                onChange={(e) => setFactor(e.target.value)}
                aria-required="true"
              />
              {fromUnit && toUnit && factorNum > 0 && (
                <p className="unit-modal__hint">
                  1 {fromUnit.abbreviation} = {factorNum} {toUnit.abbreviation}
                </p>
              )}
            </div>
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
              {isSubmitting ? 'Salvando...' : 'Criar conversão'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
