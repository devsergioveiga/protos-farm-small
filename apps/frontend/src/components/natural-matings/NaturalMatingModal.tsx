import { useState, useEffect, useMemo } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { NaturalMatingItem, CreateNaturalMatingInput } from '@/types/natural-mating';
import { MATING_REASONS } from '@/types/natural-mating';
import type { AnimalListItem } from '@/types/animal';
import { useAnimals } from '@/hooks/useAnimals';
import './NaturalMatingModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mating?: NaturalMatingItem | null;
  farmId: string;
  onSuccess: () => void;
}

interface FormData {
  bullIdentified: boolean;
  bullId: string;
  bullBreedName: string;
  reason: string;
  entryDate: string;
  exitDate: string;
  maxStayDays: string;
  animalIds: string[];
  notes: string;
}

const EMPTY_FORM: FormData = {
  bullIdentified: true,
  bullId: '',
  bullBreedName: '',
  reason: 'DIRECT_COVERAGE',
  entryDate: new Date().toISOString().split('T')[0],
  exitDate: '',
  maxStayDays: '60',
  animalIds: [],
  notes: '',
};

export default function NaturalMatingModal({ isOpen, onClose, mating, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<FormData>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animalSearch, setAnimalSearch] = useState('');

  const isEditing = !!mating;

  // Fetch bulls (males)
  const { animals: bulls } = useAnimals({
    farmId,
    sex: 'MALE',
    limit: 500,
  });

  // Fetch females for multi-select
  const { animals: females } = useAnimals({
    farmId,
    sex: 'FEMALE',
    limit: 500,
  });

  // Filter females by search
  const filteredFemales = useMemo(() => {
    if (!animalSearch.trim()) return females;
    const q = animalSearch.toLowerCase();
    return females.filter(
      (a: AnimalListItem) =>
        a.earTag.toLowerCase().includes(q) || (a.name && a.name.toLowerCase().includes(q)),
    );
  }, [females, animalSearch]);

  useEffect(() => {
    if (!isOpen) return;
    if (mating) {
      setFormData({
        bullIdentified: !!mating.bullId,
        bullId: mating.bullId ?? '',
        bullBreedName: mating.bullBreedName ?? '',
        reason: mating.reason,
        entryDate: mating.entryDate.split('T')[0],
        exitDate: mating.exitDate ? mating.exitDate.split('T')[0] : '',
        maxStayDays: mating.maxStayDays != null ? String(mating.maxStayDays) : '',
        animalIds: [],
        notes: mating.notes ?? '',
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
    setAnimalSearch('');
  }, [mating, isOpen]);

  const handleToggleAnimal = (animalId: string) => {
    setFormData((prev) => {
      const exists = prev.animalIds.includes(animalId);
      return {
        ...prev,
        animalIds: exists
          ? prev.animalIds.filter((id) => id !== animalId)
          : [...prev.animalIds, animalId],
      };
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!isEditing) {
      if (formData.bullIdentified && !formData.bullId) {
        setError('Selecione o touro.');
        return;
      }
      if (!formData.bullIdentified && !formData.bullBreedName.trim()) {
        setError('Informe a raca do touro.');
        return;
      }
      if (!formData.reason) {
        setError('Selecione o motivo.');
        return;
      }
      if (!formData.entryDate) {
        setError('Informe a data de entrada.');
        return;
      }
      if (formData.animalIds.length === 0) {
        setError('Selecione pelo menos uma femea.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isEditing) {
        await api.patch(`/org/farms/${farmId}/natural-matings/${mating!.id}`, {
          exitDate: formData.exitDate || null,
          notes: formData.notes || null,
        });
      } else {
        const payload: CreateNaturalMatingInput = {
          bullId: formData.bullIdentified ? formData.bullId || null : null,
          bullBreedName: !formData.bullIdentified ? formData.bullBreedName || null : null,
          reason: formData.reason,
          entryDate: formData.entryDate,
          exitDate: formData.exitDate || null,
          maxStayDays: formData.maxStayDays ? Number(formData.maxStayDays) : null,
          animalIds: formData.animalIds,
          notes: formData.notes || null,
        };
        await api.post(`/org/farms/${farmId}/natural-matings`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar monta natural.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="mating-modal__overlay" onClick={onClose}>
      <div
        className="mating-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mating-modal-title"
      >
        <header className="mating-modal__header">
          <h2 id="mating-modal-title">
            {isEditing ? 'Editar monta natural' : 'Nova monta natural'}
          </h2>
          <button
            type="button"
            className="mating-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="mating-modal__form">
          {error && (
            <div className="mating-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Toggle: Touro identificado */}
          {!isEditing && (
            <div className="mating-modal__toggle">
              <span className="mating-modal__toggle-label">Touro identificado</span>
              <button
                type="button"
                className={`mating-modal__toggle-switch ${formData.bullIdentified ? 'mating-modal__toggle-switch--active' : ''}`}
                onClick={() =>
                  setFormData((prev) => ({
                    ...prev,
                    bullIdentified: !prev.bullIdentified,
                    bullId: '',
                    bullBreedName: '',
                  }))
                }
                role="switch"
                aria-checked={formData.bullIdentified}
                aria-label="Touro identificado"
              />
            </div>
          )}

          {/* Bull selection (identified) */}
          {!isEditing && formData.bullIdentified && (
            <div className="mating-modal__field">
              <label htmlFor="mating-bull">Touro *</label>
              <select
                id="mating-bull"
                value={formData.bullId}
                onChange={(e) => setFormData({ ...formData, bullId: e.target.value })}
                required
                aria-required="true"
              >
                <option value="">Selecione o touro...</option>
                {bulls.map((b: AnimalListItem) => (
                  <option key={b.id} value={b.id}>
                    {b.earTag} {b.name ? `\u2014 ${b.name}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Bull breed (unknown) */}
          {!isEditing && !formData.bullIdentified && (
            <div className="mating-modal__field">
              <label htmlFor="mating-breed">Raca do touro *</label>
              <input
                id="mating-breed"
                type="text"
                value={formData.bullBreedName}
                onChange={(e) => setFormData({ ...formData, bullBreedName: e.target.value })}
                required
                aria-required="true"
                placeholder="Ex: Nelore, Angus, Brahman..."
              />
            </div>
          )}

          {/* Reason + Entry Date */}
          <div className="mating-modal__row">
            <div className="mating-modal__field">
              <label htmlFor="mating-reason">Motivo *</label>
              <select
                id="mating-reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                required
                aria-required="true"
                disabled={isEditing}
              >
                {MATING_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mating-modal__field">
              <label htmlFor="mating-entry-date">Data de entrada *</label>
              <input
                id="mating-entry-date"
                type="date"
                value={formData.entryDate}
                onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                required
                aria-required="true"
                disabled={isEditing}
              />
            </div>
          </div>

          {/* Exit Date + Max Stay */}
          <div className="mating-modal__row">
            <div className="mating-modal__field">
              <label htmlFor="mating-exit-date">Data de saida</label>
              <input
                id="mating-exit-date"
                type="date"
                value={formData.exitDate}
                onChange={(e) => setFormData({ ...formData, exitDate: e.target.value })}
              />
            </div>
            <div className="mating-modal__field">
              <label htmlFor="mating-max-stay">Permanencia maxima (dias)</label>
              <input
                id="mating-max-stay"
                type="number"
                min="1"
                value={formData.maxStayDays}
                onChange={(e) => setFormData({ ...formData, maxStayDays: e.target.value })}
                placeholder="60"
                disabled={isEditing}
              />
            </div>
          </div>

          {/* Animal multi-select (only on create) */}
          {!isEditing && (
            <div className="mating-modal__field">
              <label>Femeas no lote *</label>
              <div className="mating-modal__multi-search">
                <input
                  type="text"
                  placeholder="Buscar por brinco ou nome..."
                  value={animalSearch}
                  onChange={(e) => setAnimalSearch(e.target.value)}
                  aria-label="Buscar femeas"
                />
              </div>
              <div
                className="mating-modal__multi-select"
                role="listbox"
                aria-label="Selecionar femeas"
              >
                {filteredFemales.length === 0 && (
                  <div
                    className="mating-modal__multi-option"
                    style={{ justifyContent: 'center', color: 'var(--color-neutral-400)' }}
                  >
                    Nenhuma femea encontrada
                  </div>
                )}
                {filteredFemales.map((a: AnimalListItem) => {
                  const checked = formData.animalIds.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className="mating-modal__multi-option"
                      role="option"
                      aria-selected={checked}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleAnimal(a.id)}
                        aria-label={`Selecionar ${a.earTag}`}
                      />
                      {a.earTag} {a.name ? `\u2014 ${a.name}` : ''}
                    </label>
                  );
                })}
              </div>
              <span className="mating-modal__selected-count">
                {formData.animalIds.length}{' '}
                {formData.animalIds.length === 1 ? 'femea selecionada' : 'femeas selecionadas'}
              </span>
            </div>
          )}

          {/* Notes */}
          <div className="mating-modal__field">
            <label htmlFor="mating-notes">Observacoes</label>
            <textarea
              id="mating-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              placeholder="Observacoes sobre a monta (opcional)"
            />
          </div>

          <footer className="mating-modal__footer">
            <button
              type="button"
              className="mating-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="mating-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : isEditing ? 'Salvar alteracoes' : 'Registrar monta'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
