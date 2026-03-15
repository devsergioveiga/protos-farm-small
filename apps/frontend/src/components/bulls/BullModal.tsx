import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { BullItem, CreateBullInput } from '@/types/bull';
import { BULL_STATUSES } from '@/types/bull';
import type { AnimalListItem } from '@/types/animal';
import { useAnimals } from '@/hooks/useAnimals';
import './BullModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  bull?: BullItem | null;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateBullInput = {
  name: '',
  registryNumber: null,
  registryAssociation: null,
  breedName: '',
  breedComposition: null,
  isOwnAnimal: false,
  animalId: null,
  ownerName: null,
  ownerContact: null,
  stayStartDate: null,
  stayEndDate: null,
  status: 'ACTIVE',
  ptaMilkKg: null,
  ptaFatKg: null,
  ptaFatPct: null,
  ptaProteinKg: null,
  ptaProteinPct: null,
  typeScore: null,
  productiveLife: null,
  calvingEase: null,
  scc: null,
  geneticProofs: null,
  notes: null,
};

export default function BullModal({ isOpen, onClose, bull, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateBullInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useAnimals({ farmId, limit: 500, sex: 'MALE' });

  useEffect(() => {
    if (!isOpen) return;
    if (bull) {
      setFormData({
        name: bull.name,
        registryNumber: bull.registryNumber,
        registryAssociation: bull.registryAssociation,
        breedName: bull.breedName,
        breedComposition: bull.breedComposition,
        isOwnAnimal: bull.isOwnAnimal,
        animalId: bull.animalId,
        ownerName: bull.ownerName,
        ownerContact: bull.ownerContact,
        stayStartDate: bull.stayStartDate ? bull.stayStartDate.split('T')[0] : null,
        stayEndDate: bull.stayEndDate ? bull.stayEndDate.split('T')[0] : null,
        status: bull.status,
        ptaMilkKg: bull.ptaMilkKg,
        ptaFatKg: bull.ptaFatKg,
        ptaFatPct: bull.ptaFatPct,
        ptaProteinKg: bull.ptaProteinKg,
        ptaProteinPct: bull.ptaProteinPct,
        typeScore: bull.typeScore,
        productiveLife: bull.productiveLife,
        calvingEase: bull.calvingEase,
        scc: bull.scc,
        geneticProofs: bull.geneticProofs,
        notes: bull.notes,
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
  }, [bull, isOpen]);

  const setField = <K extends keyof CreateBullInput>(key: K, value: CreateBullInput[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const setNumberField = (key: keyof CreateBullInput, value: string) => {
    setField(key, value === '' ? null : Number(value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Informe o nome do touro.');
      return;
    }
    if (!formData.breedName.trim()) {
      setError('Informe a raça do touro.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      registryNumber: formData.registryNumber || null,
      registryAssociation: formData.registryAssociation || null,
      animalId: formData.isOwnAnimal ? formData.animalId || null : null,
      ownerName: formData.isOwnAnimal ? null : formData.ownerName || null,
      ownerContact: formData.isOwnAnimal ? null : formData.ownerContact || null,
      stayStartDate: formData.isOwnAnimal ? null : formData.stayStartDate || null,
      stayEndDate: formData.isOwnAnimal ? null : formData.stayEndDate || null,
      notes: formData.notes || null,
    };

    try {
      if (bull) {
        await api.patch(`/org/farms/${farmId}/bulls/${bull.id}`, payload);
      } else {
        await api.post(`/org/farms/${farmId}/bulls`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar touro.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bull-modal__overlay" onClick={onClose}>
      <div
        className="bull-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bull-modal-title"
      >
        <header className="bull-modal__header">
          <h2 id="bull-modal-title">{bull ? 'Editar touro' : 'Novo touro'}</h2>
          <button type="button" className="bull-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="bull-modal__form">
          {error && (
            <div className="bull-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* ─── Dados básicos ───────────────────────────────── */}
          <fieldset className="bull-modal__section">
            <legend className="bull-modal__section-title">Dados básicos</legend>

            <div className="bull-modal__row">
              <div className="bull-modal__field">
                <label htmlFor="bull-name">Nome *</label>
                <input
                  id="bull-name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setField('name', e.target.value)}
                  required
                  aria-required="true"
                  placeholder="Ex: Sultão FIV"
                />
              </div>
              <div className="bull-modal__field">
                <label htmlFor="bull-breed">Raça *</label>
                <input
                  id="bull-breed"
                  type="text"
                  value={formData.breedName}
                  onChange={(e) => setField('breedName', e.target.value)}
                  required
                  aria-required="true"
                  placeholder="Ex: Nelore"
                />
              </div>
            </div>

            <div className="bull-modal__row">
              <div className="bull-modal__field">
                <label htmlFor="bull-registry">Registro</label>
                <input
                  id="bull-registry"
                  type="text"
                  value={formData.registryNumber ?? ''}
                  onChange={(e) => setField('registryNumber', e.target.value || null)}
                  placeholder="Ex: ABCZ-12345"
                />
              </div>
              <div className="bull-modal__field">
                <label htmlFor="bull-association">Associação</label>
                <input
                  id="bull-association"
                  type="text"
                  value={formData.registryAssociation ?? ''}
                  onChange={(e) => setField('registryAssociation', e.target.value || null)}
                  placeholder="Ex: ABCZ"
                />
              </div>
            </div>

            <div className="bull-modal__row">
              <div className="bull-modal__field">
                <label htmlFor="bull-status">Status</label>
                <select
                  id="bull-status"
                  value={formData.status}
                  onChange={(e) => setField('status', e.target.value)}
                >
                  {BULL_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="bull-modal__field bull-modal__field--checkbox">
                <label htmlFor="bull-own">
                  <input
                    id="bull-own"
                    type="checkbox"
                    checked={formData.isOwnAnimal}
                    onChange={(e) => setField('isOwnAnimal', e.target.checked)}
                  />
                  Touro próprio (do rebanho)
                </label>
              </div>
            </div>
          </fieldset>

          {/* ─── Touro próprio ───────────────────────────────── */}
          {formData.isOwnAnimal && (
            <fieldset className="bull-modal__section">
              <legend className="bull-modal__section-title">Vínculo com animal</legend>
              <div className="bull-modal__field">
                <label htmlFor="bull-animal">Animal do rebanho</label>
                <select
                  id="bull-animal"
                  value={formData.animalId ?? ''}
                  onChange={(e) => setField('animalId', e.target.value || null)}
                >
                  <option value="">Selecione o animal...</option>
                  {animals.map((a: AnimalListItem) => (
                    <option key={a.id} value={a.id}>
                      {a.earTag} — {a.name || 'Sem nome'}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
          )}

          {/* ─── Touro alugado ───────────────────────────────── */}
          {!formData.isOwnAnimal && (
            <fieldset className="bull-modal__section">
              <legend className="bull-modal__section-title">Proprietário / Aluguel</legend>
              <div className="bull-modal__row">
                <div className="bull-modal__field">
                  <label htmlFor="bull-owner-name">Nome do proprietário</label>
                  <input
                    id="bull-owner-name"
                    type="text"
                    value={formData.ownerName ?? ''}
                    onChange={(e) => setField('ownerName', e.target.value || null)}
                    placeholder="Ex: João Silva"
                  />
                </div>
                <div className="bull-modal__field">
                  <label htmlFor="bull-owner-contact">Contato</label>
                  <input
                    id="bull-owner-contact"
                    type="text"
                    value={formData.ownerContact ?? ''}
                    onChange={(e) => setField('ownerContact', e.target.value || null)}
                    placeholder="Ex: (11) 99999-0000"
                  />
                </div>
              </div>
              <div className="bull-modal__row">
                <div className="bull-modal__field">
                  <label htmlFor="bull-stay-start">Início da estadia</label>
                  <input
                    id="bull-stay-start"
                    type="date"
                    value={formData.stayStartDate ?? ''}
                    onChange={(e) => setField('stayStartDate', e.target.value || null)}
                  />
                </div>
                <div className="bull-modal__field">
                  <label htmlFor="bull-stay-end">Fim da estadia</label>
                  <input
                    id="bull-stay-end"
                    type="date"
                    value={formData.stayEndDate ?? ''}
                    onChange={(e) => setField('stayEndDate', e.target.value || null)}
                  />
                </div>
              </div>
            </fieldset>
          )}

          {/* ─── Mérito genético leiteiro ────────────────────── */}
          <fieldset className="bull-modal__section">
            <legend className="bull-modal__section-title">Mérito genético leiteiro</legend>
            <div className="bull-modal__row">
              <div className="bull-modal__field">
                <label htmlFor="bull-pta-milk">PTA Leite (kg)</label>
                <input
                  id="bull-pta-milk"
                  type="number"
                  step="0.1"
                  value={formData.ptaMilkKg ?? ''}
                  onChange={(e) => setNumberField('ptaMilkKg', e.target.value)}
                  className="bull-modal__input--mono"
                />
              </div>
              <div className="bull-modal__field">
                <label htmlFor="bull-pta-fat-kg">PTA Gordura (kg)</label>
                <input
                  id="bull-pta-fat-kg"
                  type="number"
                  step="0.01"
                  value={formData.ptaFatKg ?? ''}
                  onChange={(e) => setNumberField('ptaFatKg', e.target.value)}
                  className="bull-modal__input--mono"
                />
              </div>
            </div>
            <div className="bull-modal__row">
              <div className="bull-modal__field">
                <label htmlFor="bull-pta-fat-pct">PTA Gordura (%)</label>
                <input
                  id="bull-pta-fat-pct"
                  type="number"
                  step="0.01"
                  value={formData.ptaFatPct ?? ''}
                  onChange={(e) => setNumberField('ptaFatPct', e.target.value)}
                  className="bull-modal__input--mono"
                />
              </div>
              <div className="bull-modal__field">
                <label htmlFor="bull-pta-protein-kg">PTA Proteína (kg)</label>
                <input
                  id="bull-pta-protein-kg"
                  type="number"
                  step="0.01"
                  value={formData.ptaProteinKg ?? ''}
                  onChange={(e) => setNumberField('ptaProteinKg', e.target.value)}
                  className="bull-modal__input--mono"
                />
              </div>
            </div>
            <div className="bull-modal__row">
              <div className="bull-modal__field">
                <label htmlFor="bull-pta-protein-pct">PTA Proteína (%)</label>
                <input
                  id="bull-pta-protein-pct"
                  type="number"
                  step="0.01"
                  value={formData.ptaProteinPct ?? ''}
                  onChange={(e) => setNumberField('ptaProteinPct', e.target.value)}
                  className="bull-modal__input--mono"
                />
              </div>
              <div className="bull-modal__field">
                <label htmlFor="bull-type-score">Tipo (score)</label>
                <input
                  id="bull-type-score"
                  type="number"
                  step="0.1"
                  value={formData.typeScore ?? ''}
                  onChange={(e) => setNumberField('typeScore', e.target.value)}
                  className="bull-modal__input--mono"
                />
              </div>
            </div>
            <div className="bull-modal__row">
              <div className="bull-modal__field">
                <label htmlFor="bull-productive-life">Vida produtiva</label>
                <input
                  id="bull-productive-life"
                  type="number"
                  step="0.1"
                  value={formData.productiveLife ?? ''}
                  onChange={(e) => setNumberField('productiveLife', e.target.value)}
                  className="bull-modal__input--mono"
                />
              </div>
              <div className="bull-modal__field">
                <label htmlFor="bull-calving-ease">Facilidade de parto</label>
                <input
                  id="bull-calving-ease"
                  type="number"
                  step="0.1"
                  value={formData.calvingEase ?? ''}
                  onChange={(e) => setNumberField('calvingEase', e.target.value)}
                  className="bull-modal__input--mono"
                />
              </div>
            </div>
            <div className="bull-modal__field">
              <label htmlFor="bull-scc">CCS (Contagem de células somáticas)</label>
              <input
                id="bull-scc"
                type="number"
                step="1"
                value={formData.scc ?? ''}
                onChange={(e) => setNumberField('scc', e.target.value)}
                className="bull-modal__input--mono"
              />
            </div>
          </fieldset>

          {/* ─── Observações ─────────────────────────────────── */}
          <div className="bull-modal__field">
            <label htmlFor="bull-notes">Observações</label>
            <textarea
              id="bull-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setField('notes', e.target.value || null)}
              rows={3}
              placeholder="Informações adicionais sobre o touro..."
            />
          </div>

          <footer className="bull-modal__footer">
            <button
              type="button"
              className="bull-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="bull-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : bull ? 'Salvar alterações' : 'Cadastrar touro'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
