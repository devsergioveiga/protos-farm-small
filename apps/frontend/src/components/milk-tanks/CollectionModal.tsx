import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { CollectionItem, CreateCollectionInput, TankItem } from '@/types/milk-tank';
import './CollectionModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  collection?: CollectionItem | null;
  farmId: string;
  tanks: TankItem[];
  onSuccess: () => void;
}

const EMPTY_FORM: CreateCollectionInput = {
  tankId: null,
  collectionDate: new Date().toISOString().split('T')[0],
  collectionTime: '',
  dairyCompany: '',
  driverName: '',
  volumeLiters: 0,
  sampleCollected: false,
  milkTemperature: null,
  ticketNumber: '',
  pricePerLiter: null,
  qualityDiscount: null,
  freightDiscount: null,
  notes: '',
};

export default function CollectionModal({
  isOpen,
  onClose,
  collection,
  farmId,
  tanks,
  onSuccess,
}: Props) {
  const [formData, setFormData] = useState<CreateCollectionInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (collection) {
      setFormData({
        tankId: collection.tankId ?? null,
        collectionDate: collection.collectionDate.split('T')[0],
        collectionTime: collection.collectionTime ?? '',
        dairyCompany: collection.dairyCompany,
        driverName: collection.driverName ?? '',
        volumeLiters: collection.volumeLiters,
        sampleCollected: collection.sampleCollected,
        milkTemperature: collection.milkTemperature,
        ticketNumber: collection.ticketNumber ?? '',
        pricePerLiter: collection.pricePerLiter,
        qualityDiscount: collection.qualityDiscount,
        freightDiscount: collection.freightDiscount,
        notes: collection.notes ?? '',
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
  }, [collection, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.collectionDate) {
      setError('Informe a data da coleta.');
      return;
    }
    if (!formData.dairyCompany.trim()) {
      setError('Informe o laticínio.');
      return;
    }
    if (!formData.volumeLiters || formData.volumeLiters <= 0) {
      setError('Informe o volume coletado em litros.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      tankId: formData.tankId || null,
      collectionTime: formData.collectionTime || null,
      driverName: formData.driverName || null,
      ticketNumber: formData.ticketNumber || null,
      notes: formData.notes || null,
      milkTemperature: formData.milkTemperature ?? null,
      pricePerLiter: formData.pricePerLiter ?? null,
      qualityDiscount: formData.qualityDiscount ?? null,
      freightDiscount: formData.freightDiscount ?? null,
    };

    try {
      if (collection) {
        await api.patch(`/org/farms/${farmId}/milk-collections/${collection.id}`, payload);
      } else {
        await api.post(`/org/farms/${farmId}/milk-collections`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar coleta.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="collection-modal__overlay" onClick={onClose}>
      <div
        className="collection-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-modal-title"
      >
        <header className="collection-modal__header">
          <h2 id="collection-modal-title">
            {collection ? 'Editar coleta' : 'Nova coleta de leite'}
          </h2>
          <button
            type="button"
            className="collection-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="collection-modal__form">
          {error && (
            <div className="collection-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Tank + Date */}
          <div className="collection-modal__row">
            <div className="collection-modal__field">
              <label htmlFor="col-tank">Tanque</label>
              <select
                id="col-tank"
                value={formData.tankId ?? ''}
                onChange={(e) => setFormData({ ...formData, tankId: e.target.value || null })}
              >
                <option value="">Nenhum tanque</option>
                {tanks
                  .filter((t) => t.isActive)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.capacityLiters} L)
                    </option>
                  ))}
              </select>
            </div>
            <div className="collection-modal__field">
              <label htmlFor="col-date">Data da coleta *</label>
              <input
                id="col-date"
                type="date"
                value={formData.collectionDate}
                onChange={(e) => setFormData({ ...formData, collectionDate: e.target.value })}
                required
                aria-required="true"
              />
            </div>
          </div>

          {/* Time + Dairy Company */}
          <div className="collection-modal__row">
            <div className="collection-modal__field">
              <label htmlFor="col-time">Horário</label>
              <input
                id="col-time"
                type="time"
                value={formData.collectionTime ?? ''}
                onChange={(e) => setFormData({ ...formData, collectionTime: e.target.value })}
              />
            </div>
            <div className="collection-modal__field">
              <label htmlFor="col-dairy">Laticínio *</label>
              <input
                id="col-dairy"
                type="text"
                value={formData.dairyCompany}
                onChange={(e) => setFormData({ ...formData, dairyCompany: e.target.value })}
                required
                aria-required="true"
                placeholder="Ex: Laticínio Santa Clara"
              />
            </div>
          </div>

          {/* Driver + Volume */}
          <div className="collection-modal__row">
            <div className="collection-modal__field">
              <label htmlFor="col-driver">Motorista</label>
              <input
                id="col-driver"
                type="text"
                value={formData.driverName ?? ''}
                onChange={(e) => setFormData({ ...formData, driverName: e.target.value })}
                placeholder="Nome do motorista"
              />
            </div>
            <div className="collection-modal__field">
              <label htmlFor="col-volume">Volume (litros) *</label>
              <input
                id="col-volume"
                type="number"
                min="0.1"
                step="0.1"
                value={formData.volumeLiters || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    volumeLiters: e.target.value ? Number(e.target.value) : 0,
                  })
                }
                required
                aria-required="true"
              />
            </div>
          </div>

          {/* Temperature + Sample */}
          <div className="collection-modal__row">
            <div className="collection-modal__field">
              <label htmlFor="col-temp">Temperatura do leite (°C)</label>
              <input
                id="col-temp"
                type="number"
                step="0.1"
                value={formData.milkTemperature ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    milkTemperature: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Ex: 4.5"
              />
            </div>
            <div className="collection-modal__field">
              <label htmlFor="col-sample">Amostra coletada</label>
              <div className="collection-modal__checkbox-wrapper">
                <input
                  id="col-sample"
                  type="checkbox"
                  checked={formData.sampleCollected ?? false}
                  onChange={(e) => setFormData({ ...formData, sampleCollected: e.target.checked })}
                />
                <span className="collection-modal__checkbox-label">Sim, amostra foi coletada</span>
              </div>
            </div>
          </div>

          {/* Ticket Number */}
          <div className="collection-modal__field">
            <label htmlFor="col-ticket">Número do ticket</label>
            <input
              id="col-ticket"
              type="text"
              value={formData.ticketNumber ?? ''}
              onChange={(e) => setFormData({ ...formData, ticketNumber: e.target.value })}
              placeholder="Ex: TK-2026-001"
            />
          </div>

          {/* Financial section */}
          <div className="collection-modal__section-title">Informações financeiras</div>

          <div className="collection-modal__row collection-modal__row--three">
            <div className="collection-modal__field">
              <label htmlFor="col-price">Preço por litro (R$)</label>
              <input
                id="col-price"
                type="number"
                min="0"
                step="0.01"
                value={formData.pricePerLiter ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pricePerLiter: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="Ex: 2.50"
              />
            </div>
            <div className="collection-modal__field">
              <label htmlFor="col-quality-disc">Desconto qualidade (R$)</label>
              <input
                id="col-quality-disc"
                type="number"
                min="0"
                step="0.01"
                value={formData.qualityDiscount ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    qualityDiscount: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
            <div className="collection-modal__field">
              <label htmlFor="col-freight-disc">Desconto frete (R$)</label>
              <input
                id="col-freight-disc"
                type="number"
                min="0"
                step="0.01"
                value={formData.freightDiscount ?? ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    freightDiscount: e.target.value ? Number(e.target.value) : null,
                  })
                }
              />
            </div>
          </div>

          {/* Notes */}
          <div className="collection-modal__field">
            <label htmlFor="col-notes">Observações</label>
            <textarea
              id="col-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <footer className="collection-modal__footer">
            <button
              type="button"
              className="collection-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="collection-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : collection ? 'Salvar alterações' : 'Registrar coleta'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
