import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import {
  DISCOUNT_TYPES,
  DISCOUNT_TYPE_LABELS,
  CROPS,
  CROP_LABELS,
  type DiscountTableItem,
} from '@/types/grain-discounts';
import './DiscountTableModal.css';

interface DiscountTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSave: (input: {
    crop: string;
    discountType: string;
    thresholdPct: number;
    discountPctPerPoint: number;
    maxPct?: number | null;
  }) => Promise<void>;
  selectedItem?: DiscountTableItem | null;
}

export default function DiscountTableModal({
  isOpen,
  onClose,
  onSuccess,
  onSave,
  selectedItem,
}: DiscountTableModalProps) {
  const [crop, setCrop] = useState('SOJA');
  const [discountType, setDiscountType] = useState('MOISTURE');
  const [thresholdPct, setThresholdPct] = useState('14');
  const [discountPctPerPoint, setDiscountPctPerPoint] = useState('1.5');
  const [maxPct, setMaxPct] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && selectedItem) {
      setCrop(selectedItem.crop);
      setDiscountType(selectedItem.discountType);
      setThresholdPct(String(selectedItem.thresholdPct));
      setDiscountPctPerPoint(String(selectedItem.discountPctPerPoint));
      setMaxPct(selectedItem.maxPct != null ? String(selectedItem.maxPct) : '');
    } else if (isOpen) {
      setCrop('SOJA');
      setDiscountType('MOISTURE');
      setThresholdPct('14');
      setDiscountPctPerPoint('1.5');
      setMaxPct('');
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
        discountType,
        thresholdPct: Number(thresholdPct),
        discountPctPerPoint: Number(discountPctPerPoint),
        maxPct: maxPct ? Number(maxPct) : null,
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
    <div className="dt-modal-overlay" onClick={onClose}>
      <div
        className="dt-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dt-modal-title"
      >
        <header className="dt-modal__header">
          <h2 id="dt-modal-title" className="dt-modal__title">
            {selectedItem ? 'Editar tabela de desconto' : 'Nova tabela de desconto'}
          </h2>
          <button type="button" className="dt-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {error && (
          <div className="dt-modal__error" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="dt-modal__form">
          <div className="dt-modal__row">
            <div className="dt-modal__field">
              <label htmlFor="dt-crop" className="dt-modal__label">
                Cultura *
              </label>
              <select
                id="dt-crop"
                className="dt-modal__select"
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
            <div className="dt-modal__field">
              <label htmlFor="dt-type" className="dt-modal__label">
                Tipo de desconto *
              </label>
              <select
                id="dt-type"
                className="dt-modal__select"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                required
              >
                {DISCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {DISCOUNT_TYPE_LABELS[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="dt-modal__row">
            <div className="dt-modal__field">
              <label htmlFor="dt-threshold" className="dt-modal__label">
                Tolerância (%) *
              </label>
              <input
                id="dt-threshold"
                type="number"
                className="dt-modal__input"
                value={thresholdPct}
                onChange={(e) => setThresholdPct(e.target.value)}
                min="0"
                max="100"
                step="0.01"
                required
              />
              <span className="dt-modal__hint">Até esse % não há desconto</span>
            </div>
            <div className="dt-modal__field">
              <label htmlFor="dt-discount" className="dt-modal__label">
                Desconto por ponto (%) *
              </label>
              <input
                id="dt-discount"
                type="number"
                className="dt-modal__input"
                value={discountPctPerPoint}
                onChange={(e) => setDiscountPctPerPoint(e.target.value)}
                min="0"
                max="10"
                step="0.01"
                required
              />
              <span className="dt-modal__hint">% descontado por ponto acima da tolerância</span>
            </div>
          </div>

          <div className="dt-modal__field">
            <label htmlFor="dt-max" className="dt-modal__label">
              Limite máximo (%)
            </label>
            <input
              id="dt-max"
              type="number"
              className="dt-modal__input"
              value={maxPct}
              onChange={(e) => setMaxPct(e.target.value)}
              min="0"
              max="100"
              step="0.01"
              placeholder="Sem limite"
            />
            <span className="dt-modal__hint">Acima desse % o lote pode ser rejeitado</span>
          </div>

          <footer className="dt-modal__footer">
            <button type="button" className="dt-modal__btn-cancel" onClick={onClose}>
              Cancelar
            </button>
            <button type="submit" className="dt-modal__btn-save" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
