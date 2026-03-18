import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { SemenBatchItem, CreateSemenBatchInput } from '@/types/bull';
import { SEMEN_ENTRY_TYPES } from '@/types/bull';
import './SemenBatchModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  batch?: SemenBatchItem | null;
  farmId: string;
  bullId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: CreateSemenBatchInput = {
  batchNumber: '',
  centralName: null,
  entryType: 'PURCHASE',
  entryDate: new Date().toISOString().split('T')[0],
  expiryDate: null,
  initialDoses: 0,
  costPerDose: 0,
  notes: null,
};

export default function SemenBatchModal({
  isOpen,
  onClose,
  batch,
  farmId,
  bullId,
  onSuccess,
}: Props) {
  const [formData, setFormData] = useState<CreateSemenBatchInput>({ ...EMPTY_FORM });
  const [costDisplay, setCostDisplay] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (batch) {
      setFormData({
        batchNumber: batch.batchNumber,
        centralName: batch.centralName,
        entryType: batch.entryType,
        entryDate: batch.entryDate.split('T')[0],
        expiryDate: batch.expiryDate ? batch.expiryDate.split('T')[0] : null,
        initialDoses: batch.initialDoses,
        costPerDose: batch.costPerDose,
        notes: batch.notes,
      });
      setCostDisplay((batch.costPerDose / 100).toFixed(2));
    } else {
      setFormData({ ...EMPTY_FORM });
      setCostDisplay('');
    }
    setError(null);
  }, [batch, isOpen]);

  const handleCostChange = (value: string) => {
    setCostDisplay(value);
    const cents = Math.round(Number(value.replace(',', '.')) * 100);
    setFormData((prev) => ({ ...prev, costPerDose: isNaN(cents) ? 0 : cents }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.batchNumber.trim()) {
      setError('Informe o número do lote.');
      return;
    }
    if (!formData.initialDoses || formData.initialDoses <= 0) {
      setError('Informe a quantidade de doses.');
      return;
    }
    if (!formData.entryDate) {
      setError('Informe a data de entrada.');
      return;
    }

    setIsLoading(true);

    const payload = {
      ...formData,
      centralName: formData.centralName || null,
      expiryDate: formData.expiryDate || null,
      notes: formData.notes || null,
    };

    try {
      if (batch) {
        await api.patch(`/org/farms/${farmId}/bulls/semen-batches/${batch.id}`, payload);
      } else {
        await api.post(`/org/farms/${farmId}/bulls/${bullId}/semen-batches`, payload);
      }
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar lote de sêmen.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="semen-batch-modal__overlay" onClick={onClose}>
      <div
        className="semen-batch-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="semen-batch-modal-title"
      >
        <header className="semen-batch-modal__header">
          <h2 id="semen-batch-modal-title">
            {batch ? 'Editar lote de sêmen' : 'Novo lote de sêmen'}
          </h2>
          <button
            type="button"
            className="semen-batch-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <form onSubmit={handleSubmit} className="semen-batch-modal__form">
          {error && (
            <div className="semen-batch-modal__error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="semen-batch-modal__row">
            <div className="semen-batch-modal__field">
              <label htmlFor="sb-batch-number">Número do lote *</label>
              <input
                id="sb-batch-number"
                type="text"
                value={formData.batchNumber}
                onChange={(e) => setFormData({ ...formData, batchNumber: e.target.value })}
                required
                aria-required="true"
                placeholder="Ex: LOT-2026-001"
              />
            </div>
            <div className="semen-batch-modal__field">
              <label htmlFor="sb-central">Central / Fornecedor</label>
              <input
                id="sb-central"
                type="text"
                value={formData.centralName ?? ''}
                onChange={(e) => setFormData({ ...formData, centralName: e.target.value || null })}
                placeholder="Ex: CRV Lagoa"
              />
            </div>
          </div>

          <div className="semen-batch-modal__row">
            <div className="semen-batch-modal__field">
              <label htmlFor="sb-entry-type">Tipo de entrada *</label>
              <select
                id="sb-entry-type"
                value={formData.entryType}
                onChange={(e) => setFormData({ ...formData, entryType: e.target.value })}
                required
                aria-required="true"
              >
                {SEMEN_ENTRY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="semen-batch-modal__field">
              <label htmlFor="sb-entry-date">Data de entrada *</label>
              <input
                id="sb-entry-date"
                type="date"
                value={formData.entryDate}
                onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                required
                aria-required="true"
              />
            </div>
          </div>

          <div className="semen-batch-modal__row">
            <div className="semen-batch-modal__field">
              <label htmlFor="sb-expiry">Validade</label>
              <input
                id="sb-expiry"
                type="date"
                value={formData.expiryDate ?? ''}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value || null })}
              />
            </div>
            <div className="semen-batch-modal__field">
              <label htmlFor="sb-doses">Quantidade de doses *</label>
              <input
                id="sb-doses"
                type="number"
                min="1"
                step="1"
                value={formData.initialDoses || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    initialDoses: e.target.value ? Number(e.target.value) : 0,
                  })
                }
                required
                aria-required="true"
                className="semen-batch-modal__input--mono"
              />
            </div>
          </div>

          <div className="semen-batch-modal__field">
            <label htmlFor="sb-cost">Custo por dose (R$)</label>
            <input
              id="sb-cost"
              type="text"
              inputMode="decimal"
              value={costDisplay}
              onChange={(e) => handleCostChange(e.target.value)}
              placeholder="0,00"
              className="semen-batch-modal__input--mono"
            />
          </div>

          <div className="semen-batch-modal__field">
            <label htmlFor="sb-notes">Observações</label>
            <textarea
              id="sb-notes"
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value || null })}
              rows={2}
            />
          </div>

          <footer className="semen-batch-modal__footer">
            <button
              type="button"
              className="semen-batch-modal__btn-cancel"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button type="submit" className="semen-batch-modal__btn-save" disabled={isLoading}>
              {isLoading ? 'Salvando...' : batch ? 'Salvar alterações' : 'Adicionar lote'}
            </button>
          </footer>
        </form>
      </div>
    </div>
  );
}
