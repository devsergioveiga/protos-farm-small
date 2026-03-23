import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import { useAnimals } from '@/hooks/useAnimals';
import { useLots } from '@/hooks/useLots';
import type { CreateWeaningInput } from '@/types/weaning';
import './WeaningModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateWeaningInput = {
  calfId: '',
  weaningDate: new Date().toISOString().split('T')[0],
  weightKg: null,
  targetLotId: null,
  observations: '',
};

export default function WeaningModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateWeaningInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [animalSearch, setAnimalSearch] = useState('');

  const { animals } = useAnimals({
    farmId,
    limit: 500,
    category: 'BEZERRO',
  });
  const { animals: femaleCalves } = useAnimals({
    farmId,
    limit: 500,
    category: 'BEZERRA',
  });
  const allCalves = [...animals, ...femaleCalves];

  const { lots } = useLots({ farmId, limit: 200 });

  useEffect(() => {
    if (!isOpen) return;
    setFormData({ ...EMPTY_FORM });
    setError(null);
    setAnimalSearch('');
  }, [isOpen]);

  const filteredCalves = animalSearch
    ? allCalves.filter(
        (a) =>
          a.earTag.toLowerCase().includes(animalSearch.toLowerCase()) ||
          (a.name && a.name.toLowerCase().includes(animalSearch.toLowerCase())),
      )
    : allCalves;

  const selectedAnimal = allCalves.find((a) => a.id === formData.calfId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.calfId) {
      setError('Selecione o bezerro(a).');
      return;
    }
    if (!formData.weaningDate) {
      setError('Informe a data da desmama.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      weightKg: formData.weightKg ?? null,
      targetLotId: formData.targetLotId || null,
      observations: formData.observations || null,
    };

    try {
      await api.post(`/org/farms/${farmId}/weanings`, payload);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar desmama.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="weaning-modal__overlay" onClick={onClose}>
      <div
        className="weaning-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="weaning-modal-title"
      >
        <header className="weaning-modal__header">
          <h2 id="weaning-modal-title">Registrar desmama</h2>
          <button
            type="button"
            className="weaning-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="weaning-modal__form">
          {error && (
            <div className="weaning-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="weaning-modal__field">
            <label htmlFor="wean-animal">Bezerro(a) *</label>
            {selectedAnimal ? (
              <div className="weaning-modal__selected-animal">
                <span>
                  <strong>{selectedAnimal.earTag}</strong>
                  {selectedAnimal.name ? ` — ${selectedAnimal.name}` : ''}
                </span>
                <button
                  type="button"
                  className="weaning-modal__clear-btn"
                  onClick={() => setFormData({ ...formData, calfId: '' })}
                  aria-label="Alterar bezerro"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <>
                <input
                  id="wean-animal"
                  type="text"
                  value={animalSearch}
                  onChange={(e) => setAnimalSearch(e.target.value)}
                  placeholder="Buscar por brinco ou nome..."
                  aria-required="true"
                  autoComplete="off"
                />
                {animalSearch && filteredCalves.length > 0 && (
                  <ul className="weaning-modal__animal-list" role="listbox">
                    {filteredCalves.slice(0, 10).map((a) => (
                      <li key={a.id} role="option" aria-selected={false}>
                        <button
                          type="button"
                          className="weaning-modal__animal-option"
                          onClick={() => {
                            setFormData({ ...formData, calfId: a.id });
                            setAnimalSearch('');
                          }}
                        >
                          <strong>{a.earTag}</strong>
                          {a.name ? ` — ${a.name}` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {animalSearch && filteredCalves.length === 0 && (
                  <p className="weaning-modal__no-results">Nenhum bezerro(a) encontrado.</p>
                )}
                {!animalSearch && allCalves.length > 0 && (
                  <ul className="weaning-modal__animal-list" role="listbox">
                    {allCalves.slice(0, 10).map((a) => (
                      <li key={a.id} role="option" aria-selected={false}>
                        <button
                          type="button"
                          className="weaning-modal__animal-option"
                          onClick={() => {
                            setFormData({ ...formData, calfId: a.id });
                            setAnimalSearch('');
                          }}
                        >
                          <strong>{a.earTag}</strong>
                          {a.name ? ` — ${a.name}` : ''}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="weaning-modal__row">
            <div className="weaning-modal__field">
              <label htmlFor="wean-date">Data da desmama *</label>
              <input
                id="wean-date"
                type="date"
                value={formData.weaningDate}
                onChange={(e) => setFormData({ ...formData, weaningDate: e.target.value })}
                required
                aria-required="true"
              />
            </div>
            <div className="weaning-modal__field">
              <label htmlFor="wean-weight">Peso (kg)</label>
              <input
                id="wean-weight"
                type="number"
                min="0"
                step="0.1"
                value={formData.weightKg ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    weightKg: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Peso na desmama"
              />
            </div>
          </div>

          <div className="weaning-modal__field">
            <label htmlFor="wean-lot">Lote de destino</label>
            <select
              id="wean-lot"
              value={formData.targetLotId ?? ''}
              onChange={(e) =>
                setFormData({ ...formData, targetLotId: e.target.value || null })
              }
            >
              <option value="">Nenhum (manter no lote atual)</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name}
                </option>
              ))}
            </select>
          </div>

          <div className="weaning-modal__field">
            <label htmlFor="wean-obs">Observações</label>
            <textarea
              id="wean-obs"
              value={formData.observations ?? ''}
              onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
              rows={3}
              placeholder="Observações sobre a desmama..."
            />
          </div>

          <footer className="weaning-modal__footer">
            <button
              type="button"
              className="weaning-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="weaning-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Registrar desmama'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
