import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { TankItem, CreateTankInput } from '@/types/milk-tank';
import './TankModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tank?: TankItem | null;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateTankInput = {
  name: '',
  capacityLiters: 0,
  location: '',
  serialNumber: '',
};

export default function TankModal({ isOpen, onClose, tank, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateTankInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (tank) {
      setFormData({
        name: tank.name,
        capacityLiters: tank.capacityLiters,
        location: tank.location ?? '',
        serialNumber: tank.serialNumber ?? '',
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
  }, [tank, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Informe o nome do tanque.');
      return;
    }
    if (!formData.capacityLiters || formData.capacityLiters <= 0) {
      setError('Informe a capacidade em litros.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      location: formData.location || null,
      serialNumber: formData.serialNumber || null,
    };

    try {
      if (tank) {
        await api.patch(`/org/farms/${farmId}/cooling-tanks/${tank.id}`, payload);
      } else {
        await api.post(`/org/farms/${farmId}/cooling-tanks`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar tanque.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="tank-modal__overlay" onClick={onClose}>
      <div
        className="tank-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tank-modal-title"
      >
        <header className="tank-modal__header">
          <h2 id="tank-modal-title">{tank ? 'Editar tanque' : 'Novo tanque de resfriamento'}</h2>
          <button type="button" className="tank-modal__close" onClick={onClose} aria-label="Fechar">
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="tank-modal__form">
          {error && (
            <div className="tank-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="tank-modal__field">
            <label htmlFor="tank-name">Nome do tanque *</label>
            <input
              id="tank-name"
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              aria-required="true"
              placeholder="Ex: Tanque principal"
            />
          </div>

          <div className="tank-modal__row">
            <div className="tank-modal__field">
              <label htmlFor="tank-capacity">Capacidade (litros) *</label>
              <input
                id="tank-capacity"
                type="number"
                min="1"
                step="1"
                value={formData.capacityLiters || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    capacityLiters: e.target.value ? Number(e.target.value) : 0,
                  })
                }
                required
                aria-required="true"
                placeholder="Ex: 2000"
              />
            </div>
            <div className="tank-modal__field">
              <label htmlFor="tank-serial">Numero de serie</label>
              <input
                id="tank-serial"
                type="text"
                value={formData.serialNumber ?? ''}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder="Ex: SN-12345"
              />
            </div>
          </div>

          <div className="tank-modal__field">
            <label htmlFor="tank-location">Localização</label>
            <input
              id="tank-location"
              type="text"
              value={formData.location ?? ''}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="Ex: Sala de ordenha, Galpão 2"
            />
          </div>

          <footer className="tank-modal__footer">
            <button
              type="button"
              className="tank-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="tank-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : tank ? 'Salvar alterações' : 'Cadastrar tanque'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
