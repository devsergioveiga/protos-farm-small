import { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle } from 'lucide-react';
import { api } from '@/services/api';
import type { BulkDewormInput, BulkDewormResult } from '@/types/deworming';
import { ADMINISTRATION_ROUTES } from '@/types/deworming';
import type { LotListItem } from '@/types/lot';
import { useLots } from '@/hooks/useLots';
import './BulkDewormingModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  farmId: string;
  onSuccess: () => void;
}

const EMPTY_FORM: BulkDewormInput = {
  animalLotId: '',
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
  deductStock: true,
  notes: '',
};

export default function BulkDewormingModal({ isOpen, onClose, farmId, onSuccess }: Props) {
  const [formData, setFormData] = useState<BulkDewormInput>({ ...EMPTY_FORM });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkDewormResult | null>(null);

  const { lots } = useLots({ farmId, limit: 200 });

  useEffect(() => {
    if (!isOpen) return;
    setFormData({ ...EMPTY_FORM });
    setError(null);
    setResult(null);
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.animalLotId) {
      setError('Selecione o lote.');
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
      const res = await api.post<BulkDewormResult>(`/org/farms/${farmId}/dewormings/bulk`, payload);
      setResult(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar vermifugação em lote.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (result) onSuccess();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="bulk-dew-modal__overlay" onClick={handleClose}>
      <div
        className="bulk-dew-modal__dialog"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bulk-dew-modal-title"
      >
        <header className="bulk-dew-modal__header">
          <h2 id="bulk-dew-modal-title">Vermifugação em lote</h2>
          <button
            type="button"
            className="bulk-dew-modal__close"
            onClick={handleClose}
            aria-label="Fechar"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        {result ? (
          <div className="bulk-dew-modal__result">
            <div className="bulk-dew-modal__result-success">
              <CheckCircle size={24} aria-hidden="true" />
              <div>
                <h3>{result.created} vermifugações registradas com sucesso</h3>
                <p>Campanha: {result.campaignId.slice(0, 8)}...</p>
              </div>
            </div>

            {result.rotationAlerts.length > 0 && (
              <div className="bulk-dew-modal__result-rotation">
                <div className="bulk-dew-modal__warning-header">
                  <AlertTriangle size={16} aria-hidden="true" />
                  Alertas de rotação de princípio ativo
                </div>
                <ul>
                  {result.rotationAlerts.map((alert, i) => (
                    <li key={i}>
                      {alert.animalEarTag}: {alert.chemicalGroup} —{' '}
                      {alert.status === 'CRITICAL'
                        ? '3x consecutivo (risco de resistência!)'
                        : 'mesmo grupo repetido'}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.insufficientStockAlerts.length > 0 && (
              <div className="bulk-dew-modal__result-warnings">
                <div className="bulk-dew-modal__warning-header">
                  <AlertTriangle size={16} aria-hidden="true" />
                  Alertas de estoque insuficiente
                </div>
                <ul>
                  {result.insufficientStockAlerts.map((alert, i) => (
                    <li key={i}>
                      {alert.productName}: solicitado {alert.requested} mL, disponível{' '}
                      {alert.available} mL
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <footer className="bulk-dew-modal__footer">
              <button type="button" className="bulk-dew-modal__btn-save" onClick={handleClose}>
                Fechar
              </button>
            </footer>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bulk-dew-modal__form">
            {error && (
              <div className="bulk-dew-modal__error" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                {error}
              </div>
            )}

            <div className="bulk-dew-modal__field">
              <label htmlFor="bulk-dew-lot">Lote *</label>
              <select
                id="bulk-dew-lot"
                value={formData.animalLotId}
                onChange={(e) => setFormData({ ...formData, animalLotId: e.target.value })}
                required
                aria-required="true"
              >
                <option value="">Selecione o lote...</option>
                {lots.map((l: LotListItem) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l._count.animals} animais)
                  </option>
                ))}
              </select>
            </div>

            <div className="bulk-dew-modal__row">
              <div className="bulk-dew-modal__field">
                <label htmlFor="bulk-dew-product">Vermífugo *</label>
                <input
                  id="bulk-dew-product"
                  type="text"
                  value={formData.productName}
                  onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  required
                  aria-required="true"
                  placeholder="Ex: Ivomec Gold"
                />
              </div>
              <div className="bulk-dew-modal__field">
                <label htmlFor="bulk-dew-dosage">Dosagem (mL) *</label>
                <input
                  id="bulk-dew-dosage"
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

            <div className="bulk-dew-modal__row">
              <div className="bulk-dew-modal__field">
                <label htmlFor="bulk-dew-ingredient">Princípio ativo</label>
                <input
                  id="bulk-dew-ingredient"
                  type="text"
                  value={formData.activeIngredient ?? ''}
                  onChange={(e) => setFormData({ ...formData, activeIngredient: e.target.value })}
                  placeholder="Ex: Ivermectina"
                />
              </div>
              <div className="bulk-dew-modal__field">
                <label htmlFor="bulk-dew-group">Grupo químico</label>
                <input
                  id="bulk-dew-group"
                  type="text"
                  value={formData.chemicalGroup ?? ''}
                  onChange={(e) => setFormData({ ...formData, chemicalGroup: e.target.value })}
                  placeholder="Ex: Avermectina"
                />
              </div>
            </div>

            <div className="bulk-dew-modal__row">
              <div className="bulk-dew-modal__field">
                <label htmlFor="bulk-dew-route">Via de aplicação *</label>
                <select
                  id="bulk-dew-route"
                  value={formData.administrationRoute}
                  onChange={(e) =>
                    setFormData({ ...formData, administrationRoute: e.target.value })
                  }
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
              <div className="bulk-dew-modal__field">
                <label htmlFor="bulk-dew-opg">OPG pré-vermifugação</label>
                <input
                  id="bulk-dew-opg"
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

            <div className="bulk-dew-modal__row">
              <div className="bulk-dew-modal__field">
                <label htmlFor="bulk-dew-batch">Lote do produto</label>
                <input
                  id="bulk-dew-batch"
                  type="text"
                  value={formData.productBatchNumber ?? ''}
                  onChange={(e) => setFormData({ ...formData, productBatchNumber: e.target.value })}
                  placeholder="Ex: LOT-2026-01"
                />
              </div>
              <div className="bulk-dew-modal__field">
                <label htmlFor="bulk-dew-expiry">Validade do produto</label>
                <input
                  id="bulk-dew-expiry"
                  type="date"
                  value={formData.productExpiryDate ?? ''}
                  onChange={(e) => setFormData({ ...formData, productExpiryDate: e.target.value })}
                />
              </div>
            </div>

            <div className="bulk-dew-modal__row">
              <div className="bulk-dew-modal__field">
                <label htmlFor="bulk-dew-date">Data da vermifugação *</label>
                <input
                  id="bulk-dew-date"
                  type="date"
                  value={formData.dewormingDate}
                  onChange={(e) => setFormData({ ...formData, dewormingDate: e.target.value })}
                  required
                  aria-required="true"
                />
              </div>
              <div className="bulk-dew-modal__field">
                <label htmlFor="bulk-dew-responsible">Responsável *</label>
                <input
                  id="bulk-dew-responsible"
                  type="text"
                  value={formData.responsibleName}
                  onChange={(e) => setFormData({ ...formData, responsibleName: e.target.value })}
                  required
                  aria-required="true"
                  placeholder="Nome do aplicador"
                />
              </div>
            </div>

            <div className="bulk-dew-modal__field">
              <label htmlFor="bulk-dew-vet">Veterinário</label>
              <input
                id="bulk-dew-vet"
                type="text"
                value={formData.veterinaryName ?? ''}
                onChange={(e) => setFormData({ ...formData, veterinaryName: e.target.value })}
                placeholder="Nome do veterinário (opcional)"
              />
            </div>

            <div className="bulk-dew-modal__field bulk-dew-modal__checkbox">
              <input
                id="bulk-dew-deduct"
                type="checkbox"
                checked={formData.deductStock ?? true}
                onChange={(e) => setFormData({ ...formData, deductStock: e.target.checked })}
              />
              <label htmlFor="bulk-dew-deduct">Deduzir estoque automaticamente</label>
            </div>

            <div className="bulk-dew-modal__field">
              <label htmlFor="bulk-dew-notes">Observações</label>
              <textarea
                id="bulk-dew-notes"
                value={formData.notes ?? ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
              />
            </div>

            <footer className="bulk-dew-modal__footer">
              <button
                type="button"
                className="bulk-dew-modal__btn-cancel"
                onClick={onClose}
                disabled={isLoading}
              >
                Cancelar
              </button>
              <button type="submit" className="bulk-dew-modal__btn-save" disabled={isLoading}>
                {isLoading ? 'Registrando...' : 'Vermifugar lote'}
              </button>
            </footer>
          </form>
        )}
      </div>
    </div>
  );
}
