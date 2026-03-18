import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { DewormingItem, CreateDewormingInput } from '@/types/deworming';
import { ADMINISTRATION_ROUTES } from '@/types/deworming';
import type { AnimalListItem } from '@/types/animal';
import { useAnimals } from '@/hooks/useAnimals';
import './DewormingModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  deworming?: DewormingItem | null;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateDewormingInput = {
  animalId: '',
  productId: null,
  productName: '',
  activeIngredient: '',
  chemicalGroup: '',
  dosageMl: 0,
  administrationRoute: 'SC',
  productBatchNumber: '',
  productExpiryDate: '',
  dewormingDate: new Date().toISOString().split('T')[0],
  responsibleName: '',
  veterinaryName: '',
  opgPre: null,
  notes: '',
};

export default function DewormingModal({ isOpen, onClose, deworming, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateDewormingInput>({ ...EMPTY_FORM });
  const [opgPost, setOpgPost] = useState<number | null>(null);
  const [opgPostDate, setOpgPostDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useAnimals({ farmId, limit: 500 });

  useEffect(() => {
    if (!isOpen) return;
    if (deworming) {
      setFormData({
        animalId: deworming.animalId,
        productId: deworming.productId,
        productName: deworming.productName,
        activeIngredient: deworming.activeIngredient ?? '',
        chemicalGroup: deworming.chemicalGroup ?? '',
        dosageMl: deworming.dosageMl,
        administrationRoute: deworming.administrationRoute,
        productBatchNumber: deworming.productBatchNumber ?? '',
        productExpiryDate: deworming.productExpiryDate
          ? deworming.productExpiryDate.split('T')[0]
          : '',
        dewormingDate: deworming.dewormingDate.split('T')[0],
        responsibleName: deworming.responsibleName,
        veterinaryName: deworming.veterinaryName ?? '',
        opgPre: deworming.opgPre,
        notes: deworming.notes ?? '',
      });
      setOpgPost(deworming.opgPost);
      setOpgPostDate(deworming.opgPostDate?.split('T')[0] ?? '');
    } else {
      setFormData({ ...EMPTY_FORM });
      setOpgPost(null);
      setOpgPostDate('');
    }
    setError(null);
  }, [deworming, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.animalId) {
      setError('Selecione o animal.');
      return;
    }
    if (!formData.productName.trim()) {
      setError('Informe o nome do vermífugo.');
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
      activeIngredient: formData.activeIngredient || null,
      chemicalGroup: formData.chemicalGroup || null,
      productBatchNumber: formData.productBatchNumber || null,
      productExpiryDate: formData.productExpiryDate || null,
      veterinaryName: formData.veterinaryName || null,
      opgPre: formData.opgPre ?? null,
      notes: formData.notes || null,
    };

    try {
      if (deworming) {
        const updatePayload: Record<string, unknown> = {
          dosageMl: payload.dosageMl,
          administrationRoute: payload.administrationRoute,
          productBatchNumber: payload.productBatchNumber,
          productExpiryDate: payload.productExpiryDate,
          dewormingDate: payload.dewormingDate,
          responsibleName: payload.responsibleName,
          veterinaryName: payload.veterinaryName,
          opgPre: payload.opgPre,
          notes: payload.notes,
        };
        if (opgPost !== null) {
          updatePayload.opgPost = opgPost;
          updatePayload.opgPostDate = opgPostDate || null;
        }
        await api.patch(`/org/farms/${farmId}/dewormings/${deworming.id}`, updatePayload);
      } else {
        await api.post(`/org/farms/${farmId}/dewormings`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar vermifugação.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="deworming-modal__overlay" onClick={onClose}>
      <div
        className="deworming-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deworming-modal-title"
      >
        <header className="deworming-modal__header">
          <h2 id="deworming-modal-title">
            {deworming ? 'Editar vermifugação' : 'Nova vermifugação'}
          </h2>
          <button
            type="button"
            className="deworming-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="deworming-modal__form">
          {error && (
            <div className="deworming-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Animal */}
          <div className="deworming-modal__field">
            <label htmlFor="dew-animal">Animal *</label>
            <select
              id="dew-animal"
              value={formData.animalId}
              onChange={(e) => setFormData({ ...formData, animalId: e.target.value })}
              required
              aria-required="true"
              disabled={!!deworming}
            >
              <option value="">Selecione o animal...</option>
              {animals.map((a: AnimalListItem) => (
                <option key={a.id} value={a.id}>
                  {a.earTag} — {a.name || 'Sem nome'}
                </option>
              ))}
            </select>
          </div>

          {/* Vermífugo + Dosagem */}
          <div className="deworming-modal__row">
            <div className="deworming-modal__field">
              <label htmlFor="dew-product-name">Vermífugo *</label>
              <input
                id="dew-product-name"
                type="text"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                required
                aria-required="true"
                placeholder="Ex: Ivomec Gold"
              />
            </div>
            <div className="deworming-modal__field">
              <label htmlFor="dew-dosage">Dosagem (mL) *</label>
              <input
                id="dew-dosage"
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

          {/* Princípio ativo + Grupo químico */}
          <div className="deworming-modal__row">
            <div className="deworming-modal__field">
              <label htmlFor="dew-ingredient">Princípio ativo</label>
              <input
                id="dew-ingredient"
                type="text"
                value={formData.activeIngredient ?? ''}
                onChange={(e) => setFormData({ ...formData, activeIngredient: e.target.value })}
                placeholder="Ex: Ivermectina"
              />
            </div>
            <div className="deworming-modal__field">
              <label htmlFor="dew-chemical-group">Grupo químico</label>
              <input
                id="dew-chemical-group"
                type="text"
                value={formData.chemicalGroup ?? ''}
                onChange={(e) => setFormData({ ...formData, chemicalGroup: e.target.value })}
                placeholder="Ex: Avermectina"
              />
            </div>
          </div>

          {/* Via + OPG pré */}
          <div className="deworming-modal__row">
            <div className="deworming-modal__field">
              <label htmlFor="dew-route">Via de aplicação *</label>
              <select
                id="dew-route"
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
            <div className="deworming-modal__field">
              <label htmlFor="dew-opg-pre">OPG pré-vermifugação</label>
              <input
                id="dew-opg-pre"
                type="number"
                min="0"
                value={formData.opgPre ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    opgPre: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Ovos por grama"
              />
            </div>
          </div>

          {/* OPG pós (only in edit mode) */}
          {deworming && (
            <div className="deworming-modal__row">
              <div className="deworming-modal__field">
                <label htmlFor="dew-opg-post">OPG pós-vermifugação</label>
                <input
                  id="dew-opg-post"
                  type="number"
                  min="0"
                  value={opgPost ?? ''}
                  onChange={(e) => setOpgPost(e.target.value ? Number(e.target.value) : null)}
                  placeholder="Ovos por grama (após tratamento)"
                />
              </div>
              <div className="deworming-modal__field">
                <label htmlFor="dew-opg-post-date">Data coleta OPG pós</label>
                <input
                  id="dew-opg-post-date"
                  type="date"
                  value={opgPostDate}
                  onChange={(e) => setOpgPostDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Lote + Validade do produto */}
          <div className="deworming-modal__row">
            <div className="deworming-modal__field">
              <label htmlFor="dew-batch">Lote do produto</label>
              <input
                id="dew-batch"
                type="text"
                value={formData.productBatchNumber ?? ''}
                onChange={(e) => setFormData({ ...formData, productBatchNumber: e.target.value })}
                placeholder="Ex: LOT-2026-01"
              />
            </div>
            <div className="deworming-modal__field">
              <label htmlFor="dew-expiry">Validade do produto</label>
              <input
                id="dew-expiry"
                type="date"
                value={formData.productExpiryDate ?? ''}
                onChange={(e) => setFormData({ ...formData, productExpiryDate: e.target.value })}
              />
            </div>
          </div>

          {/* Data + Responsável */}
          <div className="deworming-modal__row">
            <div className="deworming-modal__field">
              <label htmlFor="dew-date">Data da vermifugação *</label>
              <input
                id="dew-date"
                type="date"
                value={formData.dewormingDate}
                onChange={(e) => setFormData({ ...formData, dewormingDate: e.target.value })}
                required
                aria-required="true"
              />
            </div>
            <div className="deworming-modal__field">
              <label htmlFor="dew-responsible">Responsável *</label>
              <input
                id="dew-responsible"
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
          <div className="deworming-modal__field">
            <label htmlFor="dew-vet">Veterinário</label>
            <input
              id="dew-vet"
              type="text"
              value={formData.veterinaryName ?? ''}
              onChange={(e) => setFormData({ ...formData, veterinaryName: e.target.value })}
              placeholder="Nome do veterinário (opcional)"
            />
          </div>

          {/* Observações */}
          <div className="deworming-modal__field">
            <label htmlFor="dew-notes">Observações</label>
            <textarea
              id="dew-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <footer className="deworming-modal__footer">
            <button
              type="button"
              className="deworming-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="deworming-modal__btn-save" disabled={isLoading}>
              {isLoading
                ? 'Salvando...'
                : deworming
                  ? 'Salvar alterações'
                  : 'Registrar vermifugação'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
