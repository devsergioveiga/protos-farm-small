import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { FeedIngredientItem, CreateFeedIngredientInput } from '@/types/feed-ingredient';
import { FEED_TYPES } from '@/types/feed-ingredient';
import './FeedIngredientModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  ingredient?: FeedIngredientItem | null;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateFeedIngredientInput = {
  name: '',
  type: '',
  subtype: '',
  measurementUnit: 'kg',
  costPerKg: null,
  refDmPercent: null,
  refCpPercent: null,
  refNdfPercent: null,
  refTdnPercent: null,
  refNelMcalKg: null,
  notes: '',
};

export default function FeedIngredientModal({ isOpen, onClose, ingredient, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateFeedIngredientInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (ingredient) {
      setFormData({
        name: ingredient.name,
        type: ingredient.type,
        subtype: ingredient.subtype ?? '',
        measurementUnit: ingredient.measurementUnit ?? 'kg',
        costPerKg: ingredient.costPerKg,
        refDmPercent: ingredient.refDmPercent,
        refCpPercent: ingredient.refCpPercent,
        refNdfPercent: ingredient.refNdfPercent,
        refTdnPercent: ingredient.refTdnPercent,
        refNelMcalKg: ingredient.refNelMcalKg,
        notes: ingredient.notes ?? '',
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
  }, [ingredient, isOpen]);

  const setNum = (field: keyof CreateFeedIngredientInput, value: string) => {
    setFormData({ ...formData, [field]: value === '' ? null : Number(value) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    const payload: CreateFeedIngredientInput = {
      ...formData,
      subtype: formData.subtype || null,
      notes: formData.notes || null,
    };

    try {
      if (ingredient) {
        await api.patch(`/org/feed-ingredients/${ingredient.id}`, payload);
      } else {
        await api.post('/org/feed-ingredients', payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar ingrediente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fi-modal__overlay" onClick={onClose}>
      <div
        className="fi-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="fi-modal-title"
      >
        <header className="fi-modal__header">
          <h2 id="fi-modal-title">{ingredient ? 'Editar ingrediente' : 'Novo ingrediente'}</h2>
          <button type="button" className="fi-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="fi-modal__form">
          {error && (
            <div className="fi-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* ─── Informações básicas ─────────────────────────────── */}
          <fieldset className="fi-modal__section">
            <legend className="fi-modal__section-title">Informações básicas</legend>

            <div className="fi-modal__row">
              <div className="fi-modal__field">
                <label htmlFor="fi-name">Nome *</label>
                <input
                  id="fi-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  aria-required="true"
                />
              </div>
              <div className="fi-modal__field">
                <label htmlFor="fi-type">Tipo *</label>
                <select
                  id="fi-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  required
                  aria-required="true"
                >
                  <option value="">Selecione...</option>
                  {FEED_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="fi-modal__row">
              <div className="fi-modal__field">
                <label htmlFor="fi-subtype">Subtipo</label>
                <input
                  id="fi-subtype"
                  type="text"
                  value={formData.subtype ?? ''}
                  onChange={(e) => setFormData({ ...formData, subtype: e.target.value })}
                  placeholder="Ex: Silagem, Farelo..."
                />
              </div>
              <div className="fi-modal__field">
                <label htmlFor="fi-unit">Unidade de medida</label>
                <input
                  id="fi-unit"
                  type="text"
                  value={formData.measurementUnit ?? 'kg'}
                  onChange={(e) => setFormData({ ...formData, measurementUnit: e.target.value })}
                />
              </div>
            </div>

            <div className="fi-modal__row">
              <div className="fi-modal__field">
                <label htmlFor="fi-cost">Custo por kg (R$)</label>
                <input
                  id="fi-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.costPerKg ?? ''}
                  onChange={(e) => setNum('costPerKg', e.target.value)}
                  className="fi-modal__input-mono"
                />
              </div>
              <div className="fi-modal__field" />
            </div>
          </fieldset>

          {/* ─── Valores de referência — Energia ─────────────────── */}
          <fieldset className="fi-modal__section">
            <legend className="fi-modal__section-title">Energia (referência)</legend>
            <div className="fi-modal__row">
              <div className="fi-modal__field">
                <label htmlFor="fi-ref-tdn">TDN (%)</label>
                <input
                  id="fi-ref-tdn"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.refTdnPercent ?? ''}
                  onChange={(e) => setNum('refTdnPercent', e.target.value)}
                />
              </div>
              <div className="fi-modal__field">
                <label htmlFor="fi-ref-nel">NEL (Mcal/kg)</label>
                <input
                  id="fi-ref-nel"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.refNelMcalKg ?? ''}
                  onChange={(e) => setNum('refNelMcalKg', e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          {/* ─── Valores de referência — Proteína e Fibra ────────── */}
          <fieldset className="fi-modal__section">
            <legend className="fi-modal__section-title">Proteína e Fibra (referência)</legend>
            <div className="fi-modal__row">
              <div className="fi-modal__field">
                <label htmlFor="fi-ref-cp">PB — Proteína bruta (%)</label>
                <input
                  id="fi-ref-cp"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.refCpPercent ?? ''}
                  onChange={(e) => setNum('refCpPercent', e.target.value)}
                />
              </div>
              <div className="fi-modal__field">
                <label htmlFor="fi-ref-ndf">FDN — Fibra detergente neutro (%)</label>
                <input
                  id="fi-ref-ndf"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.refNdfPercent ?? ''}
                  onChange={(e) => setNum('refNdfPercent', e.target.value)}
                />
              </div>
            </div>
            <div className="fi-modal__row">
              <div className="fi-modal__field">
                <label htmlFor="fi-ref-dm">MS — Matéria seca (%)</label>
                <input
                  id="fi-ref-dm"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.refDmPercent ?? ''}
                  onChange={(e) => setNum('refDmPercent', e.target.value)}
                />
              </div>
              <div className="fi-modal__field" />
            </div>
          </fieldset>

          {/* ─── Observações ─────────────────────────────────────── */}
          <div className="fi-modal__field">
            <label htmlFor="fi-notes">Observações</label>
            <textarea
              id="fi-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <footer className="fi-modal__footer">
            <button
              type="button"
              className="fi-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="fi-modal__btn-save" disabled={isLoading}>
              {isLoading
                ? 'Salvando...'
                : ingredient
                  ? 'Salvar alterações'
                  : 'Cadastrar ingrediente'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
