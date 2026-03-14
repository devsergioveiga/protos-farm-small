import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { VaccinationItem, CreateVaccinationInput } from '@/types/vaccination';
import { ADMINISTRATION_ROUTES } from '@/types/vaccination';
import type { AnimalListItem } from '@/types/animal';
import { useAnimals } from '@/hooks/useAnimals';
import './VaccinationModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  vaccination?: VaccinationItem | null;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateVaccinationInput = {
  animalId: '',
  productId: null,
  productName: '',
  dosageMl: 0,
  administrationRoute: 'IM',
  productBatchNumber: '',
  productExpiryDate: '',
  vaccinationDate: new Date().toISOString().split('T')[0],
  responsibleName: '',
  veterinaryName: '',
  doseNumber: 1,
  notes: '',
};

export default function VaccinationModal({
  isOpen,
  onClose,
  vaccination,
  farmId,
  onSuccess,
}: Props) {
  const [formData, setFormData] = useState<CreateVaccinationInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useAnimals({ farmId, limit: 500 });

  useEffect(() => {
    if (!isOpen) return;
    if (vaccination) {
      setFormData({
        animalId: vaccination.animalId,
        productId: vaccination.productId,
        productName: vaccination.productName,
        dosageMl: vaccination.dosageMl,
        administrationRoute: vaccination.administrationRoute,
        productBatchNumber: vaccination.productBatchNumber ?? '',
        productExpiryDate: vaccination.productExpiryDate
          ? vaccination.productExpiryDate.split('T')[0]
          : '',
        vaccinationDate: vaccination.vaccinationDate.split('T')[0],
        responsibleName: vaccination.responsibleName,
        veterinaryName: vaccination.veterinaryName ?? '',
        doseNumber: vaccination.doseNumber,
        notes: vaccination.notes ?? '',
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
  }, [vaccination, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.animalId) {
      setError('Selecione o animal.');
      return;
    }
    if (!formData.productName.trim()) {
      setError('Informe o nome da vacina.');
      return;
    }
    if (!formData.dosageMl || formData.dosageMl <= 0) {
      setError('Informe a dosagem em mL.');
      return;
    }
    if (!formData.responsibleName.trim()) {
      setError('Informe o responsável pela aplicação.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      productBatchNumber: formData.productBatchNumber || null,
      productExpiryDate: formData.productExpiryDate || null,
      veterinaryName: formData.veterinaryName || null,
      notes: formData.notes || null,
    };

    try {
      if (vaccination) {
        await api.patch(`/org/farms/${farmId}/vaccinations/${vaccination.id}`, {
          dosageMl: payload.dosageMl,
          administrationRoute: payload.administrationRoute,
          productBatchNumber: payload.productBatchNumber,
          productExpiryDate: payload.productExpiryDate,
          vaccinationDate: payload.vaccinationDate,
          responsibleName: payload.responsibleName,
          veterinaryName: payload.veterinaryName,
          notes: payload.notes,
        });
      } else {
        await api.post(`/org/farms/${farmId}/vaccinations`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar vacinação.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="vaccination-modal__overlay" onClick={onClose}>
      <div
        className="vaccination-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="vaccination-modal-title"
      >
        <header className="vaccination-modal__header">
          <h2 id="vaccination-modal-title">
            {vaccination ? 'Editar vacinação' : 'Nova vacinação'}
          </h2>
          <button
            type="button"
            className="vaccination-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="vaccination-modal__form">
          {error && (
            <div className="vaccination-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Animal */}
          <div className="vaccination-modal__field">
            <label htmlFor="vacc-animal">Animal *</label>
            <select
              id="vacc-animal"
              value={formData.animalId}
              onChange={(e) => setFormData({ ...formData, animalId: e.target.value })}
              required
              aria-required="true"
              disabled={!!vaccination}
            >
              <option value="">Selecione o animal...</option>
              {animals.map((a: AnimalListItem) => (
                <option key={a.id} value={a.id}>
                  {a.earTag} — {a.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>

          {/* Vacina + Dosagem */}
          <div className="vaccination-modal__row">
            <div className="vaccination-modal__field">
              <label htmlFor="vacc-product-name">Vacina *</label>
              <input
                id="vacc-product-name"
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                required
                aria-required="true"
                placeholder="Ex: Vacina contra clostridioses"
              />
            </div>
            <div className="vaccination-modal__field">
              <label htmlFor="vacc-dosage">Dosagem (mL) *</label>
              <input
                id="vacc-dosage"
                type="number"
                min="0.1"
                step="0.1"
                value={formData.dosageMl || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dosageMl: e.target.value ? Number(e.target.value) : 0,
                  })
                }
                required
                aria-required="true"
              />
            </div>
          </div>

          {/* Via + Dose */}
          <div className="vaccination-modal__row">
            <div className="vaccination-modal__field">
              <label htmlFor="vacc-route">Via de aplicação *</label>
              <select
                id="vacc-route"
                value={formData.administrationRoute}
                onChange={(e) => setFormData({ ...formData, administrationRoute: e.target.value })}
                required
                aria-required="true"
              >
                {ADMINISTRATION_ROUTES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="vaccination-modal__field">
              <label htmlFor="vacc-dose-number">Número da dose</label>
              <input
                id="vacc-dose-number"
                type="number"
                min="1"
                value={formData.doseNumber ?? 1}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    doseNumber: e.target.value ? Number(e.target.value) : 1,
                  })
                }
              />
            </div>
          </div>

          {/* Lote + Validade do produto */}
          <div className="vaccination-modal__row">
            <div className="vaccination-modal__field">
              <label htmlFor="vacc-batch">Lote do produto</label>
              <input
                id="vacc-batch"
                type="text"
                value={formData.productBatchNumber ?? ''}
                onChange={(e) => setFormData({ ...formData, productBatchNumber: e.target.value })}
                placeholder="Ex: LOT-2026-01"
              />
            </div>
            <div className="vaccination-modal__field">
              <label htmlFor="vacc-expiry">Validade do produto</label>
              <input
                id="vacc-expiry"
                type="date"
                value={formData.productExpiryDate ?? ''}
                onChange={(e) => setFormData({ ...formData, productExpiryDate: e.target.value })}
              />
            </div>
          </div>

          {/* Data + Responsável */}
          <div className="vaccination-modal__row">
            <div className="vaccination-modal__field">
              <label htmlFor="vacc-date">Data da vacinação *</label>
              <input
                id="vacc-date"
                type="date"
                value={formData.vaccinationDate}
                onChange={(e) => setFormData({ ...formData, vaccinationDate: e.target.value })}
                required
                aria-required="true"
              />
            </div>
            <div className="vaccination-modal__field">
              <label htmlFor="vacc-responsible">Responsável *</label>
              <input
                id="vacc-responsible"
                type="text"
                value={formData.responsibleName}
                onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                required
                aria-required="true"
                placeholder="Nome do aplicador"
              />
            </div>
          </div>

          {/* Veterinário */}
          <div className="vaccination-modal__field">
            <label htmlFor="vacc-vet">Veterinário</label>
            <input
              id="vacc-vet"
              type="text"
              value={formData.veterinaryName ?? ''}
              onChange={(e) => setFormData({ ...formData, veterinaryName: e.target.value })}
              placeholder="Nome do veterinário (opcional)"
            />
          </div>

          {/* Observações */}
          <div className="vaccination-modal__field">
            <label htmlFor="vacc-notes">Observações</label>
            <textarea
              id="vacc-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <footer className="vaccination-modal__footer">
            <button
              type="button"
              className="vaccination-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="vaccination-modal__btn-save" disabled={isLoading}>
              {isLoading
                ? 'Salvando...'
                : vaccination
                  ? 'Salvar alterações'
                  : 'Registrar vacinação'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
