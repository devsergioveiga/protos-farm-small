import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  GRADE_TYPES,
  GRADE_TYPE_LABELS,
  CROPS,
  CROP_LABELS,
  type ClassificationItem,
} from '@/types/grain-discounts';
import './ClassificationModal.css';

interface ClassificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSave: (input: {
    crop: string;
    gradeType: string;
    maxMoisturePct: number;
    maxImpurityPct: number;
    maxDamagedPct: number;
    maxBrokenPct: number;
  }) => Promise<void>;
  selectedItem?: ClassificationItem | null;
}

export default function ClassificationModal({
  isOpen,
  onClose,
  onSuccess,
  onSave,
  selectedItem,
}: ClassificationModalProps) {
  const [crop, setCrop] = useState('SOJA');
  const [gradeType, setGradeType] = useState('TIPO_1');
  const [maxMoisturePct, setMaxMoisturePct] = useState('14');
  const [maxImpurityPct, setMaxImpurityPct] = useState('1');
  const [maxDamagedPct, setMaxDamagedPct] = useState('8');
  const [maxBrokenPct, setMaxBrokenPct] = useState('30');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedItem) {
      setCrop(selectedItem.crop);
      setGradeType(selectedItem.gradeType);
      setMaxMoisturePct(String(selectedItem.maxMoisturePct));
      setMaxImpurityPct(String(selectedItem.maxImpurityPct));
      setMaxDamagedPct(String(selectedItem.maxDamagedPct));
      setMaxBrokenPct(String(selectedItem.maxBrokenPct));
    } else if (isOpen) {
      setCrop('SOJA');
      setGradeType('TIPO_1');
      setMaxMoisturePct('14');
      setMaxImpurityPct('1');
      setMaxDamagedPct('8');
      setMaxBrokenPct('30');
    }
    setError(null);
  }, [isOpen, selectedItem]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onSave({
        crop,
        gradeType,
        maxMoisturePct: Number(maxMoisturePct),
        maxImpurityPct: Number(maxImpurityPct),
        maxDamagedPct: Number(maxDamagedPct),
        maxBrokenPct: Number(maxBrokenPct),
      });
      onSuccess();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="gc-modal-overlay" onClick={onClose}>
      <div
        className="gc-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="gc-modal-title"
      >
        <header className="gc-modal__header">
          <h2 id="gc-modal-title" className="gc-modal__title">
            {selectedItem ? 'Editar classificação' : 'Nova classificação'}
          </h2>
          <button type="button" className="gc-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {error && (
          <div className="gc-modal__error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="gc-modal__form">
          <div className="gc-modal__row">
            <div className="gc-modal__field">
              <label htmlFor="gc-crop" className="gc-modal__label">
                Cultura *
              </label>
              <select
                id="gc-crop"
                className="gc-modal__select"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                required
              >
                {CROPS.map((c) => (
                  <option key={c} value={c}>
                    {CROP_LABELS[c] || c}
                  </option>
                ))}
              </select>
            </div>
            <div className="gc-modal__field">
              <label htmlFor="gc-grade" className="gc-modal__label">
                Tipo/Grupo *
              </label>
              <select
                id="gc-grade"
                className="gc-modal__select"
                value={gradeType}
                onChange={(e) => setGradeType(e.target.value)}
                required
              >
                {GRADE_TYPES.map((g) => (
                  <option key={g} value={g}>
                    {GRADE_TYPE_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <fieldset className="gc-modal__fieldset">
            <legend className="gc-modal__legend">Limites máximos (%)</legend>
            <div className="gc-modal__row">
              <div className="gc-modal__field">
                <label htmlFor="gc-moisture" className="gc-modal__label">
                  Umidade
                </label>
                <input
                  id="gc-moisture"
                  type="number"
                  className="gc-modal__input"
                  value={maxMoisturePct}
                  onChange={(e) => setMaxMoisturePct(e.target.value)}
                  min="0"
                  max="100"
                  step="0.1"
                  required
                />
              </div>
              <div className="gc-modal__field">
                <label htmlFor="gc-impurity" className="gc-modal__label">
                  Impureza
                </label>
                <input
                  id="gc-impurity"
                  type="number"
                  className="gc-modal__input"
                  value={maxImpurityPct}
                  onChange={(e) => setMaxImpurityPct(e.target.value)}
                  min="0"
                  max="100"
                  step="0.1"
                  required
                />
              </div>
            </div>
            <div className="gc-modal__row">
              <div className="gc-modal__field">
                <label htmlFor="gc-damaged" className="gc-modal__label">
                  Avariados
                </label>
                <input
                  id="gc-damaged"
                  type="number"
                  className="gc-modal__input"
                  value={maxDamagedPct}
                  onChange={(e) => setMaxDamagedPct(e.target.value)}
                  min="0"
                  max="100"
                  step="0.1"
                  required
                />
              </div>
              <div className="gc-modal__field">
                <label htmlFor="gc-broken" className="gc-modal__label">
                  Quebrados
                </label>
                <input
                  id="gc-broken"
                  type="number"
                  className="gc-modal__input"
                  value={maxBrokenPct}
                  onChange={(e) => setMaxBrokenPct(e.target.value)}
                  min="0"
                  max="100"
                  step="0.1"
                  required
                />
              </div>
            </div>
          </fieldset>

          <footer className="gc-modal__footer">
            <button type="button" className="gc-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="gc-modal__btn-save" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
