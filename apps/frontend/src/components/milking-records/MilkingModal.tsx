import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { MilkingRecordItem, CreateMilkingRecordInput } from '@/types/milking-record';
import { MILKING_SHIFTS } from '@/types/milking-record';
import { useLactatingAnimals } from '@/hooks/useMilkingRecords';
import './MilkingModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  record?: MilkingRecordItem | null;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateMilkingRecordInput = {
  animalId: '',
  milkingDate: new Date().toISOString().split('T')[0],
  shift: 'MORNING',
  liters: 0,
  notes: '',
};

export default function MilkingModal({ isOpen, onClose, record, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<CreateMilkingRecordInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { animals } = useLactatingAnimals(isOpen ? farmId : null);

  useEffect(() => {
    if (!isOpen) return;
    if (record) {
      setFormData({
        animalId: record.animalId,
        milkingDate: record.milkingDate.split('T')[0],
        shift: record.shift,
        liters: record.liters,
        notes: record.notes ?? '',
      });
    } else {
      setFormData({ ...EMPTY_FORM });
    }
    setError(null);
  }, [record, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.animalId) {
      setError('Selecione o animal.');
      return;
    }
    if (!formData.liters || formData.liters <= 0) {
      setError('Informe a produção em litros.');
      return;
    }
    if (!formData.milkingDate) {
      setError('Informe a data da ordenha.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      notes: formData.notes || null,
    };

    try {
      if (record) {
        await api.patch(`/org/farms/${farmId}/milking-records/${record.id}`, {
          milkingDate: payload.milkingDate,
          shift: payload.shift,
          liters: payload.liters,
          notes: payload.notes,
        });
      } else {
        await api.post(`/org/farms/${farmId}/milking-records`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar registro de ordenha.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="milking-modal__overlay" onClick={onClose}>
      <div
        className="milking-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="milking-modal-title"
      >
        <header className="milking-modal__header">
          <h2 id="milking-modal-title">{record ? 'Editar ordenha' : 'Novo registro de ordenha'}</h2>
          <button
            type="button"
            className="milking-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="milking-modal__form">
          {error && (
            <div className="milking-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          {/* Animal */}
          <div className="milking-modal__field">
            <label htmlFor="mk-animal">Animal *</label>
            <select
              id="mk-animal"
              value={formData.animalId}
              onChange={(e) => setFormData({ ...formData, animalId: e.target.value })}
              required
              aria-required="true"
              disabled={!!record}
            >
              <option value="">Selecione o animal...</option>
              {animals.map((a) => (
                <option key={a.animalId} value={a.animalId}>
                  {a.earTag} — {a.animalName || 'Sem nome'}
                  {a.lotName ? ` (${a.lotName})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date + Shift */}
          <div className="milking-modal__row">
            <div className="milking-modal__field">
              <label htmlFor="mk-date">Data da ordenha *</label>
              <input
                id="mk-date"
                type="date"
                value={formData.milkingDate}
                onChange={(e) => setFormData({ ...formData, milkingDate: e.target.value })}
                required
                aria-required="true"
              />
            </div>
            <div className="milking-modal__field">
              <label htmlFor="mk-shift">Turno *</label>
              <select
                id="mk-shift"
                value={formData.shift}
                onChange={(e) => setFormData({ ...formData, shift: e.target.value })}
                required
                aria-required="true"
              >
                {MILKING_SHIFTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Liters */}
          <div className="milking-modal__field">
            <label htmlFor="mk-liters">Produção (litros) *</label>
            <input
              id="mk-liters"
              type="number"
              min="0.1"
              step="0.1"
              value={formData.liters || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  liters: e.target.value ? Number(e.target.value) : 0,
                })
              }
              required
              aria-required="true"
              className="milking-modal__input-liters"
            />
          </div>

          {/* Notes */}
          <div className="milking-modal__field">
            <label htmlFor="mk-notes">Observações</label>
            <textarea
              id="mk-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
            />
          </div>

          <footer className="milking-modal__footer">
            <button
              type="button"
              className="milking-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="milking-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : record ? 'Salvar alterações' : 'Registrar ordenha'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
