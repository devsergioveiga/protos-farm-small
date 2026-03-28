import { useState, useEffect, useRef } from 'react';
import { X, Calendar } from 'lucide-react';
import type { CreateFiscalYearInput } from '@/types/accounting';
import './FiscalYearModal.css';

// ─── Props ────────────────────────────────────────────────────────────────

interface FiscalYearModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateFiscalYearInput) => Promise<void>;
}

// ─── Component ───────────────────────────────────────────────────────────

export default function FiscalYearModal({ isOpen, onClose, onSubmit }: FiscalYearModalProps) {
  const currentYear = new Date().getFullYear();

  const [form, setForm] = useState<CreateFiscalYearInput>({
    name: '',
    startDate: '',
    endDate: '',
  });
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setForm({ name: '', startDate: '', endDate: '' });
      setErrors({});
      setTimeout(() => firstInputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Preset: Calendar year (Jan-Dec current year)
  const applyCalendarPreset = () => {
    setForm({
      name: String(currentYear),
      startDate: `${currentYear}-01-01`,
      endDate: `${currentYear}-12-31`,
    });
    setErrors({});
  };

  // Preset: Safra year (Jul current - Jun next)
  const applySafraPreset = () => {
    const nextYear = currentYear + 1;
    setForm({
      name: `Safra ${currentYear}/${nextYear}`,
      startDate: `${currentYear}-07-01`,
      endDate: `${nextYear}-06-30`,
    });
    setErrors({});
  };

  const validate = (): boolean => {
    const newErrors: Partial<Record<string, string>> = {};
    if (!form.name.trim()) newErrors.name = 'Nome é obrigatório';
    if (!form.startDate) newErrors.startDate = 'Data de início é obrigatória';
    if (!form.endDate) newErrors.endDate = 'Data de fim é obrigatória';
    if (form.startDate && form.endDate && form.endDate <= form.startDate) {
      newErrors.endDate = 'Data de fim deve ser posterior à data de início';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      await onSubmit({
        name: form.name.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const set = <K extends keyof CreateFiscalYearInput>(key: K, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  return (
    <div
      className="fy-modal__overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fy-modal-title"
    >
      <div className="fy-modal">
        {/* Header */}
        <div className="fy-modal__header">
          <div className="fy-modal__header-left">
            <Calendar size={20} aria-hidden="true" className="fy-modal__header-icon" />
            <h2 id="fy-modal-title" className="fy-modal__title">
              Novo Exercício Fiscal
            </h2>
          </div>
          <button
            type="button"
            className="fy-modal__close"
            onClick={onClose}
            aria-label="Fechar modal"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <form
          className="fy-modal__body"
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          noValidate
        >
          {/* Presets */}
          <div className="fy-modal__presets">
            <span className="fy-modal__presets-label">Preencher automaticamente:</span>
            <button type="button" className="fy-modal__preset-btn" onClick={applyCalendarPreset}>
              Calendário (Jan–Dez)
            </button>
            <button type="button" className="fy-modal__preset-btn" onClick={applySafraPreset}>
              Safra (Jul–Jun)
            </button>
          </div>

          {/* Name */}
          <div className="fy-modal__field">
            <label htmlFor="fy-name" className="fy-modal__label">
              Nome do Exercício <span aria-hidden="true">*</span>
            </label>
            <input
              ref={firstInputRef}
              id="fy-name"
              type="text"
              className={`fy-modal__input ${errors.name ? 'fy-modal__input--error' : ''}`}
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              onBlur={() => {
                if (!form.name.trim()) setErrors((p) => ({ ...p, name: 'Nome é obrigatório' }));
              }}
              aria-required="true"
              aria-describedby={errors.name ? 'fy-name-error' : undefined}
              placeholder="ex: 2026 ou Safra 2025/2026"
            />
            {errors.name && (
              <span id="fy-name-error" role="alert" className="fy-modal__error">
                {errors.name}
              </span>
            )}
          </div>

          {/* Date range */}
          <div className="fy-modal__row">
            <div className="fy-modal__field">
              <label htmlFor="fy-start" className="fy-modal__label">
                Data Início <span aria-hidden="true">*</span>
              </label>
              <input
                id="fy-start"
                type="date"
                className={`fy-modal__input ${errors.startDate ? 'fy-modal__input--error' : ''}`}
                value={form.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                aria-required="true"
                aria-describedby={errors.startDate ? 'fy-start-error' : undefined}
              />
              {errors.startDate && (
                <span id="fy-start-error" role="alert" className="fy-modal__error">
                  {errors.startDate}
                </span>
              )}
            </div>

            <div className="fy-modal__field">
              <label htmlFor="fy-end" className="fy-modal__label">
                Data Fim <span aria-hidden="true">*</span>
              </label>
              <input
                id="fy-end"
                type="date"
                className={`fy-modal__input ${errors.endDate ? 'fy-modal__input--error' : ''}`}
                value={form.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                min={form.startDate || undefined}
                aria-required="true"
                aria-describedby={errors.endDate ? 'fy-end-error' : undefined}
              />
              {errors.endDate && (
                <span id="fy-end-error" role="alert" className="fy-modal__error">
                  {errors.endDate}
                </span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="fy-modal__footer">
            <button
              type="button"
              className="fy-modal__btn fy-modal__btn--secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="fy-modal__btn fy-modal__btn--primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Criando...' : 'Criar Exercício'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
